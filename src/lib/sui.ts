import { SuiGrpcClient } from "@mysten/sui/grpc";
import { GrpcTransport } from "@protobuf-ts/grpc-transport";
import { ChannelCredentials } from "@grpc/grpc-js";
import { JsonRpcHTTPTransport, SuiJsonRpcClient } from "@mysten/sui/jsonRpc";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { Transaction } from "@mysten/sui/transactions";
import { bcs } from "@mysten/sui/bcs";
import { cfg, requireChainConfig } from "./config";
import { bytesLikeToHex } from "./hash";
import { sameAddr } from "./addr";
import type { OnchainRecord, Outcome } from "./types";

type AnyRec = Record<string, unknown>;

let _client: SuiGrpcClient | null = null;

export type RpcMode = "grpc" | "grpcweb" | "jsonrpc";

/**
 * Build a Sui client for one RPC mode.
 *  - "grpc"    native gRPC over HTTP/2 (what Tatum's *-grpc.gateway.tatum.io speaks). Default.
 *  - "grpcweb" gRPC-web over fetch (what the SDK uses by default; public fullnodes speak it, Tatum does not).
 *  - "jsonrpc" Tatum's JSON-RPC gateway.
 * The API key is sent as the `x-api-key` header / gRPC metadata.
 */
export function buildSuiClient(o: { network: string; url: string; mode: RpcMode; apiKey?: string }): SuiGrpcClient {
  const network = o.network as "testnet";
  const headers = o.apiKey ? { "x-api-key": o.apiKey } : undefined;
  if (o.mode === "jsonrpc") {
    // Same core client API as gRPC; cast keeps the call sites below single-typed.
    return new SuiJsonRpcClient({
      network,
      transport: new JsonRpcHTTPTransport({ url: o.url, rpc: { headers } }),
    }) as unknown as SuiGrpcClient;
  }
  if (o.mode === "grpcweb") {
    return new SuiGrpcClient({ network, baseUrl: o.url, meta: headers });
  }
  const u = new URL(o.url);
  const secure = u.protocol === "https:";
  const transport = new GrpcTransport({
    host: u.port ? u.host : `${u.hostname}:${secure ? 443 : 80}`,
    channelCredentials: secure ? ChannelCredentials.createSsl() : ChannelCredentials.createInsecure(),
    meta: headers,
  });
  return new SuiGrpcClient({ network, transport });
}

/**
 * Sui RPC client used by the whole app. When TATUM_API_KEY is set, all chain reads and writes
 * go through Tatum's Sui gateway (mode from SUI_RPC_MODE, default native gRPC).
 */
export function getClient(): SuiGrpcClient {
  if (!_client) {
    const c = cfg();
    _client = buildSuiClient({ network: c.network, url: c.rpcUrl, mode: c.rpcMode, apiKey: c.tatumKey });
  }
  return _client;
}

export function getKeypair(): Ed25519Keypair {
  const c = requireChainConfig();
  return Ed25519Keypair.fromSecretKey(c.privateKey);
}

export function getAgentAddress(): string {
  return getKeypair().toSuiAddress();
}

export interface SubmitParams {
  blobId: string;
  hash: Uint8Array; // 32 bytes
  outcome: Outcome;
  recipient: string; // valid 0x address (use ZERO_ADDRESS for no_action)
  amountMist: bigint;
  flagged: boolean;
}

/**
 * One atomic programmable transaction:
 *   1. (if outcome === "transfer") split SUI from gas and pay the recipient
 *   2. black_box::record_decision(blob id, sha256, ...)
 * Either both happen or neither does.
 */
/**
 * Free Tatum keys answer bursts with HTTP 429 ("Received HTTP status code 429"). A 429 means the request was
 * rejected before it was processed, so retrying is safe (no double spend). Back off 3s, 6s, 12s, 24s.
 */
export async function retryRateLimit<T>(fn: () => Promise<T>, tries = 5): Promise<T> {
  let last: unknown;
  for (let i = 0; i < tries; i++) {
    try {
      return await fn();
    } catch (e) {
      last = e;
      const msg = [e, (e as { cause?: unknown })?.cause].map((x) => (x instanceof Error ? x.message : String(x ?? ""))).join(" ");
      if (!/\b429\b|RESOURCE_EXHAUSTED|too many requests|rate.?limit/i.test(msg)) throw e;
      if (i < tries - 1) await new Promise((r) => setTimeout(r, 3000 * 2 ** i));
    }
  }
  throw new Error(`Tatum RPC rate limit (HTTP 429) persisted after ${tries} tries. Wait a minute, or check your Tatum plan/usage at dashboard.tatum.io. ${last instanceof Error ? last.message : ""}`);
}

