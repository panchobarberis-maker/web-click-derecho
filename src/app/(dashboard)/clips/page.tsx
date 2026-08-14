import { revalidatePath } from "next/cache";
import { sql } from "@/lib/db";
import { activeFirm, requireOwner } from "@/lib/tenancy";
import { porWidget, type Range } from "@/lib/analytics";
import { baseUrl } from "@/lib/base-url";
import { RangePicker } from "@/components/RangePicker";
import { Snippet } from "@/components/Snippet";
import { SubirArchivo } from "@/components/Subir";
import { almacenamientoListo, CLASES } from "@/lib/storage";
import { fmtNum } from "@/lib/format";
import { t as textos } from "@/lib/i18n";

export const dynamic = "force-dynamic";

async function crear(formData: FormData) {
  "use server";
  const { firm } = await requireOwner();
  const name = String(formData.get("name") ?? "").trim();
  const video = String(formData.get("video_url") ?? "").trim();
  if (!name || !video) return;
  const cta = textos(firm.lang).widgets.ctaClipDefecto;

  await sql`
    insert into clips (firm_id, name, video_url, poster_url, cta, funnel_id, paginas, autoplay)
    values (${firm.id}, ${name}, ${video},
            ${String(formData.get("poster_url") ?? "").trim() || null},
            ${String(formData.get("cta") ?? "").trim() || cta},
            ${String(formData.get("funnel_id") ?? "") || null},
            ${String(formData.get("paginas") ?? "").trim() || null},
            ${formData.get("autoplay") === "on"})`;
  revalidatePath("/clips");
}

async function guardar(formData: FormData) {
  "use server";
  const { firm } = await requireOwner();
  const cta = textos(firm.lang).widgets.ctaClipDefecto;
  await sql`
    update clips set
      name       = ${String(formData.get("name") ?? "").trim()},
      video_url  = ${String(formData.get("video_url") ?? "").trim()},
      poster_url = ${String(formData.get("poster_url") ?? "").trim() || null},
      cta        = ${String(formData.get("cta") ?? "").trim() || cta},
      funnel_id  = ${String(formData.get("funnel_id") ?? "") || null},
      paginas    = ${String(formData.get("paginas") ?? "").trim() || null},
      autoplay   = ${formData.get("autoplay") === "on"},
      active     = ${formData.get("active") === "on"}
    where id = ${String(formData.get("id"))} and firm_id = ${firm.id}`;
  revalidatePath("/clips");
}

async function borrar(formData: FormData) {
  "use server";
  const { firm } = await requireOwner();
  await sql`delete from clips where id = ${String(formData.get("id"))} and firm_id = ${firm.id}`;
  revalidatePath("/clips");
}

type Clip = {
  id: string; name: string; video_url: string; poster_url: string | null;
  cta: string; funnel_id: string | null; active: boolean; paginas: string | null; autoplay: boolean;
};

