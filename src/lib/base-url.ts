/**
 * La URL pública de la app.
 *
 * Aparece en los links de los mails, en el snippet del widget y en el redirect
 * de Google, así que no puede quedar en localhost cuando está desplegada.
 *
 * En Vercel no hace falta configurarla: la primera vez no se sabe cuál va a
 * ser el dominio, y dejarla sin setear hacía que los links de recuperación
 * apuntaran a la máquina de quien recibía el mail. Se deduce del entorno.
 */
export function baseUrl(): string {
  // Configurada a mano: manda siempre. Es la que hay que usar con dominio propio.
  const explicita = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (explicita) return explicita.replace(/\/$/, "");

  // Dominio estable de producción del proyecto en Vercel.
  const prod = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (prod) return `https://${prod}`;

  // Dominio de este deploy puntual (previews).
  const deploy = process.env.VERCEL_URL;
  if (deploy) return `https://${deploy}`;

  return "http://localhost:3000";
}

/**
 * El link del mail de recuperacion.
 *
 * Tiene que llevar al formulario que la persona estaba completando, no a la
 * portada del estudio: `retomar` lo lee el formulario cuando se monta, y en la
 * portada no hay ninguno. Apuntando a la portada, quien volvia se encontraba
 * con "¿Cómo podemos ayudarte?" y tenia que elegir todo de nuevo y reescribir
 * lo que ya habia puesto —justo lo que el mail promete que no va a pasar.
 *
 * Si la sesion se abandono antes de elegir el caso no hay nada que retomar, y
 * entonces si corresponde la portada.
 */
export function linkParaRetomar(o: {
  firmSlug: string;
  funnelSlug: string | null;
  workflowSlug: string | null;
  sessionId: string;
}): string {
  const base = baseUrl();
  if (!o.funnelSlug || !o.workflowSlug) return `${base}/f/${o.firmSlug}`;
  return `${base}/f/${o.firmSlug}/${o.funnelSlug}/${o.workflowSlug}?retomar=${o.sessionId}`;
}
