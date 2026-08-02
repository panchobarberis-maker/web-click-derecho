/**
 * Subida de videos a Supabase Storage.
 *
 * El navegador sube directo a Supabase, no a traves de nuestro servidor: en
 * Vercel el cuerpo de un request esta limitado a 4,5 MB, asi que un video de
 * 10 MB no entraria. Nuestro servidor solo firma el permiso de subida —eso
 * requiere la clave de servicio, que no puede salir al navegador— y el archivo
 * viaja aparte.
 *
 * Si no esta configurado, la aplicacion sigue andando: el clip acepta pegar la
 * direccion de un video hospedado en cualquier otro lado, que es como venia.
 */

export const BUCKET = "videos";

/** Tope de tamaño. Un clip de 15-20s bien comprimido no llega a 5 MB. */
export const MAX_MB = 25;

export const TIPOS_VIDEO = ["video/mp4", "video/webm", "video/quicktime"];

/**
 * El proyecto de Supabase.
 *
 * Se deduce de DATABASE_URL cuando no esta puesta a mano: en la cadena del
 * pooler el usuario es `postgres.<ref>`, y de ese ref sale el dominio. Es una
 * variable menos que pedirle a alguien que ya pego la cadena de conexion.
 */
export function supabaseUrl(): string | null {
  const explicita = process.env.SUPABASE_URL?.trim().replace(/\/$/, "");
  if (explicita) return explicita;

  try {
    const u = new URL(process.env.DATABASE_URL ?? "");
    const ref = decodeURIComponent(u.username).split(".")[1];
    // Los refs de Supabase son 20 letras minusculas; cualquier otra cosa no lo es.
    return /^[a-z]{20}$/.test(ref ?? "") ? `https://${ref}.supabase.co` : null;
  } catch {
    return null;
  }
}

export const almacenamientoListo = () =>
  Boolean(supabaseUrl() && process.env.SUPABASE_SERVICE_ROLE_KEY);

/** Nombre de archivo sin sorpresas: nada de rutas ni acentos. */
export function nombreSeguro(original: string): string {
  const punto = original.lastIndexOf(".");
  const ext = (punto > 0 ? original.slice(punto + 1) : "mp4").toLowerCase().replace(/[^a-z0-9]/g, "");
  const base = (punto > 0 ? original.slice(0, punto) : original)
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 50) || "video";
  return `${base}-${Date.now().toString(36)}.${ext || "mp4"}`;
}

export type PermisoDeSubida = { subirA: string; token: string; publica: string };

/**
 * Pide a Supabase un permiso de subida de un solo uso para esa ruta.
 *
 * Devuelve tambien la direccion publica final, que es la que se guarda en el
 * clip: el bucket es publico porque el video se sirve a los visitantes del
 * sitio del estudio, que no tienen sesion.
 */
export async function permisoDeSubida(ruta: string): Promise<PermisoDeSubida> {
  const base = supabaseUrl();
  const clave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!base || !clave) throw new Error("Falta configurar SUPABASE_SERVICE_ROLE_KEY.");

  const res = await fetch(`${base}/storage/v1/object/upload/sign/${BUCKET}/${ruta}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${clave}`, apikey: clave, "Content-Type": "application/json" },
    body: "{}",
  });

  if (!res.ok) {
    const detalle = await res.text();
    if (res.status === 404 && /bucket/i.test(detalle)) {
      throw new Error(`Falta crear el bucket "${BUCKET}" en Supabase → Storage, marcado como público.`);
    }
    throw new Error(`Supabase Storage respondió ${res.status}: ${detalle.slice(0, 300)}`);
  }

  const { token } = (await res.json()) as { token?: string };
  if (!token) throw new Error("Supabase no devolvió el permiso de subida.");

  return {
    subirA: `${base}/storage/v1/object/upload/sign/${BUCKET}/${ruta}`,
    token,
    publica: `${base}/storage/v1/object/public/${BUCKET}/${ruta}`,
  };
}
