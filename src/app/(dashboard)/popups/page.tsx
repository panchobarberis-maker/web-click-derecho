import { revalidatePath } from "next/cache";
import { sql } from "@/lib/db";
import { activeFirm, requireOwner } from "@/lib/tenancy";
import { porWidget, type Range } from "@/lib/analytics";
import { baseUrl } from "@/lib/base-url";
import { RangePicker } from "@/components/RangePicker";
import { Snippet } from "@/components/Snippet";

export const dynamic = "force-dynamic";

const DISPARADORES: { value: string; label: string }[] = [
  { value: "delay:12", label: "A los 12 segundos" },
  { value: "delay:30", label: "A los 30 segundos" },
  { value: "scroll:50", label: "A la mitad de la página" },
  { value: "exit", label: "Cuando se va a ir (exit intent)" },
  { value: "now", label: "Apenas carga la página" },
  { value: "button", label: "Botón flotante (no se abre solo)" },
];

async function crear(formData: FormData) {
  "use server";
  const { firm } = await requireOwner();
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;

  await sql`
    insert into popups (firm_id, name, trigger, cta, funnel_id, paginas)
    values (${firm.id}, ${name},
            ${String(formData.get("trigger") ?? "delay:12")},
            ${String(formData.get("cta") ?? "").trim() || "Consultá tu caso"},
            ${String(formData.get("funnel_id") ?? "") || null},
            ${String(formData.get("paginas") ?? "").trim() || null})`;
  revalidatePath("/popups");
}

async function guardar(formData: FormData) {
  "use server";
  const { firm } = await requireOwner();
  await sql`
    update popups set
      name      = ${String(formData.get("name") ?? "").trim()},
      trigger   = ${String(formData.get("trigger") ?? "delay:12")},
      cta       = ${String(formData.get("cta") ?? "").trim() || "Consultá tu caso"},
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
  id: string; name: string; trigger: string; cta: string;
  funnel_id: string | null; active: boolean; paginas: string | null;
};

export default async function Popups({ searchParams }: { searchParams: Promise<{ r?: string }> }) {
  const range = (((await searchParams).r as Range) ?? "30d") satisfies Range;
  const { firm } = await activeFirm();
  const puedeEditar = firm.role !== "member";

  const [popups, areas, stats] = await Promise.all([
    sql<Popup[]>`select id, name, trigger, cta, funnel_id, active, paginas from popups
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
          <h1>Pop-ups</h1>
          <p>
            El formulario apareciendo sobre el sitio del estudio. Cada pop-up tiene su propio código y sus
            propias métricas, así podés comparar cuál funciona mejor.
          </p>
        </div>
        <RangePicker current={range} />
      </div>

      <div className="grid cols-2-1">
        <div style={{ display: "grid", gap: "1rem" }}>
          {popups.length === 0 && (
            <div className="card">
              <p className="empty">Todavía no hay pop-ups. Creá el primero acá al lado.</p>
            </div>
          )}

          {popups.map((p) => {
            const s = stat.get(p.id);
            return (
              <div className="card" key={p.id}>
                <div className="widget-head">
                  <div>
                    <h3>{p.name}</h3>
                    <span className={p.active ? "pill good" : "pill"}>{p.active ? "Activo" : "Pausado"}</span>
                  </div>
                  <div className="widget-stats">
                    <div><strong>{s?.clicks ?? 0}</strong><span>aperturas</span></div>
                    <div><strong>{s?.responses ?? 0}</strong><span>consultas</span></div>
                    <div><strong>{s?.conversion ?? 0}%</strong><span>conversión</span></div>
                  </div>
                </div>

                <Snippet code={`<script src="${base}/w.js?popup=${p.id}"></script>`} />

                {puedeEditar && (
                  <details className="ajuste">
                    <summary>Ajustes</summary>
                    <form action={guardar} className="ajustes">
                      <input type="hidden" name="id" value={p.id} />

                      <label className="lbl">Nombre</label>
                      <input name="name" defaultValue={p.name} required />

                      <label className="lbl">Cuándo aparece</label>
                      <select name="trigger" defaultValue={p.trigger}>
                        {DISPARADORES.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
                      </select>

                      <label className="lbl">Texto del botón</label>
                      <input name="cta" defaultValue={p.cta} />

                      <label className="lbl">Abre directo en</label>
                      <select name="funnel_id" defaultValue={p.funnel_id ?? ""}>
                        <option value="">Todas las áreas (menú)</option>
                        {areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                      </select>

                      <label className="lbl">¿En qué páginas aparece?</label>
                      <textarea name="paginas" rows={4} defaultValue={p.paginas ?? ""}
                                placeholder={"Vacío = en todo el sitio\n/laboral\n/servicios/*\n!/contacto"} />
                      <p className="muted" style={{ fontSize: ".76rem", marginTop: ".4rem", lineHeight: 1.5 }}>
                        Una dirección por línea. <code>*</code> vale por cualquier cosa
                        (<code>/blog/*</code>). Una línea que empieza con <code>!</code> la excluye
                        (<code>!/contacto</code>). Si lo dejás vacío, aparece en todo el sitio.
                      </p>

                      <label className="check">
                        <input type="checkbox" name="active" defaultChecked={p.active} /> Activo
                      </label>

                      <div className="fila-alta" style={{ marginTop: ".5rem" }}>
                        <button type="submit" className="btn">Guardar</button>
                      </div>
                    </form>

                    <form action={borrar} style={{ marginTop: ".75rem" }}>
                      <input type="hidden" name="id" value={p.id} />
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
            <h3>Nuevo pop-up</h3>
            <form action={crear} className="ajustes">
              <label className="lbl">Nombre</label>
              <input name="name" placeholder="Home — salida" required />

              <label className="lbl">Cuándo aparece</label>
              <select name="trigger" defaultValue="delay:12">
                {DISPARADORES.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
              </select>

              <label className="lbl">Texto del botón</label>
              <input name="cta" placeholder="Consultá tu caso" />

              <label className="lbl">Abre directo en</label>
              <select name="funnel_id" defaultValue="">
                <option value="">Todas las áreas (menú)</option>
                {areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>

              <label className="lbl">¿En qué páginas aparece?</label>
              <textarea name="paginas" rows={3}
                        placeholder={"Vacío = en todo el sitio\n/laboral\n!/contacto"} />

              <button type="submit" className="btn" style={{ width: "100%", marginTop: ".5rem" }}>Crear</button>
            </form>

            <p className="muted" style={{ fontSize: ".8rem", marginTop: "1rem", lineHeight: 1.55 }}>
              El código se pega una vez en el sitio del estudio. Después podés cambiar el disparador o el texto
              desde acá sin volver a tocarlo.
            </p>
          </div>
        )}
      </div>
    </>
  );
}
