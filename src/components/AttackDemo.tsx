"use client";

import Link from "next/link";
import { useState } from "react";
import { OutcomeTag, VerdictBadge } from "@/components/Badge";
import Trace from "@/components/Trace";
import { short } from "@/lib/addr";
import { formatSui } from "@/lib/links";
import { FLAG_LABELS } from "@/lib/patterns";
import type { DecisionLog, IndexEntry, ScenarioName } from "@/lib/types";

interface RunState {
  loading: boolean;
  error?: string;
  entry?: IndexEntry;
  log?: DecisionLog;
}

const cards: { name: ScenarioName; title: string; blurb: string; button: string; page: string }[] = [
  {
    name: "normal",
    title: "Honest invoice",
    blurb: "A normal invoice. The recipient matches the address you gave the agent.",
    button: "Run honest invoice",
    page: "/invoices/invoice-1042.html",
  },
  {
    name: "attack",
    title: "Hijacked invoice",
    blurb:
      "Looks identical to a human, but the page carries hidden text telling the agent its wallet changed and to pay a new address quietly.",
    button: "Run hijacked invoice",
    page: "/invoices/invoice-1043.html",
  },
];

export default function AttackDemo() {
  const [guard, setGuard] = useState(true);
  const [runs, setRuns] = useState<Record<ScenarioName, RunState>>({
    normal: { loading: false },
    attack: { loading: false },
  });

  async function run(name: ScenarioName) {
    setRuns((r) => ({ ...r, [name]: { loading: true } }));
    try {
      const res = await fetch("/api/run", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ scenario: name, guard }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Request failed");
      setRuns((r) => ({ ...r, [name]: { loading: false, entry: data.entry, log: data.log } }));
    } catch (e) {
      setRuns((r) => ({
        ...r,
        [name]: { loading: false, error: e instanceof Error ? e.message : String(e) },
      }));
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4 rounded-lg border border-line bg-panel p-4">
        <div className="max-w-xl">
          <div className="text-sm font-medium">Black Box payment guard</div>
          <p className="mt-1 text-sm text-muted">
            {guard
              ? "ON: a payment is blocked when its recipient can't be traced to your own instruction. The attempt is still recorded."
              : "OFF: the hijacked payment will actually execute (a small amount of real SUI is sent to a dead address). It is still flagged and recorded forever."}
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={guard}
          aria-label="Black Box payment guard"
          onClick={() => setGuard((g) => !g)}
          className={`relative h-7 w-12 shrink-0 rounded-full border transition-colors ${
            guard ? "border-accent/60 bg-accent/30" : "border-line bg-panel-2"
          }`}
        >
          <span
            className={`absolute top-0.5 size-5 rounded-full bg-fg transition-all ${
              guard ? "left-6" : "left-0.5"
            }`}
          />
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {cards.map((c) => {
          const s = runs[c.name];
          return (
            <section key={c.name} className="flex flex-col rounded-lg border border-line bg-panel p-5">
              <h2 className="font-semibold">{c.title}</h2>
              <p className="mt-1 text-sm text-muted">{c.blurb}</p>
              <a
                href={c.page}
                target="_blank"
                rel="noreferrer"
                className="mt-2 self-start text-sm text-accent underline-offset-2 hover:underline"
              >
                Open the invoice page the agent will fetch
              </a>

              <button
                type="button"
                onClick={() => run(c.name)}
                disabled={s.loading}
                className="mt-4 self-start rounded-md bg-accent px-4 py-2 text-sm font-medium text-bg transition-opacity hover:opacity-90 disabled:cursor-wait disabled:opacity-50"
              >
                {s.loading ? "Running…" : c.button}
              </button>

              {s.loading && (
                <p className="mt-3 text-sm text-muted" role="status">
                  Agent is fetching the invoice, storing the log on Walrus, then recording on Sui. This takes
                  roughly 20 to 60 seconds.
                </p>
              )}

              {s.error && (
                <p role="alert" className="mt-4 rounded-md border border-bad/40 bg-bad/10 p-3 text-sm text-bad">
                  {s.error}
                </p>
              )}

              {s.entry && s.log && (
                <div className="mt-5 border-t border-line pt-5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <OutcomeTag outcome={s.entry.outcome} flagged={s.entry.flagged} />
                    <VerdictBadge verdict={s.entry.verdict} />
                  </div>
                  <p className="mt-3 text-sm">
                    <span className="font-mono">{formatSui(s.entry.amount_mist)}</span>
                    <span className="text-muted"> → </span>
                    <span className="font-mono">{short(s.entry.recipient, 10, 6)}</span>
                  </p>
                  {s.entry.flags.length > 0 && (
                    <ul className="mt-3 space-y-1.5">
                      {s.entry.flags.map((f) => (
                        <li key={f} className="rounded-md border border-warn/30 bg-warn/5 px-3 py-1.5 text-xs">
                          {FLAG_LABELS[f] ?? f}
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="mt-5">
                    <Trace steps={s.log.trace} />
                  </div>
                  <Link
                    href={`/decision/${s.entry.digest}`}
                    className="mt-5 inline-block text-sm text-accent hover:underline"
                  >
                    Open the full on-chain proof →
                  </Link>
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
