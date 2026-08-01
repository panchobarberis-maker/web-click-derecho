import { sql } from "@/lib/db";
import { activeFirm } from "@/lib/tenancy";
import { totals, series, attribution, byFunnel, bySurface, dropoff, type Range } from "@/lib/analytics";
import { LineChart, BarList, Tile } from "@/components/Charts";
import { RangePicker } from "@/components/RangePicker";
import { fmtShort, sourceLabel } from "@/lib/format";
import { WorkflowPicker } from "@/components/WorkflowPicker";

export const dynamic = "force-dynamic";

const SURFACES: Record<string, string> = {
  page: "Página de consultas",
  popup: "Pop-up en el sitio",
  clip: "Clip de video",
};

export default async function Analytics({
  searchParams,
}: {
  searchParams: Promise<{ r?: string; wf?: string }>;
}) {
  const params = await searchParams;
  const range = ((params.r as Range) ?? "30d") satisfies Range;
  const { firm } = await activeFirm();

  const workflows = await sql<{ id: string; name: string; funnel: string }[]>`
    select w.id, w.name, f.name as funnel
    from workflows w join funnels f on f.id = w.funnel_id
    where f.firm_id = ${firm.id}
    order by f.sort_order, w.sort_order`;

  const wfId = params.wf || workflows[0]?.id;

  const [t, s, attr, funnels, surfaces, drop] = await Promise.all([
    totals(firm.id, range),
    series(firm.id, range),
    attribution(firm.id, range),
    byFunnel(firm.id, range),
    bySurface(firm.id, range),
    wfId ? dropoff(firm.id, wfId, range) : null,
  ]);

  return (
    <>
      <div className="head">
        <div>
          <h1>Analytics</h1>
          <p>Cuánta gente llega al formulario, cuánta lo termina y en qué paso se cae.</p>
        </div>
        <RangePicker current={range} />
      </div>

      <div className="grid cols-4" style={{ marginBottom: "1rem" }}>
        <Tile label="Visitas" value={t.visits.toLocaleString("es-AR")} />
        <Tile label="Empezaron" value={t.starts.toLocaleString("es-AR")} sub={`${t.visits ? Math.round((t.starts / t.visits) * 100) : 0}% de las visitas`} />
        <Tile label="Consultas enviadas" value={t.responses.toLocaleString("es-AR")} />
        <Tile label="Conversión" value={`${t.conversion}%`} meter={t.conversion} sub="Consultas sobre visitas" />
      </div>

      <div className="card" style={{ marginBottom: "1rem" }}>
        <h3>Visitas y consultas</h3>
        <LineChart
          data={s.map((r) => ({ label: fmtShort(r.bucket), visits: Number(r.visits), responses: Number(r.responses) }))}
        />
      </div>

      <div className="grid cols-2-1" style={{ marginBottom: "1rem" }}>
        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem", gap: "1rem", flexWrap: "wrap" }}>
            <h3 style={{ margin: 0 }}>Dónde se cae la gente</h3>
            <WorkflowPicker workflows={workflows} current={wfId ?? ""} />
          </div>
          {drop ? (
            <>
              <BarList
                rows={drop.steps.map((st) => ({
                  label: st.title,
                  value: st.reached,
                  caption: `${st.reached} · ${st.pct}%`,
                }))}
              />
              <p className="muted" style={{ fontSize: ".82rem", marginTop: "1rem" }}>
                Cada barra es cuánta gente llegó hasta ahí. La caída más grande es el paso a rediseñar.
              </p>
            </>
          ) : (
            <p className="empty">Elegí un formulario.</p>
          )}
        </div>

        <div className="card">
          <h3>De dónde vienen</h3>
          <BarList
            rows={attr.map((a) => ({ label: sourceLabel(a.source), value: Number(a.n), caption: `${a.pct}%` }))}
          />
        </div>
      </div>

      <div className="grid cols-2-1">
        <div className="card">
          <h3>Por área de práctica</h3>
          <div className="scroll-x">
            <table>
              <thead>
                <tr>
                  <th>Área</th>
                  <th className="num">Visitas</th>
                  <th className="num">Consultas</th>
                  <th className="num">Conversión</th>
                </tr>
              </thead>
              <tbody>
                {funnels.map((f) => (
                  <tr key={f.id}>
                    <td>
                      <i className="dot" style={{ background: f.color }} />
                      {f.name}
                    </td>
                    <td className="num">{Number(f.visits)}</td>
                    <td className="num">{Number(f.responses)}</td>
                    <td className="num">{Number(f.conversion)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <h3>Por dónde entraron</h3>
          <div className="scroll-x">
            <table>
              <thead>
                <tr>
                  <th>Superficie</th>
                  <th className="num">Visitas</th>
                  <th className="num">Conv.</th>
                </tr>
              </thead>
              <tbody>
                {surfaces.map((s) => (
                  <tr key={s.surface}>
                    <td>{SURFACES[s.surface] ?? s.surface}</td>
                    <td className="num">{Number(s.visits)}</td>
                    <td className="num">{Number(s.conversion)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
