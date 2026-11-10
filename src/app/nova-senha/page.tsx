"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useApp } from "@/components/AppProvider";
import { AuthLayout } from "@/components/AuthLayout";

export default function NewPasswordPage() {
  const { store } = useApp();
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setError("");
    if (password.length < 6) return setError("A senha precisa ter pelo menos 6 caracteres.");
    try { await store.updatePassword(password); router.replace("/"); } catch (err) { setError((err as Error).message); }
  };
  return (
    <AuthLayout>
      <h1>Nova senha</h1>
      <form onSubmit={submit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <label className="field">Nova senha
          <input className="input" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        {error && <div className="error">{error}</div>}
        <button className="btn primary block">Salvar e entrar</button>
      </form>
    </AuthLayout>
  );
}
