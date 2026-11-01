"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/", label: "Home", icon: "M12 3.2 3 10.5V20h6v-6h6v6h6v-9.5L12 3.2Z" },
  { href: "/transactions", label: "Expenses", icon: "M5.5 2.5h13v19l-3.25-2-3.25 2-3.25-2-3.25 2v-19Zm3 5v2h7v-2h-7Zm0 4.5v2h7v-2h-7Z" },
  { href: "/reports", label: "Reports", icon: "M4 18.5V7.5h3.5v11H4Zm6.5 0V4h3.5v14.5h-3.5Zm6.5 0v-8H20v8h-3Z" },
  { href: "/accounts", label: "Accounts", icon: "M4 7a1 1 0 0 1 1-1h14a1 1 0 1 1 0 2H5a1 1 0 0 1-1-1Zm0 5a1 1 0 0 1 1-1h14a1 1 0 1 1 0 2H5a1 1 0 0 1-1-1Zm0 5a1 1 0 0 1 1-1h14a1 1 0 1 1 0 2H5a1 1 0 0 1-1-1Z" },
];

const addClassName =
  "flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-400 text-lg font-bold text-slate-950 shadow-[0_10px_20px_rgba(34,211,238,0.35)] justify-self-center";

export function BottomNav({ onAdd }: { onAdd?: () => void }) {
  const pathname = usePathname();

  const renderLink = ({ href, label, icon }: (typeof links)[number]) => (
    <Link
      key={href}
      href={href}
      aria-current={pathname === href ? "page" : undefined}
      className={`flex min-h-[3.15rem] flex-col items-center justify-center gap-1 rounded-2xl px-1 transition-colors ${
        pathname === href ? "bg-cyan-500/10 text-cyan-300 ring-1 ring-cyan-400/30" : "text-slate-400 hover:text-slate-200"
      }`}
    >
      <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden="true"><path d={icon} /></svg>
      <span className="text-[10px]">{label}</span>
    </Link>
  );

  return (
    <nav className="fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] left-1/2 z-20 grid w-[calc(100%-1.25rem)] max-w-md -translate-x-1/2 grid-cols-5 items-center gap-1 rounded-[24px] border border-white/10 bg-[#121d27]/95 px-2 py-2.5 shadow-[0_18px_40px_rgba(0,0,0,0.3)] backdrop-blur-xl">
      {links.slice(0, 2).map(renderLink)}
      {onAdd ? (
        <button type="button" onClick={onAdd} aria-label="Add expense" className={addClassName}>
          +
        </button>
      ) : (
        <Link href="/?add=1" aria-label="Add expense" className={addClassName}>
          +
        </Link>
      )}
      {links.slice(2).map(renderLink)}
    </nav>
  );
}
