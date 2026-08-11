import { NextResponse } from "next/server";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

const SUPERFICIES = ["popup", "clip", "page", "button"] as const;
type Superficie = (typeof SUPERFICIES)[number];

/** De que tabla sale cada widget. Fuera de esto no se registra nada. */
const TABLA: Record<string, "popups" | "clips"> = { popup: "popups", clip: "clips" };

/**
 * "Se mostro el widget".
 *
 * Es el escalon que faltaba del embudo: hasta ahora la primera medicion era
 * la apertura del formulario, y un pop-up que nadie ve se veia igual que uno
 * que se ve mucho y no convierte.
 *
 * Lo llama el widget desde el sitio del estudio, con sendBeacon: se manda y
 * la pagina sigue, aunque el visitante navegue en el mismo instante.
 *
 * Es la ruta que mas veces se va a llamar de toda la aplicacion —una por
 * vista de pagina con un widget puesto— asi que hace una sola cosa: un insert
 * que ademas resuelve el estudio. Si el id no existe, el select no devuelve
 * filas y no se inserta nada; no hay lectura previa ni sesion ni cookie.
 */
export async function POST(req: Request) {
  const b = await req.json().catch(() => null);

  const surface = String(b?.surface ?? "") as Superficie;
  const id = String(b?.id ?? "");
  if (!SUPERFICIES.includes(surface)) return new NextResponse(null, { status: 400, headers: CORS });

  const tabla = TABLA[surface];
  // Sin widget identificado no hay nada que contar: el formulario suelto ya
  // se mide con sus propias visitas.
  if (!tabla || !/^[0-9a-f-]{36}$/i.test(id)) return new NextResponse(null, { status: 204, headers: CORS });

  // La pagina del sitio del estudio donde se mostro. Sirve para ver despues
  // en que seccion rinde y en cual molesta.
  const pagina = typeof b?.lp === "string" ? b.lp.slice(0, 500) : null;

  try {
    await sql`
      insert into events (firm_id, type, surface, surface_id, meta)
      select w.firm_id, 'impression', ${surface}, w.id, ${sql.json({ lp: pagina })}
      from ${sql(tabla)} w
      where w.id = ${id}::uuid and w.active`;
  } catch {
    // Que no se caiga el sitio del estudio por una metrica.
  }

  // 204: el navegador no necesita nada de vuelta y con sendBeacon ni se mira.
  return new NextResponse(null, { status: 204, headers: CORS });
}

/**
 * Esto lo llama el sitio del estudio, que es otro dominio.
 *
 * Con sendBeacon y cuerpo de texto plano el navegador no pide permiso previo,
 * asi que en la practica el OPTIONS no llega. Va igual: si alguna vez se manda
 * con otro tipo de contenido, sin esto la llamada muere en el preflight y las
 * impresiones dejan de contarse sin que nadie se entere.
 */
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type",
  "Access-Control-Max-Age": "86400",
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}
