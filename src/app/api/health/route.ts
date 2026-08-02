import { NextResponse } from "next/server";
import { dbConfigError, sql } from "@/lib/db";
import { googleEnabled, redirectUri } from "@/lib/google";
import { TABLAS, COLUMNAS } from "@/lib/estructura";

export const dynamic = "force-dynamic";

/** Solo el host, nunca el usuario ni la contraseña. */
function hostDeLaBase(): string {
  try {
    return new URL(process.env.DATABASE_URL ?? "").host;
  } catch {
    return "—";
  }
}



/**
 * Diagnostico desde el navegador: /api/health
 *
 * Cuando algo no anda en un deploy la pregunta es siempre la misma —¿llega a
 * la base, estan cargados los datos, que falta configurar?— y sin esto hay que
 * ir a leer los logs de funciones de Vercel. No expone nada sensible: conteos,
 * el host de la base sin credenciales, y si cada integracion esta puesta o no.
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

    const cols = await sql<{ table_name: string; column_name: string }[]>`
      select table_name, column_name from information_schema.columns
      where table_schema = 'public'
        and table_name in ${sql([...new Set(COLUMNAS.map(([t]) => t))])}`;
    const hayCol = new Set(cols.map((c) => `${c.table_name}.${c.column_name}`));
    const sinColumna = COLUMNAS
      .filter(([t, c]) => hay.has(t) && !hayCol.has(`${t}.${c}`))
      .map(([t, c]) => `${t}.${c}`);

    const faltan: string[] = [];
    if (sinTabla.length) faltan.push(`faltan tablas: ${sinTabla.join(", ")}`);
    if (sinColumna.length) faltan.push(`faltan columnas: ${sinColumna.join(", ")}`);
    if (c.estudios === 0) faltan.push("no hay ningún estudio cargado");
    if (c.usuarios === 0) faltan.push("no hay usuarios: no vas a poder entrar");

    return NextResponse.json({
      base: "conecta",
      tablas: `${hay.size} de ${TABLAS.length}`,
      columnas: `${COLUMNAS.length - sinColumna.length} de ${COLUMNAS.length}`,
      ...c,
      problema: faltan.length
        ? `${faltan.join("; ")}. Entrá al panel como agencia, a Base de datos, y corré el SQL que muestra esa pantalla.`
        : null,
      // Para diagnosticar lentitud: si ida_ms es alto, la base esta lejos de
      // donde corre la app y hay que igualar las regiones.
      region: process.env.VERCEL_REGION ?? "local",
      base_host: hostDeLaBase(),
      ida_ms: ida,
      ms: Date.now() - t0,

      // El boton de Google se esconde solo cuando no esta configurado, asi que
      // desde afuera no se distingue de un boton roto. Aca se ve por que falta
      // y con que URL exacta darlo de alta en Google Cloud: escribirla de
      // memoria es el error que hace fallar el primer intento.
      google: googleEnabled() ? "configurado" : "falta GOOGLE_CLIENT_ID y/o GOOGLE_CLIENT_SECRET",
      google_redirect_uri: redirectUri(),
      mails: process.env.RESEND_API_KEY
        ? "configurado"
        : "falta RESEND_API_KEY: las consultas se guardan pero no se avisa por mail",
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
