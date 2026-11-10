"use client";
import Link from "next/link";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { useApp } from "@/components/AppProvider";
import { itemStatus } from "@/lib/fees";
import { money, pct } from "@/lib/format";

type Filter = "todos" | "revisar" | "ok";

function Menu() {
  const { items, ifoodRate, recalcMenu, pending, showToast, fee } = useApp();
  const [filter, setFilter] = useState<Filter>("todos");
  const [busy, setBusy] = useState(false);
  const rate = ifoodRate();
  const f = fee("ifood");
  const rows = items.map((i) => ({ item: i, ...itemStatus(i, rate) }));
  const stale = items.filter((i) => i.ideal_rate == null || Math.abs(i.ideal_rate - rate) > 1e-6).length;
  const counts = { todos: rows.length, revisar: rows.filter((r) => r.status === "revisar").length, ok: rows.filter((r) => r.status === "ok").length };
  const shown = rows.filter((r) => filter === "todos" || r.status === filter);
  const changed = pending.includes("ifood") || stale > 0;

  const recalc = async () => {
    setBusy(true);
    try { const n = await recalcMenu(); showToast(`${n} itens recalculados com ${f.plan?.name ?? ""} · ${pct(rate * 100)}.`); }
    catch (e) { showToast((e as Error).message); } finally { setBusy(false); }
  };

  return (
    <>
      <header className="row between">
        <h1 style={{ fontSize: 26, fontWeight: 900 }}>Meu cardápio</h1>
        <Link href="/cardapio/novo" className="btn primary small">Novo item</Link>
      </header>

      <div className={`status ${changed ? "warn" : ""}`} style={changed ? {} : { background: "var(--red-soft)", color: "var(--ink)" }}>
        <div className="grow">
          {changed
            ? <><b>As taxas mudaram.</b> {stale > 0 ? `${stale} ${stale === 1 ? "item está" : "itens estão"} com o preço ideal calculado em taxas antigas.` : "Recalcule o preço de todos os itens de uma vez."}</>
            : <><b>O iFood mudou as taxas?</b> Recalcule o preço de todos os itens de uma vez.</>}
          <div style={{ marginTop: 6 }}><button className="link-red" onClick={recalc} disabled={busy || !items.length}>{busy ? "Recalculando…" : "Recalcular cardápio"}</button></div>
        </div>
      </div>

      <div className="chips">
        {(["todos", "revisar", "ok"] as Filter[]).map((k) => (
          <button key={k} className={`chip ${filter === k ? "on" : ""}`} onClick={() => setFilter(k)}>
            {k === "todos" ? "Todos" : k === "revisar" ? "Revisar" : "Ok"} {counts[k]}
          </button>
        ))}
      </div>

      {shown.length === 0 && <p className="muted center-text">{items.length ? "Nenhum item neste filtro." : "Cadastre seus itens para saber quais estão com preço abaixo do ideal."}</p>}

      {shown.map(({ item, status, net }) => (
        <Link key={item.id} href={`/cardapio/novo?id=${item.id}`} className="card item">
          <div className="row between">
            <b>{item.name}</b>
            {status === "ok" ? <span className="badge ok">Ok</span> : <span className="badge warn">Revisar</span>}
          </div>
          <div className="cols">
            <span>Quer receber<b>{money(item.target_net)}</b></span>
            <span>Preço ideal<b>{money(item.ideal_price)}</b></span>
            <span>No iFood hoje<b>{money(item.current_price)}</b></span>
          </div>
          {status === "revisar" && (
            <p className="tiny muted" style={{ margin: "6px 0 0" }}>
              {net == null ? "Informe o preço atual no iFood." : `Hoje você recebe ${money(net)} — ${money(item.target_net - net)} a menos.`}
            </p>
          )}
        </Link>
      ))}
    </>
  );
}

export default function Page() {
  return <AppShell><Menu /></AppShell>;
}
