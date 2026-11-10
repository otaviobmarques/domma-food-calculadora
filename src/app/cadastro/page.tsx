"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useApp } from "@/components/AppProvider";
import { AuthLayout } from "@/components/AuthLayout";

export default function SignupPage() {
  const { store, user } = useApp();
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (user) router.replace("/taxas?boas-vindas=1"); }, [user, router]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6 && store.mode !== "demo") return setError("A senha precisa ter pelo menos 6 caracteres.");
    setBusy(true); setError("");
    try {
      const r = await store.signUp(name.trim(), email.trim(), password);
      if (r.needsConfirmation) setSent(true);
    } catch (err) { setError((err as Error).message); } finally { setBusy(false); }
  };

  if (sent) return (
    <AuthLayout>
      <h1>Confira seu e-mail</h1>
      <p className="muted">Enviamos um link para <b>{email}</b>. Clique nele para ativar a conta.</p>
      <Link href="/login" className="btn primary block">Voltar para entrar</Link>
    </AuthLayout>
  );

  return (
    <AuthLayout>
      <h1>Criar conta grátis</h1>
      <p className="muted" style={{ margin: 0 }}>Só 3 campos. O plano do iFood você escolhe depois, na tela de taxas.</p>
      <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <label className="field">Nome do restaurante
          <input className="input" required placeholder="Ex.: Hamburgueria do Zé" value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="field">E-mail
          <input className="input" type="email" autoComplete="email" required placeholder="voce@restaurante.com.br" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="field">Senha
          <input className="input" type="password" autoComplete="new-password" required={store.mode !== "demo"} placeholder="Mínimo 6 caracteres" value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        {error && <div className="error">{error}</div>}
        <button className="btn primary block" disabled={busy}>{busy ? "Criando…" : "Criar conta"}</button>
      </form>
      <p className="center-text small">Já tem conta? <Link href="/login" className="link-red">Entrar</Link></p>
    </AuthLayout>
  );
}
