import postgres from "postgres";
import { pgConfig } from "../../db/pg-options.mjs";

const { url, options } = pgConfig(
  process.env.DATABASE_URL || "postgres://postgres:postgres@127.0.0.1:5432/intake",
);

// En dev Next recarga los modulos en cada cambio; sin el cache global se abren
// conexiones nuevas hasta agotar el pool de Postgres.
const g = globalThis as unknown as { _sql?: postgres.Sql };

export const sql: postgres.Sql = g._sql ?? postgres(url, options);

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
