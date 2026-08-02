import { sql } from "@/lib/db";
import { requireStaff } from "@/lib/tenancy";
import { ESQUEMA_SQL } from "@/lib/esquema";
import { Snippet } from "@/components/Snippet";
import { TABLAS, COLUMNAS } from "@/lib/estructura";

export const dynamic = "force-dynamic";

/**
 * Estado de la base y el SQL para ponerla al dia.
 *
 * Existe porque cada vez que la aplicacion suma una tabla o una columna hay
 * que correr algo en Supabase, y hasta ahora eso salia por chat: yo pegaba un
 * bloque de SQL y quien lo corria no tenia forma de saber si le faltaba, si ya
 * lo habia corrido, o si el que tenia era el ultimo.
 *
 * Lo que se muestra es el esquema, no bootstrap.sql. La diferencia importa:
 * bootstrap.sql ademas carga el estudio de ejemplo y **pisa los formularios**
 * —tiene `on conflict do update set steps`—, asi que correrlo para actualizar
 * la estructura le borra al estudio las preguntas que edito desde el panel. El
 * esquema es solo `create table if not exists` y `alter table add column if not
 * exists`: se puede correr las veces que sea y no toca un solo dato.
 */
export default async function Base() {
  await requireStaff();

  let sinTabla: string[] = [];
  let sinColumna: string[] = [];
  let error: string | null = null;

  try {
    const [tabs, cols] = await Promise.all([
      sql<{ table_name: string }[]>`
        select table_name from information_schema.tables
        where table_schema = 'public' and table_name in ${sql(TABLAS)}`,
      sql<{ table_name: string; column_name: string }[]>`
        select table_name, column_name from information_schema.columns
        where table_schema = 'public'
          and table_name in ${sql([...new Set(COLUMNAS.map(([t]) => t))])}`,
    ]);
    const hayTabla = new Set(tabs.map((t) => t.table_name));
    const hayCol = new Set(cols.map((c) => `${c.table_name}.${c.column_name}`));
    sinTabla = TABLAS.filter((t) => !hayTabla.has(t));
    sinColumna = COLUMNAS.filter(([t, c]) => hayTabla.has(t) && !hayCol.has(`${t}.${c}`))
                         .map(([t, c]) => `${t}.${c}`);
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }

  const alDia = !error && sinTabla.length === 0 && sinColumna.length === 0;

  return (
    <>
      <div className="head">
        <div>
          <h1>Base de datos</h1>
          <p>
            Cuando la aplicación suma una tabla o una columna, hay que aplicarla en Supabase. Acá está
            el estado actual y el SQL exacto para ponerla al día.
          </p>
        </div>
      </div>

      <div className="card" style={{ marginBottom: "1rem" }}>
        {error ? (
          <>
            <span className="pill warn">No se pudo leer la base</span>
            <p className="muted" style={{ fontSize: ".86rem", marginTop: ".8rem" }}>{error}</p>
          </>
        ) : alDia ? (
          <>
            <span className="pill good">Al día</span>
            <p className="muted" style={{ fontSize: ".88rem", marginTop: ".8rem", lineHeight: 1.6 }}>
              Están las {TABLAS.length} tablas y las {COLUMNAS.length} columnas que la aplicación
              necesita. No hay nada que correr.
            </p>
          </>
        ) : (
          <>
            <span className="pill warn">Falta aplicar cambios</span>
            <ul className="ayuda" style={{ marginTop: "1rem" }}>
              {sinTabla.length > 0 && (
                <li><strong>Tablas que faltan</strong> — {sinTabla.join(", ")}</li>
              )}
              {sinColumna.length > 0 && (
                <li><strong>Columnas que faltan</strong> — {sinColumna.join(", ")}</li>
              )}
              <li>
                Hasta que corras el SQL de abajo, las pantallas que usan eso van a fallar.
              </li>
            </ul>
          </>
        )}
      </div>

      <div className="card">
        <h3>El SQL</h3>
        <p className="muted" style={{ fontSize: ".88rem", marginBottom: "1rem", lineHeight: 1.6 }}>
          Copialo, abrí <strong>Supabase → SQL Editor → New query</strong>, pegalo y dale <strong>Run</strong>.
          Se puede correr las veces que quieras: solo crea lo que falta y <strong>no toca ningún dato</strong>,
          ni los formularios que hayas editado desde el panel.
        </p>
        <Snippet code={ESQUEMA_SQL} />
      </div>
    </>
  );
}
