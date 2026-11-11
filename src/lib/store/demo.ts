"use client";
import { SEED_VERSIONS } from "../fees";
import type { AdminStats, AdminUser, FeeVersion, MenuItem, Profile, SourceCheck } from "../types";
import type { AuthUser, Store } from "./types";

// Modo demonstração: tudo no navegador. A "tabela central" é compartilhada entre abas
// (BroadcastChannel + evento storage), simulando a atualização automática do Supabase Realtime.
const K = { users: "domma.demo.users", tokens: "domma.demo.tokens", fees: "domma.demo.fees", user: "domma.demo.user", profile: "domma.demo.profile", items: "domma.demo.items", checks: "domma.demo.checks" };
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2));

function read<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}
function write(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* sem storage */ }
}

let channel: BroadcastChannel | null = null;
const getChannel = () => {
  if (!channel && typeof BroadcastChannel !== "undefined") channel = new BroadcastChannel("domma-fees");
  return channel;
};

function fees(): FeeVersion[] {
  let list = read<FeeVersion[] | null>(K.fees, null);
  if (!list) {
    list = SEED_VERSIONS.map((v) => ({ ...v, id: uid(), created_at: v.published_at! }));
    write(K.fees, list);
  }
  return list;
}
function setFees(list: FeeVersion[]) {
  write(K.fees, list);
  getChannel()?.postMessage("changed");
}

const authListeners = new Set<(u: AuthUser | null) => void>();
const emitAuth = () => { const u = read<AuthUser | null>(K.user, null); authListeners.forEach((cb) => cb(u)); };

function profile(): Profile {
  const u = read<AuthUser | null>(K.user, null);
  return read<Profile>(K.profile, {
    id: u?.id ?? "demo",
    email: u?.email,
    restaurant_name: "Meu Restaurante",
    is_admin: true, // no demo, todo usuário vê o Painel Domma
    plan_choice: { ifood: "basico", "99food": "campanha" },
    custom_fees: {},
    ack_versions: {},
  });
}

const SAMPLE_ITEMS = (): MenuItem[] => [
  { id: uid(), name: "X-Burguer", target_net: 28, current_price: 32.9, ideal_price: 33.02, ideal_rate: 0.152, created_at: new Date().toISOString() },
  { id: uid(), name: "Marmita de frango", target_net: 22, current_price: 26.9, ideal_price: 25.94, ideal_rate: 0.152, created_at: new Date().toISOString() },
  { id: uid(), name: "Açaí 500 ml", target_net: 18, current_price: 21.9, ideal_price: 21.23, ideal_rate: 0.152, created_at: new Date().toISOString() },
  { id: uid(), name: "Pizza calabresa", target_net: 45, current_price: 54.9, ideal_price: 53.07, ideal_rate: 0.152, created_at: new Date().toISOString() },
];

