import VerifyForm from "@/components/VerifyForm";

export const metadata = { title: "Verify Proof · Agent Black Box" };

const checks = [
  ["01", "Read on-chain event", "Fetch the DecisionRecorded event directly from Sui."],
  ["02", "Retrieve evidence", "Download the referenced execution log from Walrus."],
  ["03", "Recompute integrity", "Calculate SHA-256 and compare it with the committed hash."],
  ["04", "Cross-check claims", "Compare the log outcome and recipient with the chain record."],
];

export default function VerifyPage() {
  return (
    <>
      <section className="mb-8 max-w-3xl">
        <div className="eyebrow mb-3">Independent verification</div>
        <h1>Verify a decision</h1>
        <p className="mt-4 max-w-2xl text-sm leading-7 text-muted">
          Validate the evidence independently. Enter a Sui transaction digest to retrieve the
          on-chain commitment and check the corresponding Walrus log.
        </p>
      </section>
      <section className="surface-card max-w-3xl p-5 sm:p-7">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div><div className="eyebrow">Transaction lookup</div><h2 className="mt-1 text-lg font-semibold">Proof inspector</h2></div>
          <span className="rounded-full border border-cyan-300/20 bg-cyan-300/[.06] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-cyan-100">Sui network</span>
        </div>
        <VerifyForm />
        <p className="mt-3 text-[11px] text-muted">Your digest is used to locate the corresponding decision record.</p>
      </section>
      <section className="mt-9 max-w-3xl">
        <div className="eyebrow mb-4">Verification sequence</div>
        <div className="grid gap-3 sm:grid-cols-2">
          {checks.map(([n, title, desc]) => (
            <div key={n} className="surface-card flex gap-3 p-4">
              <span className="grid size-8 shrink-0 place-items-center rounded-lg border border-cyan-300/20 bg-cyan-300/[.07] font-mono text-xs text-cyan-100">{n}</span>
              <div><h3 className="text-sm font-semibold">{title}</h3><p className="mt-1 text-xs leading-relaxed text-muted">{desc}</p></div>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
