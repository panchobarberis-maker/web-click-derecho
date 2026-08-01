import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { sql, type Firm } from "@/lib/db";
import { requireStaff, FIRM_COOKIE } from "@/lib/tenancy";
import { slugUrl } from "@/lib/forms";
import { estadoDeTodos, pasosDe, hechos } from "@/lib/onboarding";
import { baseUrl } from "@/lib/base-url";

export const dynamic = "force-dynamic";

const ANIO = 60 * 60 * 24 * 365;

/** Deja el estudio elegido en la cookie. Solo la agencia pasa por acá. */
async function elegir(id: string) {
  (await cookies()).set(FIRM_COOKIE, id, {
    path: "/",
    maxAge: ANIO,
    sameSite: "lax",
  });
}

async function crear(formData: FormData) {
  "use server";
  await requireStaff();

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;

  // El slug va en la URL pública del estudio, así que tiene que ser único.
  const base = slugUrl(name);
  let slug = base;
  for (let i = 2; ; i++) {
    const [existe] = await sql`select 1 from firms where slug = ${slug}`;
    if (!existe) break;
    slug = `${base}-${i}`;
  }

  const notify = String(formData.get("notify_email") ?? "").trim().toLowerCase();

  const [firm] = await sql<{ id: string }[]>`
    insert into firms (name, slug, notify_email, accent, logo_url, intro)
    values (${name}, ${slug}, ${notify || null},
            ${String(formData.get("accent") ?? "#2d0a4e")},
            ${String(formData.get("logo_url") ?? "").trim() || null},
            ${String(formData.get("intro") ?? "").trim() || null})
    returning id`;

  // Quedar parado en el estudio recién creado es lo que uno quiere después de
  // crearlo: lo que sigue es cargarle las áreas.
  await elegir(firm.id);
  revalidatePath("/", "layout");
  redirect("/");
}

async function abrir(formData: FormData) {
  "use server";
  await requireStaff();
  await elegir(String(formData.get("id")));
  revalidatePath("/", "layout");
  redirect("/");
}

async function borrar(formData: FormData) {
  "use server";
  await requireStaff();

  const id = String(formData.get("id"));
  const [firm] = await sql<{ slug: string }[]>`select slug from firms where id = ${id}`;
  if (!firm) return;

  // Se borra todo lo del estudio en cascada, consultas incluidas. Escribir el
  // slug a mano es la única traba entre un click distraído y perderlas.
  if (String(formData.get("confirmar") ?? "").trim() !== firm.slug) return;

  await sql`delete from firms where id = ${id}`;
  const elegido = (await cookies()).get(FIRM_COOKIE)?.value;
  if (elegido === id) (await cookies()).delete(FIRM_COOKIE);

  revalidatePath("/", "layout");
}

