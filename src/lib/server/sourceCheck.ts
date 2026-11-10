import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";

export function adminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Configure NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no servidor.");
  return createClient(url, key, { auth: { persistSession: false } });
}

/**
 * "Impressão digital" da página: só os percentuais e valores em R$ que aparecem no texto.
 * Assim mudanças de layout/scripts não disparam alarme falso; mudança de taxa dispara.
 */
export function fingerprint(html: string): string {
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ");
  const tokens = [
    ...(text.match(/\d{1,2}(?:[.,]\d{1,2})?\s?%/g) ?? []),
    ...(text.match(/R\$\s?\d{1,3}(?:\.\d{3})*(?:,\d{2})?/g) ?? []),
  ].map((t) => t.replace(/\s/g, ""));
  const uniq = [...new Set(tokens)].sort();
  return createHash("sha256").update(uniq.join("|")).digest("hex").slice(0, 32);
}

/** Confere as páginas públicas marcadas com auto_check e registra o resultado. */
export async function runSourceChecks(sb = adminClient()) {
  const { data: sources, error } = await sb.from("fee_sources").select("*").eq("auto_check", true);
  if (error) throw new Error(error.message);
  const results = [];
  for (const s of sources ?? []) {
    let fp: string | null = null, err: string | null = null, changed = false;
    try {
      const res = await fetch(s.url, { headers: { "User-Agent": "Mozilla/5.0 (compatible; DommaFeeChecker/1.0)" }, signal: AbortSignal.timeout(20000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      fp = fingerprint(await res.text());
      const { data: last } = await sb.from("source_checks").select("fingerprint").eq("app", s.app).not("fingerprint", "is", null)
        .order("checked_at", { ascending: false }).limit(1).maybeSingle();
      changed = !!last?.fingerprint && last.fingerprint !== fp;
    } catch (e) { err = (e as Error).message; }
    const { data: row } = await sb.from("source_checks").insert({ app: s.app, url: s.url, fingerprint: fp, changed, error: err }).select("*").single();
    results.push(row);
  }
  return results;
}

/** Alerta opcional para a equipe (webhook do Slack/Discord/WhatsApp-bridge). */
export async function alertTeam(text: string) {
  const hook = process.env.TEAM_ALERT_WEBHOOK_URL;
  if (!hook) return;
  await fetch(hook, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text, content: text }) }).catch(() => {});
}
