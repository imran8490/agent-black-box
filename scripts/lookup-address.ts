import "./_env";
// What does Walrus Memory remember about an address? Run: npm run lookup -- 0xADDRESS
// Shows every remembered BlackBox decision for that recipient and whether the guard would treat it as "flagged before".
import { cfg } from "../src/lib/config";
import { memwalEnabled, isBadMemoryFor } from "../src/lib/memory";

async function main() {
  const addr = process.argv[2];
  if (!addr) { console.log("Usage: npm run lookup -- 0xADDRESS"); process.exit(1); }
  if (!memwalEnabled()) { console.log("MEMWAL_ACCOUNT_ID / MEMWAL_DELEGATE_KEY missing in .env"); process.exit(1); }
  const c = cfg();
  const { MemWal } = await import("@mysten-incubation/memwal");
  const mem = MemWal.create({ key: c.memwalKey, accountId: c.memwalAccountId, serverUrl: c.memwalServerUrl, namespace: c.memwalNamespace, preflightTimeoutMs: 25_000 });
  const res = await mem.recall({ query: `BlackBox decision | recipient=${addr.toLowerCase()}`, limit: 30, timeoutMs: 25_000 });
  const rows = res.results.filter((r: { text: string }) => r.text.toLowerCase().includes(addr.toLowerCase().replace(/^0x/, "")));
  console.log(`Namespace ${c.memwalNamespace}: ${rows.length} remembered line(s) mention ${addr}\n`);
  for (const r of rows as { text: string; blob_id: string }[]) {
    const bad = isBadMemoryFor(r.text, addr);
    console.log(`${bad ? "FLAGS THE ADDRESS" : "does not flag    "} | ${r.text.slice(0, 260)}\n   memory blob: ${r.blob_id}\n`);
  }
  console.log(rows.length === 0 ? "Nothing remembered for this address (guard shows: no earlier incident)." : "Guard flags the address only if a line says FLAGS THE ADDRESS.");
  process.exit(0);
}
main();
