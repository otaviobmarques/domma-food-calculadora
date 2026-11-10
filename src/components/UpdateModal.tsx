"use client";
import { diffVersions } from "@/lib/fees";
import { dateBR } from "@/lib/format";
import { appName, type AppId } from "@/lib/types";
import { useApp } from "./AppProvider";

/** Mostra o que mudou nas tabelas e pede confirmação. */
export function UpdateModal({ apps, onClose }: { apps: AppId[]; onClose: () => void }) {
  const { current, published, profile, ack, recalcMenu, showToast, items } = useApp();
  const rows = apps.map((app) => {
    const next = current[app]!;
    const prev = published.find((v) => v.id === profile?.ack_versions?.[app]) ?? null;
    return { app, next, changes: diffVersions(prev, next), custom: !!profile?.custom_fees?.[app]?.enabled };
  });
  const hasIfood = apps.includes("ifood") && !rows.find((r) => r.app === "ifood")?.custom;

  const confirm = async () => {
    if (hasIfood && items.length) {
      const n = await recalcMenu();
      await ack(apps);
      showToast(`Taxas confirmadas e ${n} itens recalculados.`);
    } else {
      await ack(apps);
      showToast("Taxas confirmadas.");
    }
    onClose();
  };

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal onClick={(e) => e.stopPropagation()}>
        <h2>Taxas novas publicadas</h2>
        <p className="muted">A Domma conferiu e publicou uma nova versão da tabela.</p>
        {rows.map(({ app, next, changes, custom }) => (
          <div key={app} className="diff">
            <div className="row between">
              <b>{appName(app)} · {next.label}</b>
              <span className="muted small">vale desde {dateBR(next.valid_from)}</span>
            </div>
            {changes.length ? (
              <table>
                <tbody>
                  {changes.map((c) => (
                    <tr key={c.field}><td>{c.field}</td><td className="old">{c.from}</td><td>→</td><td><b>{c.to}</b></td></tr>
                  ))}
                </tbody>
              </table>
            ) : <p className="small muted">Conferência sem mudança nos percentuais.</p>}
            {custom && <p className="note warn small">Você usa as taxas do seu contrato para o {appName(app)}. Elas não foram alteradas — confira se ainda valem em <b>Taxas</b>.</p>}
            {next.notes && <p className="small">{next.notes}</p>}
          </div>
        ))}
        <button className="btn primary block" onClick={confirm}>
          {hasIfood && items.length ? "Confirmar e recalcular cardápio" : "Ok, entendi"}
        </button>
        <button className="btn link block" onClick={onClose}>Depois</button>
      </div>
    </div>
  );
}
