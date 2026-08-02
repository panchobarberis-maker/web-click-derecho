import { NextResponse } from "next/server";
import { requireOwner } from "@/lib/tenancy";
import { almacenamientoListo, nombreSeguro, permisoDeSubida, MAX_MB, TIPOS_VIDEO } from "@/lib/storage";

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
      { error: "La subida de videos no está configurada en este servidor. Podés pegar la dirección de un video hospedado en otro lado." },
      { status: 503 },
    );
  }

  const b = await req.json().catch(() => null);
  const nombre = String(b?.nombre ?? "").trim();
  const tipo = String(b?.tipo ?? "");
  const bytes = Number(b?.bytes ?? 0);

  if (!nombre) return NextResponse.json({ error: "Falta el nombre del archivo." }, { status: 400 });
  if (!TIPOS_VIDEO.includes(tipo)) {
    return NextResponse.json({ error: "Tiene que ser un video mp4, webm o mov." }, { status: 400 });
  }
  if (!(bytes > 0) || bytes > MAX_MB * 1024 * 1024) {
    return NextResponse.json(
      { error: `El video no puede pesar más de ${MAX_MB} MB. Bajale la calidad o recortalo: 15 a 20 segundos alcanzan.` },
      { status: 400 },
    );
  }

  try {
    // Cada estudio en su carpeta, y el nombre lo normaliza el servidor.
    const permiso = await permisoDeSubida(`${firm.id}/${nombreSeguro(nombre)}`);
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
