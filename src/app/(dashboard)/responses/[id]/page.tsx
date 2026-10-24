import Link from "next/link";
import { notFound } from "next/navigation";
import { sql, type Workflow } from "@/lib/db";
import { activeFirm } from "@/lib/tenancy";
import { fmtLong, hace, sourceLabel } from "@/lib/format";
import { t as textos } from "@/lib/i18n";
import type { Triage } from "@/lib/triage";

export const dynamic = "force-dynamic";

export default async function ResponseDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { firm } = await activeFirm();
  const x = textos(firm.lang).panel;
  const lang = firm.lang;

  const [s] = await sql<
    {
      id: string; full_name: string | null; email: string | null; phone: string | null;
      data: Record<string, string>; max_step: number; submitted_at: Date | null; created_at: Date;
      source: string | null; surface: string; consent: boolean; landing_page: string | null;
      utm: Record<string, string>; funnel: string; workflow: string; steps: Workflow["steps"] | null;
      triage: Triage | null; triage_at: Date | null;
    }[]
  >`
    select s.id, s.full_name, s.email, s.phone, s.data, s.max_step, s.submitted_at, s.created_at,
           s.source, s.surface, s.consent, s.landing_page, s.utm, s.triage, s.triage_at,
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

  // El bloque de contacto ya los muestra aparte.
  const CONTACTO = new Set(["first_name", "last_name", "email", "phone", "consent"]);
  const entries = Object.entries(s.data).filter(([k]) => !k.startsWith("_") && !CONTACTO.has(k));

  const campana = [s.utm?.utm_campaign, s.utm?.utm_medium].filter(Boolean).join(" · ");

  return (
    <>
      <div className="head">
        <div>
          <Link href="/responses" className="muted" style={{ fontSize: ".88rem", textDecoration: "none" }}>
            {x.volverConsultas}
          </Link>
          <h1 style={{ marginTop: ".5rem" }}>{s.full_name ?? s.email ?? x.anonimo}</h1>
          <p>
            {s.funnel} · {s.workflow} ·{" "}
            {s.submitted_at ? x.enviadaHace(hace(s.submitted_at, lang)) : x.abandonadaEnPaso(s.max_step)}
          </p>
        </div>
        {s.submitted_at
          ? <span className="pill good">{x.completa}</span>
          : <span className="pill warn">{x.incompleta}</span>}
      </div>

      {/* Arriba de las respuestas a proposito: es lo que se mira antes de
          decidir si se levanta el telefono. */}
      <div className="card" style={{ marginBottom: "1rem" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: ".7rem", flexWrap: "wrap" }}>
          <h3 style={{ margin: 0 }}>{x.triageTitulo}</h3>
          {s.triage
            ? <span className="pill good">{x.triagePrioridad} {s.triage.puntaje}</span>
            : <span className="pill">{x.triageSinAnalizar}</span>}
        </div>

        {s.triage ? (
          <>
            <p style={{ fontWeight: 600, margin: ".8rem 0 .2rem" }}>{s.triage.titular}</p>
            {s.triage.motivo && <p style={{ margin: 0 }}>{s.triage.motivo}</p>}

            {s.triage.alerta && (
              <p style={{ margin: ".9rem 0 0", padding: ".7rem .9rem", background: "#fff6e5",
                          borderLeft: "3px solid #d98b00", borderRadius: "0 6px 6px 0", lineHeight: 1.5 }}>
                <strong>{x.triageAlerta}: </strong>{s.triage.alerta}
              </p>
            )}

            {!s.triage.encaja && (
              <p className="pill warn" style={{ display: "inline-block", marginTop: ".9rem" }}>
                {x.triageNoEncaja}
              </p>
            )}

            {s.triage.preguntar.length > 0 && (
              <>
                <p className="lbl" style={{ marginTop: "1.1rem" }}>{x.triagePreguntar}</p>
                <ul style={{ margin: 0, paddingLeft: "1.1rem", lineHeight: 1.7 }}>
                  {s.triage.preguntar.map((q) => <li key={q}>{q}</li>)}
                </ul>
              </>
            )}

            <p className="muted" style={{ fontSize: ".78rem", marginTop: "1.1rem", lineHeight: 1.5 }}>
              {x.triageAclaracion}
            </p>
          </>
        ) : (
          <p className="muted" style={{ marginTop: ".7rem" }}>{x.triageFalta}</p>
        )}
      </div>

      <div className="grid cols-2-1">
        <div className="card">
          <h3>{x.respuestas}</h3>
          {entries.length === 0 ? (
            <p className="empty">{x.noRespondioNada}</p>
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
          <h3>{x.contacto}</h3>
          <table>
            <tbody>
              <tr><td className="muted">Email</td><td>{s.email ? <a href={`mailto:${s.email}`}>{s.email}</a> : "—"}</td></tr>
              <tr><td className="muted">{x.telefono}</td><td>{s.phone ?? "—"}</td></tr>
              <tr>
                <td className="muted">{x.aceptoContacto}</td>
                <td>{s.consent
                  ? <span className="pill good">{x.si}</span>
                  : <span className="pill">{x.no}</span>}</td>
              </tr>
              <tr><td className="muted">{x.origen}</td><td>{sourceLabel(s.source ?? "direct", lang)}</td></tr>
              {campana && <tr><td className="muted">{x.campanaCol}</td><td>{campana}</td></tr>}
              <tr><td className="muted">{x.entroPor}</td><td>{x.superficies[s.surface] ?? s.surface}</td></tr>
              {s.landing_page && (
                <tr>
                  <td className="muted">{x.paginaCol}</td>
                  <td style={{ wordBreak: "break-all", fontSize: ".82rem" }}>{s.landing_page}</td>
                </tr>
              )}
              <tr><td className="muted">{x.primeraVisita}</td><td>{fmtLong(s.created_at, lang)}</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
