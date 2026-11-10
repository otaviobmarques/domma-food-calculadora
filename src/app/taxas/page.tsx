"use client";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { useApp } from "@/components/AppProvider";
import { UpdateModal } from "@/components/UpdateModal";
import { dateBR, dateTimeBR, money, parseNum, pct } from "@/lib/format";
import { APPS, appName, type AppId } from "@/lib/types";

function Fees() {
  const { current, profile, pending, checkUpdates, updateProfile, showToast, lastSync } = useApp();
  const params = useSearchParams();
  const [app, setApp] = useState<AppId>("ifood");
  const [busy, setBusy] = useState(false);
  const [modal, setModal] = useState<AppId[] | null>(null);
  const [msg, setMsg] = useState("");
  const v = current[app];
  const custom = profile?.custom_fees?.[app];
  const planKey = profile?.plan_choice?.[app] ?? v?.plans[0]?.key;
  const plan = v?.plans.find((p) => p.key === planKey) ?? v?.plans[0];
  const [comm, setComm] = useState("");
  const [onl, setOnl] = useState("");

  useEffect(() => {
    setComm(String(custom?.commission ?? plan?.commission ?? "").replace(".", ","));
    setOnl(String(custom?.online ?? plan?.online ?? "").replace(".", ","));
    setMsg("");
  }, [app, custom?.commission, custom?.online, plan?.commission, plan?.online]);

  const check = async () => {
    setBusy(true); setMsg("");
    try {
      const apps = await checkUpdates();
      if (apps.length) setModal(apps);
      else setMsg("Você já está com a versão mais recente das taxas.");
    } catch (e) { showToast((e as Error).message); } finally { setBusy(false); }
  };

  const choosePlan = (key: string) => updateProfile({ plan_choice: { ...profile!.plan_choice, [app]: key } });
  const setCustom = (enabled: boolean, c = parseNum(comm), o = parseNum(onl)) =>
    updateProfile({ custom_fees: { ...profile!.custom_fees, [app]: { enabled, commission: isNaN(c) ? 0 : c, online: isNaN(o) ? 0 : o } } });
  const saveCustom = () => {
    const c = parseNum(comm), o = parseNum(onl);
    if (isNaN(c) || isNaN(o) || c < 0 || o < 0 || c + o >= 100) return showToast("Confira os percentuais do contrato.");
    setCustom(true, c, o).then(() => showToast("Taxas do seu contrato salvas."));
  };
  const backToOfficial = () => setCustom(false).then(() => showToast("Voltou para a tabela oficial."));
  const isPending = pending.includes(app);

  return (
    <>
      <h1 style={{ fontSize: 26, fontWeight: 900 }}>Minhas taxas</h1>
      {params.get("boas-vindas") && <div className="note ok small" style={{ margin: 0 }}>Conta criada! Escolha seu plano do iFood para o cálculo ficar certinho.</div>}
      <div className="chips">
        {APPS.map((a) => (
          <button key={a.id} className={`chip ${app === a.id ? "on" : ""}`} onClick={() => setApp(a.id)}>
            {a.name}{pending.includes(a.id) ? " •" : ""}
          </button>
        ))}
      </div>

      <section className="card" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div className="row between">
          <div>
            <h3>{v?.kind === "oficial" ? "Tabela oficial" : "Tabela de referência"} {appName(app)}</h3>
            <div className="small muted">Versão {v?.label ?? "—"} · conferida em {dateBR(v?.published_at ?? v?.valid_from)}</div>
          </div>
          {isPending ? <span className="badge warn">Nova versão</span> : <span className="badge ok">Em dia</span>}
        </div>
        {v?.kind === "estimativa" && <p className="small note warn" style={{ margin: 0 }}>Estimativa: o {appName(app)} não publica tabela fixa. Se você tem contrato, use as taxas dele abaixo.</p>}
        <button className="btn primary block" onClick={check} disabled={busy}>⟳ {busy ? "Buscando…" : "Buscar atualização de taxas"}</button>
        {msg && <p className="note ok small" style={{ margin: 0 }}>{msg}</p>}
        <p className="small muted" style={{ margin: 0 }}>
          Quando o {appName(app)} muda as taxas, a Domma atualiza a tabela e você recebe um aviso para recalcular o cardápio.
          O app também confere sozinho{lastSync ? ` (última: ${dateTimeBR(lastSync.toISOString())})` : ""}.
        </p>
        {v?.source_url && <a className="tiny muted" href={v.source_url} target="_blank" rel="noreferrer">Fonte: {v.source_label ?? v.source_url}</a>}
      </section>

      {v && (
        <>
          <div className="small muted" style={{ fontWeight: 700 }}>{v.plans.length > 1 ? "Seu plano" : "Plano"}</div>
          <div className="plan-grid">
            {v.plans.map((p) => (
              <button key={p.key} className={`plan ${planKey === p.key ? "on" : ""}`} onClick={() => choosePlan(p.key)}>
                <b>{p.name}</b>
                <span className="small muted">{pct(p.commission)} + {pct(p.online)}</span>
                {p.monthly ? <div className="tiny muted">Mensalidade {money(p.monthly)}</div> : p.subtitle ? <div className="tiny muted">{p.subtitle}</div> : null}
              </button>
            ))}
          </div>
          {plan?.monthly ? <p className="tiny muted" style={{ margin: 0 }}>A mensalidade só é cobrada quando você vende mais de {money(plan.monthly_threshold ?? 0)} no mês pelo app. Ela não entra no cálculo por item.</p> : null}
        </>
      )}

      <section className="card" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <label className="check row between" style={{ justifyContent: "space-between" }}>
          Meu contrato tem taxas diferentes
          <input type="checkbox" checked={!!custom?.enabled} onChange={(e) => (e.target.checked ? saveCustom() : backToOfficial())} />
        </label>
        <div className="row" style={{ gap: 10 }}>
          <label className="field grow">Comissão %
            <input className="input" inputMode="decimal" disabled={!custom?.enabled} value={comm} onChange={(e) => setComm(e.target.value)} onBlur={() => custom?.enabled && saveCustom()} />
          </label>
          <label className="field grow">Pagamento online %
            <input className="input" inputMode="decimal" disabled={!custom?.enabled} value={onl} onChange={(e) => setOnl(e.target.value)} onBlur={() => custom?.enabled && saveCustom()} />
          </label>
        </div>
        {custom?.enabled && (
          <>
            <p className="tiny muted" style={{ margin: 0 }}>Com taxa personalizada, atualizações da Domma não mudam seus números: você recebe o aviso e decide.</p>
            <button className="link-red" style={{ alignSelf: "flex-start" }} onClick={backToOfficial}>Voltar à tabela oficial</button>
          </>
        )}
      </section>

      {modal && <UpdateModal apps={modal} onClose={() => setModal(null)} />}
    </>
  );
}

export default function Page() {
  return <AppShell><Suspense><Fees /></Suspense></AppShell>;
}
