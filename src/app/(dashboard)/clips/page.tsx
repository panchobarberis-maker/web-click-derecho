import { revalidatePath } from "next/cache";
import { sql } from "@/lib/db";
import { activeFirm, requireOwner } from "@/lib/tenancy";
import { porWidget, type Range } from "@/lib/analytics";
import { baseUrl } from "@/lib/base-url";
import { RangePicker } from "@/components/RangePicker";
import { Snippet } from "@/components/Snippet";

export const dynamic = "force-dynamic";

async function crear(formData: FormData) {
  "use server";
  const { firm } = await requireOwner();
  const name = String(formData.get("name") ?? "").trim();
  const video = String(formData.get("video_url") ?? "").trim();
  if (!name || !video) return;

  await sql`
    insert into clips (firm_id, name, video_url, poster_url, cta, funnel_id)
    values (${firm.id}, ${name}, ${video},
            ${String(formData.get("poster_url") ?? "").trim() || null},
            ${String(formData.get("cta") ?? "").trim() || "Empezar"},
            ${String(formData.get("funnel_id") ?? "") || null})`;
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
  cta: string; funnel_id: string | null; active: boolean;
};

export default async function Clips({ searchParams }: { searchParams: Promise<{ r?: string }> }) {
  const range = (((await searchParams).r as Range) ?? "30d") satisfies Range;
  const { firm } = await activeFirm();
  const puedeEditar = firm.role !== "member";

  const [clips, areas, stats] = await Promise.all([
    sql<Clip[]>`select id, name, video_url, poster_url, cta, funnel_id, active from clips
                where firm_id = ${firm.id} order by created_at desc`,
    sql<{ id: string; name: string }[]>`select id, name from funnels where firm_id = ${firm.id} order by sort_order`,
    porWidget(firm.id, "clips", range),
  ]);

  const stat = new Map(stats.map((s) => [s.id, s]));
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

                {puedeEditar && (
                  <details className="ajuste">
                    <summary>Ajustes</summary>
                    <form action={guardar} className="ajustes">
                      <input type="hidden" name="id" value={c.id} />

                      <label className="lbl">Nombre</label>
                      <input name="name" defaultValue={c.name} required />

                      <label className="lbl">URL del video (mp4)</label>
                      <input name="video_url" defaultValue={c.video_url} required />

                      <label className="lbl">Imagen de portada (opcional)</label>
                      <input name="poster_url" defaultValue={c.poster_url ?? ""} />

                      <label className="lbl">Texto del botón</label>
                      <input name="cta" defaultValue={c.cta} />

                      <label className="lbl">Abre directo en</label>
                      <select name="funnel_id" defaultValue={c.funnel_id ?? ""}>
                        <option value="">Todas las áreas (menú)</option>
                        {areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                      </select>

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

              <label className="lbl">URL del video (mp4)</label>
              <input name="video_url" placeholder="https://…/clip.mp4" required />

              <label className="lbl">Imagen de portada (opcional)</label>
              <input name="poster_url" placeholder="https://…/portada.jpg" />

              <label className="lbl">Texto del botón</label>
              <input name="cta" placeholder="Empezar" />

              <label className="lbl">Abre directo en</label>
              <select name="funnel_id" defaultValue="">
                <option value="">Todas las áreas (menú)</option>
                {areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>

              <button type="submit" className="btn" style={{ width: "100%", marginTop: ".5rem" }}>Crear</button>
            </form>

            <p className="muted" style={{ fontSize: ".8rem", marginTop: "1rem", lineHeight: 1.55 }}>
              El video lo hospedás donde quieras y pegás la dirección acá. Vertical y de 15 a 30 segundos es lo
              que mejor funciona.
            </p>
          </div>
        )}
      </div>
    </>
  );
}
