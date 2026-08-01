import postgres from "postgres";
import { pgConfig } from "../../db/pg-options.mjs";

// En dev Next recarga los modulos en cada cambio; sin el cache global se abren
// conexiones nuevas hasta agotar el pool de Postgres.
const g = globalThis as unknown as { _sql?: postgres.Sql };

/**
 * Si DATABASE_URL esta mal formada, el driver tira al construirse: la
 * excepcion sale al importar el modulo, antes de que corra ningun handler, y
 * la app responde 500 sin explicacion (o peor: un server action que no hace
 * nada al apretar el boton). En vez de eso guardamos el motivo y dejamos que
 * falle recien al consultar, con un mensaje que se entiende.
 */
export let dbConfigError: string | null = null;

function conectar(): postgres.Sql {
  try {
    const { url, options } = pgConfig(
      process.env.DATABASE_URL || "postgres://postgres:postgres@127.0.0.1:5432/intake",
    );
    return postgres(url, options);
  } catch (e) {
    dbConfigError =
      "DATABASE_URL no es una cadena de conexión válida " +
      `(${e instanceof Error ? e.message : String(e)}). ` +
      'Tiene que empezar con postgresql:// y no incluir el prefijo "DATABASE_URL=".';

    const fallar = () => {
      throw new Error(dbConfigError!);
    };
    return Object.assign(fallar, { json: fallar, unsafe: fallar, end: async () => {} }) as unknown as postgres.Sql;
  }
}

export const sql: postgres.Sql = g._sql ?? conectar();

if (process.env.NODE_ENV !== "production") g._sql = sql;

export type Firm = {
  id: string;
  name: string;
  slug: string;
  notify_email: string | null;
  accent: string;
  logo_url: string | null;
  hero_url: string | null;
  intro: string | null;
};

export type Funnel = {
  id: string;
  firm_id: string;
  name: string;
  slug: string;
  color: string;
  active: boolean;
  on_storefront: boolean;
};

export type Field = {
  key: string;
  label: string;
  type: "text" | "email" | "tel" | "textarea" | "select" | "radio" | "date" | "checkbox";
  required?: boolean;
  options?: string[];
};

export type Step = { title: string; subtitle?: string; fields: Field[] };

export type Workflow = {
  id: string;
  funnel_id: string;
  name: string;
  slug: string;
  active: boolean;
  steps: { steps: Step[] };
};
