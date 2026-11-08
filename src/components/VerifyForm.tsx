"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function VerifyForm() {
  const router = useRouter();
  const [digest, setDigest] = useState("");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const d = digest.trim();
        if (d) router.push(`/decision/${encodeURIComponent(d)}`);
      }}
      className="flex flex-col gap-3 sm:flex-row"
    >
      <label htmlFor="digest" className="sr-only">
        Sui transaction digest
      </label>
      <input
        id="digest"
        value={digest}
        onChange={(e) => setDigest(e.target.value)}
        placeholder="Paste a Sui transaction digest"
        spellCheck={false}
        autoComplete="off"
        className="min-w-0 flex-1 rounded-md border border-line bg-panel px-3 py-2.5 font-mono text-sm outline-none placeholder:text-muted focus:border-accent"
      />
      <button
        type="submit"
        disabled={!digest.trim()}
        className="rounded-md bg-accent px-5 py-2.5 text-sm font-medium text-bg transition-opacity hover:opacity-90 disabled:opacity-40"
      >
        Verify
      </button>
    </form>
  );
}
