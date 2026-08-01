import Link from "next/link";
import { notFound } from "next/navigation";
import { currentFirm, sql, type Workflow } from "@/lib/db";
import { fmtLong, hace, sourceLabel } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ResponseDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const firm = await currentFirm();

  const [s] = await sql<
    {
      id: string; full_name: string | null; email: string | null; phone: string | null;
      data: Record<string, string>; max_step: number; submitted_at: Date | null; created_at: Date;
      source: string | null; surface: string; funnel: string; workflow: string; steps: Workflow["steps"] | null;
    }[]
  >`
    select s.id, s.full_name, s.email, s.phone, s.data, s.max_step, s.submitted_at, s.created_at,
           s.source, s.surface,
           coalesce(f.name, '—') as funnel, coalesce(w.name, '—') as workflow, w.steps
    from sessions s
    left join funnels f on f.id = s.funnel_id
    left join workflows w on w.id = s.workflow_id
    where s.id = ${id} and s.firm_id = ${firm.id}`;

  if (!s) notFound();

  // Marcar como leida al abrirla.
  if (s.submitted_at) await sql`update sessions set read_at = coalesce(read_at, now()) where id = ${id}`;

  // Etiquetas lindas: recorremos el schema del form en vez de mostrar las keys crudas.
  const labels = new Map<string, string>();
  for (const step of s.steps?.steps ?? []) for (const f of step.fields) labels.set(f.key, f.label);

  const entries = Object.entries(s.data).filter(([k]) => !k.startsWith("_"));

  return (
    <>
      <div className="head">
        <div>
          <Link href="/responses" className="muted" style={{ fontSize: ".88rem", textDecoration: "none" }}>
            ← Consultas
          </Link>
          <h1 style={{ marginTop: ".5rem" }}>{s.full_name ?? s.email ?? "Anónimo"}</h1>
          <p>
            {s.funnel} · {s.workflow} ·{" "}
            {s.submitted_at ? `enviada ${hace(s.submitted_at)}` : `abandonada en el paso ${s.max_step}`}
          </p>
        </div>
        {s.submitted_at ? <span className="pill good">Completa</span> : <span className="pill warn">Incompleta</span>}
      </div>

      <div className="grid cols-2-1">
        <div className="card">
          <h3>Respuestas</h3>
          {entries.length === 0 ? (
            <p className="empty">No llegó a responder nada.</p>
          ) : (
            <table>
              <tbody>
                {entries.map(([k, v]) => (
                  <tr key={k}>
                    <td className="muted" style={{ width: "38%" }}>{labels.get(k) ?? k}</td>
                    <td>{String(v) || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="card">
          <h3>Contacto</h3>
          <table>
            <tbody>
              <tr><td className="muted">Email</td><td>{s.email ? <a href={`mailto:${s.email}`}>{s.email}</a> : "—"}</td></tr>
              <tr><td className="muted">Teléfono</td><td>{s.phone ?? "—"}</td></tr>
              <tr><td className="muted">Origen</td><td>{sourceLabel(s.source ?? "direct")}</td></tr>
              <tr><td className="muted">Entró por</td><td>{s.surface}</td></tr>
              <tr><td className="muted">Primera visita</td><td>{fmtLong(s.created_at)}</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
