// Client-safe types (no Node imports) shared by the agent, API routes and UI.

export type ScenarioName = "normal" | "attack";

export type TraceKind =
  | "user" // trusted instruction from the human
  | "untrusted" // content the agent read from the outside world
  | "thought" // model text produced before acting
  | "tool_call"
  | "tool_result"
  | "guard" // Black Box policy decision
  | "final"; // model's closing message

export interface TraceStep {
  at: string; // ISO timestamp
  kind: TraceKind;
  title: string;
  text: string;
  source?: string; // for untrusted content: where it came from
}

export interface Proposal {
  recipient: string;
  amount_sui: number;
  amount_mist: string; // bigint as string
  reason: string;
}

export interface GuardResult {
  enabled: boolean;
  allowed: boolean;
  flags: string[];
}

export type Outcome = "transfer" | "blocked" | "no_action";

/** The exact JSON stored on Walrus. Its SHA-256 is committed on Sui. */
export interface DecisionLog {
  version: 1;
  id: string;
  created_at: string;
  scenario: ScenarioName;
  agent_mode: "live" | "simulated";
  prompt_style?: "standard" | "naive";
  model: string;
  agent_address: string;
  trusted_instruction: string;
  trace: TraceStep[];
  proposal: Proposal | null;
  guard: GuardResult;
  outcome: Outcome;
}

export type Verdict = "verified" | "pending" | "mismatch";

/** Local index row used by the Live Feed. The chain + Walrus remain the source of truth. */
export interface IndexEntry {
  id: string;
  digest: string;
  blob_id: string;
  log_hash: string; // hex
  outcome: Outcome;
  recipient: string;
  amount_mist: string;
  flagged: boolean;
  flags: string[];
  timestamp_ms: number;
  scenario: ScenarioName;
  agent_mode: "live" | "simulated";
  verdict: Verdict;
  memory_blob_id?: string; // Walrus Memory blob with the full decision log
  memory_summary_blob_id?: string; // Walrus Memory blob with the one-line recall summary
}

export interface OnchainRecord {
  log_id?: string;
  agent: string;
  walrus_blob_id: string;
  log_hash: string; // hex
  action: string;
  recipient: string;
  amount_mist: string;
  risk_flagged: boolean;
  timestamp_ms: number;
}

export interface VerifyResult {
  digest: string;
  verdict: Verdict;
  reasons: string[]; // human-readable explanation of the verdict
  onchain?: OnchainRecord;
  computed_hash?: string; // sha256 of bytes fetched from Walrus
  log?: DecisionLog;
  log_source?: "walrus" | "local-cache";
}
