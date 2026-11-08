import AttackDemo from "@/components/AttackDemo";

export const metadata = { title: "Attack Lab · Agent Black Box" };

export default function AttackPage() {
  return (
    <>
      <section className="mb-8 max-w-3xl">
        <div className="eyebrow mb-3">Adversarial testing environment</div>
        <h1>Attack Lab</h1>
        <p className="mt-4 text-sm leading-7 text-muted">
          Stress-test the payment guard with controlled invoice scenarios. Compare a trusted instruction
          with a prompt-injected invoice, then inspect the captured trace and resulting proof.
        </p>
      </section>
      <AttackDemo />
    </>
  );
}
