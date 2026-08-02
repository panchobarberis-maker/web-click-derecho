import { NextResponse } from "next/server";
import { dbConfigError, sql } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Diagnostico desde el navegador: /api/health
 *
 * Cuando algo no anda en un deploy, la pregunta es siempre la misma —¿llega a
 * la base y estan cargados los datos?— y sin esto hay que ir a leer los logs
 * de funciones de Vercel. No expone nada sensible: solo conteos.
 */
/**
 * Todas las tablas del esquema, no solo las del principio.
 *
 * Una base que se creo con una version anterior de bootstrap.sql conecta,
 * responde y parece sana, pero le faltan las tablas nuevas y la app se cae
 * recien al abrir la pantalla que las usa. Nombrar cual falta es la diferencia
 * entre un diagnostico y una adivinanza.
 */
/** Solo el host, nunca el usuario ni la contraseña. */
function hostDeLaBase(): string {
  try {
    return new URL(process.env.DATABASE_URL ?? "").host;
  } catch {
    return "—";
  }
}

const TABLAS = [
  "firms", "funnels", "workflows", "sessions", "events",
  "users", "memberships", "oauth_accounts", "auth_sessions", "invitations",
  "popups", "clips", "password_resets", "login_attempts",
] as const;

export async function GET() {
  const t0 = Date.now();

  if (dbConfigError) {
    return NextResponse.json(
      { base: "no conecta", pista: dbConfigError, error: "DATABASE_URL mal formada", ms: 0 },
      { status: 503 },
    );
  }

  try {
    // Una consulta trivial primero: mide la ida y vuelta hasta la base sin
    // que se mezcle con el costo de leer nada. Si esto ya da 300ms, el
    // problema no es la consulta, es la distancia.
    const t1 = Date.now();
    await sql`select 1`;
    const ida = Date.now() - t1;

    const presentes = await sql<{ table_name: string }[]>`
      select table_name from information_schema.tables
      where table_schema = 'public' and table_name in ${sql(TABLAS)}`;

    const hay = new Set(presentes.map((r) => r.table_name));
    const sinTabla = TABLAS.filter((t) => !hay.has(t));

    if (hay.size === 0) {
      return NextResponse.json({
        base: "conecta",
        tablas: 0,
        problema: "La base responde pero está vacía. Falta correr db/bootstrap.sql en el SQL Editor de Supabase.",
        ms: Date.now() - t0,
      });
    }

    const [c] = await sql<{ estudios: number; areas: number; formularios: number; usuarios: number; consultas: number }[]>`
      select
        (select count(*)::int from firms)     as estudios,
        (select count(*)::int from funnels)   as areas,
        (select count(*)::int from workflows) as formularios,
        (select count(*)::int from users)     as usuarios,
        (select count(*)::int from sessions)  as consultas`;

    const faltan: string[] = [];
    if (sinTabla.length) faltan.push(`faltan tablas: ${sinTabla.join(", ")}`);
    if (c.estudios === 0) faltan.push("no hay ningún estudio cargado");
    if (c.usuarios === 0) faltan.push("no hay usuarios: no vas a poder entrar");

    return NextResponse.json({
      base: "conecta",
      tablas: `${hay.size} de ${TABLAS.length}`,
      ...c,
      problema: faltan.length
        ? `${faltan.join("; ")}. Volvé a correr db/bootstrap.sql en el SQL Editor de Supabase: es idempotente, no duplica lo que ya está.`
        : null,
      // Para diagnosticar lentitud: si ida_ms es alto, la base esta lejos de
      // donde corre la app y hay que igualar las regiones.
      region: process.env.VERCEL_REGION ?? "local",
      base_host: hostDeLaBase(),
      ida_ms: ida,
      ms: Date.now() - t0,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);

    // Traducimos los errores tipicos; el mensaje crudo va igual para poder pegarlo.
    let pista = "Revisá DATABASE_URL en las variables de entorno de Vercel.";
    if (/password authentication|SASL|SCRAM/i.test(msg)) {
      pista = "La contraseña de la base es incorrecta.";
    } else if (/CONNECT_TIMEOUT|ETIMEDOUT|ECONNREFUSED/i.test(msg)) {
      pista = "No se llegó al servidor. Desde Vercel usá la cadena del transaction pooler (puerto 6543).";
    } else if (/ENETUNREACH|EHOSTUNREACH|ENOTFOUND/i.test(msg)) {
      pista = "Host inalcanzable. La conexión directa de Supabase necesita IPv6: usá la del pooler.";
    } else if (/Invalid URL/i.test(msg)) {
      pista = 'DATABASE_URL está mal formada. El valor va sin el prefijo "DATABASE_URL=".';
    } else if (/prepared statement/i.test(msg)) {
      pista = "Estás en el transaction pooler pero sin desactivar prepared statements. Usá el puerto 6543 en la URL.";
    }

    return NextResponse.json({ base: "no conecta", pista, error: msg, ms: Date.now() - t0 }, { status: 503 });
  }
}
