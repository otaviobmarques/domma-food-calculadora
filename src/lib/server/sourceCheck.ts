import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";

/**
 * Cliente com a chave pública. As funções do banco (get_fee_sources / record_source_check)
 * só aceitam quem é admin (token do usuário) ou quem tem o CRON_SECRET (rotina diária).
 */
export function serverClient(userToken?: string): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Configure NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY.");
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: userToken ? { headers: { Authorization: `Bearer ${userToken}` } } : undefined,
  });
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
export async function runSourceChecks(sb: SupabaseClient, secret: string | null) {
  const { data: sources, error } = await sb.rpc("get_fee_sources", { p_secret: secret });
  if (error) throw new Error(error.message);
  const results = [];
  for (const s of (sources ?? []) as { app: string; url: string }[]) {
    let fp: string | null = null, err: string | null = null;
    try {
      const res = await fetch(s.url, { headers: { "User-Agent": "Mozilla/5.0 (compatible; DommaFeeChecker/1.0)" }, signal: AbortSignal.timeout(20000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      fp = fingerprint(await res.text());
    } catch (e) { err = (e as Error).message; }
    const { data: row, error: e2 } = await sb.rpc("record_source_check", { p_app: s.app, p_url: s.url, p_fingerprint: fp, p_error: err, p_secret: secret });
    if (e2) throw new Error(e2.message);
    results.push(row);
  }
  return results;
}

/** Alerta opcional para a equipe (webhook do Slack/Discord/Google Chat). */
export async function alertTeam(text: string) {
  const hook = process.env.TEAM_ALERT_WEBHOOK_URL;
  if (!hook) return;
  await fetch(hook, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text, content: text }) }).catch(() => {});
}
