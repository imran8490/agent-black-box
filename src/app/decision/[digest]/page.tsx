import Link from "next/link";
import { notFound } from "next/navigation";
import { OutcomeTag, VerdictBadge } from "@/components/Badge";
import Trace from "@/components/Trace";
import { short } from "@/lib/addr";
import { formatSui, suiscanTx, walrusBlobUrl } from "@/lib/links";
import { FLAG_LABELS } from "@/lib/patterns";
import { verifyDigest } from "@/lib/verify";
import { findEntryByDigest } from "@/lib/store";
import type { Verdict } from "@/lib/types";

export const dynamic = "force-dynamic";

const banner: Record<Verdict, { title: string; body: string; cls: string }> = {
  verified: {
    title: "Verified",
    body: "The log on Walrus is byte-for-byte what the agent committed on Sui.",
    cls: "border-ok/40 bg-ok/10 text-ok",
  },
  pending: {
    title: "Not fully verified yet",
    body: "Part of the proof could not be fetched. Try again in a moment.",
    cls: "border-warn/40 bg-warn/10 text-warn",
  },
  mismatch: {
    title: "Mismatch. Do not trust this log",
    body: "The evidence on Walrus does not agree with what Sui recorded.",
    cls: "border-bad/40 bg-bad/10 text-bad",
  },
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-1 break-all font-mono text-sm">{children}</dd>
    </div>
  );
}

export default async function DecisionPage({
  params,
}: {
  params: Promise<{ digest: string }>;
}) {
  const { digest: raw } = await params;
  const digest = decodeURIComponent(raw);
  const r = await verifyDigest(digest);

  if (!r.onchain && r.verdict === "mismatch") {
    return (
      <div>
        <Link href="/verify" className="text-sm text-muted hover:text-fg">← Verify another</Link>
        <div className="mt-4 rounded-lg border border-bad/40 bg-bad/10 p-5">
          <h1 className="font-semibold text-bad">Nothing to verify</h1>
          <p className="mt-2 text-sm">{r.reasons.join(" ")}</p>
          <p className="mt-3 break-all font-mono text-xs text-muted">{digest}</p>
        </div>
      </div>
    );
  }

  const memoryBlobId = (await findEntryByDigest(digest))?.memory_blob_id;
  const b = banner[r.verdict];
  const onchain = r.onchain;
  const log = r.log;
  const hashesMatch =
    onchain && r.computed_hash ? onchain.log_hash.toLowerCase() === r.computed_hash : null;

  return (
    <div className="space-y-8">
      <Link href="/" className="text-sm text-muted hover:text-fg">← Live feed</Link>

      <section className={`rounded-lg border p-5 ${b.cls}`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-lg font-semibold">{b.title}</h1>
          <VerdictBadge verdict={r.verdict} />
        </div>
        <p className="mt-1 text-sm text-fg/80">{b.body}</p>
        <ul className="mt-3 space-y-1 text-sm text-fg/90">
          {r.reasons.map((x, i) => (
            <li key={i} className="flex gap-2">
              <span aria-hidden className="text-muted">•</span>
              <span>{x}</span>
            </li>
          ))}
        </ul>
        {r.log_source === "local-cache" && (
          <p className="mt-3 inline-block rounded-md border border-warn/40 bg-warn/10 px-2.5 py-1 text-xs font-medium">
            Unverified local copy. This log was NOT read from Walrus and is not proven by the chain.
          </p>
        )}
      </section>

      {onchain && (
        <section>
          <h2 className="mb-3 text-sm font-medium text-muted">Proof</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-line bg-panel p-4">
              <div className="text-xs text-muted">SHA-256 committed on Sui</div>
              <div className="mt-2 break-all font-mono text-xs">{onchain.log_hash}</div>
            </div>
            <div className="rounded-lg border border-line bg-panel p-4">
              <div className="flex items-center justify-between text-xs text-muted">
                <span>SHA-256 of the Walrus blob (computed just now)</span>
                {hashesMatch !== null && (
                  <span className={hashesMatch ? "text-ok" : "text-bad"}>
                    {hashesMatch ? "✓ match" : "✗ differ"}
                  </span>
                )}
              </div>
              <div className="mt-2 break-all font-mono text-xs">
                {r.computed_hash ?? "Walrus blob unavailable"}
              </div>
            </div>
          </div>
        </section>
      )}

      {onchain && (
        <section>
          <h2 className="mb-3 text-sm font-medium text-muted">What the chain recorded</h2>
          <dl className="grid gap-x-6 gap-y-4 rounded-lg border border-line bg-panel p-4 sm:grid-cols-2">
            <Field label="Outcome">
              <OutcomeTag
                outcome={onchain.action as "transfer" | "blocked" | "no_action"}
                flagged={onchain.risk_flagged}
              />
            </Field>
            <Field label="Amount">{formatSui(onchain.amount_mist)}</Field>
            <Field label="Recipient">{onchain.recipient}</Field>
            <Field label="Agent wallet">{onchain.agent}</Field>
            <Field label="Sui transaction">
              <a href={suiscanTx(digest)} target="_blank" rel="noreferrer" className="text-accent hover:underline">
                {short(digest, 12, 8)} ↗
              </a>
            </Field>
            {memoryBlobId && (
              <Field label="Walrus Memory (full log copy)">
                <a
                  href={walrusBlobUrl(memoryBlobId)}
                  target="_blank"
                  rel="noreferrer"
                  className="text-accent hover:underline"
                >
                  {short(memoryBlobId, 12, 8)} ↗
                </a>
              </Field>
            )}
            <Field label="Walrus blob (audit log)">
              <a
                href={walrusBlobUrl(onchain.walrus_blob_id)}
                target="_blank"
                rel="noreferrer"
                className="text-accent hover:underline"
              >
                {short(onchain.walrus_blob_id, 12, 8)} ↗
              </a>
            </Field>
          </dl>
        </section>
      )}

      {log && (
        <>
          {log.guard.flags.length > 0 && (
            <section>
              <h2 className="mb-3 text-sm font-medium text-muted">Why it was flagged</h2>
              <ul className="space-y-2">
                {log.guard.flags.map((f) => (
                  <li key={f} className="rounded-lg border border-warn/30 bg-warn/5 px-4 py-2.5 text-sm">
                    {FLAG_LABELS[f] ?? f}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section>
            <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-sm font-medium text-muted">
                {r.log_source === "local-cache"
                  ? "Agent reasoning (unverified local copy)"
                  : "Agent reasoning, as stored on Walrus"}
              </h2>
              <span className="text-xs text-muted">
                {log.agent_mode === "simulated" ? "Scripted agent" : `Live model: ${log.model}${log.prompt_style ? ` · ${log.prompt_style} prompt` : ""}`} · guard{" "}
                {log.guard.enabled ? "on" : "off"}
              </span>
            </div>
            <Trace steps={log.trace} />
          </section>
        </>
      )}
    </div>
  );
}
