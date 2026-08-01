// Envio via Resend. Sin RESEND_API_KEY los mails se loguean en consola,
// asi el flujo completo se puede probar en local sin cuenta.

type Mail = { to: string; subject: string; html: string; replyTo?: string };

export async function sendMail({ to, subject, html, replyTo }: Mail): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM || "Consultas <onboarding@resend.dev>";

  if (!key) {
    console.log(`\n[mail simulado] para: ${to}\nasunto: ${subject}\n${html.replace(/<[^>]+>/g, " ").trim().slice(0, 300)}\n`);
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

const wrap = (accent: string, body: string) => `
<div style="font-family:-apple-system,Segoe UI,sans-serif;max-width:520px;margin:0 auto;color:#1c1230;line-height:1.6">
  ${body}
  <hr style="border:none;border-top:1px solid #e8e5ee;margin:2rem 0" />
  <p style="font-size:12px;color:#6b6478">
    Recibís este mail porque dejaste tus datos en nuestro formulario de consulta.
    Si fue un error, ignoralo y no volvemos a escribirte.
  </p>
</div>`.trim();

/** Al que dejo el mail y no termino el form. */
export function recoveryEmail(o: { name: string | null; firm: string; accent: string; url: string; area: string }) {
  return {
    subject: `Dejaste una consulta a medias en ${o.firm}`,
    html: wrap(
      o.accent,
      `<p>Hola${o.name ? ` ${o.name.split(" ")[0]}` : ""},</p>
       <p>Vimos que empezaste una consulta sobre <strong>${o.area}</strong> y no llegaste a terminarla.
       Quedó guardada: podés retomarla donde la dejaste, son dos minutos.</p>
       <p style="margin:1.75rem 0">
         <a href="${o.url}" style="background:${o.accent};color:#fff;padding:12px 26px;border-radius:99px;text-decoration:none;font-weight:500;display:inline-block">
           Retomar mi consulta
         </a>
       </p>
       <p>Si preferís, respondé este mail y te contactamos nosotros.</p>
       <p style="margin-top:1.5rem">— ${o.firm}</p>`,
    ),
  };
}

/** Aviso al estudio de que entro una consulta nueva. */
export function leadEmail(o: { name: string; area: string; workflow: string; answers: [string, string][]; url: string }) {
  const filas = o.answers
    .map(
      ([k, v]) =>
        `<tr><td style="padding:6px 12px 6px 0;color:#6b6478;vertical-align:top;white-space:nowrap">${k}</td><td style="padding:6px 0">${v}</td></tr>`,
    )
    .join("");

  return {
    subject: `Nueva consulta: ${o.area} — ${o.name}`,
    html: wrap(
      "#2d0a4e",
      `<p style="font-size:13px;color:#6b6478;text-transform:uppercase;letter-spacing:.05em;margin-bottom:.35rem">${o.area} · ${o.workflow}</p>
       <h2 style="font-size:22px;margin:0 0 1.25rem">${o.name}</h2>
       <table style="font-size:14px;border-collapse:collapse">${filas}</table>
       <p style="margin:1.75rem 0 0">
         <a href="${o.url}" style="background:#2d0a4e;color:#fff;padding:11px 24px;border-radius:99px;text-decoration:none;display:inline-block">
           Ver en el panel
         </a>
       </p>`,
    ),
  };
}
