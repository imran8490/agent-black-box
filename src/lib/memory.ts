import { cfg } from "./config";
import { normAddr } from "./addr";
import type { DecisionLog } from "./types";

/**
 * Walrus Memory (MemWal) integration. OPTIONAL: it switches on only when MEMWAL_ACCOUNT_ID and
 * MEMWAL_DELEGATE_KEY are set. Without them nothing here runs and the app behaves exactly as before.
 *
 * What it does:
 *  - after every recorded decision, the agent REMEMBERS a one-line summary (recipient, outcome, flags,
 *    Sui tx digest, Walrus audit blob id) in the "black-box" namespace;
 *  - before a payment is approved, the agent RECALLS earlier decisions about that recipient. If the same
 *    address was blocked or flagged before, the guard adds the flag `recipient_flagged_before`.
 *
 * Safety design: memory can only ever ADD a flag (block more). A poisoned or wrong memory can cause a
 * false block, never an approval. The audit log (Walrus blob + Sui hash) stays the source of truth;
 * recall is semantic search, so a miss is possible and this signal is advisory, not a replacement for
 * the provenance check.
 */

export const memwalEnabled = () => {
  const c = cfg();
  return Boolean(c.memwalAccountId && c.memwalKey);
};

// Minimal surface we use, so tests can inject a fake.
export interface MemClient {
  rememberAndWait(text: string, opts?: { timeoutMs?: number }): Promise<{ blob_id: string }>;
  recall(p: { query: string; limit?: number; timeoutMs?: number }): Promise<{ results: { text: string; blob_id: string }[] }>;
  health(): Promise<{ status: string }>;
}

let _client: MemClient | null = null;
export function setMemClientForTests(c: MemClient | null) {
  _client = c;
}

async function client(): Promise<MemClient> {
  if (_client) return _client;
  const c = cfg();
  const { MemWal } = await import("@mysten-incubation/memwal");
  _client = MemWal.create({
    key: c.memwalKey,
    accountId: c.memwalAccountId,
    serverUrl: c.memwalServerUrl,
    namespace: c.memwalNamespace,
    // The mainnet relayer is sometimes slow to answer its /version preflight; the 5s default made the
    // guard report "Walrus Memory check unavailable". Give it room (still fails safe if it never answers).
    preflightTimeoutMs: 25_000,
  }) as unknown as MemClient;
  return _client;
}

export interface DecisionMemory {
  recipient: string;
  amountSui: number;
  outcome: string;
  flags: string[];
  scenario: string;
  digest: string;
  auditBlobId: string;
  /** URLs of the untrusted pages the agent read in this run (lets later runs recognise a known-bad page). */
  sources?: string[];
}

const PREFIX = "BlackBox decision";

export function formatMemory(d: DecisionMemory): string {
  return [
    PREFIX,
    `recipient=${normAddr(d.recipient)}`,
    `amount_sui=${d.amountSui}`,
    `outcome=${d.outcome}`,
    `flagged=${d.flags.length > 0 ? "yes" : "no"}`,
    `flags=${d.flags.join(",") || "none"}`,
    `sources=${(d.sources ?? []).join(" ") || "none"}`,
    `scenario=${d.scenario}`,
    `tx=${d.digest}`,
    `audit_blob=${d.auditBlobId}`,
  ].join(" | ");
}

const FULL_PREFIX = "BlackBox full log";
const MAX_STEP_CHARS = 3000;

/**
 * Compact copy of the whole decision log for Walrus Memory: same trace, but long step text is
 * whitespace-collapsed and capped so one memory stays a sane size. The byte-exact, hash-committed
 * original is the plain Walrus audit blob; this copy is for agent memory and recall.
 */
export function formatFullLogMemory(log: DecisionLog, ids: { digest: string; auditBlobId: string }): string {
  const squash = (s: string) => {
    const t = s.replace(/\s+/g, " ").trim();
    return t.length > MAX_STEP_CHARS ? t.slice(0, MAX_STEP_CHARS) + " …[truncated]" : t;
  };
  const compact = {
    id: log.id,
    created_at: log.created_at,
    scenario: log.scenario,
    model: log.model,
    prompt_style: log.prompt_style,
    outcome: log.outcome,
    proposal: log.proposal,
    guard: log.guard,
    trace: log.trace.map((t) => ({ kind: t.kind, title: t.title, text: squash(t.text) })),
  };
  return `${FULL_PREFIX} | log_id=${log.id} | tx=${ids.digest} | audit_blob=${ids.auditBlobId} | ${JSON.stringify(compact)}`;
}

