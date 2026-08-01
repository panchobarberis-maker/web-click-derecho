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
export async function GET() {
  const t0 = Date.now();

  if (dbConfigError) {
    return NextResponse.json(
      { base: "no conecta", pista: dbConfigError, error: "DATABASE_URL mal formada", ms: 0 },
      { status: 503 },
    );
  }

  try {
    const [tablas] = await sql<{ n: number }[]>`
      select count(*)::int as n from information_schema.tables
      where table_schema = 'public'
        and table_name in ('firms','funnels','workflows','sessions','events',
                           'users','memberships','oauth_accounts','auth_sessions','invitations')`;

    if (Number(tablas.n) === 0) {
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
    if (c.estudios === 0) faltan.push("no hay ningún estudio cargado");
    if (c.usuarios === 0) faltan.push("no hay usuarios: no vas a poder entrar");
    if (Number(tablas.n) < 10) faltan.push(`faltan tablas (hay ${tablas.n} de 10)`);

    return NextResponse.json({
      base: "conecta",
      tablas: Number(tablas.n),
      ...c,
      problema: faltan.length ? faltan.join("; ") + ". Corré db/bootstrap.sql en Supabase." : null,
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
