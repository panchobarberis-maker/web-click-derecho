/**
 * Publicar un clip en Facebook y, si la página tiene una cuenta de Instagram
 * profesional vinculada, también ahí — via Graph API.
 *
 * Usa un único access token de página con permiso para publicar en una o
 * varias páginas (`META_PAGE_IDS`, separadas por coma) — así una agencia que
 * administra las páginas de varios estudios no necesita un token por estudio.
 * El video ya está hospedado en Supabase Storage (bucket público), así que
 * Graph lo toma por URL en vez de que nuestro servidor lo reenvíe entero.
 *
 * A diferencia de Facebook, Instagram no publica el video al toque: hay que
 * crear un contenedor y esperar a que Meta termine de procesarlo antes de
 * publicarlo. Por eso esta llamada puede tardar unos segundos — ver
 * `maxDuration` en la página que la usa.
 */

const GRAPH_VERSION = "v21.0";
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;

export function paginasMeta(): string[] {
  return (process.env.META_PAGE_IDS ?? "")
    .split(",")
    .map((id: string) => id.trim())
    .filter(Boolean);
}

export const metaListo = () =>
  Boolean(process.env.META_PAGE_ACCESS_TOKEN?.trim() && paginasMeta().length > 0);

export type ClipAPublicar = { name: string; video_url: string; poster_url: string | null; cta: string };

export type ResultadoDestino = { destino: string; ok: boolean; postId?: string; error?: string };

const mensaje = (e: unknown) => (e instanceof Error ? e.message : String(e));

async function comoJson(res: Response): Promise<any> {
  try {
    return await res.json();
  } catch {
    return {};
  }
}

/** El id de la cuenta de Instagram vinculada a la página, si tiene una. */
async function cuentaInstagram(pageId: string, token: string): Promise<string | null> {
  const q = new URLSearchParams({ fields: "instagram_business_account", access_token: token });
  const res = await fetch(`${GRAPH_BASE}/${pageId}?${q}`);
  const data = await comoJson(res);
  if (!res.ok) throw new Error(data.error?.message ?? `Graph API respondió ${res.status}`);
  return data.instagram_business_account?.id ?? null;
}

async function publicarVideoEnPagina(
  pageId: string,
  token: string,
  clip: ClipAPublicar,
  descripcion: string,
): Promise<string> {
  const params = new URLSearchParams({ access_token: token, file_url: clip.video_url, description: descripcion });
  if (clip.poster_url) params.set("thumb", clip.poster_url);

  const res = await fetch(`${GRAPH_BASE}/${pageId}/videos`, { method: "POST", body: params });
  const data = await comoJson(res);
  if (!res.ok || !data.id) throw new Error(data.error?.message ?? `Graph API respondió ${res.status}`);
  return data.id;
}

/** Espera a que Instagram termine de procesar el video del contenedor. */
async function esperarProcesado(creationId: string, token: string): Promise<void> {
  for (let intento = 0; intento < 10; intento++) {
    const q = new URLSearchParams({ fields: "status_code", access_token: token });
    const res = await fetch(`${GRAPH_BASE}/${creationId}?${q}`);
    const data = await comoJson(res);
    if (!res.ok) throw new Error(data.error?.message ?? `Graph API respondió ${res.status}`);
    if (data.status_code === "FINISHED") return;
    if (data.status_code === "ERROR") throw new Error("Instagram no pudo procesar el video.");
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error("Instagram todavía está procesando el video. Probá publicar de nuevo en un minuto.");
}

async function publicarReelEnInstagram(
  igId: string,
  token: string,
  clip: ClipAPublicar,
  descripcion: string,
): Promise<string> {
  const crear = new URLSearchParams({
    access_token: token,
    media_type: "REELS",
    video_url: clip.video_url,
    caption: descripcion,
  });
  const resCrear = await fetch(`${GRAPH_BASE}/${igId}/media`, { method: "POST", body: crear });
  const creado = await comoJson(resCrear);
  if (!resCrear.ok || !creado.id) throw new Error(creado.error?.message ?? `Graph API respondió ${resCrear.status}`);

  await esperarProcesado(creado.id, token);

  const publicar = new URLSearchParams({ access_token: token, creation_id: creado.id });
  const resPublicar = await fetch(`${GRAPH_BASE}/${igId}/media_publish`, { method: "POST", body: publicar });
  const publicado = await comoJson(resPublicar);
  if (!resPublicar.ok || !publicado.id) {
    throw new Error(publicado.error?.message ?? `Graph API respondió ${resPublicar.status}`);
  }
  return publicado.id;
}

/**
 * Publica el video del clip en cada página configurada (y su Instagram, si
 * tiene uno vinculado). Una página o cuenta que falla no frena a las demás:
 * se publica en todas las que se pueda y se devuelve el detalle de cada
 * destino, para que el panel muestre exactamente qué quedó pendiente y por
 * qué.
 */
export async function publicarClipEnMeta(clip: ClipAPublicar): Promise<ResultadoDestino[]> {
  const token = process.env.META_PAGE_ACCESS_TOKEN?.trim();
  const paginas = paginasMeta();
  if (!token || paginas.length === 0) {
    throw new Error("Falta configurar META_PAGE_ACCESS_TOKEN y/o META_PAGE_IDS.");
  }

  const descripcion = clip.cta ? `${clip.name}\n\n${clip.cta}` : clip.name;

  const porPagina = await Promise.all(
    paginas.map(async (pageId): Promise<ResultadoDestino[]> => {
      const resultados: ResultadoDestino[] = [];

      try {
        const postId = await publicarVideoEnPagina(pageId, token, clip, descripcion);
        resultados.push({ destino: `Facebook ${pageId}`, ok: true, postId });
      } catch (e) {
        resultados.push({ destino: `Facebook ${pageId}`, ok: false, error: mensaje(e) });
      }

      try {
        const igId = await cuentaInstagram(pageId, token);
        if (igId) {
          const postId = await publicarReelEnInstagram(igId, token, clip, descripcion);
          resultados.push({ destino: `Instagram ${igId}`, ok: true, postId });
        }
      } catch (e) {
        resultados.push({ destino: `Instagram (página ${pageId})`, ok: false, error: mensaje(e) });
      }

      return resultados;
    }),
  );

  return porPagina.flat();
}
