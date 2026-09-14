import { revalidatePath } from "next/cache";
import { sql } from "@/lib/db";
import { activeFirm, requireOwner } from "@/lib/tenancy";
import { porWidget, type Range } from "@/lib/analytics";
import { baseUrl } from "@/lib/base-url";
import { RangePicker } from "@/components/RangePicker";
import { Snippet } from "@/components/Snippet";
import { SubirArchivo } from "@/components/Subir";
import { almacenamientoListo, CLASES } from "@/lib/storage";
import { metaListo, publicarClipEnMeta } from "@/lib/meta";

export const dynamic = "force-dynamic";
// Instagram no publica el video al toque: hay que esperar a que lo procese
// antes de poder publicarlo, y esa espera puede llevar unos segundos.
export const maxDuration = 60;

const AYUDA_VIDEO =
  `Vertical, de 15 a 20 segundos, hasta ${CLASES.video.maxMb} MB. Cuanto más liviano, más rápido arranca en el sitio del estudio.`;
const AYUDA_PORTADA =
  `Es lo que se ve mientras el video carga. Vertical, hasta ${CLASES.imagen.maxMb} MB.`;

async function crear(formData: FormData) {
  "use server";
  const { firm } = await requireOwner();
  const name = String(formData.get("name") ?? "").trim();
  const video = String(formData.get("video_url") ?? "").trim();
  if (!name || !video) return;

  await sql`
    insert into clips (firm_id, name, video_url, poster_url, cta, funnel_id, paginas, autoplay)
    values (${firm.id}, ${name}, ${video},
            ${String(formData.get("poster_url") ?? "").trim() || null},
            ${String(formData.get("cta") ?? "").trim() || "Empezar"},
            ${String(formData.get("funnel_id") ?? "") || null},
            ${String(formData.get("paginas") ?? "").trim() || null},
            ${formData.get("autoplay") === "on"})`;
  revalidatePath("/clips");
}

