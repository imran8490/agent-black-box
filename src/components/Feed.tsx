"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { OutcomeTag, VerdictBadge } from "@/components/Badge";
import { short } from "@/lib/addr";
import { formatSui } from "@/lib/links";
import type { IndexEntry, Verdict } from "@/lib/types";

const bar: Record<Verdict, string> = {
  verified: "border-l-ok",
  pending: "border-l-warn",
  mismatch: "border-l-bad",
};

export default function Feed() {
  const [entries, setEntries] = useState<IndexEntry[] | null>(null);
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  const seen = useRef<Set<string> | null>(null);

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const res = await fetch("/api/decisions", { cache: "no-store" });
        const data = (await res.json()) as IndexEntry[];
        if (!alive) return;
        if (seen.current === null) {
          seen.current = new Set(data.map((d) => d.id));
        } else {
          const added = data.filter((d) => !seen.current!.has(d.id)).map((d) => d.id);
          if (added.length) {
            added.forEach((id) => seen.current!.add(id));
            setFresh((prev) => new Set([...prev, ...added]));
          }
        }
        setEntries(data);
      } catch {
        if (alive) setEntries((prev) => prev ?? []);
      }
    }
    load();
    const t = setInterval(load, 4000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  if (entries === null) {
    return <p className="py-16 text-center text-sm text-muted">Loading records…</p>;
  }

  const blocked = entries.filter((e) => e.outcome === "blocked").length;
  const flagged = entries.filter((e) => e.flagged).length;
  const verified = entries.filter((e) => e.verdict === "verified").length;

  const stats = [
    { label: "Decisions recorded", value: entries.length },
    { label: "Verified", value: verified },
    { label: "Flagged", value: flagged },
    { label: "Payments blocked", value: blocked },
  ];

  return (
    <div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="group rounded-xl border border-line bg-panel px-5 py-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-cyan-300/30 hover:shadow-[0_14px_36px_rgba(0,0,0,.22)]">
            <div className="font-mono text-3xl font-semibold tracking-tight tabular-nums text-fg">{s.value}</div>
            <div className="mt-0.5 text-xs text-muted">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="mb-4 mt-10 flex flex-wrap items-end justify-between gap-2"><div><div className="text-[10px] font-semibold uppercase tracking-[.18em] text-cyan-200/70">Live activity</div><h2 className="mt-1 text-xl font-semibold tracking-tight text-fg">Latest decisions</h2></div><span className="inline-flex items-center gap-2 rounded-full border border-line bg-panel px-3 py-1.5 text-[11px] text-muted"><span className="size-1.5 rounded-full bg-emerald-400" /> Auto-refresh · 4s</span></div>

      {entries.length === 0 ? (
        <div className="rounded-lg border border-dashed border-line px-6 py-14 text-center">
          <p className="font-medium">No decisions recorded yet</p>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted">
            Open <Link href="/attack" className="text-accent underline-offset-4 hover:underline">Attack Demo</Link>{" "}
            and run the agent, or run <code className="font-mono text-fg">npm run agent</code> in a terminal.
            New records appear here automatically.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {entries.map((e) => (
            <li key={e.id} className={fresh.has(e.id) ? "slide-in" : ""}>
              <Link
                href={`/decision/${e.digest}`}
                className={`grid items-center gap-x-4 gap-y-3 rounded-xl border border-l-4 border-line bg-panel px-4 py-4 transition-all duration-200 hover:-translate-y-px hover:border-r-cyan-300/20 hover:bg-panel-2 sm:grid-cols-[1fr_1.4fr_auto_auto] ${bar[e.verdict]}`}
              >
                <div>
                  <OutcomeTag outcome={e.outcome} flagged={e.flagged} />
                  <div className="mt-1 text-xs text-muted">
                    {new Date(e.timestamp_ms).toLocaleString()}
                    {e.agent_mode === "simulated" && " · scripted agent"}
                  </div>
                </div>
                <div className="min-w-0">
                  <div className="truncate font-mono text-sm">{short(e.recipient, 10, 6)}</div>
                  <div className="mt-0.5 truncate text-xs text-muted">
                    {e.scenario === "attack" ? "Hijacked invoice" : "Normal invoice"}
                    {e.flags.length > 0 && ` · ${e.flags.length} flag${e.flags.length > 1 ? "s" : ""}`}
                  </div>
                </div>
                <div className="font-mono text-sm tabular-nums sm:text-right">{formatSui(e.amount_mist)}</div>
                <div className="sm:text-right">
                  <VerdictBadge verdict={e.verdict} />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
