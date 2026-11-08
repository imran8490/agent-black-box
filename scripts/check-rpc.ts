import "./_env";
// Quick connectivity test for the Tatum Sui RPC. Run: npm run check:rpc
// Tries all three modes so you know which SUI_RPC_MODE to use.
import { cfg, tatumEndpoint } from "../src/lib/config";
import { buildSuiClient, type RpcMode } from "../src/lib/sui";

function why(e: unknown): string {
  const parts: string[] = [];
  let cur: unknown = e;
  for (let i = 0; i < 4 && cur instanceof Error; i++) {
    parts.push(cur.message);
    cur = (cur as { cause?: unknown }).cause;
  }
  return parts.join(" <- ");
}

async function main() {
  const c = cfg();
  if (!c.tatumKey) {
    console.log("TATUM_API_KEY is empty. Get a free key at https://dashboard.tatum.io and put it in .env.local");
    process.exit(1);
  }
  const working: RpcMode[] = [];
  for (const mode of ["grpc", "grpcweb", "jsonrpc"] as const) {
    const url = tatumEndpoint(c.network, mode);
    try {
      const client = buildSuiClient({ network: c.network, url, mode, apiKey: c.tatumKey });
      const info = await client.core.getChainIdentifier();
      console.log(`OK    ${mode.padEnd(8)} ${url}  chain=${info.chainIdentifier}`);
      working.push(mode);
    } catch (e) {
      console.log(`FAIL  ${mode.padEnd(8)} ${url}  ${why(e)}`);
    }
  }
  if (working.length === 0) {
    console.log("\nNo Tatum endpoint reachable. Check TATUM_API_KEY (no quotes/spaces) and the network.");
    process.exit(1);
  }
  console.log(`\nUse SUI_RPC_MODE=${working[0]} (currently: ${c.rpcMode}).`);
  process.exit(0);
}
main();