async function guardar(formData: FormData) {
  "use server";
  const { firm } = await requireOwner();
  await sql`
    update clips set
      name       = ${String(formData.get("name") ?? "").trim()},
      video_url  = ${String(formData.get("video_url") ?? "").trim()},
      poster_url = ${String(formData.get("poster_url") ?? "").trim() || null},
      cta        = ${String(formData.get("cta") ?? "").trim() || "Empezar"},
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

async function publicarMeta(formData: FormData) {
  "use server";
  const { firm } = await requireOwner();
  if (!metaListo()) return;
  const id = String(formData.get("id"));

  const [clip] = await sql<{ name: string; video_url: string; poster_url: string | null; cta: string }[]>`
    select name, video_url, poster_url, cta from clips where id = ${id} and firm_id = ${firm.id}`;
  if (!clip) return;

  let meta_published_at: Date | null = null;
  let meta_post_ids: string | null = null;
  let meta_error: string | null = null;

  try {
    const resultados = await publicarClipEnMeta(clip);
    const publicadas = resultados.filter((r) => r.ok);
    const fallidas = resultados.filter((r) => !r.ok);
    if (publicadas.length > 0) {
      meta_published_at = new Date();
      meta_post_ids = publicadas.map((r) => `${r.destino}:${r.postId}`).join(", ");
    }
    if (fallidas.length > 0) {
      meta_error = fallidas.map((r) => `${r.destino}: ${r.error}`).join("; ");
    }
  } catch (e) {
    meta_error = e instanceof Error ? e.message : String(e);
  }

  // Si esta vez no se publico en ninguna pagina, no se pisa la fecha ni las
  // paginas de la ultima vez que si funciono -- solo el error, que es lo
  // nuevo. Asi el panel sigue mostrando cuando se publico de verdad.
  await sql`
    update clips set
      meta_published_at = coalesce(${meta_published_at}, meta_published_at),
      meta_post_ids      = coalesce(${meta_post_ids}, meta_post_ids),
      meta_error         = ${meta_error}
    where id = ${id} and firm_id = ${firm.id}`;
  revalidatePath("/clips");
}

type Clip = {
  id: string; name: string; video_url: string; poster_url: string | null;
  cta: string; funnel_id: string | null; active: boolean; paginas: string | null; autoplay: boolean;
  meta_published_at: string | null; meta_post_ids: string | null; meta_error: string | null;
};

export default async function Clips({ searchParams }: { searchParams: Promise<{ r?: string }> }) {
  const range = (((await searchParams).r as Range) ?? "30d") satisfies Range;
  const { firm } = await activeFirm();
  const puedeEditar = firm.role !== "member";

  const [clips, areas, stats] = await Promise.all([
    sql<Clip[]>`select id, name, video_url, poster_url, cta, funnel_id, active, paginas, autoplay,
                       meta_published_at, meta_post_ids, meta_error
                from clips where firm_id = ${firm.id} order by created_at desc`,
    sql<{ id: string; name: string }[]>`select id, name from funnels where firm_id = ${firm.id} order by sort_order`,
    porWidget(firm.id, "clips", range),
  ]);

  const stat = new Map(stats.map((s) => [s.id, s]));
  const puedeSubir = almacenamientoListo();
  const puedePublicarMeta = metaListo();
  const base = baseUrl();

  return (
    <>
      <div className="head">
        <div>
          <h1>Clips</h1>
          <p>
            Un video corto fijo en una esquina del sitio. Al tocarlo abre el formulario. Sirve para poner la cara
            del estudio antes de que la persona escriba nada.
          </p>
        </div>
        <RangePicker current={range} />
      </div>

      <div className="grid cols-2-1">
        <div style={{ display: "grid", gap: "1rem" }}>
          {clips.length === 0 && (
            <div className="card">
              <p className="empty">Todavía no hay clips. Creá el primero acá al lado.</p>
            </div>
          )}

          {clips.map((c) => {
            const s = stat.get(c.id);
            return (
              <div className="card" key={c.id}>
                <div className="widget-head">
                  <div>
                    <h3>{c.name}</h3>
                    <span className={c.active ? "pill good" : "pill"}>{c.active ? "Activo" : "Pausado"}</span>
                  </div>
                  <div className="widget-stats">
                    <div><strong>{s?.clicks ?? 0}</strong><span>aperturas</span></div>
                    <div><strong>{s?.responses ?? 0}</strong><span>consultas</span></div>
                    <div><strong>{s?.conversion ?? 0}%</strong><span>conversión</span></div>
                  </div>
                </div>

                <Snippet code={`<script src="${base}/w.js?clip=${c.id}"></script>`} />

                <a href={`/preview/clip/${c.id}`} target="_blank" className="btn ghost"
                   style={{ marginTop: ".9rem", padding: ".45rem 1.1rem", fontSize: ".84rem" }}>
                  Ver cómo queda
                </a>

                {puedeEditar && puedePublicarMeta && (
                  <form action={publicarMeta}
                        style={{ marginTop: ".6rem", display: "flex", alignItems: "center", gap: ".7rem", flexWrap: "wrap" }}>
                    <input type="hidden" name="id" value={c.id} />
                    <button type="submit" className="btn ghost" style={{ padding: ".45rem 1.1rem", fontSize: ".84rem" }}>
                      Publicar en Facebook/Instagram
                    </button>
                    {c.meta_published_at && (
                      <span className="pill good">
                        Publicado {new Date(c.meta_published_at).toLocaleString("es-AR")}
                      </span>
                    )}
                    {c.meta_error && <span className="pill warn">Falló en alguna página</span>}
                  </form>
                )}
                {c.meta_error && (
                  <p className="muted" style={{ fontSize: ".78rem", marginTop: ".4rem", lineHeight: 1.5 }}>
                    {c.meta_error}
                  </p>
                )}

                {puedeEditar && (
                  <details className="ajuste">
                    <summary>Ajustes</summary>
                    <form action={guardar} className="ajustes">
                      <input type="hidden" name="id" value={c.id} />

                      <label className="lbl">Nombre</label>
                      <input name="name" defaultValue={c.name} required />

                      <SubirArchivo name="video_url" clase="video" etiqueta="Video" defaultValue={c.video_url}
                                    habilitado={puedeSubir} maxMb={CLASES.video.maxMb} ayuda={AYUDA_VIDEO} />

                      <SubirArchivo name="poster_url" clase="imagen" etiqueta="Imagen de portada (opcional)"
                                    defaultValue={c.poster_url ?? ""}
                                    habilitado={puedeSubir} maxMb={CLASES.imagen.maxMb}
                                    ayuda={AYUDA_PORTADA} vistaPrevia />

                      <label className="lbl">Texto del botón</label>
                      <input name="cta" defaultValue={c.cta} />

                      <label className="lbl">Abre directo en</label>
                      <select name="funnel_id" defaultValue={c.funnel_id ?? ""}>
                        <option value="">Todas las áreas (menú)</option>
                        {areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                      </select>

                      <label className="lbl">¿En qué páginas aparece?</label>
                      <textarea name="paginas" rows={4} defaultValue={c.paginas ?? ""}
                                placeholder={"Vacío = en todo el sitio\n/laboral\n/servicios/*\n!/contacto"} />
                      <p className="muted" style={{ fontSize: ".76rem", marginTop: ".4rem", lineHeight: 1.5 }}>
                        Una dirección por línea. <code>*</code> vale por cualquier cosa
                        (<code>/blog/*</code>). Una línea que empieza con <code>!</code> la excluye
                        (<code>!/contacto</code>). Si lo dejás vacío, aparece en todo el sitio.
                      </p>

                      <label className="check">
                        <input type="checkbox" name="autoplay" defaultChecked={c.autoplay} />
                        Arranca solo, en silencio
                      </label>
                      <p className="muted" style={{ fontSize: ".76rem", marginTop: "-.2rem", lineHeight: 1.5 }}>
                        Así se ve el video andando apenas entran, que es para lo que sirve.
                        Destildalo solo si preferís que quede quieto con un botón de play.
                      </p>

                      <label className="check">
                        <input type="checkbox" name="active" defaultChecked={c.active} /> Activo
                      </label>

                      <div className="fila-alta" style={{ marginTop: ".5rem" }}>
                        <button type="submit" className="btn">Guardar</button>
                      </div>
                    </form>

                    <form action={borrar} style={{ marginTop: ".75rem" }}>
                      <input type="hidden" name="id" value={c.id} />
                      <button type="submit" className="btn ghost" style={{ fontSize: ".8rem" }}>Borrar</button>
                    </form>
                  </details>
                )}
              </div>
            );
          })}
        </div>

        {puedeEditar && (
          <div className="card">
            <h3>Nuevo clip</h3>
            <form action={crear} className="ajustes">
              <label className="lbl">Nombre</label>
              <input name="name" placeholder="Home — presentación" required />

              <SubirArchivo name="video_url" clase="video" etiqueta="Video" habilitado={puedeSubir}
                            maxMb={CLASES.video.maxMb} ayuda={AYUDA_VIDEO} />

              <SubirArchivo name="poster_url" clase="imagen" etiqueta="Imagen de portada (opcional)"
                            habilitado={puedeSubir}
                            maxMb={CLASES.imagen.maxMb} ayuda={AYUDA_PORTADA} vistaPrevia />

              <label className="lbl">Texto del botón</label>
              <input name="cta" placeholder="Empezar" />

              <label className="lbl">Abre directo en</label>
              <select name="funnel_id" defaultValue="">
                <option value="">Todas las áreas (menú)</option>
                {areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>

              <label className="lbl">¿En qué páginas aparece?</label>
              <textarea name="paginas" rows={3}
                        placeholder={"Vacío = en todo el sitio\n/laboral\n!/contacto"} />

              <label className="check">
                <input type="checkbox" name="autoplay" defaultChecked />
                Arranca solo, en silencio
              </label>

              <button type="submit" className="btn" style={{ width: "100%", marginTop: ".5rem" }}>Crear</button>
            </form>

            <p className="muted" style={{ fontSize: ".8rem", marginTop: "1rem", lineHeight: 1.55 }}>
              {puedeSubir
                ? "Subís el video y queda hospedado con nosotros. Vertical y de 15 a 20 segundos es lo que mejor funciona."
                : "La subida no está configurada en este servidor: por ahora el video lo hospedás donde quieras y pegás la dirección."}
            </p>
          </div>
        )}
      </div>
    </>
  );
}
