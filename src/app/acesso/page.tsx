"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { useApp } from "@/components/AppProvider";
import { AuthLayout } from "@/components/AuthLayout";
import { displayLogin } from "@/lib/login";

/** Link de acesso enviado pela Domma Food: o cliente cria a senha e já entra. */
function AccessForm() {
  const { store, user } = useApp();
  const router = useRouter();
  const token = useSearchParams().get("t") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [login, setLogin] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setError("");
    if (password.length < 6) return setError("A senha precisa ter pelo menos 6 caracteres.");
    if (password !== confirm) return setError("As senhas não são iguais.");
    setBusy(true);
    try {
      if (user) await store.signOut(); // o link pode ser aberto num aparelho com outra conta
      const email = await store.redeemAccessLink(token, password);
      setLogin(displayLogin(email));
      await store.signIn(email, password);
      router.replace("/taxas?boas-vindas=1");
    } catch (err) { setError((err as Error).message); setBusy(false); }
  };

  if (!token) return (
    <AuthLayout>
      <h1>Link incompleto</h1>
      <p className="muted">Abra o link exatamente como recebeu ou peça um novo à Domma Food.</p>
      <Link href="/login" className="btn primary block">Ir para o login</Link>
    </AuthLayout>
  );

  return (
    <AuthLayout>
      <h1>Bem-vindo! Crie sua senha.</h1>
      <p className="muted" style={{ margin: 0 }}>Seu acesso à Calculadora iFood da Domma Food está pronto. Escolha uma senha para entrar.</p>
      <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <label className="field">Nova senha
          <input className="input" type="password" autoComplete="new-password" placeholder="Mínimo 6 caracteres" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus />
        </label>
        <label className="field">Repita a senha
          <input className="input" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </label>
        {error && <div className="error">{error}</div>}
        {login && !error && <div className="note ok small">Senha criada! Seu login é <b>{login}</b>. Entrando…</div>}
        <button className="btn primary block" disabled={busy}>{busy ? "Entrando…" : "Criar senha e entrar"}</button>
      </form>
      <p className="center-text small">Já tem senha? <Link href="/login" className="link-red">Entrar</Link></p>
    </AuthLayout>
  );
}

export default function Page() {
  return <Suspense><AccessForm /></Suspense>;
}
