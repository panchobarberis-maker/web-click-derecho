import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Abre (o retoma) una sesion y registra la visita.
 * Devuelve el sessionId y, si retoma, lo que ya habia respondido.
 */
export async function POST(req: Request) {
  const b = await req.json().catch(() => null);
  if (!b?.firmSlug) return NextResponse.json({ error: "firmSlug requerido" }, { status: 400 });

  const [firm] = await sql<{ id: string }[]>`select id from firms where slug = ${b.firmSlug}`;
  if (!firm) return NextResponse.json({ error: "estudio inexistente" }, { status: 404 });

  // Retomar una sesion previa (link del mail de recuperacion o vuelta a la pagina).
  if (b.sessionId) {
    const [prev] = await sql<{ id: string; data: Record<string, string>; max_step: number; submitted_at: Date | null }[]>`
      select id, data, max_step, submitted_at from sessions
      where id = ${b.sessionId} and firm_id = ${firm.id}`;

    if (prev && !prev.submitted_at) {
      // La sesion nace en el menu de areas (sin funnel ni workflow todavia) y se
      // va completando a medida que la persona elige. coalesce para no pisar con
      // null cuando vuelve atras al menu.
      await sql`
        update sessions set
          funnel_id   = coalesce(${b.funnelId ?? null}, funnel_id),
          workflow_id = coalesce(${b.workflowId ?? null}, workflow_id),
          updated_at  = now()
        where id = ${prev.id}`;
      await sql`insert into events (session_id, firm_id, funnel_id, workflow_id, type, surface)
        values (${prev.id}, ${firm.id}, ${b.funnelId ?? null}, ${b.workflowId ?? null}, 'resume', ${b.surface ?? "page"})`;
      const { _demo, ...data } = prev.data ?? {};
      void _demo;
      return NextResponse.json({ sessionId: prev.id, data, maxStep: prev.max_step });
    }
  }

  const [s] = await sql<{ id: string }[]>`
    insert into sessions (firm_id, funnel_id, workflow_id, surface, source, referrer, utm)
    values (${firm.id}, ${b.funnelId ?? null}, ${b.workflowId ?? null}, ${b.surface ?? "page"},
            ${b.source ?? inferSource(b.referrer)}, ${b.referrer ?? null}, ${sql.json(b.utm ?? {})})
    returning id`;

  await sql`insert into events (session_id, firm_id, funnel_id, workflow_id, type, surface)
    values (${s.id}, ${firm.id}, ${b.funnelId ?? null}, ${b.workflowId ?? null}, 'view', ${b.surface ?? "page"})`;

  return NextResponse.json({ sessionId: s.id, data: {}, maxStep: 0 });
}

/** Atribucion basica cuando no viene utm_source. */
function inferSource(referrer?: string | null): string {
  if (!referrer) return "direct";
  try {
    const h = new URL(referrer).hostname.replace(/^www\./, "");
    if (h.includes("google")) return "google";
    if (h.includes("instagram")) return "instagram";
    if (h.includes("facebook")) return "facebook";
    if (h.includes("whatsapp")) return "whatsapp";
    if (h.includes("linkedin")) return "linkedin";
    return "referral";
  } catch {
    return "direct";
  }
}
