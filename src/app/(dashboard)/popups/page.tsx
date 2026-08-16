import { revalidatePath } from "next/cache";
import { sql } from "@/lib/db";
import { activeFirm, requireOwner } from "@/lib/tenancy";
import { porWidget, type Range } from "@/lib/analytics";
import { baseUrl } from "@/lib/base-url";
import { RangePicker } from "@/components/RangePicker";
import { Snippet } from "@/components/Snippet";
import { fmtNum } from "@/lib/format";
import { t as textos } from "@/lib/i18n";

export const dynamic = "force-dynamic";

/** El orden en que se ofrecen; el texto de cada uno lo pone el diccionario. */
const DISPARADORES = ["delay:12", "delay:30", "scroll:50", "exit", "now", "button"];

async function crear(formData: FormData) {
  "use server";
  const { firm } = await requireOwner();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;
  const cta = textos(firm.lang).widgets.ctaPopupDefecto;

  await sql`
    insert into popups (firm_id, name, trigger, titulo, cta, funnel_id, paginas)
    values (${firm.id}, ${name},
            ${String(formData.get("trigger") ?? "delay:12")},
            ${String(formData.get("titulo") ?? "").trim() || null},
            ${String(formData.get("cta") ?? "").trim() || cta},
            ${String(formData.get("funnel_id") ?? "") || null},
            ${String(formData.get("paginas") ?? "").trim() || null})`;
  revalidatePath("/popups");
}

async function guardar(formData: FormData) {
  "use server";
  const { firm } = await requireOwner();
  const cta = textos(firm.lang).widgets.ctaPopupDefecto;
  await sql`
    update popups set
      name      = ${String(formData.get("name") ?? "").trim()},
      trigger   = ${String(formData.get("trigger") ?? "delay:12")},
      titulo    = ${String(formData.get("titulo") ?? "").trim() || null},
      cta       = ${String(formData.get("cta") ?? "").trim() || cta},
      funnel_id = ${String(formData.get("funnel_id") ?? "") || null},
      paginas   = ${String(formData.get("paginas") ?? "").trim() || null},
      active    = ${formData.get("active") === "on"}
    where id = ${String(formData.get("id"))} and firm_id = ${firm.id}`;
  revalidatePath("/popups");
}

async function borrar(formData: FormData) {
  "use server";
  const { firm } = await requireOwner();
  await sql`delete from popups where id = ${String(formData.get("id"))} and firm_id = ${firm.id}`;
  revalidatePath("/popups");
}

type Popup = {
  id: string; name: string; trigger: string; cta: string; titulo: string | null;
  funnel_id: string | null; active: boolean; paginas: string | null;
};

