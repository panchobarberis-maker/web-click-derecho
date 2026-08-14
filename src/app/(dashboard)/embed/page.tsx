import { sql } from "@/lib/db";
import { activeFirm } from "@/lib/tenancy";
import { baseUrl } from "@/lib/base-url";
import { t as textos } from "@/lib/i18n";

export const dynamic = "force-dynamic";

export default async function Embed() {
  const { firm } = await activeFirm();
  const x = textos(firm.lang).embed;
  const base = baseUrl();

  const funnels = await sql<{ name: string; slug: string }[]>`
    select name, slug from funnels where firm_id = ${firm.id} and active order by sort_order`;

  const snippets = [
    {
      title: x.popupTitulo,
      desc: x.popupDesc,
      code: `<script src="${base}/w.js"
        data-firm="${firm.slug}"
        data-mode="popup"
        data-trigger="delay:12"></script>`,
    },
    {
      title: x.botonTitulo,
      desc: x.botonDesc,
      code: `<script src="${base}/w.js"
        data-firm="${firm.slug}"
        data-mode="button"
        data-cta="${textos(firm.lang).widgets.ctaPopupDefecto}"
        data-accent="${firm.accent}"></script>`,
    },
    {
      title: x.inlineTitulo,
      desc: x.inlineDesc,
      code: `<div id="consulta"></div>
<script src="${base}/w.js"
        data-firm="${firm.slug}"
        data-mode="inline"
        data-target="#consulta"></script>`,
    },
    {
      title: x.clipTitulo,
      desc: x.clipDesc,
      code: `<script src="${base}/w.js"
        data-firm="${firm.slug}"
        data-mode="clip"
        data-video="https://tu-cdn.com/clip.mp4"
        data-poster="https://tu-cdn.com/clip.jpg"
        data-cta="${textos(firm.lang).widgets.ctaClipDefecto}"
        data-accent="${firm.accent}"></script>`,
    },
    {
      title: x.areaTitulo,
      desc: x.areaDesc,
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
          <h1>{x.titulo}</h1>
          <p>{x.bajada}</p>
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
        <h3>{x.atribucion}</h3>
        <p className="muted" style={{ fontSize: ".88rem", lineHeight: 1.6 }}>
          {x.atribucion1} <code>utm_*</code> {x.atribucion2}
        </p>
      </div>

      <div className="card" style={{ marginTop: "1rem" }}>
        <h3>{x.links}</h3>
        <p className="muted" style={{ fontSize: ".88rem", marginBottom: "1rem" }}>
          {x.linksAyuda1} <code>?utm_source=instagram</code> {x.linksAyuda2}
        </p>
        <table>
          <tbody>
            <tr>
              <td>{x.todasLasAreas}</td>
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
