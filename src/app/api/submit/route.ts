import { NextResponse } from "next/server";
import { sql, type Workflow } from "@/lib/db";
import { leadEmail, sendMail } from "@/lib/mailer";
import { sourceLabel } from "@/lib/format";
import { baseUrl } from "@/lib/base-url";

export const dynamic = "force-dynamic";

// Van en el bloque fijo de contacto del mail, no en "respuestas del formulario".
const CONTACTO = new Set(["first_name", "last_name", "email", "phone", "consent"]);

export async function POST(req: Request) {
  const b = await req.json().catch(() => null);
  if (!b?.sessionId) return NextResponse.json({ error: "sessionId requerido" }, { status: 400 });

  const data: Record<string, string> = b.data ?? {};

  const [s] = await sql<
    {
      id: string; firm_id: string; funnel_id: string | null; workflow_id: string | null;
      notify_email: string | null; funnel: string; workflow: string;
      steps: Workflow["steps"] | null; source: string | null;
    }[]
  >`
    select s.id, s.firm_id, s.funnel_id, s.workflow_id, s.source,
           fi.notify_email,
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
      email      = coalesce(nullif(${data.email ?? null}, ''), email),
      first_name = coalesce(nullif(${data.first_name ?? null}, ''), first_name),
      last_name  = coalesce(nullif(${data.last_name ?? null}, ''), last_name),
      phone      = coalesce(nullif(${data.phone ?? null}, ''), phone),
      consent    = ${data.consent === "Sí"},
      max_step = ${pasos}, submitted_at = coalesce(submitted_at, now()), updated_at = now()
    where id = ${s.id}`;

  await sql`insert into events (session_id, firm_id, funnel_id, workflow_id, type, step_index)
    values (${s.id}, ${s.firm_id}, ${s.funnel_id}, ${s.workflow_id}, 'submit', ${Number(b.step ?? 0)})`;

  // Aviso al estudio. No bloquea la respuesta al visitante si el mail falla.
  if (s.notify_email) {
    const labels = new Map<string, string>();
    for (const st of s.steps?.steps ?? []) for (const f of st.fields) labels.set(f.key, f.label);

    const base = baseUrl();
    const mail = leadEmail({
      firstName: data.first_name ?? "",
      lastName: data.last_name ?? "",
      email: data.email ?? "",
      phone: data.phone ?? "",
      consent: data.consent === "Sí",
      funnel: s.funnel,
      service: s.workflow,
      source: sourceLabel(s.source ?? "direct"),
      answers: Object.entries(data)
        .filter(([k, v]) => !k.startsWith("_") && !CONTACTO.has(k) && v)
        .map(([k, v]) => [labels.get(k) ?? k, String(v)] as [string, string]),
      url: `${base}/responses/${s.id}`,
    });

    sendMail({ to: s.notify_email, ...mail, replyTo: data.email || undefined }).catch((e) =>
      console.error("no se pudo avisar al estudio:", e),
    );
  }

  return NextResponse.json({ ok: true });
}
