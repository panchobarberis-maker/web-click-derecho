import { sql } from "@/lib/db";
import { activeFirm } from "@/lib/tenancy";
import { totals, series, attribution, byFunnel, bySurface, campanas, dropoff, type Range } from "@/lib/analytics";
import { LineChart, BarList, Tile } from "@/components/Charts";
import { RangePicker } from "@/components/RangePicker";
import { fmtShort, fmtNum, sourceLabel } from "@/lib/format";
import { t as textos } from "@/lib/i18n";
import { WorkflowPicker } from "@/components/WorkflowPicker";

export const dynamic = "force-dynamic";

export default async function Analytics({
  searchParams,
}: {
  searchParams: Promise<{ r?: string; wf?: string }>;
}) {
  const params = await searchParams;
  const range = ((params.r as Range) ?? "30d") satisfies Range;
  const { firm } = await activeFirm();
  const x = textos(firm.lang).stats;
  const lang = firm.lang;

  // Todo junto: el embudo ya resuelve solo cual es el formulario, asi que la
  // lista no tiene que llegar antes y nada espera a nada.
  const [workflows, t, s, attr, funnels, surfaces, camps, drop] = await Promise.all([
    sql<{ id: string; name: string; funnel: string }[]>`
      select w.id, w.name, f.name as funnel
      from workflows w join funnels f on f.id = w.funnel_id
      where f.firm_id = ${firm.id}
      order by f.sort_order, w.sort_order`,
    totals(firm.id, range),
    series(firm.id, range),
    attribution(firm.id, range),
    byFunnel(firm.id, range),
    bySurface(firm.id, range),
    campanas(firm.id, range),
    dropoff(firm.id, params.wf || null, range, lang),
  ]);

  const wfId = params.wf || workflows[0]?.id;

  return (
    <>
      <div className="head">
        <div>
          <h1>{x.analytics}</h1>
          <p>{x.analyticsBajada}</p>
        </div>
        <div style={{ display: "flex", gap: ".6rem", alignItems: "center", flexWrap: "wrap" }}>
          <RangePicker current={range} lang={lang} />
          {/*
            Descarga directa, sin JavaScript: es un link a una ruta que
            devuelve el archivo. Lleva el mismo rango que se está mirando, así
            lo exportado coincide con los números de la pantalla.
          */}
          <a href={`/export?r=${range}`} className="btn ghost" download>
            {x.exportar}
          </a>
        </div>
      </div>

      <div className="grid cols-4" style={{ marginBottom: "1rem" }}>
        <Tile label={x.visitas} value={fmtNum(t.visits, lang)} />
        <Tile label={x.empezaron} value={fmtNum(t.starts, lang)} sub={x.deLasVisitas(t.visits ? Math.round((t.starts / t.visits) * 100) : 0)} />
        <Tile label={x.consultasEnviadas} value={fmtNum(t.responses, lang)} />
        <Tile label={x.conversion} value={`${t.conversion}%`} meter={t.conversion} sub={x.sobreVisitas} />
      </div>

      <div className="card" style={{ marginBottom: "1rem" }}>
        <h3>{x.visitasYConsultas}</h3>
        <LineChart
          lang={lang}
          data={s.map((r) => ({ label: fmtShort(r.bucket, lang), visits: Number(r.visits), responses: Number(r.responses) }))}
        />
      </div>

      <div className="grid cols-2-1" style={{ marginBottom: "1rem" }}>
        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem", gap: "1rem", flexWrap: "wrap" }}>
            <h3 style={{ margin: 0 }}>{x.dondeSeCae}</h3>
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
                {x.cadaBarra}
              </p>
            </>
          ) : (
            <p className="empty">{x.elegiFormulario}</p>
          )}
        </div>

        <div className="card">
          <h3>{x.deDondeVienen}</h3>
          <BarList
            rows={attr.map((a) => ({
              label: sourceLabel(a.source, lang),
              value: Number(a.n),
              caption: x.deTotal(Number(a.consultas), Number(a.n)),
            }))}
          />
          <p className="muted" style={{ fontSize: ".82rem", marginTop: "1rem" }}>
            {x.sobreVisitasOrigen}
          </p>
        </div>
      </div>

      <div className="card" style={{ marginBottom: "1rem" }}>
        <h3>{x.campanas}</h3>
        <p className="muted" style={{ fontSize: ".86rem", marginTop: "-.4rem", marginBottom: "1rem", lineHeight: 1.55 }}>
          {x.campanasAyuda1} <code>utm_</code> {x.campanasAyuda2}
        </p>

        {camps.length === 0 ? (
          <p className="empty">{x.sinVisitas}</p>
        ) : (
          <div className="scroll-x">
            <table>
              <thead>
                <tr>
                  <th>{x.fuente}</th>
                  <th>{x.medio}</th>
                  <th>{x.campana}</th>
                  <th className="num">{x.visitas}</th>
                  <th className="num">{x.consultas}</th>
                  <th className="num">{x.conversion}</th>
                </tr>
              </thead>
              <tbody>
                {camps.map((c) => (
                  <tr key={`${c.fuente}|${c.medio}|${c.campana}`}>
                    <td style={{ fontWeight: 500 }}>{sourceLabel(c.fuente, lang)}</td>
                    <td className="muted">{c.medio}</td>
                    <td>{c.campana}</td>
                    <td className="num">{Number(c.visitas)}</td>
                    <td className="num">{Number(c.consultas)}</td>
                    <td className="num">{Number(c.conversion)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="grid cols-2-1">
        <div className="card">
          <h3>{x.porArea}</h3>
          <div className="scroll-x">
            <table>
              <thead>
                <tr>
                  <th>{x.area}</th>
                  <th className="num">{x.visitas}</th>
                  <th className="num">{x.consultas}</th>
                  <th className="num">{x.conversion}</th>
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
          <h3>{x.porDondeEntraron}</h3>
          <div className="scroll-x">
            <table>
              <thead>
                <tr>
                  <th>{x.superficie}</th>
                  <th className="num">{x.visitas}</th>
                  <th className="num">{x.conv}</th>
                </tr>
              </thead>
              <tbody>
                {surfaces.map((s) => (
                  <tr key={s.surface}>
                    <td>{x.superficies[s.surface as keyof typeof x.superficies] ?? s.surface}</td>
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
