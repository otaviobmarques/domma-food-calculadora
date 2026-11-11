"use client";
import Link from "next/link";
import { useState } from "react";
import { AppShell } from "@/components/AppShell";
import { useApp } from "@/components/AppProvider";
import { FeeStatus } from "@/components/FeeStatus";
import { Logo } from "@/components/Logo";
import { itemStatus } from "@/lib/fees";
import { pct } from "@/lib/format";

function Home() {
  const { profile, fee, items, ifoodRate, store } = useApp();
  const [menu, setMenu] = useState(false);
  const f = fee("ifood");
  const below = items.filter((i) => itemStatus(i, ifoodRate()).status === "revisar").length;
  return (
    <>
      <header className="row between">
        <div className="row">
          <Logo size={30} />
          <div style={{ lineHeight: 1.15 }}>
            <div className="eyebrow">Calculadora iFood</div>
            <div className="small muted">Olá, {profile?.restaurant_name || "restaurante"}</div>
          </div>
        </div>
        <div style={{ position: "relative" }}>
          <button className="btn outline small" aria-label="Configurações" onClick={() => setMenu(!menu)}>⚙</button>
          {menu && (
            <div className="card" style={{ position: "absolute", right: 0, top: 44, zIndex: 5, minWidth: 190, padding: 8, display: "flex", flexDirection: "column" }}>
              <Link className="btn link" href="/taxas">Minhas taxas</Link>
              {profile?.is_admin && <Link className="btn link" href="/painel">Painel Domma</Link>}
              <button className="btn link" onClick={() => store.signOut()}>Sair</button>
            </div>
          )}
        </div>
      </header>

      <FeeStatus />

      <section className="hero">
        <h2>Quanto cobrar<br />nos apps?</h2>
        <p>Diga quanto quer receber limpo e veja o preço certo no iFood, Keeta, 99Food e aiqfome.</p>
        <Link href="/calcular" className="btn white">Calcular preço</Link>
      </section>

      <section className="card">
        <div className="row between" style={{ marginBottom: 10 }}>
          <h3>Suas taxas{f.custom && <span className="badge warn" style={{ marginLeft: 6 }}>Contrato próprio</span>}</h3>
          <Link href="/taxas" className="link-red">Alterar</Link>
        </div>
        <div className="stats">
          <div className="stat"><small>Plano</small><b>{f.plan?.name ?? "—"}</b></div>
          <div className="stat"><small>Comissão</small><b>{pct(f.commission)}</b></div>
          <div className="stat"><small>Online</small><b>{pct(f.online)}</b></div>
        </div>
      </section>

      <section className="card">
        <div className="row between" style={{ marginBottom: 10 }}>
          <h3>Meu cardápio</h3>
          <Link href="/cardapio" className="link-red">Ver tudo</Link>
        </div>
        {items.length === 0 ? (
          <p className="small muted" style={{ margin: 0 }}>Nenhum item ainda. <Link href="/cardapio/novo" className="link-red">Cadastrar o primeiro</Link></p>
        ) : below > 0 ? (
          <div className="status warn"><span>⚠</span><span><b>{below} {below === 1 ? "item está" : "itens estão"}</b> abaixo do valor que você quer receber</span></div>
        ) : (
          <div className="status ok"><span>✓</span><span>Todos os {items.length} itens estão com preço certo.</span></div>
        )}
      </section>
    </>
  );
}

export default function Page() {
  return <AppShell><Home /></AppShell>;
}
