import { currentFirm, sql } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function Embed() {
  const firm = await currentFirm();
  const base = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

  const funnels = await sql<{ name: string; slug: string }[]>`
    select name, slug from funnels where firm_id = ${firm.id} and active order by sort_order`;

  const snippets = [
    {
      title: "Pop-up automático",
      desc: "Aparece solo, a los 12 segundos. También podés usar data-trigger=\"scroll:50\" (a la mitad de la página) o \"exit\" (cuando el mouse se va a cerrar la pestaña).",
      code: `<script src="${base}/w.js"
        data-firm="${firm.slug}"
        data-mode="popup"
        data-trigger="delay:12"></script>`,
    },
    {
      title: "Botón flotante",
      desc: "Un botón fijo abajo a la derecha en todas las páginas. El menos invasivo de los tres.",
      code: `<script src="${base}/w.js"
        data-firm="${firm.slug}"
        data-mode="button"
        data-cta="Consultá tu caso"
        data-accent="${firm.accent}"></script>`,
    },
    {
      title: "Formulario embebido",
      desc: "El formulario dentro de una sección de la página. Poné un <div id=\"consulta\"></div> donde lo quieras.",
      code: `<div id="consulta"></div>
<script src="${base}/w.js"
        data-firm="${firm.slug}"
        data-mode="inline"
        data-target="#consulta"></script>`,
    },
    {
      title: "Clip de video",
      desc: "Un video corto fijo en una esquina que abre el formulario al tocarlo. Subí el mp4 donde quieras y pasá la URL.",
      code: `<script src="${base}/w.js"
        data-firm="${firm.slug}"
        data-mode="clip"
        data-video="https://tu-cdn.com/clip.mp4"
        data-poster="https://tu-cdn.com/clip.jpg"
        data-cta="Empezar"
        data-accent="${firm.accent}"></script>`,
    },
    {
      title: "Directo a un área",
      desc: "Para poner en la página de una práctica específica: saltea el menú y abre ese formulario.",
      code: `<script src="${base}/w.js"
        data-firm="${firm.slug}"
        data-mode="popup"
        data-funnel="${funnels[0]?.slug ?? "laboral"}"
        data-trigger="scroll:40"></script>`,
    },
  ];

  return (
    <>
      <div className="head">
        <div>
          <h1>Instalación</h1>
          <p>
            Una sola línea en el sitio del estudio. El formulario va dentro de un iframe, así que no hereda ni rompe
            los estilos de la página.
          </p>
        </div>
      </div>

      <div className="grid cols-2-1" style={{ gridTemplateColumns: "1fr 1fr" }}>
        {snippets.map((s) => (
          <div className="card" key={s.title}>
            <h3>{s.title}</h3>
            <p className="muted" style={{ fontSize: ".88rem", marginBottom: "1rem", lineHeight: 1.5 }}>{s.desc}</p>
            <pre className="snippet">{s.code}</pre>
          </div>
        ))}
      </div>

      <div className="card" style={{ marginTop: "1rem" }}>
        <h3>Atribución del origen</h3>
        <p className="muted" style={{ fontSize: ".88rem", lineHeight: 1.6 }}>
          El widget lee los <code>utm_*</code> y el referrer <strong>de la página del estudio</strong> y se los pasa al
          formulario. Desde adentro del iframe el referrer sería el sitio del estudio, así que sin esto todas las
          consultas figurarían como &ldquo;referral&rdquo;. Se guarda en el primer aterrizaje: si alguien llega desde
          Instagram, navega tres páginas y recién ahí abre el formulario, el origen sigue siendo Instagram.
        </p>
      </div>

      <div className="card" style={{ marginTop: "1rem" }}>
        <h3>Links directos</h3>
        <p className="muted" style={{ fontSize: ".88rem", marginBottom: "1rem" }}>
          Para mandar por WhatsApp, poner en el bio de Instagram o usar como destino de una campaña. Agregá{" "}
          <code>?utm_source=instagram</code> y aparece separado en Analytics.
        </p>
        <table>
          <tbody>
            <tr>
              <td>Todas las áreas</td>
              <td><code>{base}/f/{firm.slug}</code></td>
            </tr>
            {funnels.map((f) => (
              <tr key={f.slug}>
                <td>{f.name}</td>
                <td><code>{base}/f/{firm.slug}/{f.slug}</code></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
