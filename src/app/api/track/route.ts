import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { resolveSource } from "@/lib/attribution";

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

  const utm: Record<string, string> = b.utm ?? {};
  const referrer: string | null = b.referrer ?? null;
  const landingPage: string | null = b.landingPage ?? null;
  const source = resolveSource({ utm, referrer, landingPage });

  // Retomar una sesion previa (link del mail de recuperacion o vuelta a la pagina).
  if (b.sessionId) {
    const [prev] = await sql<{ id: string; data: Record<string, string>; max_step: number; submitted_at: Date | null }[]>`
      select id, data, max_step, submitted_at from sessions
      where id = ${b.sessionId} and firm_id = ${firm.id}`;

    if (prev && !prev.submitted_at) {
      // La sesion nace en el menu de areas (sin funnel ni workflow todavia) y se
      // va completando a medida que la persona elige. coalesce para no pisar con
      // null cuando vuelve atras al menu.
      //
      // La atribucion es first-touch: si ya guardamos de donde vino, no la
      // pisamos. Que despues navegue dentro del sitio no cambia el origen.
      await sql`
        update sessions set
          funnel_id    = coalesce(${b.funnelId ?? null}, funnel_id),
          workflow_id  = coalesce(${b.workflowId ?? null}, workflow_id),
          source       = case when source is null or source = 'direct'
                              then ${source} else source end,
          utm          = case when utm = '{}'::jsonb then ${sql.json(utm)} else utm end,
          referrer     = coalesce(referrer, ${referrer}),
          landing_page = coalesce(landing_page, ${landingPage}),
          updated_at   = now()
        where id = ${prev.id}`;

      await sql`insert into events (session_id, firm_id, funnel_id, workflow_id, type, surface)
        values (${prev.id}, ${firm.id}, ${b.funnelId ?? null}, ${b.workflowId ?? null}, 'resume', ${b.surface ?? "page"})`;

      const { _demo, ...data } = prev.data ?? {};
      void _demo;
      return NextResponse.json({ sessionId: prev.id, data, maxStep: prev.max_step });
    }
  }

  const [s] = await sql<{ id: string }[]>`
    insert into sessions (firm_id, funnel_id, workflow_id, surface, surface_id,
                          source, referrer, landing_page, utm)
    values (${firm.id}, ${b.funnelId ?? null}, ${b.workflowId ?? null}, ${b.surface ?? "page"},
            ${/^[0-9a-f-]{36}$/i.test(String(b.surfaceId ?? "")) ? b.surfaceId : null},
            ${source}, ${referrer}, ${landingPage}, ${sql.json(utm)})
    returning id`;

  await sql`insert into events (session_id, firm_id, funnel_id, workflow_id, type, surface)
    values (${s.id}, ${firm.id}, ${b.funnelId ?? null}, ${b.workflowId ?? null}, 'view', ${b.surface ?? "page"})`;

  return NextResponse.json({ sessionId: s.id, data: {}, maxStep: 0 });
}
