-- Esquema del intake. Postgres 14+.
-- Modelo: firm > funnel (area de practica) > workflow (caso concreto, con su form).
-- Una session es un visitante que abrio un form; se guarda parcial desde el paso 1.

create extension if not exists "pgcrypto";

create table if not exists firms (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  slug          text not null unique,
  notify_email  text,
  accent        text not null default '#2d0a4e',
  created_at    timestamptz not null default now()
);

create table if not exists funnels (
  id            uuid primary key default gen_random_uuid(),
  firm_id       uuid not null references firms(id) on delete cascade,
  name          text not null,
  slug          text not null,
  color         text not null default '#c9a227',
  active        boolean not null default true,
  on_storefront boolean not null default true,
  sort_order    int not null default 0,
  created_at    timestamptz not null default now(),
  unique (firm_id, slug)
);

-- steps es el schema del form:
-- { "steps": [ { "title": "...", "subtitle": "...", "fields": [
--     { "key":"email", "label":"Email", "type":"email", "required":true } ] } ] }
create table if not exists workflows (
  id          uuid primary key default gen_random_uuid(),
  funnel_id   uuid not null references funnels(id) on delete cascade,
  name        text not null,
  slug        text not null,
  active      boolean not null default true,
  steps       jsonb not null default '{"steps":[]}'::jsonb,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now(),
  unique (funnel_id, slug)
);

-- Una fila por visitante que abrio el form. data se pisa en cada paso.
create table if not exists sessions (
  id              uuid primary key default gen_random_uuid(),
  firm_id         uuid not null references firms(id) on delete cascade,
  funnel_id       uuid references funnels(id) on delete set null,
  workflow_id     uuid references workflows(id) on delete set null,
  data            jsonb not null default '{}'::jsonb,
  email           text,
  full_name       text,
  phone           text,
  max_step        int not null default 0,
  submitted_at    timestamptz,
  recovery_sent_at timestamptz,
  read_at         timestamptz,
  status          text not null default 'new',
  source          text,
  referrer        text,
  utm             jsonb not null default '{}'::jsonb,
  surface         text not null default 'page',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- Log crudo. De aca sale todo el panel de analytics.
create table if not exists events (
  id          bigserial primary key,
  session_id  uuid references sessions(id) on delete cascade,
  firm_id     uuid not null references firms(id) on delete cascade,
  funnel_id   uuid references funnels(id) on delete set null,
  workflow_id uuid references workflows(id) on delete set null,
  type        text not null,
  step_index  int,
  surface     text,
  meta        jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists idx_sessions_firm       on sessions (firm_id, created_at desc);
create index if not exists idx_sessions_recovery   on sessions (submitted_at, recovery_sent_at, updated_at) where email is not null;
create index if not exists idx_events_firm_type    on events (firm_id, type, created_at desc);
create index if not exists idx_events_session      on events (session_id);
create index if not exists idx_workflows_funnel    on workflows (funnel_id);