export default async function Estudios() {
  await requireStaff();

  const [firms, estados, consultas] = await Promise.all([
    sql<Firm[]>`select * from firms order by name`,
    estadoDeTodos(),
    // Acá sí van todas las consultas, incluidas las de demostración: es el
    // número que uno quiere ver de un vistazo por cliente.
    sql<{ firm_id: string; n: number }[]>`
      select firm_id, count(*)::int as n from sessions
      where submitted_at is not null group by firm_id`,
  ]);

  const total = new Map(consultas.map((c) => [c.firm_id, c.n]));

  const base = baseUrl().replace(/^https?:\/\//, "");
  const activo = (await cookies()).get(FIRM_COOKIE)?.value;

  return (
    <>
      <div className="head">
        <div>
          <h1>Estudios</h1>
          <p>
            Los estudios que administra la agencia. Cada uno tiene sus formularios, sus consultas y su
            página pública propios: no se ven entre ellos.
          </p>
        </div>
      </div>

      <div className="grid cols-2-1">
        <div style={{ display: "grid", gap: "1rem" }}>
          {firms.map((f) => {
            const e = estados.get(f.id);
            const pasos = e ? pasosDe(e, f.slug) : [];
            const listos = hechos(pasos);
            const completo = listos === pasos.length;

            return (
              <div className="card" key={f.id}>
                <div className="widget-head">
                  <div>
                    <h3>
                      {f.name}{" "}
                      {f.id === activo && <span className="pill" style={{ fontSize: ".68rem" }}>Viendo</span>}
                    </h3>
                    <div className="muted" style={{ fontSize: ".82rem" }}>
                      {base}/f/{f.slug}
                    </div>
                  </div>
                  <div className="widget-stats">
                    <div><strong>{e?.areas ?? 0}</strong><span>áreas</span></div>
                    <div><strong>{e?.casos ?? 0}</strong><span>formularios</span></div>
                    <div><strong>{total.get(f.id) ?? 0}</strong><span>consultas</span></div>
                  </div>
                </div>

                <div className="fila-alta" style={{ marginTop: 0, justifyContent: "space-between" }}>
                  <span className={completo ? "pill good" : "pill warn"} style={{ flex: "none" }}>
                    {completo ? "En marcha" : `Puesta en marcha: ${listos} de ${pasos.length}`}
                  </span>
                  <span style={{ display: "flex", gap: ".5rem", flex: "none" }}>
                    <Link href={`/f/${f.slug}`} className="btn ghost" target="_blank"
                          style={{ padding: ".4rem 1rem", fontSize: ".82rem" }}>
                      Ver página
                    </Link>
                    <form action={abrir}>
                      <input type="hidden" name="id" value={f.id} />
                      <button type="submit" className="btn" style={{ padding: ".4rem 1rem", fontSize: ".82rem" }}>
                        Abrir panel
                      </button>
                    </form>
                  </span>
                </div>

                <details className="ajuste">
                  <summary>Borrar este estudio</summary>
                  <form action={borrar} className="fila-alta">
                    <input type="hidden" name="id" value={f.id} />
                    <input name="confirmar" placeholder={f.slug} aria-label={`Escribí ${f.slug} para confirmar`} />
                    <button type="submit" className="btn ghost" style={{ flex: "none" }}>Borrar</button>
                  </form>
                  <p className="muted" style={{ fontSize: ".78rem", marginTop: ".6rem", lineHeight: 1.5 }}>
                    Se borran sus áreas, formularios, pop-ups, clips y <strong>todas sus consultas</strong>. Escribí{" "}
                    <code>{f.slug}</code> para confirmar.
                  </p>
                </details>
              </div>
            );
          })}
        </div>

        <div className="card">
          <h3>Estudio nuevo</h3>
          <form action={crear} className="ajustes">
            <label className="lbl" htmlFor="name">Nombre del estudio</label>
            <input id="name" name="name" placeholder="Alzogaray & Serrano" required />

            <label className="lbl" htmlFor="notify_email">A dónde llegan las consultas</label>
            <input id="notify_email" name="notify_email" type="email" placeholder="consultas@estudio.com.ar" />

            <label className="lbl" htmlFor="accent">Color principal</label>
            <input id="accent" name="accent" type="color" defaultValue="#2d0a4e" />

            <label className="lbl" htmlFor="logo_url">Logo (URL)</label>
            <input id="logo_url" name="logo_url" placeholder="https://…/logo.png" />

            <label className="lbl" htmlFor="intro">Texto de privacidad</label>
            <textarea id="intro" name="intro" rows={4}
                      placeholder="Lo que nos contés es confidencial y solo lo ve el estudio." />

            <button type="submit" className="btn" style={{ width: "100%", marginTop: ".75rem" }}>
              Crear estudio
            </button>
          </form>

          <p className="muted" style={{ fontSize: ".8rem", marginTop: "1rem", lineHeight: 1.55 }}>
            La dirección pública sale del nombre. Al crearlo quedás parado en el estudio nuevo, con el checklist
            de puesta en marcha en el Inicio.
          </p>
        </div>
      </div>
    </>
  );
}
