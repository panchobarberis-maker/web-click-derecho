const short = new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "short" });
const long = new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

export const fmtShort = (d: Date | string) => short.format(new Date(d)).replace(".", "");
export const fmtLong = (d: Date | string) => long.format(new Date(d));

export function hace(d: Date | string) {
  const ms = Date.now() - new Date(d).getTime();
  const min = Math.round(ms / 6e4);
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `hace ${h} h`;
  const dias = Math.round(h / 24);
  return dias === 1 ? "ayer" : `hace ${dias} días`;
}

export const SOURCE_LABELS: Record<string, string> = {
  organic: "Orgánico",
  google: "Google",
  instagram: "Instagram",
  whatsapp: "WhatsApp",
  referral: "Referidos",
  direct: "Directo",
  facebook: "Facebook",
};

export const sourceLabel = (s: string) => SOURCE_LABELS[s] ?? s;
