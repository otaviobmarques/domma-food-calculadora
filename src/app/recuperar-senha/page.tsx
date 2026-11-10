"use client";
import Link from "next/link";
import { useState } from "react";
import { useApp } from "@/components/AppProvider";
import { AuthLayout } from "@/components/AuthLayout";

export default function ForgotPage() {
  const { store } = useApp();
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setError("");
    try { await store.resetPassword(email.trim()); setMsg("Se o e-mail estiver cadastrado, você vai receber um link para criar uma nova senha."); }
    catch (err) { setError((err as Error).message); }
  };
  return (
    <AuthLayout>
      <h1>Esqueci minha senha</h1>
      <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <label className="field">E-mail
          <input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@restaurante.com.br" />
        </label>
        {msg && <div className="note ok small">{msg}</div>}
        {error && <div className="error">{error}</div>}
        <button className="btn primary block">Enviar link</button>
      </form>
      <Link href="/login" className="btn link">Voltar</Link>
    </AuthLayout>
  );
}
