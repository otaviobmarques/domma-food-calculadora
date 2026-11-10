"use client";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { useApp } from "@/components/AppProvider";
import { Logo } from "@/components/Logo";
import { MoneyInput } from "@/components/MoneyInput";
import { FeeStatus } from "@/components/FeeStatus";
import { netFor, priceFor, totalRate } from "@/lib/fees";
import { money, pct } from "@/lib/format";
import { APPS, type AppId } from "@/lib/types";

type Mode = "cobrar" | "recebo";

function Calculator() {
  const { current, fee, profile } = useApp();
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("cobrar");
  const [value, setValue] = useState<number | null>(25);
  const [online, setOnline] = useState(true);
  const [showCoupon, setShowCoupon] = useState(false);
  const [coupon, setCoupon] = useState(0);
  const [plans, setPlans] = useState<Partial<Record<AppId, string>>>({});

  const planOf = (app: AppId) => plans[app] ?? profile?.plan_choice?.[app];

  const cards = useMemo(() => APPS.map((a) => {
    const v = current[a.id];
    const f = fee(a.id, planOf(a.id));
    const rate = totalRate(f.commission, f.online, online);
    const val = value ?? 0;
    const price = mode === "cobrar" ? priceFor(val, rate, coupon) : val;
    const net = mode === "cobrar" ? val : netFor(val, rate, coupon);
    return { app: a, version: v, f, rate, price, net };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [current, fee, value, online, mode, coupon, plans, profile]);

  const valid = (value ?? 0) > 0 && cards.some((c) => c.version);
  const best = valid
    ? cards.filter((c) => c.version).reduce((b, c) => (mode === "cobrar" ? (c.price < b.price ? c : b) : (c.net > b.net ? c : b)))
    : null;
  const label = (current.ifood?.label ?? "").replace("/", " ");

  const togglePlan = (app: AppId) => {
    const v = current[app];
    if (!v || v.plans.length < 2) return;
    const i = v.plans.findIndex((p) => p.key === (planOf(app) ?? v.plans[0].key));
    setPlans({ ...plans, [app]: v.plans[(i + 1) % v.plans.length].key });
  };

  const save = () => {
    const q = mode === "cobrar" ? `receber=${value ?? ""}` : `preco=${value ?? ""}`;
    router.push(`/cardapio/novo?${q}`);
  };

  return (
    <>
      <div className="redtop">
        <div className="row between">
          <div><h1>Calculadora</h1><div className="small">Compare o preço em cada app</div></div>
          <span style={{ background: "#fff", borderRadius: 999, padding: "5px 12px" }}><Logo size={20} /></span>
        </div>
      </div>
      <section className="card pull-up" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div className="tabs">
          <button className={mode === "cobrar" ? "on" : ""} onClick={() => setMode("cobrar")}>Quanto cobrar?</button>
          <button className={mode === "recebo" ? "on" : ""} onClick={() => setMode("recebo")}>Quanto recebo?</button>
        </div>
        <label className="field" htmlFor="valor">
          <span className="muted">{mode === "cobrar" ? "Quanto você quer receber limpo por este item?" : "Qual o preço do item no app?"}</span>
        </label>
        <MoneyInput id="valor" big value={value} onChange={setValue} autoFocus />
        <label className="check"><input type="checkbox" checked={online} onChange={(e) => setOnline(e.target.checked)} />Cliente paga pelo app (cartão ou Pix)</label>
        {showCoupon ? (
          <label className="field">Cupom bancado pela loja (%)
            <input className="input" inputMode="decimal" value={coupon || ""} placeholder="0"
              onChange={(e) => setCoupon(Math.min(90, Number(e.target.value.replace(",", ".")) || 0))} />
            <span className="hint">O preço de tabela sobe para compensar; as taxas incidem sobre o valor pago pelo cliente.</span>
          </label>
        ) : <button className="link-red" style={{ alignSelf: "flex-start" }} onClick={() => setShowCoupon(true)}>+ Cupom bancado pela loja</button>}
      </section>

      <div className="row between">
        <h3 style={{ fontSize: 16 }}>{mode === "cobrar" ? "Cadastre em cada app por" : "Você recebe em cada app"}</h3>
        <span className="tiny muted">taxas {label}</span>
      </div>

      <div className="apps-grid">
        {cards.map(({ app, version, f, rate, price, net }) => {
          const isBest = best?.app.id === app.id;
          const multi = (version?.plans.length ?? 0) > 1;
          return (
            <button key={app.id} className={`app-card ${isBest ? "best" : ""}`} onClick={() => togglePlan(app.id)} aria-label={`${app.name}${multi ? ", toque para trocar o plano" : ""}`}>
              {isBest && <span className="badge best">{mode === "cobrar" ? "Menor preço" : "Mais lucro"}</span>}
              <div className="row between">
                <b>{app.name}</b>
                {f.custom ? <span className="badge red">Contrato</span>
                  : version?.kind === "oficial" ? <span className="badge ok">Oficial</span> : <span className="badge warn">Estimativa</span>}
              </div>
              <span className="tiny muted">{f.plan ? `${f.plan.name}${f.plan.subtitle ? " · " + f.plan.subtitle : ""}` : "sem tabela"}</span>
              {multi && <span className="swap">⇄ trocar plano</span>}
              <span className="price">{valid ? money(mode === "cobrar" ? price : net) : "—"}</span>
              <span className="tiny muted">{mode === "cobrar" ? `recebe ${money(value)}` : `cobrando ${money(price)}`}</span>
              <span className="taxes"><span>Taxas</span><span>{pct(rate * 100)}</span></span>
            </button>
          );
        })}
      </div>
      {coupon > 0 && <p className="small muted center-text" style={{ margin: 0 }}>Com cupom de {pct(coupon)} o cliente paga {money(best ? best.price * (1 - coupon / 100) : null)} no app destacado.</p>}

      <button className="btn primary block" disabled={!valid} onClick={save}>Salvar no cardápio</button>
      <FeeStatus />
    </>
  );
}

export default function Page() {
  return <AppShell><Calculator /></AppShell>;
}
