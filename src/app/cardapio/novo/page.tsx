"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { useApp } from "@/components/AppProvider";
import { MoneyInput } from "@/components/MoneyInput";
import { netFor, priceFor } from "@/lib/fees";
import { money, pct } from "@/lib/format";

function ItemForm() {
  const { items, store, reloadItems, ifoodRate, fee, showToast } = useApp();
  const router = useRouter();
  const params = useSearchParams();
  const id = params.get("id");
  const editing = id ? items.find((i) => i.id === id) : undefined;

  const [name, setName] = useState("");
  const [target, setTarget] = useState<number | null>(params.get("receber") ? Number(params.get("receber")) : null);
  const [currentPrice, setCurrentPrice] = useState<number | null>(params.get("preco") ? Number(params.get("preco")) : null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (editing) { setName(editing.name); setTarget(editing.target_net); setCurrentPrice(editing.current_price); }
  }, [editing]);

  const f = fee("ifood");
  const rate = ifoodRate();
  const ideal = target ? priceFor(target, rate) : null;
  const netNow = currentPrice ? netFor(currentPrice, rate) : null;
  const short = target && netNow != null ? Math.round((target - netNow) * 100) / 100 : null;

  const save = async () => {
    if (!name.trim() || !target) return setError("Preencha o nome e quanto quer receber.");
    setBusy(true); setError("");
    try {
      await store.saveItem({ id: editing?.id, created_at: editing?.created_at, name: name.trim(), target_net: target,
        current_price: currentPrice, ideal_price: ideal, ideal_rate: rate });
      await reloadItems();
      showToast(editing ? "Item atualizado." : "Item salvo no cardápio.");
      router.push("/cardapio");
    } catch (e) { setError((e as Error).message); setBusy(false); }
  };
  const remove = async () => {
    if (!editing || !confirm(`Excluir “${editing.name}”?`)) return;
    await store.deleteItem(editing.id); await reloadItems(); router.push("/cardapio");
  };

  return (
    <>
      <header className="row">
        <button className="btn link" style={{ padding: 0, textDecoration: "none", fontSize: 22 }} onClick={() => router.back()} aria-label="Voltar">‹</button>
        <h1 style={{ fontSize: 20, fontWeight: 900 }}>{editing ? "Editar item" : "Novo item"}</h1>
      </header>
      <label className="field">Nome do item
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: X-Burguer" autoFocus={!editing} />
      </label>
      <label className="field">Quanto quer receber limpo
        <MoneyInput value={target} onChange={setTarget} />
        <span className="hint">Normalmente é o preço que você cobra no balcão.</span>
      </label>
      <label className="field">Preço no iFood hoje (opcional)
        <MoneyInput value={currentPrice} onChange={setCurrentPrice} />
      </label>

      <section className="card" style={{ background: "#f0f0f3", border: 0 }}>
        <div className="eyebrow">Plano {f.plan?.name ?? ""} · {pct(rate * 100)}{f.custom ? " · contrato próprio" : ""}</div>
        <div className="row between" style={{ marginTop: 8 }}>
          <span className="small muted">Preço ideal no iFood</span>
          <b style={{ fontSize: 26, fontWeight: 900 }}>{money(ideal)}</b>
        </div>
        {short != null && short > 0.004 && (
          <p className="note warn small">⚠ Com {money(currentPrice)} você recebe <b>{money(netNow)}</b>, {money(short)} a menos que o desejado. Suba para {money(ideal)}.</p>
        )}
        {short != null && short <= 0.004 && (
          <p className="note ok small">✓ Com {money(currentPrice)} você recebe {money(netNow)}. Preço ok.</p>
        )}
      </section>
      {error && <div className="error">{error}</div>}
      <button className="btn primary block" onClick={save} disabled={busy}>{busy ? "Salvando…" : "Salvar item"}</button>
      {editing && <button className="btn outline block" onClick={remove}>Excluir item</button>}
      <button className="btn link" onClick={() => router.push("/cardapio")}>Cancelar</button>
    </>
  );
}

export default function Page() {
  return <AppShell nav={false}><Suspense><ItemForm /></Suspense></AppShell>;
}
