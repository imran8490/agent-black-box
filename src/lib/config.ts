// Server-side configuration. Read lazily so env files are loaded first.

type Net = "mainnet" | "testnet" | "devnet";

/** Tatum Sui gateways. gRPC and JSON-RPC are separate hosts; both take the key as `x-api-key`. */
export function tatumEndpoint(network: string, mode: "grpc" | "grpcweb" | "jsonrpc"): string {
  const n = network as Net;
  return mode === "grpc" || mode === "grpcweb"
    ? `https://sui-${n}-grpc.gateway.tatum.io`
    : `https://sui-${n}.gateway.tatum.io`;
}

export function cfg() {
  const apiKey = process.env.ANTHROPIC_API_KEY ?? "";
  const geminiKey = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY ?? "";
  // Provider: AGENT_PROVIDER=anthropic|gemini|scripted, otherwise whichever key is present.
  // OpenAI-compatible gateways (OpenRouter, LiteLLM, Bluesminds, ...): OPENAI_BASE_URL + OPENAI_API_KEY + OPENAI_MODEL.
  const openaiKey = process.env.OPENAI_API_KEY ?? "";
  const openaiBase = (process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1").replace(/\/+$/, "");
  const forced = process.env.AGENT_PROVIDER;
  const provider: "anthropic" | "gemini" | "openai" | "scripted" =
    process.env.SIMULATE_AGENT === "1" || forced === "scripted"
      ? "scripted"
      : forced === "openai"
        ? openaiKey ? "openai" : "scripted"
        : forced === "gemini" || (forced !== "anthropic" && !apiKey && geminiKey)
          ? geminiKey ? "gemini" : "scripted"
          : apiKey ? "anthropic" : forced !== "anthropic" && openaiKey ? "openai" : "scripted";
  const network = process.env.SUI_NETWORK ?? "mainnet";
  const isMainnet = network === "mainnet";
  const tatumKey = process.env.TATUM_API_KEY ?? "";
  const rpcMode: "grpc" | "grpcweb" | "jsonrpc" =
    process.env.SUI_RPC_MODE === "jsonrpc" ? "jsonrpc" : process.env.SUI_RPC_MODE === "grpcweb" ? "grpcweb" : "grpc";
  return {
    network,
    // Tatum is the default RPC provider whenever TATUM_API_KEY is set.
    tatumKey,
    rpcMode,
    rpcUrl:
      process.env.SUI_RPC_URL ||
      (tatumKey
        ? tatumEndpoint(network, rpcMode)
        : `https://fullnode.${network}.sui.io:443`),
    packageId: process.env.PACKAGE_ID ?? "",
    privateKey: process.env.SUI_PRIVATE_KEY ?? "",
    walrusAggregator:
      process.env.WALRUS_AGGREGATOR_URL ??
      `https://aggregator.walrus-${isMainnet ? "mainnet" : "testnet"}.walrus.space`,
    walrusUploadRelay:
      process.env.WALRUS_UPLOAD_RELAY_URL ??
      `https://upload-relay.${isMainnet ? "mainnet" : "testnet"}.walrus.space`,
    // Highest tip (in MIST) we allow the upload relay to charge per upload.
    walrusRelayMaxTipMist: Number(process.env.WALRUS_RELAY_MAX_TIP_MIST ?? 5_000_000),
    walrusEpochs: Number(process.env.WALRUS_EPOCHS ?? 5),
    provider,
    // Walrus Memory (MemWal). Optional; enabled only when both id and key are set.
    memwalAccountId: process.env.MEMWAL_ACCOUNT_ID ?? "",
    memwalKey: process.env.MEMWAL_DELEGATE_KEY ?? "",
    memwalServerUrl:
      process.env.MEMWAL_SERVER_URL ??
      (isMainnet ? "https://relayer.memory.walrus.xyz" : "https://relayer.dev.memwal.ai"),
    memwalNamespace: process.env.MEMWAL_NAMESPACE ?? "black-box",
    promptStyle: (process.env.AGENT_PROMPT === "naive" ? "naive" : "standard") as "standard" | "naive",
    anthropicKey: apiKey,
    geminiKey,
    geminiFallbackModel: process.env.GEMINI_FALLBACK_MODEL ?? "",
    openaiKey,
    openaiBase,
    model:
      provider === "gemini"
        ? process.env.GEMINI_MODEL ?? "gemini-3.8-flash"
        : provider === "openai"
          ? process.env.OPENAI_MODEL ?? "gpt-4o-mini"
          : process.env.ANTHROPIC_MODEL ?? "claude-sonnet-5-5",
    simulate: provider === "scripted",
    maxPaymentSui: Number(process.env.MAX_PAYMENT_SUI ?? 0.02),
    // Amount the hijacked invoice tries to steal. Real money on mainnet, so keep it small.
    attackAmountSui: Number(process.env.ATTACK_AMOUNT_SUI ?? (isMainnet ? 0.05 : 0.5)),
    demoRunEnabled: (process.env.DEMO_RUN_ENABLED ?? "false") === "true",
  };
}

/**
 * Hackathon-grade mainnet guardrails, checked before any run that spends money or writes memories:
 * mainnet network, Tatum RPC key, and Walrus Memory credentials. Escape hatches exist for development
 * (ALLOW_NON_MAINNET=1, MEMWAL_OPTIONAL=1) but are off by default.
 */
export function requireMainnetConfig() {
  const c = cfg();
  const problems: string[] = [];
  if (c.network !== "mainnet" && process.env.ALLOW_NON_MAINNET !== "1") {
    problems.push(`SUI_NETWORK is "${c.network}", expected "mainnet" (set ALLOW_NON_MAINNET=1 only for development)`);
  }
  if (!c.tatumKey) problems.push("TATUM_API_KEY (Sui RPC must go through Tatum)");
  if (process.env.MEMWAL_OPTIONAL !== "1") {
    if (!c.memwalAccountId) problems.push("MEMWAL_ACCOUNT_ID (decisions must be written to Walrus Memory)");
    if (!c.memwalKey) problems.push("MEMWAL_DELEGATE_KEY (decisions must be written to Walrus Memory)");
  }
  if (problems.length > 0) {
    throw new Error(`Not ready for mainnet. Missing or wrong in .env.local:\n - ${problems.join("\n - ")}`);
  }
}

export function requireChainConfig() {
  const c = cfg();
  const missing: string[] = [];
  if (!c.packageId) missing.push("PACKAGE_ID");
  if (!c.privateKey) missing.push("SUI_PRIVATE_KEY");
  if (missing.length > 0) {
    throw new Error(
      `Missing ${missing.join(", ")} in .env.local. See README step 4.`,
    );
  }
  return c;
}
