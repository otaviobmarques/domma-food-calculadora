"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useApp } from "./AppProvider";
import { dateBR, dateTimeBR } from "@/lib/format";
import { displayLogin, toEmail } from "@/lib/login";
import type { AdminUser } from "@/lib/types";

type Filter = "todos" | "ativos" | "bloqueados" | "pendentes" | "admins";
const LINK_HOURS = 72;

interface LinkInfo { user: AdminUser; url: string }

function accessMessage(u: AdminUser, url: string) {
  const nome = u.restaurant_name ? `, ${u.restaurant_name}` : "";
  return `Olá${nome}! Seu acesso à Calculadora iFood da Domma Food está pronto.\n\n` +
    `1. Abra o link e crie sua senha (vale por ${LINK_HOURS / 24} dias):\n${url}\n\n` +
    `2. Depois é só entrar com o login: ${displayLogin(u.email)}`;
}

/** Aba "Clientes" do Painel: criar, bloquear, excluir e enviar link de acesso. */
export function PanelClients() {
  const { store, user, showToast } = useApp();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("todos");
  const [q, setQ] = useState("");
  const [name, setName] = useState("");
  const [login, setLogin] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [link, setLink] = useState<LinkInfo | null>(null);

  const load = useCallback(async () => {
    try { setUsers(await store.admin.listUsers()); } catch (e) { showToast((e as Error).message); } finally { setLoading(false); }
  }, [store, showToast]);
  useEffect(() => { load(); }, [load]);

  const makeLink = async (u: AdminUser) => {
    setBusy(u.id);
    try {
      const t = await store.admin.createAccessLink(u.id, LINK_HOURS);
      setLink({ user: u, url: `${location.origin}/acesso?t=${t}` });
    } catch (e) { showToast((e as Error).message); } finally { setBusy(null); }
  };

  const create = async (e: React.FormEvent) => {
    e.preventDefault(); setError("");
    if (!name.trim() || !login.trim()) return setError("Preencha o nome do restaurante e o e-mail (ou usuário).");
    const email = toEmail(login);
    setBusy("new");
    try {
      const id = await store.admin.createUser(email, name.trim(), isAdmin);
      const fresh = await store.admin.listUsers();
      setUsers(fresh);
      setName(""); setLogin(""); setIsAdmin(false);
      const u = fresh.find((x) => x.id === id);
      if (u) await makeLink(u);
    } catch (err) { setError((err as Error).message); } finally { setBusy(null); }
  };

  const toggleBlock = async (u: AdminUser) => {
    if (!confirm(u.blocked ? `Desbloquear ${u.restaurant_name || u.email}?` : `Bloquear ${u.restaurant_name || u.email}? A pessoa sai do app na hora e não consegue entrar.`)) return;
    setBusy(u.id);
    try { await store.admin.setBlocked(u.id, !u.blocked); await load(); showToast(u.blocked ? "Acesso liberado." : "Acesso bloqueado."); }
    catch (e) { showToast((e as Error).message); } finally { setBusy(null); }
  };
  const toggleAdmin = async (u: AdminUser) => {
    if (!confirm(u.is_admin ? `Tirar o acesso ao Painel de ${u.email}?` : `Dar acesso ao Painel Domma para ${u.email}?`)) return;
    setBusy(u.id);
    try { await store.admin.setAdmin(u.id, !u.is_admin); await load(); } catch (e) { showToast((e as Error).message); } finally { setBusy(null); }
  };
  const remove = async (u: AdminUser) => {
    const typed = prompt(`Excluir ${u.restaurant_name || u.email} apaga a conta e o cardápio (${u.items_count} itens) para sempre.\n\nDigite EXCLUIR para confirmar:`);
    if (typed?.trim().toUpperCase() !== "EXCLUIR") return;
    setBusy(u.id);
    try { await store.admin.deleteUser(u.id); await load(); showToast("Usuário excluído."); } catch (e) { showToast((e as Error).message); } finally { setBusy(null); }
  };

  const counts = useMemo(() => ({
    todos: users.length,
    ativos: users.filter((u) => !u.blocked && u.has_password).length,
    bloqueados: users.filter((u) => u.blocked).length,
    pendentes: users.filter((u) => !u.blocked && !u.has_password).length,
    admins: users.filter((u) => u.is_admin).length,
  }), [users]);

  const shown = users.filter((u) => {
    if (filter === "ativos" && (u.blocked || !u.has_password)) return false;
    if (filter === "bloqueados" && !u.blocked) return false;
    if (filter === "pendentes" && (u.blocked || u.has_password)) return false;
    if (filter === "admins" && !u.is_admin) return false;
    const s = q.trim().toLowerCase();
    return !s || u.email.toLowerCase().includes(s) || u.restaurant_name.toLowerCase().includes(s);
  });

  const copy = async () => {
    if (!link) return;
    try { await navigator.clipboard.writeText(accessMessage(link.user, link.url)); showToast("Mensagem com o link copiada."); }
    catch { showToast("Não deu para copiar: selecione o link e copie manualmente."); }
  };

  return (
    <>
      <div>
        <div className="eyebrow">Calculadora iFood</div>
        <h1 style={{ fontSize: 28, fontWeight: 900 }}>Clientes</h1>
        <p className="small muted" style={{ margin: 0 }}>Crie acessos, envie o link para o cliente criar a senha, bloqueie ou exclua.</p>
      </div>

      <div className="kpis">
        <div className="card"><small className="muted">Contas</small><b>{counts.todos}</b><span className="small muted">{counts.admins} com acesso ao Painel</span></div>
        <div className="card"><small className="muted">Aguardando primeiro acesso</small><b>{counts.pendentes}</b><span className="small muted">ainda não criaram a senha</span></div>
        <div className="card"><small className="muted">Bloqueados</small><b>{counts.bloqueados}</b><span className="small muted">não conseguem entrar</span></div>
      </div>

      <form className="card" onSubmit={create} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <h3>Novo usuário</h3>
        <div className="form-grid">
          <label className="field" style={{ gridColumn: "span 2" }}>Nome do restaurante
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Hamburgueria do Zé" />
          </label>
          <label className="field" style={{ gridColumn: "span 2" }}>E-mail (ou usuário)
            <input className="input" value={login} onChange={(e) => setLogin(e.target.value)} placeholder="ze@hamburgueria.com.br" autoCapitalize="none" />
            <span className="hint">Sem “@”, vira um usuário só para login (ex.: <b>ze</b>). Com e-mail, o cliente também pode usar “Esqueci minha senha”.</span>
          </label>
        </div>
        <label className="check"><input type="checkbox" checked={isAdmin} onChange={(e) => setIsAdmin(e.target.checked)} />Equipe Domma (acesso ao Painel)</label>
        {error && <div className="error">{error}</div>}
        <div><button className="btn primary" disabled={busy === "new"}>{busy === "new" ? "Criando…" : "Criar e gerar link de acesso"}</button></div>
      </form>

      <section className="card" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div className="row between wrap">
          <div className="chips">
            {(["todos", "ativos", "pendentes", "bloqueados", "admins"] as Filter[]).map((f) => (
              <button key={f} className={`chip ${filter === f ? "on" : ""}`} onClick={() => setFilter(f)}>
                {{ todos: "Todos", ativos: "Ativos", pendentes: "Sem senha", bloqueados: "Bloqueados", admins: "Equipe" }[f]} {counts[f]}
              </button>
            ))}
          </div>
          <input className="input" style={{ maxWidth: 260 }} placeholder="Buscar restaurante ou e-mail" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="tbl-wrap"><table className="tbl">
          <thead><tr><th>Restaurante</th><th>Login</th><th>Criado</th><th>Último acesso</th><th>Itens</th><th>Situação</th><th>Ações</th></tr></thead>
          <tbody>
            {loading && <tr><td colSpan={7} className="muted">Carregando…</td></tr>}
            {!loading && !shown.length && <tr><td colSpan={7} className="muted">Nenhum usuário neste filtro.</td></tr>}
            {shown.map((u) => {
              const self = u.id === user?.id || (store.mode === "demo" && u.id === "demo");
              return (
                <tr key={u.id} style={u.blocked ? { opacity: 0.6 } : undefined}>
                  <td><b>{u.restaurant_name || "—"}</b>{u.custom_fees && <div className="tiny muted">taxa de contrato própria</div>}</td>
                  <td>{displayLogin(u.email)}</td>
                  <td>{dateBR(u.created_at)}</td>
                  <td>{u.last_sign_in_at ? dateTimeBR(u.last_sign_in_at) : "nunca"}</td>
                  <td>{u.items_count}</td>
                  <td className="row wrap" style={{ gap: 4 }}>
                    {u.blocked ? <span className="badge red">Bloqueado</span> : u.has_password ? <span className="badge ok">Ativo</span> : <span className="badge warn">Sem senha</span>}
                    {u.is_admin && <span className="badge" style={{ background: "var(--navy-soft)", color: "var(--navy)" }}>Equipe</span>}
                  </td>
                  <td>
                    {self ? <span className="tiny muted">você</span> : (
                      <div className="row wrap" style={{ gap: 10 }}>
                        <button className="link-red" disabled={busy === u.id || u.blocked} onClick={() => makeLink(u)}>Link de acesso</button>
                        <button className="link-red" disabled={busy === u.id} onClick={() => toggleBlock(u)}>{u.blocked ? "Desbloquear" : "Bloquear"}</button>
                        <button className="link-red" disabled={busy === u.id} onClick={() => toggleAdmin(u)}>{u.is_admin ? "Tirar do Painel" : "Dar Painel"}</button>
                        <button className="link-red" disabled={busy === u.id} onClick={() => remove(u)}>Excluir</button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table></div>
      </section>

      {link && (
        <div className="modal-bg" onClick={() => setLink(null)}>
          <div className="modal" role="dialog" aria-modal onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520, borderRadius: 22, marginBottom: "auto", marginTop: "10vh" }}>
            <h2>Link de acesso pronto</h2>
            <p className="small muted" style={{ margin: 0 }}>
              Para <b>{link.user.restaurant_name || link.user.email}</b> · login <b>{displayLogin(link.user.email)}</b>. Vale por {LINK_HOURS / 24} dias e só funciona uma vez; gerar outro cancela este.
            </p>
            <input className="input" readOnly value={link.url} onFocus={(e) => e.target.select()} />
            <div className="row wrap">
              <button className="btn primary" onClick={copy}>Copiar mensagem</button>
              <a className="btn outline" target="_blank" rel="noreferrer" href={`https://wa.me/?text=${encodeURIComponent(accessMessage(link.user, link.url))}`}>Enviar por WhatsApp</a>
              {link.user.email.includes("@") && !link.user.email.endsWith("@dommafood.local") && (
                <a className="btn outline" href={`mailto:${link.user.email}?subject=${encodeURIComponent("Seu acesso à Calculadora iFood · Domma Food")}&body=${encodeURIComponent(accessMessage(link.user, link.url))}`}>Enviar por e-mail</a>
              )}
            </div>
            <button className="btn link" onClick={() => setLink(null)}>Fechar</button>
          </div>
        </div>
      )}
    </>
  );
}
