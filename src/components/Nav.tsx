"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Live Feed" },
  { href: "/attack", label: "Attack Lab" },
  { href: "/verify", label: "Verify Proof" },
];

export default function Nav() {
  const pathname = usePathname();
  return (
    <header className="border-b border-line bg-bg/80 backdrop-blur">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <Link href="/" className="flex items-center gap-3">
          <span aria-hidden className="grid size-10 place-items-center rounded-xl border border-cyan-300/25 bg-cyan-300/10 shadow-[0_0_28px_rgba(100,216,255,.12)]">
            <span className="relative size-3 rounded-full bg-accent shadow-[0_0_14px_rgba(100,216,255,.9)]">
              <span className="absolute inset-[-5px] rounded-full border border-accent/30" />
            </span>
          </span>
          <span className="leading-tight">
            <span className="block text-[15px] font-bold tracking-tight text-fg">Agent Black Box</span>
            <span className="mt-1 block text-[10px] font-medium uppercase tracking-[.16em] text-muted">Verifiable agent execution</span>
          </span>
        </Link>
        <nav aria-label="Main navigation" className="flex items-center gap-1 text-sm">
          {links.map((l) => {
            const active = l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                aria-current={active ? "page" : undefined}
                className={`rounded-md px-3 py-1.5 transition-colors ${
                  active ? "bg-panel-2 text-fg" : "text-muted hover:text-fg"
                }`}
              >
                {l.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
