"use client";
import { useState } from "react";
import { dateBR } from "@/lib/format";
import { appName } from "@/lib/types";
import { useApp } from "./AppProvider";
import { UpdateModal } from "./UpdateModal";

/** Selo verde "Taxas em dia" ou amarelo quando a Domma publica taxas novas. */
export function FeeStatus() {
  const { current, pending } = useApp();
  const [open, setOpen] = useState(false);
  const checked = Object.values(current).map((v) => v?.published_at ?? v?.valid_from ?? "").sort().pop();
  if (!pending.length)
    return (
      <div className="status ok">
        <span aria-hidden>✓</span>
        <span><b>Taxas em dia</b> · conferidas pela Domma em {dateBR(checked)}</span>
      </div>
    );
  const msg = pending.includes("ifood")
    ? "O iFood mudou as taxas. Recalcule seu cardápio."
    : `Taxas novas: ${pending.map(appName).join(", ")}.`;
  return (
    <>
      <div className="status warn">
        <span aria-hidden>⚠</span>
        <span className="grow"><b>{msg}</b></span>
        <button className="link-red" onClick={() => setOpen(true)}>Ver o que mudou</button>
      </div>
      {open && <UpdateModal apps={pending} onClose={() => setOpen(false)} />}
    </>
  );
}
