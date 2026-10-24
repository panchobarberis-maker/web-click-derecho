import type { Lang } from "./i18n";

/**
 * Fechas, tiempos y numeros en el idioma del estudio.
 *
 * Las funciones toman el idioma como ultimo parametro y con castellano por
 * defecto: asi las pantallas que todavia no lo pasan siguen andando igual, y
 * el dia que lo pasen cambian solas.
 */
const LOCALE: Record<Lang, string> = { es: "es-AR", en: "en-US" };

const short = (lang: Lang) =>
  new Intl.DateTimeFormat(LOCALE[lang], { day: "numeric", month: "short" });
const long = (lang: Lang) =>
  new Intl.DateTimeFormat(LOCALE[lang], {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
  });

export const fmtShort = (d: Date | string, lang: Lang = "es") =>
  short(lang).format(new Date(d)).replace(".", "");

/** Fecha sola, con año: para cosas viejas donde "14 ago" no dice nada. */
export const fmtFecha = (d: Date | string, lang: Lang = "es") =>
  new Date(d).toLocaleDateString(LOCALE[lang]);
export const fmtLong = (d: Date | string, lang: Lang = "es") => long(lang).format(new Date(d));

/** Cuantos separadores de miles y decimales usa cada idioma. */
export const fmtNum = (n: number, lang: Lang = "es") => n.toLocaleString(LOCALE[lang]);

export function hace(d: Date | string, lang: Lang = "es") {
  const ms = Date.now() - new Date(d).getTime();
  const min = Math.round(ms / 6e4);
  // Lo de recien y lo que viene del futuro caen en el mismo lugar: "0 min ago"
  // se lee como un error, y "-1149 min ago" —que sale con el reloj corrido o
  // con datos de demostracion— directamente parece la aplicacion rota.
  if (min < 1) return lang === "en" ? "just now" : "recién";
  if (lang === "en") {
    if (min < 60) return `${min} min ago`;
    const h = Math.round(min / 60);
    if (h < 24) return `${h}h ago`;
    const dias = Math.round(h / 24);
    return dias === 1 ? "yesterday" : `${dias} days ago`;
  }
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `hace ${h} h`;
  const dias = Math.round(h / 24);
  return dias === 1 ? "ayer" : `hace ${dias} días`;
}

/** Contraparte de hace(), para fechas futuras: vencimientos de invitaciones. */
export function dentroDe(d: Date | string, lang: Lang = "es") {
  const min = Math.round((new Date(d).getTime() - Date.now()) / 6e4);
  if (lang === "en") {
    if (min <= 0) return "expired";
    if (min < 60) return `in ${min} min`;
    const h = Math.round(min / 60);
    if (h < 24) return `in ${h}h`;
    const dias = Math.round(h / 24);
    return dias === 1 ? "tomorrow" : `in ${dias} days`;
  }
  if (min <= 0) return "vencida";
  if (min < 60) return `en ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `en ${h} h`;
  const dias = Math.round(h / 24);
  return dias === 1 ? "mañana" : `en ${dias} días`;
}

/**
 * Los origenes de trafico son nombres propios casi todos, asi que solo cambian
 * los tres que son palabras.
 */
const FUENTES: Record<Lang, Record<string, string>> = {
  es: {
    organic: "Orgánico", google: "Google", instagram: "Instagram", whatsapp: "WhatsApp",
    referral: "Referidos", direct: "Directo", facebook: "Facebook",
  },
  en: {
    organic: "Organic", google: "Google", instagram: "Instagram", whatsapp: "WhatsApp",
    referral: "Referral", direct: "Direct", facebook: "Facebook",
  },
};

export const sourceLabel = (s: string, lang: Lang = "es") => FUENTES[lang][s] ?? s;
