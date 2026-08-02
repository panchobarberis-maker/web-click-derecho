import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { sql, type Firm } from "@/lib/db";
import { requireOwner } from "@/lib/tenancy";
import { slugUrl } from "@/lib/forms";
import { baseUrl } from "@/lib/base-url";

export const dynamic = "force-dynamic";

async function guardar(formData: FormData) {
  "use server";

  // El estudio sale de la sesión, no del formulario: nadie edita el de otro
  // mandando otro id.
  const { user, firm } = await requireOwner();

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;

  // El slug cambia la dirección pública, así que solo lo toca la agencia.
  let slug = firm.slug;
  if (user.is_staff) {
    const pedido = slugUrl(String(formData.get("slug") ?? ""));
    if (pedido && pedido !== firm.slug) {
      const [existe] = await sql`select 1 from firms where slug = ${pedido}`;
      if (!existe) slug = pedido;
    }
  }

  await sql`
    update firms set
      name         = ${name},
      slug         = ${slug},
      notify_email = ${String(formData.get("notify_email") ?? "").trim().toLowerCase() || null},
      accent       = ${String(formData.get("accent") ?? "#5a4630")},
      logo_url     = ${String(formData.get("logo_url") ?? "").trim() || null},
      hero_url     = ${String(formData.get("hero_url") ?? "").trim() || null},
      intro        = ${String(formData.get("intro") ?? "").trim() || null}
    where id = ${firm.id}`;

  revalidatePath("/", "layout");
  redirect("/ajustes?ok=1");
}

export default async function Ajustes({ searchParams }: { searchParams: Promise<{ ok?: string }> }) {
  const guardado = (await searchParams).ok === "1";
  const { user, firm } = await requireOwner();

  const [actual] = await sql<Firm[]>`select * from firms where id = ${firm.id}`;
  const base = baseUrl().replace(/^https?:\/\//, "");

  return (
    <>
      <div className="head">
        <div>
          <h1>Ajustes del estudio</h1>
          <p>
            Cómo se ve el formulario y a dónde llegan las consultas. Todo esto lo ve la persona antes de
            escribir: es lo que hace que el formulario parezca del estudio y no de una app cualquiera.
          </p>
        </div>
        <Link href={`/f/${actual.slug}`} className="btn ghost" target="_blank">Ver página pública</Link>
      </div>

      {guardado && (
        <div className="card" style={{ marginBottom: "1rem" }}>
          <span className="pill good">Guardado</span>
        </div>
      )}

      <div className="grid cols-2-1">
        <div className="card">
          <h3>Identidad</h3>
          <form action={guardar} className="ajustes">
            <label className="lbl" htmlFor="name">Nombre del estudio</label>
            <input id="name" name="name" defaultValue={actual.name} required />

            <label className="lbl" htmlFor="slug">Dirección pública</label>
            {user.is_staff ? (
              <>
                <input id="slug" name="slug" defaultValue={actual.slug} />
                <p className="muted" style={{ fontSize: ".78rem", marginTop: ".4rem" }}>
                  {base}/f/<strong>{actual.slug}</strong> — si la cambiás, los links viejos dejan de andar.
                </p>
              </>
            ) : (
              <p className="muted" style={{ fontSize: ".84rem" }}>
                {base}/f/{actual.slug}
              </p>
            )}

            <label className="lbl" htmlFor="notify_email">A dónde llegan las consultas</label>
            <input id="notify_email" name="notify_email" type="email"
                   defaultValue={actual.notify_email ?? ""} placeholder="consultas@estudio.com.ar" />

            <label className="lbl" htmlFor="accent">Color principal</label>
            <input id="accent" name="accent" type="color" defaultValue={actual.accent} />

            <label className="lbl" htmlFor="logo_url">Logo (URL)</label>
            <input id="logo_url" name="logo_url" defaultValue={actual.logo_url ?? ""}
                   placeholder="https://…/logo.png" />

            <label className="lbl" htmlFor="hero_url">Imagen de la página pública (URL)</label>
            <input id="hero_url" name="hero_url" defaultValue={actual.hero_url ?? ""}
                   placeholder="https://…/foto-estudio.jpg" />

            <label className="lbl" htmlFor="intro">Texto de privacidad</label>
            <textarea id="intro" name="intro" rows={4} defaultValue={actual.intro ?? ""}
                      placeholder="Lo que nos contés es confidencial y solo lo ve el estudio." />

            <button type="submit" className="btn" style={{ width: "100%", marginTop: ".9rem" }}>Guardar</button>
          </form>
        </div>

        <div className="card">
          <h3>Dónde se usa cada cosa</h3>
          <ul className="ayuda">
            <li>
              <strong>Logo y color</strong> — arriba del formulario, en el pop-up y en el mail que le llega a
              quien abandona a mitad de camino.
            </li>
            <li>
              <strong>A dónde llegan las consultas</strong> — cada formulario completado se manda a esa
              dirección con los datos de contacto y el origen de la visita. Si está vacío, la consulta igual
              queda guardada en el panel.
            </li>
            <li>
              <strong>Imagen de la página pública</strong> — la foto del costado en {base}/f/{actual.slug}.
            </li>
            <li>
              <strong>Texto de privacidad</strong> — el párrafo debajo del formulario. Es lo que baja la
              desconfianza de dejar un teléfono.
            </li>
          </ul>
        </div>
      </div>
    </>
  );
}
