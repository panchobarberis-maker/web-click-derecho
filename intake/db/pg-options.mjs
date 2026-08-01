/**
 * Configuración de conexión según a qué Postgres estemos apuntando.
 *
 * Lo comparten la app y el script de setup para que no se desincronicen.
 * Los tres casos que importan:
 *
 *   - Postgres local (Docker o instalado): sin SSL.
 *   - Supabase por conexión directa o "session pooler" (5432): SSL, todo normal.
 *   - Supabase por "transaction pooler" (6543): SSL y `prepare: false`.
 *
 * El último es el que rompe si no se contempla. En modo transacción, pgbouncer
 * reparte cada consulta entre conexiones distintas, así que un prepared
 * statement creado en una conexión no existe en la siguiente y Postgres
 * responde "prepared statement does not exist". Es el error mas comun al
 * poner una app de Postgres en Vercel con Supabase.
 *
 * @param {string} url
 * @returns {{ url: string, options: object }}
 */
export function pgConfig(url) {
  const local = /@(localhost|127\.0\.0\.1|\[::1\]|db):/.test(url);

  // `?pgbouncer=true` es una marca que entienden algunos clientes, no un
  // parametro de Postgres: postgres.js lo reenviaria al servidor y este
  // cortaria con 'unrecognized configuration parameter "pgbouncer"'. Lo
  // leemos como señal y lo sacamos de la cadena.
  let limpio = url;
  let marcado = false;
  try {
    const u = new URL(url);
    marcado = u.searchParams.get("pgbouncer") === "true";
    if (marcado) {
      u.searchParams.delete("pgbouncer");
      limpio = u.toString().replace(/\?$/, "");
    }
  } catch {
    // Cadena no parseable como URL: la usamos tal cual y que falle el driver.
  }

  const transactionPooler = marcado || /:6543/.test(url);

  return {
    url: limpio,
    options: {
      // Supabase rechaza conexiones sin cifrar.
      ...(local ? {} : { ssl: "require" }),
      ...(transactionPooler ? { prepare: false } : {}),
      // El pooler comparte un cupo chico entre todas las instancias.
      max: transactionPooler ? 3 : 10,
      idle_timeout: 20,
      // Sin esto, una red que bloquea el puerto 5432 de salida deja el proceso
      // colgado sin decir nada. Mejor fallar y mostrar el motivo.
      connect_timeout: 15,
      onnotice: () => {},
    },
  };
}
