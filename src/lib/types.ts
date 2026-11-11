export type AppId = "ifood" | "keeta" | "99food" | "aiqfome";
export type FeeKind = "oficial" | "estimativa";

export const APPS: { id: AppId; name: string }[] = [
  { id: "ifood", name: "iFood" },
  { id: "keeta", name: "Keeta" },
  { id: "99food", name: "99Food" },
  { id: "aiqfome", name: "aiqfome" },
];
export const appName = (id: AppId) => APPS.find((a) => a.id === id)?.name ?? id;

export interface FeePlan {
  key: string;
  name: string;
  subtitle?: string;
  commission: number; // %
  online: number; // % taxa de pagamento online
  monthly?: number | null; // R$ mensalidade
  monthly_threshold?: number | null; // R$ faturamento a partir do qual cobra mensalidade
}

export interface FeeVersion {
  id: string;
  app: AppId;
  label: string; // ex.: "nov/2026"
  kind: FeeKind;
  plans: FeePlan[];
  source_url: string;
  source_label?: string | null;
  notes?: string | null;
  valid_from: string; // YYYY-MM-DD
  status: "draft" | "published";
  notify: boolean;
  published_at?: string | null;
  created_at: string;
}

export interface CustomFee {
  enabled: boolean;
  commission: number;
  online: number;
}

export interface Profile {
  id: string;
  email?: string;
  restaurant_name: string;
  is_admin: boolean;
  plan_choice: Partial<Record<AppId, string>>;
  custom_fees: Partial<Record<AppId, CustomFee>>;
  ack_versions: Partial<Record<AppId, string>>;
  blocked?: boolean;
}

export interface MenuItem {
  id: string;
  name: string;
  target_net: number;
  current_price: number | null;
  ideal_price: number | null;
  ideal_rate: number | null; // taxa total (fração) usada no último cálculo
  created_at: string;
}

export interface SourceCheck {
  id: string;
  app: AppId;
  url: string;
  fingerprint: string | null;
  changed: boolean;
  error?: string | null;
  checked_at: string;
}

export interface AdminUser {
  id: string;
  email: string;
  restaurant_name: string;
  is_admin: boolean;
  blocked: boolean;
  created_at: string;
  last_sign_in_at: string | null;
  items_count: number;
  custom_fees: boolean;
  has_password: boolean;
}

export interface AdminStats {
  client_count: number;
  custom_count: number;
  last_check: SourceCheck | null;
}