/** Store the full decision log in Walrus Memory. Returns the memory blob id, or null on failure. */
export async function rememberFullLog(
  log: DecisionLog,
  ids: { digest: string; auditBlobId: string },
): Promise<{ blobId: string | null; error?: string }> {
  if (!memwalEnabled()) return { blobId: null };
  try {
    const r = await (await client()).rememberAndWait(formatFullLogMemory(log, ids), { timeoutMs: 60_000 });
    return { blobId: r.blob_id };
  } catch (e) {
    return { blobId: null, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Pure: does a remembered line say this recipient was blocked or flagged? */
export function isBadMemoryFor(text: string, recipient: string): boolean {
  const t = text.toLowerCase();
  if (!t.startsWith(PREFIX.toLowerCase())) return false;
  if (!t.includes(`recipient=${normAddr(recipient)}`)) return false;
  // Only an earlier decision where the RECIPIENT ITSELF was the problem counts (it appeared only in
  // untrusted content, i.e. it was the injected address). A payment held because the page contained
  // injection phrases, while the recipient matched the user's own instruction, must NOT taint that
  // recipient: otherwise one hijacked page would poison the honest vendor's address forever.
  // Older lines without a flags= field fall back to the old rule.
  const m = t.match(/\| flags=([^|]*)/);
  if (!m) return t.includes("outcome=blocked") || t.includes("flagged=yes");
  return m[1].split(",").map((x) => x.trim()).includes("recipient_only_in_untrusted_input");
}

/**
 * Pure: did an earlier decision hold a payment because THIS PAGE carried an attack?
 * True when the remembered line lists the url under sources= and its flags show injection text or an
 * injected recipient. Older lines without sources= never match.
 */
export function isBadMemoryForSource(text: string, url: string): boolean {
  const t = text.toLowerCase();
  if (!t.startsWith(PREFIX.toLowerCase())) return false;
  const src = t.match(/\| sources=([^|]*)/);
  if (!src || !src[1].trim().split(/\s+/).includes(url.trim().toLowerCase())) return false;
  const fl = t.match(/\| flags=([^|]*)/);
  const flags = fl ? fl[1].split(",").map((x) => x.trim()) : [];
  return flags.includes("injection_pattern_in_untrusted_input") || flags.includes("recipient_only_in_untrusted_input") || flags.includes("source_flagged_before");
}

/** Store one decision. Returns the Walrus blob id of the memory, or null if it could not be saved. */
export async function rememberDecision(d: DecisionMemory): Promise<{ blobId: string | null; error?: string }> {
  if (!memwalEnabled()) return { blobId: null };
  try {
    const r = await (await client()).rememberAndWait(formatMemory(d), { timeoutMs: 45_000 });
    return { blobId: r.blob_id };
  } catch (e) {
    return { blobId: null, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Earlier remembered decisions about this recipient that were blocked or flagged. Never throws. */
export async function recallBadHistory(recipient: string): Promise<{ hits: string[]; error?: string }> {
  if (!memwalEnabled()) return { hits: [] };
  try {
    const q = `${PREFIX} | recipient=${normAddr(recipient)} | outcome=blocked | flagged=yes`;
    const mem = await client();
    let res: Awaited<ReturnType<MemClient["recall"]>>;
    try {
      res = await mem.recall({ query: q, limit: 20, timeoutMs: 25_000 });
    } catch {
      res = await mem.recall({ query: q, limit: 20, timeoutMs: 25_000 }); // one retry: relayer hiccups are usually transient
    }
    return { hits: res.results.map((r) => r.text).filter((t) => isBadMemoryFor(t, recipient)) };
  } catch (e) {
    return { hits: [], error: e instanceof Error ? e.message : String(e) };
  }
}

/** Pure: was this remembered line an earlier clean payment (executed, nothing flagged) to this recipient? */
export function isCleanPaymentFor(text: string, recipient: string): boolean {
  const t = text.toLowerCase();
  if (!t.startsWith(PREFIX.toLowerCase())) return false;
  if (!t.includes(`recipient=${normAddr(recipient)}`)) return false;
  return t.includes("| outcome=transfer") && t.includes("| flagged=no");
}

/** Earlier clean payments to this recipient (the "known good vendor" side of memory). Never throws. */
export async function recallCleanHistory(recipient: string): Promise<{ hits: string[]; error?: string }> {
  if (!memwalEnabled()) return { hits: [] };
  try {
    const q = `${PREFIX} | recipient=${normAddr(recipient)} | outcome=transfer | flagged=no`;
    const res = await (await client()).recall({ query: q, limit: 20, timeoutMs: 25_000 });
    return { hits: res.results.map((r) => r.text).filter((t) => isCleanPaymentFor(t, recipient)) };
  } catch (e) {
    return { hits: [], error: e instanceof Error ? e.message : String(e) };
  }
}

/** Earlier remembered decisions in which this page (url) carried an attack. Never throws. */
export async function recallBadSource(url: string): Promise<{ hits: string[]; error?: string }> {
  if (!memwalEnabled()) return { hits: [] };
  try {
    const q = `${PREFIX} | sources=${url} | outcome=blocked | flagged=yes`;
    const mem = await client();
    let res: Awaited<ReturnType<MemClient["recall"]>>;
    try {
      res = await mem.recall({ query: q, limit: 20, timeoutMs: 25_000 });
    } catch {
      res = await mem.recall({ query: q, limit: 20, timeoutMs: 25_000 });
    }
    return { hits: res.results.map((r) => r.text).filter((t) => isBadMemoryForSource(t, url)) };
  } catch (e) {
    return { hits: [], error: e instanceof Error ? e.message : String(e) };
  }
}

export async function memwalHealth(): Promise<{ status: string }> {
  return (await client()).health();
}