export default async function Popups({ searchParams }: { searchParams: Promise<{ r?: string }> }) {
  const range = (((await searchParams).r as Range) ?? "30d") satisfies Range;
  const { firm } = await activeFirm();
  const puedeEditar = firm.role !== "member";
  const x = textos(firm.lang).widgets;
  // El titular por defecto es el que pone el widget cuando el campo esta vacio.
  const porDefecto = textos(firm.lang).widget.avisoDefecto;

  const [popups, areas, stats] = await Promise.all([
    sql<Popup[]>`select id, name, trigger, cta, titulo, funnel_id, active, paginas from popups
                 where firm_id = ${firm.id} order by created_at desc`,
    sql<{ id: string; name: string }[]>`select id, name from funnels where firm_id = ${firm.id} order by sort_order`,
    porWidget(firm.id, "popups", range),
  ]);

  const stat = new Map(stats.map((s) => [s.id, s]));
  const base = baseUrl();

  return (
    <>
      <div className="head">
        <div>
          <h1>{x.popups}</h1>
          <p>{x.popupsBajada}</p>
        </div>
        <RangePicker current={range} lang={firm.lang} />
      </div>

      <div className="grid cols-2-1">
        <div style={{ display: "grid", gap: "1rem" }}>
          {popups.length === 0 && (
            <div className="card">
              <p className="empty">{x.sinPopups}</p>
            </div>
          )}

          {popups.map((p) => {
            const s = stat.get(p.id);
            return (
              <div className="card" key={p.id}>
                <div className="widget-head">
                  <div>
                    <h3>{p.name}</h3>
                    <span className={p.active ? "pill good" : "pill"}>{p.active ? x.activo : x.pausado}</span>
                  </div>
                  <div className="widget-stats">
                    <div><strong>{fmtNum(s?.impresiones ?? 0, firm.lang)}</strong><span>{x.seMostro}</span></div>
                    <div><strong>{s?.clicks ?? 0}</strong><span>{x.aperturas}</span></div>
                    <div><strong>{s?.responses ?? 0}</strong><span>{x.consultas}</span></div>
                    <div className="tasa"><strong>{s?.apertura ?? 0}%</strong><span>{x.abre}</span></div>
                    <div className="tasa"><strong>{s?.conversion ?? 0}%</strong><span>{x.convierte}</span></div>
                  </div>
                </div>

                {(s?.impresiones ?? 0) > 0 && (
                  <p className="resumen-widget">{x.resumen(Math.round((100 * (s?.responses ?? 0)) / (s?.impresiones || 1)), x.unPopup)}</p>
                )}

                <Snippet code={`<script src="${base}/w.js?popup=${p.id}"></script>`} lang={firm.lang} />

                <a href={`/preview/popup/${p.id}`} target="_blank" className="btn ghost"
                   style={{ marginTop: ".9rem", padding: ".45rem 1.1rem", fontSize: ".84rem" }}>
                  {x.verComoQueda}
                </a>

                {puedeEditar && (
                  <details className="ajuste">
                    <summary>{x.ajustes}</summary>
                    <form action={guardar} className="ajustes">
                      <input type="hidden" name="id" value={p.id} />

                      <label className="lbl">{x.nombre}</label>
                      <input name="name" defaultValue={p.name} required />

                      <label className="lbl">{x.cuandoAparece}</label>
                      <select name="trigger" defaultValue={p.trigger}>
                        {DISPARADORES.map((d) => <option key={d} value={d}>{x.disparadores[d]}</option>)}
                      </select>

                      <label className="lbl">{x.tituloAviso}</label>
                      <input name="titulo" defaultValue={p.titulo ?? ""} placeholder={porDefecto} />
                      <p className="muted" style={{ fontSize: ".76rem", marginTop: ".4rem", lineHeight: 1.5 }}>
                        {x.tituloAvisoAyuda}
                      </p>

                      <label className="lbl">{x.textoBoton}</label>
                      <input name="cta" defaultValue={p.cta} />

                      <label className="lbl">{x.abreDirectoEn}</label>
                      <select name="funnel_id" defaultValue={p.funnel_id ?? ""}>
                        <option value="">{x.todasLasAreas}</option>
                        {areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                      </select>

                      <label className="lbl">{x.enQuePaginas}</label>
                      <textarea name="paginas" rows={4} defaultValue={p.paginas ?? ""}
                                placeholder={x.ejemploPaginas} />
                      <p className="muted" style={{ fontSize: ".76rem", marginTop: ".4rem", lineHeight: 1.5 }}>
                        {x.reglasAyuda} <code>*</code> {x.reglasComodin} (<code>/blog/*</code>). {x.reglasExcluye} <code>!</code> {x.reglasExcluye2} (<code>!/contacto</code>). {x.reglasVacio}
                      </p>

                      <label className="check">
                        <input type="checkbox" name="active" defaultChecked={p.active} /> {x.activoCheck}
                      </label>

                      <div className="fila-alta" style={{ marginTop: ".5rem" }}>
                        <button type="submit" className="btn">{x.guardar}</button>
                      </div>
                    </form>

                    <form action={borrar} style={{ marginTop: ".75rem" }}>
                      <input type="hidden" name="id" value={p.id} />
                      <button type="submit" className="btn ghost" style={{ fontSize: ".8rem" }}>{x.borrar}</button>
                    </form>
                  </details>
                )}
              </div>
            );
          })}
        </div>

        {puedeEditar && (
          <div className="card">
            <h3>{x.nuevoPopup}</h3>
            <form action={crear} className="ajustes">
              <label className="lbl">{x.nombre}</label>
              <input name="name" placeholder={x.ejemploNombrePopup} required />

              <label className="lbl">{x.cuandoAparece}</label>
              <select name="trigger" defaultValue="delay:12">
                {DISPARADORES.map((d) => <option key={d} value={d}>{x.disparadores[d]}</option>)}
              </select>

              <label className="lbl">{x.tituloAviso}</label>
              <input name="titulo" placeholder={porDefecto} />

              <label className="lbl">{x.textoBoton}</label>
              <input name="cta" placeholder={x.ctaPopupDefecto} />

              <label className="lbl">{x.abreDirectoEn}</label>
              <select name="funnel_id" defaultValue="">
                <option value="">{x.todasLasAreas}</option>
                {areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>

              <label className="lbl">{x.enQuePaginas}</label>
              <textarea name="paginas" rows={3}
                        placeholder={x.ejemploPaginasCorto} />

              <button type="submit" className="btn" style={{ width: "100%", marginTop: ".5rem" }}>{x.crear}</button>
            </form>

            <p className="muted" style={{ fontSize: ".8rem", marginTop: "1rem", lineHeight: 1.55 }}>
              {x.piePopup}
            </p>
          </div>
        )}
      </div>
    </>
  );
}
