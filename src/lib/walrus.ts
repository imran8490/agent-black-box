import { cfg } from "./config";
import { buildSuiClient, getClient, getKeypair } from "./sui";

/**
 * Store text on Walrus mainnet. Returns the blob id.
 * The bytes stored are exactly the UTF-8 bytes of `text`, so sha256(utf8(text))
 * can later be compared against what we read back.
 *
 * Uses @mysten/walrus + the Walrus upload relay (Walrus has no public publisher on mainnet).
 * The agent wallet pays storage in WAL and the relay tip in SUI.
 */
export async function storeBlob(text: string): Promise<string> {
  return storeViaSdk(text);
}

type WalrusClient = Awaited<ReturnType<typeof makeWalrusClient>>;
let _walrus: WalrusClient | null = null;

// Imported lazily so pages that only READ (verify, decision detail) never load the Walrus SDK + wasm.
async function makeWalrusClient() {
  const c = cfg();
  const { walrus } = await import("@mysten/walrus");
  // The Walrus SDK is very chatty (committee, system state, dozens of object reads per upload) and a free
  // Tatum key answers that with HTTP 429. So the SDK's internal reads use a public fullnode by default;
  // the payment + record_decision transaction and all verification reads still go through Tatum.
  // Set WALRUS_VIA_TATUM=1 to push the Walrus SDK through Tatum too (needs a paid/high-rate key).
  const sui =
    process.env.WALRUS_VIA_TATUM === "1"
      ? getClient()
      : buildSuiClient({
          network: c.network,
          url: process.env.WALRUS_SUI_RPC_URL || "https://fullnode.mainnet.sui.io:443",
          mode: "grpcweb",
        });
  return sui.$extend(
    walrus({
      uploadRelay: {
        host: c.walrusUploadRelay,
        sendTip: { max: c.walrusRelayMaxTipMist },
      },
    }),
  );
}

async function storeViaSdk(text: string): Promise<string> {
  const c = cfg();
  _walrus ??= await makeWalrusClient();
  try {
    const { blobId } = await _walrus.walrus.writeBlob({
      blob: new TextEncoder().encode(text),
      deletable: false, // an audit log must not be deletable
      epochs: c.walrusEpochs,
      signer: getKeypair(),
    });
    return blobId;
  } catch (e) {
    const detail = describeError(e);
    const rateLimited = /\b429\b|rate.?limit|too many requests|RESOURCE_EXHAUSTED/i.test(detail);
    const protocol = /content type|application\/grpc|grpc-web|HTTP\/2|http2/i.test(detail);
    const network = /fetch failed|ECONN|ENOTFOUND|ETIMEDOUT|EAI_AGAIN|UND_ERR|timeout/i.test(detail);
    throw new Error(
      `Walrus upload failed: ${detail}. ` +
        (rateLimited
          ? `This is a RATE LIMIT (HTTP 429), not a balance problem. Wait ~30s and retry. If it persists: leave WALRUS_VIA_TATUM unset (Walrus then uses a public fullnode) or upgrade the Tatum plan.`
          : protocol
          ? `This is an RPC PROTOCOL mismatch with the Tatum endpoint. Set SUI_RPC_MODE=grpc (native gRPC, default) or SUI_RPC_MODE=jsonrpc in .env.local, then run "npm run check:rpc" to see which modes your key can reach.`
          : network
          ? `This is a NETWORK problem (cannot reach Tatum RPC, the Walrus upload relay or a storage node), not a balance problem. ` +
            `Run "npm run check:mainnet" to see which host fails. In WSL try: export NODE_OPTIONS="--dns-result-order=ipv4first"`
          : `If this mentions coins or gas: the agent wallet needs SUI (gas + relay tip) and WAL (storage).`),
    );
  }
}

/** Node's "fetch failed" hides the real reason in error.cause (code + host). Walk the chain. */
function describeError(e: unknown): string {
  const parts: string[] = [];
  let cur: unknown = e;
  for (let i = 0; i < 5 && cur; i++) {
    if (cur instanceof Error) {
      const code = (cur as { code?: string }).code;
      parts.push([cur.name !== "Error" ? cur.name : "", code ?? "", cur.message].filter(Boolean).join(" "));
      cur = (cur as { cause?: unknown }).cause;
    } else {
      parts.push(String(cur));
      break;
    }
  }
  return parts.join(" <- ");
}

/** Read raw bytes of a blob from a Walrus aggregator (public on mainnet and testnet). */
export async function readBlob(blobId: string): Promise<Uint8Array> {
  const c = cfg();
  const res = await fetch(`${c.walrusAggregator}/v1/blobs/${encodeURIComponent(blobId)}`, {
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) {
    throw new Error(`Walrus read failed (${res.status}) for blob ${blobId}`);
  }
  return new Uint8Array(await res.arrayBuffer());
}

export function blobUrl(blobId: string): string {
  return `${cfg().walrusAggregator}/v1/blobs/${blobId}`;
}
