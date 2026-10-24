import { NextResponse } from "next/server";
import { esSi } from "@/lib/forms";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Guardado parcial. Se llama en cada blur y en cada paso, y tambien via
 * sendBeacon cuando la persona cierra la pestaña. Sin esto no hay
 * recuperacion de abandonos posible.
 */
export async function POST(req: Request) {
  const b = await req.json().catch(() => null);
  if (!b?.sessionId) return NextResponse.json({ error: "sessionId requerido" }, { status: 400 });

  const data: Record<string, string> = b.data ?? {};
  const step: number = Number(b.step ?? 0);

  const [s] = await sql<{ firm_id: string; funnel_id: string | null; workflow_id: string | null; max_step: number }[]>`
    select firm_id, funnel_id, workflow_id, max_step from sessions
    where id = ${b.sessionId} and submitted_at is null`;
  if (!s) return NextResponse.json({ ok: true });

  // Los campos de contacto se promueven a columnas: son los que usa el panel
  // y el job de recuperacion, y no queremos escarbar el jsonb para eso.
  const alcanzado = Math.max(s.max_step, b.started ? step + 1 : 0);

  await sql`
    update sessions set
      data       = ${sql.json(data)},
      email      = coalesce(nullif(${data.email ?? null}, ''), email),
      first_name = coalesce(nullif(${data.first_name ?? null}, ''), first_name),
      last_name  = coalesce(nullif(${data.last_name ?? null}, ''), last_name),
      phone      = coalesce(nullif(${data.phone ?? null}, ''), phone),
      consent    = ${esSi(data.consent)},
      max_step   = ${alcanzado},
      updated_at = now()
    where id = ${b.sessionId}`;

  if (b.started && s.max_step === 0) {
    await sql`insert into events (session_id, firm_id, funnel_id, workflow_id, type, step_index)
      values (${b.sessionId}, ${s.firm_id}, ${s.funnel_id}, ${s.workflow_id}, 'start', 0)`;
  }

  if (typeof b.stepDone === "number") {
    await sql`insert into events (session_id, firm_id, funnel_id, workflow_id, type, step_index)
      values (${b.sessionId}, ${s.firm_id}, ${s.funnel_id}, ${s.workflow_id}, 'step_complete', ${b.stepDone})`;
  }

  return NextResponse.json({ ok: true });
}
