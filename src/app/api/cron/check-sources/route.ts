import { NextResponse } from "next/server";
import { alertTeam, runSourceChecks, serverClient } from "@/lib/server/sourceCheck";

// Rotina diária (Vercel Cron, ver vercel.json). A Vercel envia Authorization: Bearer $CRON_SECRET.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const checks = await runSourceChecks(serverClient(), secret);
    const changed = checks.filter((c) => c?.changed);
    if (changed.length) await alertTeam(`⚠ Domma Calculadora: mudança detectada em ${changed.map((c) => c.app).join(", ")}. Confira e publique nova versão no painel.`);
    return NextResponse.json({ ok: true, checks });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