export function createDemoStore(): Store {
  return {
    mode: "demo",
    async getUser() { return read<AuthUser | null>(K.user, null); },
    onAuthChange(cb) { authListeners.add(cb); return () => { authListeners.delete(cb); }; },
    async signIn(email) {
      if (!email) throw new Error("Informe o e-mail.");
      write(K.user, { id: "demo", email });
      if (!localStorage.getItem(K.items)) write(K.items, SAMPLE_ITEMS());
      emitAuth();
    },
    async signUp(restaurant, email) {
      write(K.user, { id: "demo", email });
      write(K.profile, { ...profile(), email, restaurant_name: restaurant });
      if (!localStorage.getItem(K.items)) write(K.items, []);
      emitAuth();
      return { needsConfirmation: false };
    },
    async signInWithGoogle() { await this.signIn("demo@google.com", ""); },
    async resetPassword() { /* demo */ },
    async updatePassword() { /* demo */ },
    async redeemAccessLink(token) {
      const tokens = read<Record<string, string>>(K.tokens, {});
      const id = tokens[token];
      if (!id) throw new Error("Link inválido ou expirado. Peça um novo link.");
      delete tokens[token]; write(K.tokens, tokens);
      const users = read<AdminUser[]>(K.users, []);
      const u = users.find((x) => x.id === id);
      if (!u) throw new Error("Link inválido ou expirado. Peça um novo link.");
      if (u.blocked) throw new Error("Acesso bloqueado. Fale com a Domma Food.");
      write(K.users, users.map((x) => (x.id === id ? { ...x, has_password: true } : x)));
      return u.email;
    },
    async signOut() { localStorage.removeItem(K.user); emitAuth(); },

    async getProfile() { return profile(); },
    async updateProfile(patch) { const p = { ...profile(), ...patch }; write(K.profile, p); return p; },

    async listPublishedFees() { return fees().filter((v) => v.status === "published"); },
    subscribeFees(cb) {
      const ch = getChannel();
      const onMsg = () => cb();
      const onStorage = (e: StorageEvent) => { if (e.key === K.fees) cb(); };
      ch?.addEventListener("message", onMsg);
      window.addEventListener("storage", onStorage);
      return () => { ch?.removeEventListener("message", onMsg); window.removeEventListener("storage", onStorage); };
    },

    async listItems() { return read<MenuItem[]>(K.items, []); },
    async saveItem(item) {
      const list = read<MenuItem[]>(K.items, []);
      const full: MenuItem = {
        id: item.id ?? uid(), name: item.name, target_net: item.target_net,
        current_price: item.current_price ?? null, ideal_price: item.ideal_price ?? null, ideal_rate: item.ideal_rate ?? null,
        created_at: item.created_at ?? new Date().toISOString(),
      };
      const i = list.findIndex((x) => x.id === full.id);
      if (i >= 0) list[i] = full; else list.push(full);
      write(K.items, list);
      return full;
    },
    async saveItems(items) {
      const list = read<MenuItem[]>(K.items, []);
      write(K.items, list.map((x) => items.find((y) => y.id === x.id) ?? x));
    },
    async deleteItem(id) { write(K.items, read<MenuItem[]>(K.items, []).filter((x) => x.id !== id)); },

    admin: {
      async listVersions() { return fees(); },
      async saveVersion(v) {
        const list = fees();
        const now = new Date().toISOString();
        const existing = v.id ? list.find((x) => x.id === v.id) : undefined;
        const full: FeeVersion = {
          ...(existing ?? {}), ...v, id: v.id ?? uid(), created_at: existing?.created_at ?? now,
          published_at: v.status === "published" ? (existing?.status === "published" ? existing.published_at : now) : null,
        } as FeeVersion;
        setFees(existing ? list.map((x) => (x.id === full.id ? full : x)) : [...list, full]);
        return full;
      },
      async publishVersion(id) {
        setFees(fees().map((x) => (x.id === id ? { ...x, status: "published", published_at: new Date().toISOString() } : x)));
      },
      async deleteVersion(id) { setFees(fees().filter((x) => x.id !== id || x.status !== "draft")); },
      async stats(): Promise<AdminStats> {
        const p = profile();
        const custom = Object.values(p.custom_fees).some((c) => c?.enabled) ? 1 : 0;
        const checks = read<SourceCheck[]>(K.checks, []);
        return { client_count: 1, custom_count: custom, last_check: checks[0] ?? null };
      },
      async listUsers() {
        const me = read<AuthUser | null>(K.user, null);
        const users = read<AdminUser[]>(K.users, []);
        const self: AdminUser = { id: "demo", email: me?.email ?? "demo", restaurant_name: profile().restaurant_name, is_admin: true, blocked: false,
          created_at: new Date().toISOString(), last_sign_in_at: new Date().toISOString(), items_count: read<MenuItem[]>(K.items, []).length,
          custom_fees: Object.values(profile().custom_fees).some((c) => c?.enabled), has_password: true };
        return [self, ...users];
      },
      async createUser(email, restaurant, isAdmin) {
        const users = read<AdminUser[]>(K.users, []);
        if (users.some((u) => u.email === email.toLowerCase())) throw new Error("Já existe um usuário com este e-mail");
        const u: AdminUser = { id: uid(), email: email.toLowerCase(), restaurant_name: restaurant, is_admin: isAdmin, blocked: false,
          created_at: new Date().toISOString(), last_sign_in_at: null, items_count: 0, custom_fees: false, has_password: false };
        write(K.users, [u, ...users]);
        return u.id;
      },
      async setBlocked(id, blocked) {
        if (id === "demo") throw new Error("Você não pode bloquear a própria conta");
        write(K.users, read<AdminUser[]>(K.users, []).map((u) => (u.id === id ? { ...u, blocked } : u)));
      },
      async setAdmin(id, isAdmin) { write(K.users, read<AdminUser[]>(K.users, []).map((u) => (u.id === id ? { ...u, is_admin: isAdmin } : u))); },
      async deleteUser(id) {
        if (id === "demo") throw new Error("Você não pode excluir a própria conta");
        write(K.users, read<AdminUser[]>(K.users, []).filter((u) => u.id !== id));
      },
      async createAccessLink(id) {
        const t = uid().replace(/-/g, "");
        const tokens = Object.fromEntries(Object.entries(read<Record<string, string>>(K.tokens, {})).filter(([, v]) => v !== id));
        write(K.tokens, { ...tokens, [t]: id });
        return t;
      },
      async checkSources() {
        const c: SourceCheck = {
          id: uid(), app: "ifood", url: "https://parceiros.ifood.com.br/", fingerprint: "demo",
          changed: false, error: "Modo demo: a verificação real roda no servidor com Supabase configurado.", checked_at: new Date().toISOString(),
        };
        write(K.checks, [c, ...read<SourceCheck[]>(K.checks, [])].slice(0, 20));
        return [c];
      },
    },
  };
}