export async function submitDecision(p: SubmitParams): Promise<{ digest: string }> {
  const c = requireChainConfig();
  const client = getClient();
  const keypair = getKeypair();

  const tx = new Transaction();

  if (p.outcome === "transfer" && p.amountMist > 0n) {
    const [coin] = tx.splitCoins(tx.gas, [tx.pure.u64(p.amountMist)]);
    tx.transferObjects([coin], tx.pure.address(p.recipient));
  }

  tx.moveCall({
    target: `${c.packageId}::black_box::record_decision`,
    arguments: [
      tx.pure.string(p.blobId),
      tx.pure.vector("u8", Array.from(p.hash)),
      tx.pure.string(p.outcome),
      tx.pure.address(p.recipient),
      tx.pure.u64(p.amountMist),
      tx.pure.bool(p.flagged),
      tx.object("0x6"), // shared Clock object
    ],
  });

  const result = (await retryRateLimit(() =>
    client.signAndExecuteTransaction({
      transaction: tx,
      signer: keypair,
      include: { effects: true },
    }),
  )) as unknown as AnyRec;

  const executed = (result.Transaction ?? result.FailedTransaction) as AnyRec | undefined;
  const status = executed?.status as AnyRec | undefined;
  if (!executed || !status?.success) {
    throw new Error(`Sui transaction failed: ${JSON.stringify(status ?? result).slice(0, 400)}`);
  }

  await retryRateLimit(() => client.waitForTransaction({ result: result as never }));
  return { digest: String(executed.digest) };
}

// ---- Reading the on-chain record back --------------------------------------

const DecisionRecordedBcs = bcs.struct("DecisionRecorded", {
  log_id: bcs.Address,
  agent: bcs.Address,
  walrus_blob_id: bcs.string(),
  log_hash: bcs.vector(bcs.u8()),
  action: bcs.string(),
  recipient: bcs.Address,
  amount_mist: bcs.u64(),
  risk_flagged: bcs.bool(),
  timestamp_ms: bcs.u64(),
});

function recordFromJson(j: AnyRec): OnchainRecord {
  return {
    log_id: typeof j.log_id === "string" ? j.log_id : undefined,
    agent: String(j.agent),
    walrus_blob_id: String(j.walrus_blob_id),
    log_hash: bytesLikeToHex(j.log_hash),
    action: String(j.action),
    recipient: String(j.recipient),
    amount_mist: String(j.amount_mist),
    risk_flagged: Boolean(j.risk_flagged),
    timestamp_ms: Number(j.timestamp_ms),
  };
}

/**
 * Find the black_box::DecisionRecorded event emitted by a transaction.
 * Returns null when the transaction has no such event.
 * Throws if the event was emitted by a package other than PACKAGE_ID
 * (anyone can publish a lookalike package, so we pin ours).
 */
export async function fetchRecordedEvent(digest: string): Promise<OnchainRecord | null> {
  const c = cfg();
  const res = (await retryRateLimit(() =>
    getClient().getTransaction({
      digest,
      include: { events: true },
    }),
  )) as unknown as AnyRec;

  const tx = (res.Transaction ?? res.FailedTransaction ?? res) as AnyRec;
  const events = (tx.events ?? []) as AnyRec[];

  const ev = events.find((e) =>
    String(e.eventType ?? e.type ?? "").endsWith("::black_box::DecisionRecorded"),
  );
  if (!ev) return null;

  const evType = String(ev.eventType ?? ev.type ?? "");
  const pkg = evType.split("::")[0];
  if (c.packageId && !sameAddr(pkg, c.packageId)) {
    throw new Error(
      `Event was emitted by package ${pkg}, not the expected PACKAGE_ID. Possible lookalike contract.`,
    );
  }

  const json = (ev.json ?? ev.parsedJson) as AnyRec | undefined;
  if (json && typeof json === "object" && "walrus_blob_id" in json) {
    return recordFromJson(json);
  }

  // Fall back to decoding the raw BCS payload.
  const raw = ev.bcs as unknown;
  const bytes =
    raw instanceof Uint8Array
      ? raw
      : typeof raw === "string"
        ? Uint8Array.from(Buffer.from(raw, "base64"))
        : null;
  if (!bytes) return null;

  const parsed = DecisionRecordedBcs.parse(bytes) as unknown as AnyRec;
  return recordFromJson(parsed);
}
