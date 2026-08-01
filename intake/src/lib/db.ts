import postgres from "postgres";

const url = process.env.DATABASE_URL || "postgres://postgres:postgres@127.0.0.1:5432/intake";

// En dev Next recarga los modulos en cada cambio; sin el cache global se abren
// conexiones nuevas hasta agotar el pool de Postgres.
const g = globalThis as unknown as { _sql?: postgres.Sql };

export const sql: postgres.Sql =
  g._sql ?? postgres(url, { max: 10, idle_timeout: 20, onnotice: () => {} });

if (process.env.NODE_ENV !== "production") g._sql = sql;

export type Firm = {
  id: string;
  name: string;
  slug: string;
  notify_email: string | null;
  accent: string;
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
  type: "text" | "email" | "tel" | "textarea" | "select" | "radio" | "date";
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

/** El estudio activo. Hoy hay uno solo; con multi-tenant sale de la sesion del usuario. */
export async function currentFirm(): Promise<Firm> {
  const [firm] = await sql<Firm[]>`select * from firms order by created_at limit 1`;
  if (!firm) throw new Error("No hay ningun estudio cargado. Corré: npm run db:setup");
  return firm;
}
