import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { sql, type Firm } from "@/lib/db";
import { requireOwner } from "@/lib/tenancy";
import { slugUrl } from "@/lib/forms";
import { baseUrl } from "@/lib/base-url";
import { SubirArchivo } from "@/components/Subir";
import { almacenamientoListo, CLASES } from "@/lib/storage";
import { IDIOMAS, esLang, t as textos } from "@/lib/i18n";

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
      intro        = ${String(formData.get("intro") ?? "").trim() || null},
      lang         = ${esLang(formData.get("lang")) ? String(formData.get("lang")) : firm.lang}
    where id = ${firm.id}`;

  revalidatePath("/", "layout");
  redirect("/ajustes?ok=1");
}

export default async function Ajustes({ searchParams }: { searchParams: Promise<{ ok?: string }> }) {
  const guardado = (await searchParams).ok === "1";
  const { user, firm } = await requireOwner();

  const [actual] = await sql<Firm[]>`select * from firms where id = ${firm.id}`;
  const x = textos(actual.lang).ajustes;
  const base = baseUrl().replace(/^https?:\/\//, "");
  const puedeSubir = almacenamientoListo();

  return (
    <>
      <div className="head">
        <div>
          <h1>{x.titulo}</h1>
          <p>{x.bajada}</p>
        </div>
        <Link href={`/f/${actual.slug}`} className="btn ghost" target="_blank">{x.verPublica}</Link>
      </div>

      {guardado && (
        <div className="card" style={{ marginBottom: "1rem" }}>
          <span className="pill good">{x.guardado}</span>
        </div>
      )}

      <div className="grid cols-2-1">
        <div className="card">
          <h3>{x.identidad}</h3>
          <form action={guardar} className="ajustes">
            <label className="lbl" htmlFor="name">{x.nombreEstudio}</label>
            <input id="name" name="name" defaultValue={actual.name} required />

            <label className="lbl" htmlFor="slug">{x.direccionPublica}</label>
            {user.is_staff ? (
              <>
                <input id="slug" name="slug" defaultValue={actual.slug} />
                <p className="muted" style={{ fontSize: ".78rem", marginTop: ".4rem" }}>
                  {base}/f/<strong>{actual.slug}</strong> {x.slugAviso}
                </p>
              </>
            ) : (
              <p className="muted" style={{ fontSize: ".84rem" }}>
                {base}/f/{actual.slug}
              </p>
            )}

            <label className="lbl" htmlFor="notify_email">{x.aDondeLlegan}</label>
            <input id="notify_email" name="notify_email" type="email"
                   defaultValue={actual.notify_email ?? ""} placeholder={x.ejemploNotify} />

            <label className="lbl" htmlFor="accent">{x.colorPrincipal}</label>
            <input id="accent" name="accent" type="color" defaultValue={actual.accent} />

            <label className="lbl" htmlFor="lang">{x.idioma}</label>
            <select id="lang" name="lang" defaultValue={actual.lang}>
              {IDIOMAS.map((i) => <option key={i.code} value={i.code}>{i.nombre}</option>)}
            </select>
            <p className="muted" style={{ fontSize: ".78rem", marginTop: ".4rem", lineHeight: 1.5 }}>
              {x.idiomaAyuda}
            </p>

            <SubirArchivo lang={actual.lang} name="logo_url" clase="imagen" etiqueta={x.logo}
                          defaultValue={actual.logo_url ?? ""}
                          habilitado={puedeSubir} maxMb={CLASES.imagen.maxMb} vistaPrevia
                          ayuda={x.logoAyuda} />

            <SubirArchivo lang={actual.lang} name="hero_url" clase="imagen" etiqueta={x.imagenPublica}
                          defaultValue={actual.hero_url ?? ""}
                          habilitado={puedeSubir} maxMb={CLASES.imagen.maxMb} vistaPrevia
                          ayuda={x.imagenPublicaAyuda} />

            <label className="lbl" htmlFor="intro">{x.privacidad}</label>
            <textarea id="intro" name="intro" rows={4} defaultValue={actual.intro ?? ""}
                      placeholder={x.privacidadEjemplo} />

            <button type="submit" className="btn" style={{ width: "100%", marginTop: ".9rem" }}>{x.guardar}</button>
          </form>
        </div>

        <div className="card">
          <h3>{x.dondeSeUsa}</h3>
          <ul className="ayuda">
            <li><strong>{x.usoLogo}</strong> — {x.usoLogoDet}</li>
            <li><strong>{x.usoNotify}</strong> — {x.usoNotifyDet}</li>
            <li><strong>{x.usoImagen}</strong> — {x.usoImagenDet} {base}/f/{actual.slug}.</li>
            <li><strong>{x.usoIdioma}</strong> — {x.usoIdiomaDet}</li>
            <li><strong>{x.usoPrivacidad}</strong> — {x.usoPrivacidadDet}</li>
          </ul>
        </div>
      </div>
    </>
  );
}
