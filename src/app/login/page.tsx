"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useApp } from "@/components/AppProvider";
import { AuthLayout } from "@/components/AuthLayout";
import { toEmail } from "@/lib/login";

export default function LoginPage() {
  const { store, user } = useApp();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (user) router.replace("/inicio"); }, [user, router]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError("");
    try { await store.signIn(toEmail(email.trim()), password); } catch (err) { setError((err as Error).message); } finally { setBusy(false); }
  };

  return (
    <AuthLayout>
      <h1>Preço certo no iFood, sem prejuízo.</h1>
      <p className="muted" style={{ margin: 0 }}>Calcule em segundos quanto cobrar em cada item no iFood, Keeta, 99Food e aiqfome.</p>
      <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <label className="field">E-mail ou usuário
          <input className="input" type="text" inputMode="email" autoCapitalize="none" autoComplete="username" required placeholder="voce@restaurante.com.br" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="field">Senha
          <input className="input" type="password" autoComplete="current-password" required={store.mode !== "demo"} placeholder="Sua senha" value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        <div style={{ textAlign: "right" }}><Link href="/recuperar-senha" className="link-red">Esqueci minha senha</Link></div>
        {error && <div className="error">{error}</div>}
        <button className="btn primary block" disabled={busy}>{busy ? "Entrando…" : "Entrar"}</button>
        <button type="button" className="btn outline block" onClick={() => store.signInWithGoogle().catch((e) => setError(e.message))}>Entrar com Google</button>
      </form>
      <p className="center-text small">Ainda não tem conta? <Link href="/cadastro" className="link-red">Criar conta grátis</Link></p>
    </AuthLayout>
  );
}
