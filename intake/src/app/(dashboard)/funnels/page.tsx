import Link from "next/link";
import { sql } from "@/lib/db";
import { activeFirm } from "@/lib/tenancy";

export const dynamic = "force-dynamic";

type Row = {
  id: string;
  name: string;
  slug: string;
  color: string;
  active: boolean;
  workflows: { name: string; slug: string; steps: number; visits: number; responses: number }[];
};

export default async function Funnels() {
  const { firm } = await activeFirm();

  const rows = await sql<Row[]>`
    select f.id, f.name, f.slug, f.color, f.active,
      coalesce(json_agg(
        json_build_object(
          'name', w.name, 'slug', w.slug,
          'steps', jsonb_array_length(w.steps->'steps'),
          'visits', (select count(*) from sessions s where s.workflow_id = w.id),
          'responses', (select count(*) from sessions s where s.workflow_id = w.id and s.submitted_at is not null)
        ) order by w.sort_order
      ) filter (where w.id is not null), '[]') as workflows
    from funnels f
    left join workflows w on w.funnel_id = f.id
    where f.firm_id = ${firm.id}
    group by f.id
    order by f.sort_order`;

  return (
    <>
      <div className="head">
        <div>
          <h1>Áreas y formularios</h1>
          <p>
            Cada <strong>área de práctica</strong> agrupa los formularios de casos concretos. El visitante elige su
            área, después su caso, y responde solo las preguntas de ese caso. Los formularios se definen en{" "}
            <code>db/seed-data.mjs</code>.
          </p>
        </div>
        <Link href={`/f/${firm.slug}`} className="btn" target="_blank">
          Ver página pública
        </Link>
      </div>

      <div className="grid cols-3">
        {rows.map((f) => (
          <div className="card" key={f.id}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
              <span className="pill" style={{ background: `${f.color}1f`, color: f.color }}>{f.name}</span>
              {f.active && <span className="muted" style={{ fontSize: ".78rem" }}>Activa</span>}
            </div>

            <table>
              <tbody>
                {f.workflows.map((w) => (
                  <tr key={w.slug}>
                    <td>
                      <Link href={`/f/${firm.slug}/${f.slug}/${w.slug}`} target="_blank" style={{ textDecoration: "none" }}>
                        {w.name}
                      </Link>
                      <div className="muted" style={{ fontSize: ".78rem" }}>{w.steps} pasos</div>
                    </td>
                    <td className="num muted" style={{ fontSize: ".82rem", whiteSpace: "nowrap" }}>
                      {w.responses}/{w.visits}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </>
  );
}
