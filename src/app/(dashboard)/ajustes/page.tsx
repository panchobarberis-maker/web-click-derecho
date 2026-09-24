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
import { hayTriage } from "@/lib/triage";

export const dynamic = "force-dynamic";

/** Lo que se configura del resumen. No va en el tipo Firm de la sesion: esa
 *  consulta la corre cada pagina del panel y no necesita nada de esto. */
type Resumen = {
  triage_contexto: string | null;
  timezone: string;
  digest_hora: number;
  digest_dias: string;
};

// Una lista corta y no las 400 zonas de la base de datos: el que la elige es
// alguien del estudio, no un administrador de sistemas.
const ZONAS = [
  "America/Argentina/Buenos_Aires", "America/Montevideo", "America/Santiago",
  "America/Sao_Paulo", "America/Bogota", "America/Lima", "America/Mexico_City",
  "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles",
  "Europe/Madrid", "UTC",
];

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

async function guardarResumen(formData: FormData) {
  "use server";
  const { firm } = await requireOwner();

  // Una zona inventada haria fallar el reloj del resumen, asi que solo entran
  // las de la lista.
  const zonaPedida = String(formData.get("timezone") ?? "");
  const timezone = ZONAS.includes(zonaPedida) ? zonaPedida : "UTC";

  const hora = Math.min(23, Math.max(0, Number(formData.get("digest_hora") ?? 8) || 0));

  // Los dias llegan como una casilla por dia; se ordenan para que el texto
  // guardado no dependa del orden del formulario.
  const dias = formData.getAll("dias")
    .map((d) => Number(d))
    .filter((d) => d >= 1 && d <= 7)
    .sort((a, b) => a - b)
    .join(",");

  await sql`
    update firms set
      triage_contexto = ${String(formData.get("triage_contexto") ?? "").trim() || null},
      timezone        = ${timezone},
      digest_hora     = ${hora},
      digest_dias     = ${dias}
    where id = ${firm.id}`;

  revalidatePath("/ajustes");
  redirect("/ajustes?ok=1");
}

export default async function Ajustes({ searchParams }: { searchParams: Promise<{ ok?: string }> }) {
  const guardado = (await searchParams).ok === "1";
  const { user, firm } = await requireOwner();

  const [actual] = await sql<(Firm & Resumen)[]>`select * from firms where id = ${firm.id}`;
  const diasElegidos = new Set(actual.digest_dias.split(",").map((d) => d.trim()));
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

        <div className="card" style={{ gridColumn: "1 / -1" }}>
          <h3>{x.resumenTitulo}</h3>
          <p className="muted" style={{ fontSize: ".88rem", marginTop: "-.4rem" }}>{x.resumenBajada}</p>

          {!hayTriage() && (
            <p className="pill warn" style={{ display: "block", margin: ".9rem 0", padding: ".6rem .9rem", lineHeight: 1.5 }}>
              {x.faltaClave}
            </p>
          )}

          <form action={guardarResumen} className="ajustes">
            <label className="lbl" htmlFor="triage_contexto">{x.criterio}</label>
            <textarea id="triage_contexto" name="triage_contexto" rows={4}
                      defaultValue={actual.triage_contexto ?? ""}
                      placeholder={x.criterioEjemplo} />
            <p className="muted" style={{ fontSize: ".78rem", marginTop: ".4rem", lineHeight: 1.5 }}>
              {x.criterioAyuda}
            </p>

            <div className="grid cols-2" style={{ gap: ".9rem", marginTop: "1.1rem" }}>
              <div>
                <label className="lbl" htmlFor="timezone">{x.zona}</label>
                <select id="timezone" name="timezone" defaultValue={actual.timezone}>
                  {ZONAS.map((z) => <option key={z} value={z}>{z.replace(/_/g, " ")}</option>)}
                </select>
              </div>
              <div>
                <label className="lbl" htmlFor="digest_hora">{x.horaResumen}</label>
                <select id="digest_hora" name="digest_hora" defaultValue={String(actual.digest_hora)}>
                  {Array.from({ length: 24 }, (_, h) => (
                    <option key={h} value={h}>{String(h).padStart(2, "0")}:00</option>
                  ))}
                </select>
              </div>
            </div>

            <label className="lbl" style={{ marginTop: "1.1rem" }}>{x.diasResumen}</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: ".75rem" }}>
              {x.dias.map((nombre, i) => (
                <label key={nombre} style={{ display: "flex", alignItems: "center", gap: ".35rem", fontSize: ".88rem" }}>
                  <input type="checkbox" name="dias" value={i + 1}
                         defaultChecked={diasElegidos.has(String(i + 1))} />
                  {nombre}
                </label>
              ))}
            </div>
            <p className="muted" style={{ fontSize: ".78rem", marginTop: ".5rem", lineHeight: 1.5 }}>
              {actual.notify_email ? x.resumenVaA(actual.notify_email) : x.resumenSinDestino}{" "}
              {x.sinDias}
            </p>

            <button type="submit" className="btn" style={{ width: "100%", marginTop: "1.1rem" }}>
              {x.guardarResumen}
            </button>
          </form>

          <p className="muted" style={{ fontSize: ".78rem", marginTop: "1rem", lineHeight: 1.5 }}>
            {x.resumenAclaracion}
          </p>
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
