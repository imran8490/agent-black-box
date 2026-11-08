import type { Outcome, Verdict } from "@/lib/types";

const verdictStyle: Record<Verdict, { cls: string; label: string }> = {
  verified: { cls: "text-ok border-ok/40 bg-ok/10", label: "Verified" },
  pending: { cls: "text-warn border-warn/40 bg-warn/10", label: "Pending" },
  mismatch: { cls: "text-bad border-bad/40 bg-bad/10", label: "Mismatch" },
};

export function VerdictBadge({ verdict }: { verdict: Verdict }) {
  const s = verdictStyle[verdict];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${s.cls}`}
    >
      <span aria-hidden className="size-1.5 rounded-full bg-current" />
      {s.label}
    </span>
  );
}

const outcomeStyle: Record<Outcome, { cls: string; label: string }> = {
  transfer: { cls: "text-fg border-line bg-panel-2", label: "Paid" },
  blocked: { cls: "text-bad border-bad/40 bg-bad/10", label: "Blocked" },
  no_action: { cls: "text-muted border-line bg-panel-2", label: "No action" },
};

export function OutcomeTag({ outcome, flagged }: { outcome: Outcome; flagged?: boolean }) {
  const s = outcomeStyle[outcome];
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`rounded-md border px-2 py-0.5 text-xs font-medium ${s.cls}`}>{s.label}</span>
      {flagged && (
        <span className="rounded-md border border-warn/40 bg-warn/10 px-2 py-0.5 text-xs font-medium text-warn">
          Flagged
        </span>
      )}
    </span>
  );
}
