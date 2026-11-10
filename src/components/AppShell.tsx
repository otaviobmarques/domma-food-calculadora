"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useApp } from "./AppProvider";

const NAV = [
  { href: "/", label: "Início", icon: "M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" },
  { href: "/calcular", label: "Calcular", icon: "M6 3h12a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zm2 3v3h8V6zm0 6h2v2H8zm4 0h2v2h-2zm4 0h2v2h-2zM8 16h2v2H8zm4 0h2v2h-2zm4 0h2v2h-2z" },
  { href: "/cardapio", label: "Cardápio", icon: "M4 6h2v2H4zm4 0h12v2H8zm-4 5h2v2H4zm4 0h12v2H8zm-4 5h2v2H4zm4 0h12v2H8z" },
  { href: "/taxas", label: "Taxas", icon: "M7 5a2 2 0 1 1 0 4 2 2 0 0 1 0-4zm10 10a2 2 0 1 1 0 4 2 2 0 0 1 0-4zM18.4 4.2l1.4 1.4L5.6 19.8l-1.4-1.4z" },
];

export function Disclaimer() {
  return <p className="disclaimer">Ferramenta independente, sem vínculo com iFood, Keeta, 99Food ou aiqfome.</p>;
}

export function Toast() {
  const { toast } = useApp();
  return toast ? <div className="toast" role="status">{toast}</div> : null;
}

/** Área logada do restaurante: protege a rota, mostra o menu inferior e o aviso. */
export function AppShell({ children, nav = true }: { children: React.ReactNode; nav?: boolean }) {
  const { ready, user } = useApp();
  const router = useRouter();
  const path = usePathname();
  useEffect(() => { if (ready && !user) router.replace("/login"); }, [ready, user, router]);
  if (!ready || !user) return <div className="screen center"><div className="spinner" /></div>;
  return (
    <div className="screen">
      <main className="content">{children}<Disclaimer /></main>
      {nav && (
        <nav className="bottom-nav">
          {NAV.map((n) => {
            const active = n.href === "/" ? path === "/" : path.startsWith(n.href);
            return (
              <Link key={n.href} href={n.href} className={active ? "active" : ""}>
                <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden><path d={n.icon} fill="currentColor" /></svg>
                {n.label}
              </Link>
            );
          })}
        </nav>
      )}
      <Toast />
    </div>
  );
}
