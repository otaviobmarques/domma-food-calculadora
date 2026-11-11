"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useApp } from "@/components/AppProvider";
import { Logo } from "@/components/Logo";
import { Toast } from "@/components/AppShell";
import { diffVersions, pickCurrent } from "@/lib/fees";
import { dateBR, dateTimeBR, money, parseNum, pct } from "@/lib/format";
import { APPS, appName, type AdminStats, type AppId, type FeeKind, type FeePlan, type FeeVersion } from "@/lib/types";

const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const labelFor = (d: string) => `${MONTHS[Number(d.slice(5, 7)) - 1]}/${d.slice(0, 4)}`;
const today = () => new Date().toISOString().slice(0, 10);

type PlanDraft = { key: string; name: string; subtitle: string; commission: string; online: string; monthly: string; monthly_threshold: string };
const toDraft = (p: FeePlan): PlanDraft => ({
  key: p.key, name: p.name, subtitle: p.subtitle ?? "", commission: String(p.commission).replace(".", ","), online: String(p.online).replace(".", ","),
  monthly: p.monthly != null ? String(p.monthly) : "", monthly_threshold: p.monthly_threshold != null ? String(p.monthly_threshold) : "",
});

function Panel() {
  const { store, profile, ready, user, showToast, refreshFees } = useApp();
  const router = useRouter();
  const [versions, setVersions] = useState<FeeVersion[]>([]);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [checking, setChecking] = useState(false);
  const [checkMsg, setCheckMsg] = useState("");

  // formulário
  const [editId, setEditId] = useState<string | undefined>();
  const [app, setApp] = useState<AppId>("ifood");
  const [kind, setKind] = useState<FeeKind>("oficial");
  const [plans, setPlans] = useState<PlanDraft[]>([]);
  const [validFrom, setValidFrom] = useState(today());
  const [label, setLabel] = useState(labelFor(today()));
  const [sourceUrl, setSourceUrl] = useState("");
  const [sourceLabel, setSourceLabel] = useState("");
  const [notes, setNotes] = useState("");
  const [notify, setNotify] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { if (ready && !user) router.replace("/login"); }, [ready, user, router]);

  const load = useCallback(async () => {
    const [v, s] = await Promise.all([store.admin.listVersions(), store.admin.stats().catch(() => null)]);
    setVersions(v); setStats(s);
    return v;
  }, [store]);
  useEffect(() => { if (profile?.is_admin) load().catch((e) => showToast(e.message)); }, [profile, load, showToast]);

  const currentByApp = useMemo(() => {
    const o = {} as Record<AppId, FeeVersion | null>;
    for (const a of APPS) o[a.id] = pickCurrent(versions, a.id);
    return o;
  }, [versions]);

  const resetForm = useCallback((a: AppId, list?: FeeVersion[]) => {
    const c = list ? pickCurrent(list, a) : currentByApp[a];
    setEditId(undefined); setApp(a);
    setKind(c?.kind ?? (a === "ifood" ? "oficial" : "estimativa"));
    setPlans((c?.plans ?? [{ key: "padrao", name: "Padrão", commission: 0, online: 3.2 }]).map(toDraft));
    setSourceUrl(c?.source_url ?? ""); setSourceLabel(c?.source_label ?? ""); setNotes("");
    setValidFrom(today()); setLabel(labelFor(today())); setNotify(true); setError("");
  }, [currentByApp]);
  useEffect(() => { if (versions.length && !plans.length) resetForm("ifood"); }, [versions, plans.length, resetForm]);

  const editDraft = (v: FeeVersion) => {
    setEditId(v.id); setApp(v.app); setKind(v.kind); setPlans(v.plans.map(toDraft)); setValidFrom(v.valid_from); setLabel(v.label);
    setSourceUrl(v.source_url); setSourceLabel(v.source_label ?? ""); setNotes(v.notes ?? ""); setNotify(v.notify);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const parsedPlans = (): FeePlan[] | string => {
    const out: FeePlan[] = [];
    for (const p of plans) {
      const c = parseNum(p.commission), o = parseNum(p.online);
      if (!p.name.trim()) return "Todo plano precisa de nome.";
      if (isNaN(c) || isNaN(o) || c < 0 || o < 0 || c + o >= 100) return `Percentuais inválidos no plano ${p.name}.`;
      const m = p.monthly.trim() ? parseNum(p.monthly) : null;
      const t = p.monthly_threshold.trim() ? parseNum(p.monthly_threshold) : null;
      out.push({ key: p.key || p.name.toLowerCase().normalize("NFD").replace(/[^a-z0-9]/g, ""), name: p.name.trim(), subtitle: p.subtitle.trim() || undefined,
        commission: c, online: o, monthly: m, monthly_threshold: t });
    }
    return out;
  };

  const preview = useMemo(() => {
    const pp = parsedPlans();
    if (typeof pp === "string") return [];
    return diffVersions(currentByApp[app], { ...(currentByApp[app] as FeeVersion), plans: pp, kind });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plans, kind, app, currentByApp]);

  const submit = async (publish: boolean) => {
    setError("");
    const pp = parsedPlans();
    if (typeof pp === "string") return setError(pp);
    if (!/^https?:\/\/\S+\.\S+/.test(sourceUrl.trim())) return setError("Toda publicação precisa do link da fonte (https://…).");
    if (publish && !confirm(`Publicar ${appName(app)} ${label} para todos os clientes?`)) return;
    setSaving(true);
    try {
      const saved = await store.admin.saveVersion({
        id: editId, app, kind, label: label.trim() || labelFor(validFrom), plans: pp, valid_from: validFrom,
        source_url: sourceUrl.trim(), source_label: sourceLabel.trim() || null, notes: notes.trim() || null, notify,
        status: publish ? "published" : "draft",
      });
      showToast(publish
        ? `Publicado! ${validFrom > today() ? `Entra em vigor em ${dateBR(validFrom)}.` : "Os clientes já estão recebendo."}`
        : "Rascunho salvo.");
      const fresh = await load(); await refreshFees({ silent: true });
      if (publish) resetForm(app, fresh); else setEditId(saved.id);
    } catch (e) { setError((e as Error).message); } finally { setSaving(false); }
  };

  const publishDraft = async (v: FeeVersion) => {
    if (!confirm(`Publicar ${appName(v.app)} ${v.label} para todos?`)) return;
    await store.admin.publishVersion(v.id); await load(); await refreshFees({ silent: true }); showToast("Publicado para todos.");
  };
  const deleteDraft = async (v: FeeVersion) => {
    if (!confirm("Apagar este rascunho?")) return;
    await store.admin.deleteVersion(v.id); await load();
  };
  const runCheck = async () => {
    setChecking(true); setCheckMsg("");
    try {
      const res = await store.admin.checkSources();
      setCheckMsg(res.map((r) => `${appName(r.app)}: ${r.error ? r.error : r.changed ? "MUDANÇA DETECTADA — confira e publique nova versão" : "sem mudança"}`).join(" · "));
      setStats(await store.admin.stats().catch(() => null));
    } catch (e) { setCheckMsg((e as Error).message); } finally { setChecking(false); }
  };

  if (!ready || !profile || (profile.is_admin && !versions.length)) return <div className="screen center"><div className="spinner" /></div>;
  if (!profile.is_admin) return (
    <div className="auth"><Logo /><h1>Acesso restrito</h1><p className="muted">O painel é só para a equipe Domma.</p><Link href="/" className="btn primary">Voltar</Link></div>
  );

  const ifood = currentByApp.ifood;
  const upd = (i: number, k: keyof PlanDraft, val: string) => setPlans(plans.map((p, j) => (j === i ? { ...p, [k]: val } : p)));

  return (
    <div className="panel">
      <aside>
        <div className="brand"><Logo size={34} dark /><span className="tiny" style={{ color: "#fff", opacity: .7, fontWeight: 800, letterSpacing: 2 }}>PAINEL INTERNO</span></div>
        <a className="on" href="#taxas">Taxas dos apps</a>
        <a href="#historico">Histórico</a>
        <Link href="/">Abrir app do cliente</Link>
      </aside>
      <main>
        <div className="row between wrap" id="taxas">
          <div>
            <div className="eyebrow">Calculadora iFood</div>
            <h1 style={{ fontSize: 28, fontWeight: 900 }}>Taxas dos apps</h1>
            <p className="small muted" style={{ margin: 0 }}>A tabela publicada aqui vale para todos os clientes que usam as taxas oficiais.</p>
          </div>
          <button className="btn outline" onClick={runCheck} disabled={checking}>{checking ? "Verificando…" : "Verificar sites dos apps agora"}</button>
        </div>
        {checkMsg && <div className="note warn small" style={{ margin: 0 }}>{checkMsg}</div>}

        <div className="kpis">
          <div className="card"><small className="muted">Versão em vigor (iFood)</small><b>{ifood?.label ?? "—"}</b><span className="small" style={{ color: "var(--green)" }}>Publicada em {dateBR(ifood?.published_at)}</span></div>
          <div className="card"><small className="muted">Última verificação automática</small><b>{stats?.last_check ? dateTimeBR(stats.last_check.checked_at) : "—"}</b>
            <span className="small muted">{stats?.last_check ? (stats.last_check.changed ? "Mudança detectada!" : stats.last_check.error ? "Com erro" : "Sem mudança detectada") : "Nenhuma ainda"}</span></div>
          <div className="card"><small className="muted">Clientes com taxa personalizada</small><b>{stats?.custom_count ?? "—"}</b><span className="small muted">de {stats?.client_count ?? "—"} · não recebem atualização automática</span></div>
        </div>

        <section className="card" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div className="row between"><h3>{editId ? "Editar rascunho" : "Nova versão de taxas"}</h3>{editId && <button className="link-red" onClick={() => resetForm(app)}>Cancelar edição</button>}</div>
          <div className="form-grid">
            <label className="field">App
              <select className="input" value={app} onChange={(e) => resetForm(e.target.value as AppId)} disabled={!!editId}>
                {APPS.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </label>
            <label className="field">Status
              <select className="input" value={kind} onChange={(e) => setKind(e.target.value as FeeKind)}>
                <option value="oficial">Oficial (tabela pública)</option><option value="estimativa">Estimativa</option>
              </select>
            </label>
            <label className="field">Vale a partir de
              <input className="input" type="date" value={validFrom} onChange={(e) => { setValidFrom(e.target.value); setLabel(labelFor(e.target.value)); }} />
            </label>
            <label className="field">Nome da versão
              <input className="input" value={label} onChange={(e) => setLabel(e.target.value)} />
            </label>
          </div>

          {plans.map((p, i) => (
            <div key={i} className="plan-row">
              <label className="field">Plano<input className="input" value={p.name} onChange={(e) => upd(i, "name", e.target.value)} /></label>
              <label className="field">Comissão %<input className="input" inputMode="decimal" value={p.commission} onChange={(e) => upd(i, "commission", e.target.value)} /></label>
              <label className="field">Pagamento online %<input className="input" inputMode="decimal" value={p.online} onChange={(e) => upd(i, "online", e.target.value)} /></label>
              <label className="field">Mensalidade R$<input className="input" inputMode="decimal" value={p.monthly} placeholder="—" onChange={(e) => upd(i, "monthly", e.target.value)} /></label>
              <label className="field">Cobra acima de R$<input className="input" inputMode="decimal" value={p.monthly_threshold} placeholder="—" onChange={(e) => upd(i, "monthly_threshold", e.target.value)} /></label>
            </div>
          ))}
          <div className="row">
            <button className="link-red" onClick={() => setPlans([...plans, { key: "", name: "", subtitle: "", commission: "", online: "3,2", monthly: "", monthly_threshold: "" }])}>+ Adicionar plano</button>
            {plans.length > 1 && <button className="link-red" onClick={() => setPlans(plans.slice(0, -1))}>− Remover último</button>}
          </div>

          <div className="form-grid">
            <label className="field" style={{ gridColumn: "span 2" }}>Fonte da informação (link) *
              <input className="input" value={sourceUrl} placeholder="https://parceiros.ifood.com.br/…" onChange={(e) => setSourceUrl(e.target.value)} />
            </label>
            <label className="field" style={{ gridColumn: "span 2" }}>Descrição da fonte
              <input className="input" value={sourceLabel} placeholder="Tabela pública / comunicado / contrato" onChange={(e) => setSourceLabel(e.target.value)} />
            </label>
          </div>
          <label className="field">Observação para o cliente (opcional)
            <input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ex.: o iFood reduziu a taxa de pagamento online." />
          </label>

          {preview.length > 0 && (
            <div className="diff"><b className="small">O que muda para os clientes</b>
              <table><tbody>{preview.map((c) => <tr key={c.field}><td>{c.field}</td><td className="old">{c.from}</td><td>→</td><td><b>{c.to}</b></td></tr>)}</tbody></table>
            </div>
          )}
          <label className="check"><input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} />Avisar os clientes no app para recalcular o cardápio</label>
          {error && <div className="error">{error}</div>}
          <div className="row">
            <button className="btn primary" disabled={saving} onClick={() => submit(true)}>Publicar para todos</button>
            <button className="btn outline" disabled={saving} onClick={() => submit(false)}>Salvar rascunho</button>
          </div>
        </section>

        <section className="card">
          <h3 style={{ marginBottom: 10 }}>Taxas em vigor por app</h3>
          <div className="tbl-wrap"><table className="tbl">
            <thead><tr><th>App</th><th>Versão</th><th>Comissão</th><th>Online</th><th>Mensalidades</th><th>Fonte</th><th>Status</th></tr></thead>
            <tbody>{APPS.map((a) => { const v = currentByApp[a.id]; return (
              <tr key={a.id}>
                <td><b>{a.name}</b></td><td>{v?.label ?? "—"}</td>
                <td>{v?.plans.map((p) => `${p.name} ${pct(p.commission)}`).join(" / ")}</td>
                <td>{v ? [...new Set(v.plans.map((p) => pct(p.online)))].join(" / ") : "—"}</td>
                <td>{v?.plans.some((p) => p.monthly) ? v.plans.map((p) => money(p.monthly)).join(" / ") : "—"}</td>
                <td>{v ? <a href={v.source_url} target="_blank" rel="noreferrer">{v.source_label ?? "link"}</a> : "—"}</td>
                <td>{v?.kind === "oficial" ? <span className="badge ok">Oficial</span> : <span className="badge warn">Estimativa</span>}</td>
              </tr>); })}</tbody>
          </table></div>
        </section>

        <section className="card" id="historico">
          <h3 style={{ marginBottom: 10 }}>Histórico de versões</h3>
          <div className="tbl-wrap"><table className="tbl">
            <thead><tr><th>App</th><th>Versão</th><th>Vigência</th><th>Planos</th><th>Situação</th><th></th></tr></thead>
            <tbody>{[...versions].sort((a, b) => b.created_at.localeCompare(a.created_at)).map((v) => {
              const inForce = currentByApp[v.app]?.id === v.id;
              return (
                <tr key={v.id}>
                  <td>{appName(v.app)}</td><td>{v.label}</td><td>{dateBR(v.valid_from)}</td>
                  <td className="small">{v.plans.map((p) => `${p.name}: ${pct(p.commission)} + ${pct(p.online)}`).join("; ")}</td>
                  <td>{v.status === "draft" ? <span className="badge red">Rascunho</span> : inForce ? <span className="badge ok">Em vigor</span>
                    : v.valid_from > today() ? <span className="badge warn">Agendada</span> : <span className="badge" style={{ background: "#eee" }}>Substituída</span>}
                    {v.published_at && <div className="tiny muted">publicada {dateTimeBR(v.published_at)}</div>}</td>
                  <td>{v.status === "draft" && <div className="row"><button className="link-red" onClick={() => editDraft(v)}>Editar</button><button className="link-red" onClick={() => publishDraft(v)}>Publicar</button><button className="link-red" onClick={() => deleteDraft(v)}>Apagar</button></div>}</td>
                </tr>);
            })}</tbody>
          </table></div>
        </section>
      </main>
      <Toast />
    </div>
  );
}

export default function Page() { return <Panel />; }
