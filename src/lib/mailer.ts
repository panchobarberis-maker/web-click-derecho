import { t, type Lang } from "./i18n";
// Envio via Resend. Sin RESEND_API_KEY los mails se loguean en consola,
// asi el flujo completo se puede probar en local sin cuenta.

type Mail = { to: string; subject: string; html: string; replyTo?: string };

export async function sendMail({ to, subject, html, replyTo }: Mail): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM || "Consultas <onboarding@resend.dev>";

  if (!key) {
    const texto = html
      // Los links importan: sin ellos no se puede seguir una invitacion ni
      // retomar un formulario desde la consola en desarrollo.
      .replace(/<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g, (_m, href, txt) => `${txt.replace(/<[^>]+>/g, "").trim()}: ${href}`)
      .replace(/<\/(tr|p|h2|h3|div)>/g, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">")
      .split("\n").map((l) => l.replace(/\s+/g, " ").trim()).filter(Boolean).join("\n");
    console.log(`\n[mail simulado] para: ${to}\nasunto: ${subject}\n${texto}\n`);
    return true;
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to, subject, html, reply_to: replyTo }),
  });

  if (!res.ok) {
    console.error("resend fallo:", res.status, await res.text());
    return false;
  }
  return true;
}

const wrap = (body: string, footer: string) => `
<div style="font-family:-apple-system,Segoe UI,sans-serif;max-width:520px;margin:0 auto;color:#1c1230;line-height:1.6">
  ${body}
  <hr style="border:none;border-top:1px solid #e8e5ee;margin:2rem 0" />
  <p style="font-size:12px;color:#6b6478">${footer}</p>
</div>`.trim();

// Al visitante: por que le llega y como cortarlo. Al estudio no le corresponde.
const PIE_VISITANTE =
  "Recibís este mail porque dejaste tus datos en nuestro formulario de consulta. " +
  "Si fue un error, ignoralo y no volvemos a escribirte.";

const PIE_ESTUDIO = "Aviso automático de tu formulario de consultas.";

/**
 * Al que dejo el mail y no termino el form.
 *
 * Va en el idioma del estudio: lo recibe su cliente, no el abogado.
 */
export function recoveryEmail(o: {
  name: string | null; firm: string; accent: string; url: string; area: string; lang?: Lang;
}) {
  const m = t(o.lang ?? "es").mail;
  const nombre = o.name ? o.name.split(" ")[0] : "";
  return {
    subject: m.recuperarAsunto(o.firm),
    html: wrap(
      `<p>${esc(m.recuperarHola(nombre))}</p>
       <p>${esc(m.recuperarCuerpo(o.area))}</p>
       <p style="margin:1.75rem 0">
         <a href="${o.url}" style="background:${o.accent};color:#fff;padding:12px 26px;border-radius:99px;text-decoration:none;font-weight:500;display:inline-block">
           ${esc(m.recuperarBoton)}
         </a>
       </p>
       <p>${esc(m.recuperarResponder)}</p>
       <p style="margin-top:1.5rem">— ${esc(o.firm)}</p>`,
      m.pieEstudio,
    ),
  };
}

/** Link para elegir una contraseña nueva. Al panel, no a un estudio. */
export function resetEmail(o: { name: string | null; url: string }, lang: Lang = "es") {
  const x = t(lang).auth;
  return {
    subject: x.resetAsunto,
    html: wrap(
      `<p>${x.resetHola(o.name ? o.name.split(" ")[0] : "")}</p>
       <p>${x.resetCuerpo}</p>
       <p style="margin:1.75rem 0">
         <a href="${o.url}" style="background:#2d0a4e;color:#fff;padding:12px 26px;border-radius:99px;text-decoration:none;font-weight:500;display:inline-block">
           ${x.resetBoton}
         </a>
       </p>
       <p>${x.resetNoFuiste}</p>
       <p style="margin-top:1.5rem">— Right Lead</p>`,
      x.resetPie,
    ),
  };
}

const esc = (v: string) =>
  v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const fila = (k: string, v: string) =>
  `<tr>
     <td style="padding:7px 16px 7px 0;color:#6b6478;vertical-align:top;white-space:nowrap;font-size:13px">${esc(k)}</td>
     <td style="padding:7px 0;font-size:14px;font-weight:500">${esc(v) || "—"}</td>
   </tr>`;

/**
 * Aviso al estudio de que entro una consulta nueva.
 *
 * El bloque fijo de arriba es lo que el estudio mira primero para decidir si
 * llamar: quien es, como contactarlo, si acepto que le escriban, de que area
 * es el caso y de donde vino. Las respuestas del formulario van abajo.
 */
export function leadEmail(o: {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  consent: boolean;
  funnel: string;
  service: string;
  source: string;
  answers: [string, string][];
  url: string;
  lang?: Lang;
}) {
  const m = t(o.lang ?? "es").mail;
  const c = m.campos;
  const nombre = [o.firstName, o.lastName].filter(Boolean).join(" ") || o.email || m.sinNombre;

  const contacto = [
    fila(c.nombre, o.firstName),
    fila(c.apellido, o.lastName),
    fila(c.email, o.email),
    fila(c.telefono, o.phone),
    fila(c.consent, o.consent ? c.si : c.no),
    fila(c.area, o.funnel),
    fila(c.caso, o.service),
    fila(c.origen, o.source),
  ].join("");

  const resto = o.answers.length
    ? `<h3 style="font-size:14px;text-transform:uppercase;letter-spacing:.06em;color:#6b6478;font-weight:600;margin:2rem 0 .5rem">
         ${esc(m.leadRespuestas)}
       </h3>
       <table style="border-collapse:collapse;width:100%">${o.answers.map(([k, v]) => fila(k, v)).join("")}</table>`
    : "";

  return {
    subject: m.leadAsunto(o.funnel, nombre),
    html: wrap(
      `<h2 style="font-size:24px;margin:0 0 .35rem">${esc(m.leadTitulo)}</h2>
       <p style="color:#6b6478;margin-bottom:1.75rem">${esc(m.leadBajada(o.funnel))}</p>

       <h3 style="font-size:14px;text-transform:uppercase;letter-spacing:.06em;color:#6b6478;font-weight:600;margin:0 0 .5rem">
         ${esc(m.leadContacto)}
       </h3>
       <table style="border-collapse:collapse;width:100%">${contacto}</table>

       ${resto}

       <p style="margin:2rem 0 0">
         <a href="${o.url}" style="background:#2d0a4e;color:#fff;padding:12px 28px;border-radius:99px;text-decoration:none;display:inline-block;font-weight:500">
           ${esc(m.leadVer)}
         </a>
       </p>`,
      PIE_ESTUDIO,
    ),
  };
}
