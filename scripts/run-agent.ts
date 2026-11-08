import "./_env";
// CLI: npm run agent -- --scenario both --no-guard
import { runScenario } from "../src/lib/run";
import { cfg } from "../src/lib/config";
import { formatSui, suiscanTx, walrusBlobUrl } from "../src/lib/links";
import { attackerAddress } from "../src/lib/scenarios";
import type { ScenarioName } from "../src/lib/types";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const which = arg("scenario") ?? "both";
  const guard = !process.argv.includes("--no-guard");
  const names: ScenarioName[] = which === "both" ? ["normal", "attack"] : [which as ScenarioName];

  console.log(`Agent mode: ${cfg().simulate ? "simulated (no ANTHROPIC_API_KEY / GEMINI_API_KEY / OPENAI_API_KEY)" : `live (${cfg().provider}: ${cfg().model})`}  |  guard: ${guard ? "ON" : "OFF"}\n`);

  for (const name of names) {
    console.log(`=== ${name.toUpperCase()} ===`);
    const { entry, log } = await runScenario(name, {
      guard,
      onProgress: (m) => console.log(`  - ${m}`),
    });
    console.log(`  outcome   : ${entry.outcome}${entry.flagged ? "  (flagged)" : ""}`);
    if (entry.flags.length) console.log(`  flags     : ${entry.flags.join(", ")}`);
    console.log(`  amount    : ${formatSui(entry.amount_mist)} -> ${entry.recipient === attackerAddress() ? "ATTACKER " : ""}${entry.recipient}`);
    console.log(`  verified  : ${entry.verdict}`);
    console.log(`  sui tx    : ${suiscanTx(entry.digest)}`);
    console.log(`  walrus    : ${walrusBlobUrl(entry.blob_id)}`);
    console.log(`  trace     : ${log.trace.length} steps\n`);
  }
}

main().catch((e) => {
  console.error("\nFailed:", e instanceof Error ? e.message : e);
  process.exit(1);
});
