import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { sql, type Funnel } from "@/lib/db";
import { activeFirm, requireOwner } from "@/lib/tenancy";
import { pasoDeContacto, slugUrl } from "@/lib/forms";

export const dynamic = "force-dynamic";

/** Busca el área por slug validando siempre contra el estudio de la sesión. */
async function buscarArea(slug: string) {
  const { firm, user } = await activeFirm();
  const [funnel] = await sql<Funnel[]>`
    select * from funnels where firm_id = ${firm.id} and slug = ${slug}`;
  if (!funnel) notFound();
  return { firm, user, funnel };
}

async function guardarArea(formData: FormData) {
  "use server";
  const { firm } = await requireOwner();
  const id = String(formData.get("id"));

  await sql`
    update funnels set
      name          = ${String(formData.get("name") ?? "").trim()},
      color         = ${String(formData.get("color") ?? "#c9a227")},
      active        = ${formData.get("active") === "on"},
      on_storefront = ${formData.get("on_storefront") === "on"}
    where id = ${id} and firm_id = ${firm.id}`;

  revalidatePath("/funnels");
}

async function borrarArea(formData: FormData) {
  "use server";
  const { firm } = await requireOwner();
  // Las consultas ya recibidas no se borran: quedan con el área en null.
  await sql`delete from funnels where id = ${String(formData.get("id"))} and firm_id = ${firm.id}`;
  revalidatePath("/funnels");
  redirect("/funnels");
}

async function crearCaso(formData: FormData) {
  "use server";
  const { firm } = await requireOwner();

  const funnelId = String(formData.get("funnelId"));
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;

  const [funnel] = await sql<{ id: string; slug: string }[]>`
    select id, slug from funnels where id = ${funnelId} and firm_id = ${firm.id}`;
  if (!funnel) return;

  const base = slugUrl(name);
  let slug = base;
  for (let i = 2; ; i++) {
    const [existe] = await sql`select 1 from workflows where funnel_id = ${funnel.id} and slug = ${slug}`;
    if (!existe) break;
    slug = `${base}-${i}`;
  }

  const [{ n }] = await sql<{ n: number }[]>`select count(*)::int as n from workflows where funnel_id = ${funnel.id}`;

  // Arranca con el paso de contacto ya armado: es el que habilita recuperar
  // los abandonos, y dejarlo librado a que se acuerden es pedir problemas.
  // El de coordinación se agrega desde el editor, con un botón, para que caiga
  // al final y no en el medio de los pasos del caso.
  await sql`
    insert into workflows (funnel_id, name, slug, steps, sort_order)
    values (${funnel.id}, ${name}, ${slug}, ${sql.json({ steps: [pasoDeContacto()] })}, ${n})`;

  revalidatePath(`/funnels/${funnel.slug}`);
  redirect(`/funnels/${funnel.slug}/${slug}`);
}

async function borrarCaso(formData: FormData) {
  "use server";
  const { firm } = await requireOwner();
  const id = String(formData.get("id"));
  await sql`
    delete from workflows w using funnels f
    where w.id = ${id} and w.funnel_id = f.id and f.firm_id = ${firm.id}`;
  revalidatePath("/funnels");
}

type Caso = { id: string; name: string; slug: string; active: boolean; pasos: number; consultas: number };

export default async function AreaDetalle({ params }: { params: Promise<{ funnel: string }> }) {
  const { funnel: slug } = await params;
  const { firm, funnel } = await buscarArea(slug);
  const puedeEditar = firm.role !== "member";

  const casos = await sql<Caso[]>`
    select w.id, w.name, w.slug, w.active,
      jsonb_array_length(w.steps->'steps') as pasos,
      (select count(*)::int from sessions s where s.workflow_id = w.id and s.submitted_at is not null) as consultas
    from workflows w
    where w.funnel_id = ${funnel.id}
    order by w.sort_order, w.name`;

  return (
    <>
      <div className="head">
        <div>
          <Link href="/funnels" className="muted" style={{ fontSize: ".88rem", textDecoration: "none" }}>
            ← Áreas
          </Link>
          <h1 style={{ marginTop: ".5rem" }}>{funnel.name}</h1>
          <p>
            Los casos que atiende esta área. Cada uno tiene su propio formulario, con las preguntas que
            correspondan.
          </p>
        </div>
        <Link href={`/f/${firm.slug}/${funnel.slug}`} className="btn ghost" target="_blank">
          Ver esta área
        </Link>
      </div>

      <div className="grid cols-2-1">
        <div className="card">
          <h3>Casos</h3>

          {casos.length === 0 ? (
            <p className="empty">
              Todavía no hay casos. Agregá el primero: &ldquo;Despido sin causa&rdquo;, &ldquo;Divorcio&rdquo;, lo
              que corresponda.
            </p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Caso</th>
                  <th className="num">Pasos</th>
                  <th className="num">Consultas</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {casos.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <Link href={`/funnels/${funnel.slug}/${c.slug}`} style={{ fontWeight: 500 }}>
                        {c.name}
                      </Link>
                      {!c.active && <div className="muted" style={{ fontSize: ".78rem" }}>Desactivado</div>}
                    </td>
                    <td className="num">{c.pasos}</td>
                    <td className="num">{c.consultas}</td>
                    <td className="num">
                      {puedeEditar && (
                        <form action={borrarCaso}>
                          <input type="hidden" name="id" value={c.id} />
                          <button type="submit" className="btn ghost" style={{ padding: ".3rem .8rem", fontSize: ".78rem" }}>
                            Borrar
                          </button>
                        </form>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {puedeEditar && (
            <form action={crearCaso} className="fila-alta">
              <input type="hidden" name="funnelId" value={funnel.id} />
              <input name="name" placeholder="Despido sin causa" required aria-label="Nombre del caso" />
              <button type="submit" className="btn">Agregar caso</button>
            </form>
          )}
        </div>

        {puedeEditar && (
          <div className="card">
            <h3>Ajustes del área</h3>
            <form action={guardarArea} className="ajustes">
              <input type="hidden" name="id" value={funnel.id} />

              <label className="lbl" htmlFor="name">Nombre</label>
              <input id="name" name="name" defaultValue={funnel.name} required />

              <label className="lbl" htmlFor="color">Color</label>
              <input id="color" name="color" type="color" defaultValue={funnel.color} />

              <label className="check">
                <input type="checkbox" name="active" defaultChecked={funnel.active} />
                Activa
              </label>
              <label className="check">
                <input type="checkbox" name="on_storefront" defaultChecked={funnel.on_storefront} />
                Visible en la página pública
              </label>

              <button type="submit" className="btn" style={{ width: "100%", marginTop: ".5rem" }}>Guardar</button>
            </form>

            <form action={borrarArea} style={{ marginTop: "1.5rem" }}>
              <input type="hidden" name="id" value={funnel.id} />
              <button type="submit" className="btn ghost" style={{ width: "100%", fontSize: ".84rem" }}>
                Borrar el área
              </button>
              <p className="muted" style={{ fontSize: ".78rem", marginTop: ".6rem", lineHeight: 1.5 }}>
                Se borran sus casos y formularios. Las consultas ya recibidas se conservan.
              </p>
            </form>
          </div>
        )}
      </div>
    </>
  );
}
