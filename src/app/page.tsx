import Feed from "@/components/Feed";

export default function Home() {
  return (
    <>
      <section className="dashboard-hero">
        <div className="mb-5 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-300/20 bg-emerald-300/[.06] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[.15em] text-emerald-200">
            <span className="size-1.5 animate-pulse rounded-full bg-emerald-400" />
            Agent observability layer
          </span>
          <span className="rounded-full border border-line bg-panel/70 px-3 py-1.5 text-[10px] font-medium uppercase tracking-[.13em] text-muted">Sui × Walrus</span>
        </div>
        <div className="grid items-end gap-6 lg:grid-cols-[minmax(0,1fr)_260px]">
          <div>
            <h1>Trust the proof.<br /><span>Not the agent.</span></h1>
            <p className="mt-5 max-w-2xl">
              An accountability layer for autonomous payments. Capture agent decisions, preserve
              execution evidence on Walrus, and anchor integrity proofs to Sui.
            </p>
          </div>
          <div className="hero-action">
            <div className="text-[10px] font-semibold uppercase tracking-[.16em] text-muted">Quick action</div>
            <div className="mt-2 text-sm font-semibold">Run a security scenario</div>
            <p className="mt-1 text-xs leading-relaxed text-muted">See how prompt injection is detected and recorded.</p>
            <a href="/attack" className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-300 px-4 py-3 text-xs font-bold text-slate-950 transition hover:bg-cyan-200">Launch Attack Lab <span>↗</span></a>
          </div>
        </div>
      </section>
      <Feed />
      <footer className="mt-12 flex flex-wrap items-center justify-between gap-3 border-t border-line/70 pt-5 text-[10px] text-muted">
        <span>AGENT BLACK BOX · VERIFIABLE EXECUTION</span>
        <span>Evidence-first infrastructure for autonomous agents</span>
      </footer>
    </>
  );
}
