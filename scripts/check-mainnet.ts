import "./_env";
// Mainnet preflight. Run: npm run check:mainnet   (spends nothing)
import { cfg } from "../src/lib/config";
import { getClient, getAgentAddress } from "../src/lib/sui";
import { memwalHealth } from "../src/lib/memory";
import { readIndex } from "../src/lib/store";

const MAINNET_CHAIN_ID = "35834a8a";
const MAINNET_GENESIS_DIGEST = "4btiuiMPvEENsttpZC7CZ53DruC3MAgfznDbASZ7DR6S"; // gRPC returns this base58 form of the same chain id
const WAL_TYPE = "0x356a26eb9e012a68958082340d4c4116e7f55615cf27affcff209cf0ae544f59::wal::WAL";
let failures = 0;
const ok = (m: string) => console.log(`  OK    ${m}`);
const warn = (m: string) => console.log(`  WARN  ${m}`);
const bad = (m: string) => { failures++; console.log(`  FAIL  ${m}`); };
const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

async function main() {
  const c = cfg();
  console.log("Config");
  c.network === "mainnet" ? ok("SUI_NETWORK=mainnet") : bad(`SUI_NETWORK=${c.network}`);
  c.tatumKey ? ok(`Tatum key set, RPC ${new URL(c.rpcUrl).host} (${c.rpcMode})`) : bad("TATUM_API_KEY missing");
  c.packageId ? ok(`PACKAGE_ID ${c.packageId.slice(0, 12)}…`) : bad("PACKAGE_ID missing (npm run move:publish)");
  c.privateKey ? ok("SUI_PRIVATE_KEY set") : bad("SUI_PRIVATE_KEY missing");
  c.memwalAccountId && c.memwalKey ? ok(`MemWal credentials set, relayer ${new URL(c.memwalServerUrl).host}`) : bad("MEMWAL_ACCOUNT_ID / MEMWAL_DELEGATE_KEY missing");
  c.simulate ? warn("No live model key: the scripted agent will run (labelled in the UI)") : ok(`Live agent: ${c.provider}/${c.model}, prompt ${c.promptStyle}`);
  if (failures > 0) { console.log("\nFix the config above first."); process.exit(1); }

  console.log("\nChain (through Tatum)");
  const client = getClient();
  try {
    const id = (await client.core.getChainIdentifier()).chainIdentifier;
    (id === MAINNET_CHAIN_ID || id === MAINNET_GENESIS_DIGEST) ? ok(`chain id ${id} = Sui mainnet`) : bad(`chain id ${id}, expected ${MAINNET_CHAIN_ID} (mainnet). Wrong network or endpoint?`);
  } catch (e) { bad(`Tatum RPC call failed: ${msg(e)}`); }
  try {
    const r = (await client.core.getObjects({ objectIds: [c.packageId] })).objects[0];
    r instanceof Error ? bad(`PACKAGE_ID not found on this network: ${r.message}`) : ok("Move package exists on mainnet");
  } catch (e) { bad(`Package lookup failed: ${msg(e)}`); }

  console.log("\nAgent wallet");
  const owner = getAgentAddress();
  ok(`address ${owner}`);
  try {
    const sui = Number((await client.core.getBalance({ owner })).balance.balance) / 1e9;
    sui >= 0.2 ? ok(`${sui.toFixed(3)} SUI`) : warn(`${sui.toFixed(3)} SUI. Fund at least ~0.2 SUI (gas, relay tips, demo payments)`);
    if (sui === 0) bad("No SUI");
    const wal = Number((await client.core.getBalance({ owner, coinType: WAL_TYPE })).balance.balance) / 1e9;
    wal >= 0.1 ? ok(`${wal.toFixed(3)} WAL`) : bad(`${wal.toFixed(3)} WAL. Walrus uploads need WAL: swap some SUI to WAL`);
  } catch (e) { bad(`Balance check failed: ${msg(e)}`); }

  console.log("\nWalrus");
  try {
    const r = await fetch(`${c.walrusAggregator}/v1/api`, { signal: AbortSignal.timeout(15_000) });
    r.status < 500 ? ok(`aggregator reachable (${r.status})`) : bad(`aggregator HTTP ${r.status}`);
  } catch (e) { bad(`aggregator unreachable: ${msg(e)}`); }
  try {
    const h = await memwalHealth();
    ok(`MemWal relayer health: ${JSON.stringify(h)} (proves reachability, not that your key is valid; run npm run check:memwal)`);
  } catch (e) { bad(`MemWal relayer: ${msg(e)}`); }

  console.log("\nHackathon progress (this machine's data/decisions.json)");
  const idx = await readIndex();
  const mem = idx.reduce((n, e) => n + (e.memory_blob_id ? 1 : 0) + (e.memory_summary_blob_id ? 1 : 0), 0);
  console.log(`  decisions recorded: ${idx.length} | memories written to Walrus Memory by runs: ${mem} / 10 required`);
  mem >= 10 ? ok("10-memory requirement met") : warn(`${10 - mem} more memories needed (each run writes 2). check:memwal writes extra test memories that are not counted here.`);

  console.log(failures > 0 ? `\n${failures} problem(s). Fix them before running.` : "\nReady for mainnet.");
  process.exit(failures > 0 ? 1 : 0);
}
main().catch((e) => { console.log("check failed:", msg(e)); process.exit(1); });
