import type { AppId, FeePlan, FeeVersion, MenuItem, Profile } from "./types";

/** Taxa total (fração) de um plano. Se o cliente paga na entrega, a taxa online não entra. */
export function totalRate(commission: number, online: number, paidOnline = true): number {
  return (commission + (paidOnline ? online : 0)) / 100;
}

export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/**
 * Quanto cobrar: preço de tabela no app para receber `net` limpo.
 * Com cupom bancado pela loja, o cliente paga preço × (1 − cupom) e as taxas incidem sobre esse valor.
 */
export function priceFor(net: number, rate: number, discountPct = 0): number {
  const d = Math.min(Math.max(discountPct, 0), 95) / 100;
  const denom = (1 - d) * (1 - rate);
  if (denom <= 0 || !isFinite(net)) return NaN;
  return round2(net / denom);
}

/** Quanto recebo: valor líquido de um preço de tabela no app. */
export function netFor(price: number, rate: number, discountPct = 0): number {
  const d = Math.min(Math.max(discountPct, 0), 95) / 100;
  return round2(price * (1 - d) * (1 - rate));
}

export function breakdown(price: number, commission: number, online: number, paidOnline = true, discountPct = 0) {
  const charged = round2(price * (1 - Math.min(Math.max(discountPct, 0), 95) / 100));
  const commissionValue = round2((charged * commission) / 100);
  const onlineValue = paidOnline ? round2((charged * online) / 100) : 0;
  return { charged, commissionValue, onlineValue, net: round2(charged - commissionValue - onlineValue) };
}

const today = () => new Date().toISOString().slice(0, 10);

/** Versão em vigor de um app: a publicada mais recente cuja vigência já começou. */
export function pickCurrent(versions: FeeVersion[], app: AppId, onDate = today()): FeeVersion | null {
  const list = versions
    .filter((v) => v.app === app && v.status === "published" && v.valid_from <= onDate)
    .sort((a, b) =>
      a.valid_from === b.valid_from
        ? (b.published_at ?? b.created_at).localeCompare(a.published_at ?? a.created_at)
        : b.valid_from.localeCompare(a.valid_from)
    );
  return list[0] ?? null;
}

export function getPlan(version: FeeVersion | null, key?: string): FeePlan | null {
  if (!version) return null;
  return version.plans.find((p) => p.key === key) ?? version.plans[0] ?? null;
}

export interface EffectiveFee {
  plan: FeePlan | null;
  commission: number;
  online: number;
  custom: boolean;
}

/** Taxas que valem para o restaurante: contrato próprio (se ligado) ou a tabela oficial em vigor. */
export function effectiveFee(version: FeeVersion | null, profile: Profile | null, app: AppId, planKey?: string): EffectiveFee {
  const plan = getPlan(version, planKey ?? profile?.plan_choice?.[app]);
  const custom = profile?.custom_fees?.[app];
  if (custom?.enabled) {
    return { plan, commission: Number(custom.commission) || 0, online: Number(custom.online) || 0, custom: true };
  }
  return { plan, commission: plan?.commission ?? 0, online: plan?.online ?? 0, custom: false };
}

export type ItemStatus = "ok" | "revisar";

export function itemStatus(item: MenuItem, rate: number): { status: ItemStatus; net: number | null; ideal: number } {
  const ideal = priceFor(item.target_net, rate);
  if (item.current_price == null || item.current_price <= 0) return { status: "revisar", net: null, ideal };
  const net = netFor(item.current_price, rate);
  return { status: net + 0.004 < item.target_net ? "revisar" : "ok", net, ideal };
}

export interface FeeChange {
  field: string;
  from: string;
  to: string;
}

const pct = (n: number | null | undefined) => (n == null ? "—" : `${String(n).replace(".", ",")}%`);
const brl = (n: number | null | undefined) => (n == null ? "—" : `R$ ${n}`);

/** Lista o que mudou entre duas versões de tabela (para o aviso "o que mudou"). */
export function diffVersions(prev: FeeVersion | null, next: FeeVersion): FeeChange[] {
  if (!prev) return [];
  const out: FeeChange[] = [];
  for (const p of next.plans) {
    const o = prev.plans.find((x) => x.key === p.key);
    if (!o) {
      out.push({ field: `Novo plano ${p.name}`, from: "—", to: `${pct(p.commission)} + ${pct(p.online)}` });
      continue;
    }
    if (o.commission !== p.commission) out.push({ field: `Comissão ${p.name}`, from: pct(o.commission), to: pct(p.commission) });
    if (o.online !== p.online) out.push({ field: `Pagamento online ${p.name}`, from: pct(o.online), to: pct(p.online) });
    if ((o.monthly ?? null) !== (p.monthly ?? null)) out.push({ field: `Mensalidade ${p.name}`, from: brl(o.monthly), to: brl(p.monthly) });
  }
  for (const o of prev.plans) if (!next.plans.find((p) => p.key === o.key)) out.push({ field: `Plano ${o.name}`, from: "ativo", to: "removido" });
  if (prev.kind !== next.kind) out.push({ field: "Status", from: prev.kind, to: next.kind });
  return out;
}

/** Tabelas de referência 2026 (usadas no modo demo e como semente do banco). */
export const SEED_DATE = "2026-11-10";
export const SEED_VERSIONS: Omit<FeeVersion, "id" | "created_at">[] = [
  {
    app: "ifood",
    label: "nov/2026",
    kind: "oficial",
    plans: [
      { key: "basico", name: "Básico", subtitle: "você entrega", commission: 12, online: 3.2, monthly: 110, monthly_threshold: 1800 },
      { key: "entrega", name: "Entrega", subtitle: "entregador iFood", commission: 23, online: 3.2, monthly: 150, monthly_threshold: 1800 },
    ],
    source_url: "https://parceiros.ifood.com.br/",
    source_label: "Tabela pública",
    valid_from: SEED_DATE,
    status: "published",
    notify: false,
    published_at: `${SEED_DATE}T08:00:00.000Z`,
  },
  {
    app: "keeta",
    label: "nov/2026",
    kind: "estimativa",
    plans: [{ key: "padrao", name: "Padrão", commission: 9, online: 3.2 }],
    source_url: "https://www.meioemensagem.com.br/",
    source_label: "Sem tabela pública (2 a 3 pontos abaixo do líder)",
    valid_from: SEED_DATE,
    status: "published",
    notify: false,
    published_at: `${SEED_DATE}T08:00:00.000Z`,
  },
  {
    app: "99food",
    label: "nov/2026",
    kind: "estimativa",
    plans: [
      { key: "campanha", name: "Campanha", subtitle: "comissão zero", commission: 0, online: 3.2 },
      { key: "depois", name: "Depois", subtitle: "após a campanha", commission: 12, online: 3.2 },
    ],
    source_url: "https://www.infomoney.com.br/",
    source_label: "Campanha de entrada (até 24 meses)",
    valid_from: SEED_DATE,
    status: "published",
    notify: false,
    published_at: `${SEED_DATE}T08:00:00.000Z`,
  },
  {
    app: "aiqfome",
    label: "nov/2026",
    kind: "estimativa",
    plans: [{ key: "padrao", name: "Padrão", commission: 10, online: 3.2 }],
    source_url: "https://neofeed.com.br/",
    source_label: "Média declarada (9% a 10%)",
    valid_from: SEED_DATE,
    status: "published",
    notify: false,
    published_at: `${SEED_DATE}T08:00:00.000Z`,
  },
];
