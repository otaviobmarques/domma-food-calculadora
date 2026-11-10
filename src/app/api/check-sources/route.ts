import { NextResponse } from "next/server";
import { adminClient, alertTeam, runSourceChecks } from "@/lib/server/sourceCheck";

// Botão "Verificar sites dos apps agora" do Painel (só admin).
export async function POST(req: Request) {
  try {
    const sb = adminClient();
    const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    const { data: u } = await sb.auth.getUser(token ?? "");
    if (!u.user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    const { data: p } = await sb.from("profiles").select("is_admin").eq("id", u.user.id).single();
    if (!p?.is_admin) return NextResponse.json({ error: "Só a equipe Domma" }, { status: 403 });
    const checks = await runSourceChecks(sb);
    if (checks.some((c) => c?.changed)) await alertTeam("⚠ Domma Calculadora: mudança detectada na página de taxas. Confira e publique nova versão no painel.");
    return NextResponse.json({ checks });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
