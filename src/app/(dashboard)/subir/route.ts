import { NextResponse } from "next/server";
import { requireOwner } from "@/lib/tenancy";
import { almacenamientoListo, nombreSeguro, permisoDeSubida, CLASES, esClase, type Clase } from "@/lib/storage";

export const dynamic = "force-dynamic";

/**
 * Firma un permiso para que el navegador suba el video directo a Supabase.
 *
 * El archivo no pasa por acá: en Vercel el cuerpo de un request esta limitado
 * a 4,5 MB y un video no entra. Lo unico que hace este endpoint es autorizar,
 * que es lo que requiere la clave de servicio.
 *
 * Vive bajo (dashboard) para que el middleware lo proteja como el resto del
 * panel, y el estudio sale de la sesion: la ruta del archivo la arma el
 * servidor, asi que nadie escribe en la carpeta de otro.
 */
export async function POST(req: Request) {
  const { firm } = await requireOwner();

  if (!almacenamientoListo()) {
    return NextResponse.json(
      { error: "La subida de archivos no está configurada en este servidor. Podés pegar la dirección de un archivo hospedado en otro lado." },
      { status: 503 },
    );
  }

  const b = await req.json().catch(() => null);
  const nombre = String(b?.nombre ?? "").trim();
  const tipo = String(b?.tipo ?? "");
  const bytes = Number(b?.bytes ?? 0);
  // Sin clase asumimos video: es como venia funcionando antes de las imagenes.
  const clase: Clase = esClase(b?.clase) ? b.clase : "video";
  const regla = CLASES[clase];

  if (!nombre) return NextResponse.json({ error: "Falta el nombre del archivo." }, { status: 400 });
  if (!(regla.tipos as readonly string[]).includes(tipo)) {
    return NextResponse.json({ error: `Tiene que ser ${regla.que}.` }, { status: 400 });
  }
  if (!(bytes > 0) || bytes > regla.maxMb * 1024 * 1024) {
    const comoAdelgazar = clase === "video"
      ? "Bajale la calidad o recortalo: 15 a 20 segundos alcanzan."
      : "Achicala antes de subirla: 1600 píxeles de ancho sobran para cualquier pantalla.";
    return NextResponse.json(
      { error: `El archivo no puede pesar más de ${regla.maxMb} MB. ${comoAdelgazar}` },
      { status: 400 },
    );
  }

  try {
    // Cada estudio en su carpeta, separando por clase, y el nombre lo normaliza
    // el servidor.
    const ext = clase === "video" ? "mp4" : "png";
    const permiso = await permisoDeSubida(`${firm.id}/${clase}/${nombreSeguro(nombre, ext)}`);
    return NextResponse.json(permiso);
  } catch (e) {
    // fetch envuelve el error real en `cause`; sin eso, todo problema de red
    // llega como un "fetch failed" que no dice nada.
    const causa = (e as { cause?: { code?: string; message?: string } })?.cause;
    const msg = e instanceof Error ? e.message : String(e);
    const detalle = causa?.code ?? causa?.message;
    console.error("no se pudo firmar la subida:", msg, detalle ?? "");
    return NextResponse.json(
      { error: detalle ? `${msg} (${detalle})` : msg },
      { status: 500 },
    );
  }
}
