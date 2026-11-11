"use client";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { AdminStats, AdminUser, FeeVersion, MenuItem, Profile, SourceCheck } from "../types";
import type { AuthUser, Store } from "./types";

const num = (v: unknown) => (v == null ? null : Number(v));
const toItem = (r: Record<string, unknown>): MenuItem => ({
  id: r.id as string, name: r.name as string, target_net: Number(r.target_net),
  current_price: num(r.current_price), ideal_price: num(r.ideal_price), ideal_rate: num(r.ideal_rate),
  created_at: r.created_at as string,
});
function must<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data;
}

export function createSupabaseStore(url: string, anonKey: string): Store {
  const sb: SupabaseClient = createClient(url, anonKey, { auth: { persistSession: true, autoRefreshToken: true } });
  const userId = async () => {
    const { data } = await sb.auth.getUser();
    if (!data.user) throw new Error("Sessão expirada. Entre de novo.");
    return data.user;
  };

  return {
    mode: "supabase",
    async getUser() {
      const { data } = await sb.auth.getSession();
      const u = data.session?.user;
      return u ? { id: u.id, email: u.email ?? "" } : null;
    },
    onAuthChange(cb) {
      const { data } = sb.auth.onAuthStateChange((_e, s) => cb(s?.user ? ({ id: s.user.id, email: s.user.email ?? "" } as AuthUser) : null));
      return () => data.subscription.unsubscribe();
    },
    async signIn(email, password) {
      const { error } = await sb.auth.signInWithPassword({ email, password });
      if (error) {
        if (error.message === "Invalid login credentials") throw new Error("E-mail ou senha incorretos.");
        if (/banned/i.test(error.message)) throw new Error("Acesso bloqueado. Fale com a Domma Food.");
        throw new Error(error.message);
      }
    },
    async redeemAccessLink(token, password) {
      return must(await sb.rpc("redeem_access_link", { p_token: token, p_password: password })) as string;
    },
    async signUp(restaurant, email, password) {
      const { data, error } = await sb.auth.signUp({
        email, password, options: { data: { restaurant_name: restaurant }, emailRedirectTo: `${location.origin}/` },
      });
      if (error) throw new Error(error.message);
      return { needsConfirmation: !data.session };
    },
    async signInWithGoogle() {
      const { error } = await sb.auth.signInWithOAuth({ provider: "google", options: { redirectTo: `${location.origin}/` } });
      if (error) throw new Error(error.message);
    },
    async resetPassword(email) {
      const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: `${location.origin}/nova-senha` });
      if (error) throw new Error(error.message);
    },
    async updatePassword(password) {
      const { error } = await sb.auth.updateUser({ password });
      if (error) throw new Error(error.message);
    },
    async signOut() { await sb.auth.signOut(); },

    async getProfile() {
      const u = await userId();
      const p = must(await sb.from("profiles").select("*").eq("id", u.id).maybeSingle()) as Profile | null;
      if (p) return { ...p, email: u.email };
      // perfil ainda não criado pelo gatilho (ex.: login com Google)
      return { id: u.id, email: u.email, restaurant_name: (u.user_metadata?.full_name as string) ?? "", is_admin: false,
        plan_choice: { ifood: "basico", "99food": "campanha" }, custom_fees: {}, ack_versions: {} };
    },
    async updateProfile(patch) {
      const u = await userId();
      const p = must(await sb.from("profiles").update(patch).eq("id", u.id).select("*").single()) as Profile;
      return { ...p, email: u.email };
    },

    async listPublishedFees() {
      return must(await sb.from("fee_versions").select("*").eq("status", "published").order("valid_from", { ascending: false })) as FeeVersion[];
    },
    subscribeFees(cb) {
      const ch = sb
        .channel("fee_versions_changes")
        .on("postgres_changes", { event: "*", schema: "public", table: "fee_versions" }, () => cb())
        .subscribe();
      return () => { sb.removeChannel(ch); };
    },

    async listItems() {
      return (must(await sb.from("menu_items").select("*").order("created_at")) as Record<string, unknown>[]).map(toItem);
    },
    async saveItem(item) {
      const row = { name: item.name, target_net: item.target_net, current_price: item.current_price ?? null,
        ideal_price: item.ideal_price ?? null, ideal_rate: item.ideal_rate ?? null, updated_at: new Date().toISOString() };
      const q = item.id ? sb.from("menu_items").update(row).eq("id", item.id) : sb.from("menu_items").insert(row);
      return toItem(must(await q.select("*").single()) as Record<string, unknown>);
    },
    async saveItems(items) {
      await Promise.all(items.map((i) =>
        sb.from("menu_items").update({ ideal_price: i.ideal_price, ideal_rate: i.ideal_rate, updated_at: new Date().toISOString() }).eq("id", i.id)
          .then((r) => { if (r.error) throw new Error(r.error.message); })));
    },
    async deleteItem(id) { must(await sb.from("menu_items").delete().eq("id", id)); },

    admin: {
      async listVersions() {
        return must(await sb.from("fee_versions").select("*").order("created_at", { ascending: false })) as FeeVersion[];
      },
      async saveVersion(v) {
        const { id, ...row } = v;
        const q = id ? sb.from("fee_versions").update(row).eq("id", id) : sb.from("fee_versions").insert(row);
        return must(await q.select("*").single()) as FeeVersion;
      },
      async publishVersion(id) { must(await sb.from("fee_versions").update({ status: "published" }).eq("id", id)); },
      async deleteVersion(id) { must(await sb.from("fee_versions").delete().eq("id", id)); },
      async stats() { return must(await sb.rpc("admin_stats")) as AdminStats; },
      async listUsers() {
        return (must(await sb.rpc("admin_list_users")) as AdminUser[]).map((u) => ({ ...u, items_count: Number(u.items_count) }));
      },
      async createUser(email, restaurant, isAdmin) {
        return must(await sb.rpc("admin_create_user", { p_email: email, p_restaurant: restaurant, p_is_admin: isAdmin })) as string;
      },
      async setBlocked(id, blocked) { must(await sb.rpc("admin_set_blocked", { p_user: id, p_blocked: blocked })); },
      async setAdmin(id, isAdmin) { must(await sb.rpc("admin_set_admin", { p_user: id, p_is_admin: isAdmin })); },
      async deleteUser(id) { must(await sb.rpc("admin_delete_user", { p_user: id })); },
      async createAccessLink(id, hours = 72) {
        return must(await sb.rpc("admin_create_access_link", { p_user: id, p_hours: hours })) as string;
      },
      async checkSources() {
        const { data } = await sb.auth.getSession();
        const res = await fetch("/api/check-sources", { method: "POST", headers: { Authorization: `Bearer ${data.session?.access_token ?? ""}` } });
        const body = await res.json();
        if (!res.ok) throw new Error(body.error ?? "Falha na verificação");
        return body.checks as SourceCheck[];
      },
    },
  };
}
