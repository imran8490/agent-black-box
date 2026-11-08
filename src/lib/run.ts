import { runAgent } from "./agent";
import { ZERO_ADDRESS, isValidAddress, normAddr } from "./addr";
import { requireChainConfig, requireMainnetConfig } from "./config";
import { sha256, toHex } from "./hash";
import { appendIndex, cacheLog } from "./store";
import { getAgentAddress, submitDecision } from "./sui";
import { verifyDigest } from "./verify";
import { storeBlob } from "./walrus";
import { memwalEnabled, rememberDecision, rememberFullLog } from "./memory";
import type { DecisionLog, IndexEntry, ScenarioName } from "./types";

export interface RunOptions {
  guard: boolean;
  onProgress?: (message: string) => void;
}

export interface RunResult {
  entry: IndexEntry;
  log: DecisionLog;
}

/**
 * Full pipeline:
 *   agent decides -> log stored on Walrus -> ONE Sui tx (payment + hash commit)
 *   -> read everything back and verify.
 */
export async function runScenario(
  name: ScenarioName,
  opts: RunOptions,
): Promise<RunResult> {
  const say = opts.onProgress ?? (() => {});
  requireMainnetConfig();
  requireChainConfig();

  say("Running the agent…");
  const log = await runAgent(name, { guard: opts.guard, agentAddress: getAgentAddress() });
  await cacheLog(log);

  say("Storing the decision log on Walrus…");
  const text = JSON.stringify(log, null, 2);
  const hash = sha256(new TextEncoder().encode(text));
  const blobId = await storeBlob(text);

  say("Recording on Sui (payment + hash in one transaction)…");
  const proposal = log.proposal;
  const recipient =
    proposal && isValidAddress(proposal.recipient) ? normAddr(proposal.recipient) : ZERO_ADDRESS;
  const amountMist = proposal ? BigInt(proposal.amount_mist) : 0n;
  const flagged = log.guard.flags.length > 0;

  const { digest } = await submitDecision({
    blobId,
    hash,
    outcome: log.outcome,
    recipient,
    amountMist,
    flagged,
  });

  say("Verifying the record from chain + Walrus…");
  let verdict: IndexEntry["verdict"] = "pending";
  let timestamp = Date.now();
  try {
    const v = await verifyDigest(digest);
    verdict = v.verdict;
    if (v.onchain?.timestamp_ms) timestamp = v.onchain.timestamp_ms;
  } catch {
    // Verification is best-effort here; the detail page re-verifies live.
  }

  let memoryBlobId: string | undefined;
  let memorySummaryBlobId: string | undefined;
  if (memwalEnabled()) {
    say("Saving to Walrus Memory (full log + recall summary)…");
    const [full, summary] = await Promise.all([
      rememberFullLog(log, { digest, auditBlobId: blobId }),
      rememberDecision({
        recipient,
        amountSui: Number(amountMist) / 1e9,
        outcome: log.outcome,
        flags: log.guard.flags,
        scenario: name,
        digest,
        auditBlobId: blobId,
        sources: log.trace
          .filter((t) => t.kind === "untrusted" && t.source)
          .map((t) => String(t.source).replace(/\s*\(.*\)\s*$/, "").trim()),
      }),
    ]);
    memoryBlobId = full.blobId ?? undefined;
    memorySummaryBlobId = summary.blobId ?? undefined;
    if (full.error) say(`Walrus Memory full-log save failed (audit record on Walrus + Sui is unaffected): ${full.error}`);
    if (summary.error) say(`Walrus Memory summary save failed: ${summary.error}`);
  }

  const entry: IndexEntry = {
    id: log.id,
    digest,
    blob_id: blobId,
    log_hash: toHex(hash),
    outcome: log.outcome,
    recipient,
    amount_mist: amountMist.toString(),
    flagged,
    flags: log.guard.flags,
    timestamp_ms: timestamp,
    scenario: name,
    agent_mode: log.agent_mode,
    verdict,
    memory_blob_id: memoryBlobId,
    memory_summary_blob_id: memorySummaryBlobId,
  };
  await appendIndex(entry);
  return { entry, log };
}
