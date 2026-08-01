import { NextResponse } from "next/server";
import { sql, type Workflow } from "@/lib/db";
import { leadEmail, sendMail } from "@/lib/mailer";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const b = await req.json().catch(() => null);
  if (!b?.sessionId) return NextResponse.json({ error: "sessionId requerido" }, { status: 400 });

  const data: Record<string, string> = b.data ?? {};

  const [s] = await sql<
    {
      id: string; firm_id: string; funnel_id: string | null; workflow_id: string | null;
      firm_name: string; notify_email: string | null; funnel: string; workflow: string; steps: Workflow["steps"] | null;
    }[]
  >`
    select s.id, s.firm_id, s.funnel_id, s.workflow_id,
           fi.name as firm_name, fi.notify_email,
           coalesce(f.name, '—') as funnel, coalesce(w.name, '—') as workflow, w.steps
    from sessions s
    join firms fi on fi.id = s.firm_id
    left join funnels f on f.id = s.funnel_id
    left join workflows w on w.id = s.workflow_id
    where s.id = ${b.sessionId}`;
  if (!s) return NextResponse.json({ error: "sesión inexistente" }, { status: 404 });

  const pasos = s.steps?.steps?.length ?? 1;

  await sql`
    update sessions set
      data = ${sql.json(data)},
      email     = coalesce(nullif(${data.email ?? null}, ''), email),
      full_name = coalesce(nullif(${data.full_name ?? null}, ''), full_name),
      phone     = coalesce(nullif(${data.phone ?? null}, ''), phone),
      max_step = ${pasos}, submitted_at = coalesce(submitted_at, now()), updated_at = now()
    where id = ${s.id}`;

  await sql`insert into events (session_id, firm_id, funnel_id, workflow_id, type, step_index)
    values (${s.id}, ${s.firm_id}, ${s.funnel_id}, ${s.workflow_id}, 'submit', ${Number(b.step ?? 0)})`;

  // Aviso al estudio. No bloquea la respuesta al visitante si el mail falla.
  if (s.notify_email) {
    const labels = new Map<string, string>();
    for (const st of s.steps?.steps ?? []) for (const f of st.fields) labels.set(f.key, f.label);

    const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const mail = leadEmail({
      name: data.full_name || data.email || "Consulta sin nombre",
      area: s.funnel,
      workflow: s.workflow,
      answers: Object.entries(data)
        .filter(([k, v]) => !k.startsWith("_") && v)
        .map(([k, v]) => [labels.get(k) ?? k, String(v)] as [string, string]),
      url: `${base}/responses/${s.id}`,
    });

    sendMail({ to: s.notify_email, ...mail, replyTo: data.email || undefined }).catch((e) =>
      console.error("no se pudo avisar al estudio:", e),
    );
  }

  return NextResponse.json({ ok: true });
}
