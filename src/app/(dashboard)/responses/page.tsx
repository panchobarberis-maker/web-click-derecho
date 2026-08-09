import Link from "next/link";
import { revalidatePath } from "next/cache";
import { sql } from "@/lib/db";
import { activeFirm } from "@/lib/tenancy";
import { fmtLong, hace } from "@/lib/format";
import { recoveryEmail, sendMail } from "@/lib/mailer";
import { baseUrl } from "@/lib/base-url";

export const dynamic = "force-dynamic";

type Row = {
  id: string;
  full_name: string | null;
  email: string | null;
  max_step: number;
  submitted_at: Date | null;
  read_at: Date | null;
  recovery_sent_at: Date | null;
  created_at: Date;
  updated_at: Date;
  funnel: string;
  workflow: string;
};

/** Manda el mail de recuperacion a mano desde el panel. */
async function recuperar(formData: FormData) {
  "use server";
  const id = String(formData.get("id"));
  const { firm } = await activeFirm();

  const [s] = await sql<{ email: string; full_name: string | null; funnel: string; slug: string }[]>`
    select s.email, s.full_name, coalesce(f.name, 'tu consulta') as funnel, ${firm.slug} as slug
    from sessions s left join funnels f on f.id = s.funnel_id
    where s.id = ${id} and s.firm_id = ${firm.id} and s.email is not null`;
  if (!s) return;

  const base = baseUrl();
  const mail = recoveryEmail({
    name: s.full_name,
    firm: firm.name,
    accent: firm.accent,
    area: s.funnel,
    url: `${base}/f/${firm.slug}?retomar=${id}`,
  });

  const ok = await sendMail({ to: s.email, ...mail, replyTo: firm.notify_email ?? undefined });
  if (ok) await sql`update sessions set recovery_sent_at = now() where id = ${id}`;
  revalidatePath("/responses");
}

export default async function Responses({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const tab = (await searchParams).tab === "abandonadas" ? "abandonadas" : "enviadas";
  const { firm } = await activeFirm();

  // Las dos consultas no dependen entre si: encadenadas eran dos latencias
  // contra Supabase por una pantalla que solo lista y cuenta.
  const [rows, [counts]] = await Promise.all([
    sql<Row[]>`
    select s.id, s.full_name, s.email, s.max_step, s.submitted_at, s.read_at,
           s.recovery_sent_at, s.created_at, s.updated_at,
           coalesce(f.name, '—') as funnel, coalesce(w.name, '—') as workflow
    from sessions s
    left join funnels f on f.id = s.funnel_id
    left join workflows w on w.id = s.workflow_id
    where s.firm_id = ${firm.id}
      ${tab === "enviadas"
        ? sql`and s.submitted_at is not null`
        : sql`and s.submitted_at is null and s.email is not null and s.email <> ''`}
    order by ${tab === "enviadas" ? sql`s.submitted_at` : sql`s.updated_at`} desc
    limit 200`,

    sql<{ enviadas: number; abandonadas: number; sin_leer: number }[]>`
      select
        count(*) filter (where submitted_at is not null) as enviadas,
        count(*) filter (where submitted_at is null and email is not null and email <> '') as abandonadas,
        count(*) filter (where submitted_at is not null and read_at is null) as sin_leer
      from sessions where firm_id = ${firm.id}`,
  ]);

  return (
    <>
      <div className="head">
        <div>
          <h1>Consultas</h1>
          <p>
            {Number(counts.sin_leer)} sin leer · {Number(counts.abandonadas)} formularios abandonados con mail.
          </p>
        </div>
      </div>

      <div className="tabs">
        <Link href="/responses" aria-current={tab === "enviadas" ? "page" : undefined}>
          Enviadas ({Number(counts.enviadas)})
        </Link>
        <Link href="/responses?tab=abandonadas" aria-current={tab === "abandonadas" ? "page" : undefined}>
          Abandonadas ({Number(counts.abandonadas)})
        </Link>
      </div>

      <div className="card scroll-x">
        {rows.length === 0 ? (
          <p className="empty">Todavía no hay nada acá.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Persona</th>
                <th>Área</th>
                <th>Caso</th>
                <th>{tab === "enviadas" ? "Enviada" : "Última actividad"}</th>
                <th>{tab === "enviadas" ? "Estado" : "Se fue en"}</th>
                {tab === "abandonadas" && <th />}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>
                    <Link href={`/responses/${r.id}`} style={{ fontWeight: r.read_at || tab === "abandonadas" ? 400 : 700, textDecoration: "none" }}>
                      {r.full_name ?? r.email ?? "Anónimo"}
                    </Link>
                    <div className="muted" style={{ fontSize: ".8rem" }}>{r.email}</div>
                  </td>
                  <td>{r.funnel}</td>
                  <td>{r.workflow}</td>
                  <td title={fmtLong(r.submitted_at ?? r.updated_at)}>{hace(r.submitted_at ?? r.updated_at)}</td>
                  <td>
                    {tab === "enviadas" ? (
                      r.read_at ? <span className="pill">Leída</span> : <span className="pill good">Nueva</span>
                    ) : (
                      <span className="pill warn">Paso {r.max_step}</span>
                    )}
                  </td>
                  {tab === "abandonadas" && (
                    <td className="num">
                      {r.recovery_sent_at ? (
                        <span className="muted" style={{ fontSize: ".8rem" }}>Recordatorio enviado</span>
                      ) : (
                        <form action={recuperar}>
                          <input type="hidden" name="id" value={r.id} />
                          <button type="submit" className="btn ghost" style={{ padding: ".4rem 1rem", fontSize: ".82rem" }}>
                            Enviar recordatorio
                          </button>
                        </form>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
