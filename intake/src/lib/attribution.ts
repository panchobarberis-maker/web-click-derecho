/**
 * Atribucion de origen.
 *
 * El problema: el formulario corre dentro de un iframe en el sitio del estudio,
 * asi que `document.referrer` visto desde adentro es el sitio del estudio, no
 * de donde vino la persona. El widget reenvia los datos reales de la pagina
 * madre (`utm_*`, `ref`, `lp`) y estas funciones los interpretan.
 */

export const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"] as const;
export const CLICK_IDS = ["gclid", "fbclid", "ttclid", "msclkid"] as const;

const POR_DOMINIO: [RegExp, string][] = [
  [/(^|\.)google\./, "google"],
  [/(^|\.)bing\./, "bing"],
  [/duckduckgo\./, "duckduckgo"],
  [/instagram\./, "instagram"],
  [/(facebook|fb)\./, "facebook"],
  [/(wa\.me|whatsapp)/, "whatsapp"],
  [/linkedin\./, "linkedin"],
  [/(t\.co|twitter\.|x\.com)/, "twitter"],
  [/tiktok\./, "tiktok"],
  [/youtube\.|youtu\.be/, "youtube"],
  [/(chatgpt|openai)\./, "chatgpt"],
  [/perplexity\./, "perplexity"],
];

const POR_CLICK_ID: Record<string, string> = {
  gclid: "google",
  fbclid: "facebook",
  ttclid: "tiktok",
  msclkid: "bing",
};

/**
 * Prioridad: utm_source declarado > click id de la plataforma > dominio del
 * referrer > directo. El referrer que llega acá es el de la página madre.
 */
export function resolveSource(input: {
  utm?: Record<string, string> | null;
  referrer?: string | null;
  landingPage?: string | null;
}): string {
  const utm = input.utm ?? {};

  const declarado = (utm.utm_source ?? "").trim().toLowerCase();
  if (declarado) return declarado;

  for (const id of CLICK_IDS) if (utm[id]) return POR_CLICK_ID[id];

  const ref = input.referrer?.trim();
  if (!ref) return "direct";

  let host: string;
  try {
    host = new URL(ref).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "direct";
  }

  // El estudio linkeando a su propio formulario no es una fuente.
  if (input.landingPage) {
    try {
      if (host === new URL(input.landingPage).hostname.replace(/^www\./, "").toLowerCase()) return "direct";
    } catch {
      /* landing page invalida: seguimos con la clasificacion normal */
    }
  }

  for (const [re, nombre] of POR_DOMINIO) if (re.test(host)) return nombre;
  return "referral";
}

/** Sólo las claves de atribución, para no guardar basura en el jsonb. */
export function pickAttribution(params: Record<string, string | undefined | null>) {
  const out: Record<string, string> = {};
  for (const k of [...UTM_KEYS, ...CLICK_IDS]) {
    const v = params[k];
    if (v) out[k] = String(v).slice(0, 200);
  }
  return out;
}
