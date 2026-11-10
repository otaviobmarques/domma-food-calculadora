"use client";
import { Logo } from "./Logo";
import { Disclaimer } from "./AppShell";
import { useApp } from "./AppProvider";

export function AuthLayout({ children }: { children: React.ReactNode }) {
  const { store } = useApp();
  return (
    <div className="auth">
      <Logo size={30} />
      <span className="eyebrow">Calculadora iFood</span>
      {store.mode === "demo" && <div className="demo-flag">Modo demonstração: qualquer e-mail e senha entram. Os dados ficam só neste navegador.</div>}
      {children}
      <div className="grow" />
      <Disclaimer />
    </div>
  );
}
