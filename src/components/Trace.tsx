import { highlight } from "@/lib/patterns";
import type { TraceKind, TraceStep } from "@/lib/types";

const kindMeta: Record<TraceKind, { label: string; dot: string; chip: string }> = {
  user: { label: "TRUSTED", dot: "bg-accent", chip: "text-accent border-accent/40" },
  untrusted: { label: "UNTRUSTED", dot: "bg-warn", chip: "text-warn border-warn/40" },
  thought: { label: "THOUGHT", dot: "bg-muted", chip: "text-muted border-line" },
  tool_call: { label: "TOOL CALL", dot: "bg-muted", chip: "text-muted border-line" },
  tool_result: { label: "TOOL RESULT", dot: "bg-muted", chip: "text-muted border-line" },
  guard: { label: "GUARD", dot: "bg-accent", chip: "text-accent border-accent/40" },
  final: { label: "SUMMARY", dot: "bg-muted", chip: "text-muted border-line" },
};

function guardTone(title: string): { dot: string; chip: string; text: string } {
  if (title.includes("BLOCKED"))
    return { dot: "bg-bad", chip: "text-bad border-bad/50", text: "text-bad" };
  if (title.includes("flagged"))
    return { dot: "bg-warn", chip: "text-warn border-warn/50", text: "text-warn" };
  return { dot: "bg-ok", chip: "text-ok border-ok/50", text: "text-ok" };
}

export default function Trace({ steps }: { steps: TraceStep[] }) {
  return (
    <ol className="relative space-y-5 border-l border-line pl-6">
      {steps.map((s, i) => {
        const meta = kindMeta[s.kind];
        const tone = s.kind === "guard" ? guardTone(s.title) : null;
        const dot = tone?.dot ?? meta.dot;
        const chip = tone?.chip ?? meta.chip;
        return (
          <li key={i} className="relative">
            <span
              aria-hidden
              className={`absolute -left-[29px] top-1.5 size-2.5 rounded-full ring-4 ring-bg ${dot}`}
            />
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded border px-1.5 py-px font-mono text-[10px] tracking-wider ${chip}`}>
                {meta.label}
              </span>
              <span className={`text-sm font-medium ${tone?.text ?? ""}`}>{s.title}</span>
              <time className="ml-auto font-mono text-[11px] text-muted" dateTime={s.at}>
                {new Date(s.at).toLocaleTimeString()}
              </time>
            </div>
            {s.source && <p className="mt-1 text-xs text-muted">Source: {s.source}</p>}
            <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-words rounded-md border border-line bg-panel px-3 py-2 font-mono text-xs leading-relaxed text-fg/90">
              {s.kind === "untrusted"
                ? highlight(s.text).map((seg, j) =>
                    seg.hit ? (
                      <mark key={j} className="rounded bg-bad/25 px-0.5 text-bad">
                        {seg.text}
                      </mark>
                    ) : (
                      <span key={j}>{seg.text}</span>
                    ),
                  )
                : s.text}
            </pre>
          </li>
        );
      })}
    </ol>
  );
}
