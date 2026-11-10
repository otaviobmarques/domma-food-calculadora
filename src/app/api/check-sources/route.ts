import { NextResponse } from "next/server";
import { alertTeam, runSourceChecks, serverClient } from "@/lib/server/sourceCheck";

// Botão "Verificar sites dos apps agora" do Painel. O banco só aceita se o token for de admin.
export async function POST(req: Request) {
  try {
    const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    if (!token) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    const checks = await runSourceChecks(serverClient(token), null);
    if (checks.some((c) => c?.changed)) await alertTeam("⚠ Domma Calculadora: mudança detectada na página de taxas. Confira e publique nova versão no painel.");
    return NextResponse.json({ checks });
  } catch (e) {
    const msg = (e as Error).message;
    return NextResponse.json({ error: msg === "not allowed" ? "Só a equipe Domma" : msg }, { status: msg === "not allowed" ? 403 : 500 });
  }
}
