import "./_env";
// Walrus Memory round trip: health, remember a test line, recall it. Run: npm run check:memwal
import { cfg } from "../src/lib/config";
import { memwalEnabled, memwalHealth, rememberDecision, recallBadHistory, rememberFullLog } from "../src/lib/memory";
import { runAgent } from "../src/lib/agent";

async function main() {
  const c = cfg();
  if (!memwalEnabled()) {
    console.log("Set MEMWAL_ACCOUNT_ID and MEMWAL_DELEGATE_KEY in .env.local first.");
    process.exit(1);
  }
  console.log(`Relayer: ${c.memwalServerUrl} | namespace: ${c.memwalNamespace}`);
  try {
    const h = await memwalHealth();
    console.log("health:", JSON.stringify(h), "(only proves the relayer is reachable, not that your key works)");
  } catch (e) {
    console.log("health FAILED:", e instanceof Error ? e.message : e);
    process.exit(1);
  }
  const test = "0x" + "c0de".repeat(16);
  const r = await rememberDecision({
    recipient: test, amountSui: 0.01, outcome: "blocked", flags: ["recipient_only_in_untrusted_input"],
    scenario: "attack", digest: "CHECK_ONLY_NOT_A_REAL_TX", auditBlobId: "CHECK_ONLY",
  });
  if (!r.blobId) { console.log("remember FAILED:", r.error); process.exit(1); }
  console.log("remember OK, memory blob:", r.blobId);
  const q = await recallBadHistory(test);
  console.log(q.error ? `recall FAILED: ${q.error}` : `recall OK, matches: ${q.hits.length}`);
  if (!q.error && q.hits.length === 0) console.log("0 matches can be indexing delay. Wait ~10s and run again.");

  // The full decision log is a much bigger memory than the one-line summary. Make sure the relayer accepts one.
  const log = await runAgent("attack", { guard: true, agentAddress: "0x0" });
  const full = await rememberFullLog(log, { digest: "CHECK_ONLY_NOT_A_REAL_TX", auditBlobId: "CHECK_ONLY" });
  console.log(full.blobId ? `full-log remember OK, memory blob: ${full.blobId}` : `full-log remember FAILED: ${full.error}`);
  process.exit(q.error || !full.blobId ? 1 : 0);
}
main();