export default async function Clips({ searchParams }: { searchParams: Promise<{ r?: string }> }) {
  const range = (((await searchParams).r as Range) ?? "30d") satisfies Range;
  const { firm } = await activeFirm();
  const puedeEditar = firm.role !== "member";
  const x = textos(firm.lang).widgets;

  const [clips, areas, stats] = await Promise.all([
    sql<Clip[]>`select id, name, video_url, poster_url, cta, funnel_id, active, paginas, autoplay from clips
                where firm_id = ${firm.id} order by created_at desc`,
    sql<{ id: string; name: string }[]>`select id, name from funnels where firm_id = ${firm.id} order by sort_order`,
    porWidget(firm.id, "clips", range),
  ]);

  const stat = new Map(stats.map((s) => [s.id, s]));
  const puedeSubir = almacenamientoListo();
  const base = baseUrl();

  return (
    <>
      <div className="head">
        <div>
          <h1>{x.clips}</h1>
          <p>{x.clipsBajada}</p>
        </div>
        <RangePicker current={range} lang={firm.lang} />
      </div>

      <div className="grid cols-2-1">
        <div style={{ display: "grid", gap: "1rem" }}>
          {clips.length === 0 && (
            <div className="card">
              <p className="empty">{x.sinClips}</p>
            </div>
          )}

          {clips.map((c) => {
            const s = stat.get(c.id);
            return (
              <div className="card" key={c.id}>
                <div className="widget-head">
                  <div>
                    <h3>{c.name}</h3>
                    <span className={c.active ? "pill good" : "pill"}>{c.active ? x.activo : x.pausado}</span>
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
                  <p className="resumen-widget">{x.resumen(Math.round((100 * (s?.responses ?? 0)) / (s?.impresiones || 1)), x.unClip)}</p>
                )}

                <Snippet code={`<script src="${base}/w.js?clip=${c.id}"></script>`} lang={firm.lang} />

                <a href={`/preview/clip/${c.id}`} target="_blank" className="btn ghost"
                   style={{ marginTop: ".9rem", padding: ".45rem 1.1rem", fontSize: ".84rem" }}>
                  {x.verComoQueda}
                </a>

                {puedeEditar && (
                  <details className="ajuste">
                    <summary>{x.ajustes}</summary>
                    <form action={guardar} className="ajustes">
                      <input type="hidden" name="id" value={c.id} />

                      <label className="lbl">{x.nombre}</label>
                      <input name="name" defaultValue={c.name} required />

                      <SubirArchivo lang={firm.lang} name="video_url" clase="video" etiqueta={x.video} defaultValue={c.video_url}
                                    habilitado={puedeSubir} maxMb={CLASES.video.maxMb} ayuda={x.ayudaVideo(CLASES.video.maxMb)} />

                      <SubirArchivo lang={firm.lang} name="poster_url" clase="imagen" etiqueta={x.portada}
                                    defaultValue={c.poster_url ?? ""}
                                    habilitado={puedeSubir} maxMb={CLASES.imagen.maxMb}
                                    ayuda={x.ayudaPortada(CLASES.imagen.maxMb)} vistaPrevia />

                      <label className="lbl">{x.textoBoton}</label>
                      <input name="cta" defaultValue={c.cta} />

                      <label className="lbl">{x.abreDirectoEn}</label>
                      <select name="funnel_id" defaultValue={c.funnel_id ?? ""}>
                        <option value="">{x.todasLasAreas}</option>
                        {areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                      </select>

                      <label className="lbl">{x.enQuePaginas}</label>
                      <textarea name="paginas" rows={4} defaultValue={c.paginas ?? ""}
                                placeholder={x.ejemploPaginas} />
                      <p className="muted" style={{ fontSize: ".76rem", marginTop: ".4rem", lineHeight: 1.5 }}>
                        {x.reglasAyuda} <code>*</code> {x.reglasComodin} (<code>/blog/*</code>). {x.reglasExcluye} <code>!</code> {x.reglasExcluye2} (<code>!/contacto</code>). {x.reglasVacio}
                      </p>

                      <label className="check">
                        <input type="checkbox" name="autoplay" defaultChecked={c.autoplay} />
                        {x.arrancaSolo}
                      </label>
                      <p className="muted" style={{ fontSize: ".76rem", marginTop: "-.2rem", lineHeight: 1.5 }}>
                        {x.arrancaAyuda}
                      </p>

                      <label className="check">
                        <input type="checkbox" name="active" defaultChecked={c.active} /> {x.activoCheck}
                      </label>

                      <div className="fila-alta" style={{ marginTop: ".5rem" }}>
                        <button type="submit" className="btn">{x.guardar}</button>
                      </div>
                    </form>

                    <form action={borrar} style={{ marginTop: ".75rem" }}>
                      <input type="hidden" name="id" value={c.id} />
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
            <h3>{x.nuevoClip}</h3>
            <form action={crear} className="ajustes">
              <label className="lbl">{x.nombre}</label>
              <input name="name" placeholder={x.ejemploNombreClip} required />

              <SubirArchivo lang={firm.lang} name="video_url" clase="video" etiqueta={x.video} habilitado={puedeSubir}
                            maxMb={CLASES.video.maxMb} ayuda={x.ayudaVideo(CLASES.video.maxMb)} />

              <SubirArchivo lang={firm.lang} name="poster_url" clase="imagen" etiqueta={x.portada}
                            habilitado={puedeSubir}
                            maxMb={CLASES.imagen.maxMb} ayuda={x.ayudaPortada(CLASES.imagen.maxMb)} vistaPrevia />

              <label className="lbl">{x.textoBoton}</label>
              <input name="cta" placeholder={x.ctaClipDefecto} />

              <label className="lbl">{x.abreDirectoEn}</label>
              <select name="funnel_id" defaultValue="">
                <option value="">{x.todasLasAreas}</option>
                {areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>

              <label className="lbl">{x.enQuePaginas}</label>
              <textarea name="paginas" rows={3}
                        placeholder={x.ejemploPaginasCorto} />

              <label className="check">
                <input type="checkbox" name="autoplay" defaultChecked />
                {x.arrancaSolo}
              </label>

              <button type="submit" className="btn" style={{ width: "100%", marginTop: ".5rem" }}>{x.crear}</button>
            </form>

            <p className="muted" style={{ fontSize: ".8rem", marginTop: "1rem", lineHeight: 1.55 }}>
              {puedeSubir ? x.pieClip : x.pieClipSinSubida}
            </p>
          </div>
        )}
      </div>
    </>
  );
}
