-- Esquema del intake. Postgres 14+ (gen_random_uuid() es nativo desde la 13).
-- Modelo: firm > funnel (area de practica) > workflow (caso concreto, con su form).
-- Una session es un visitante que abrio un form; se guarda parcial desde el paso 1.

create table if not exists firms (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  slug          text not null unique,
  notify_email  text,
  accent        text not null default '#2d0a4e',
  logo_url      text,
  hero_url      text,
  intro         text,          -- parrafo de privacidad de la landing
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
  first_name      text,
  last_name       text,
  -- derivada, para no repetir el concat en cada consulta del panel
  full_name       text generated always as
                  (nullif(trim(coalesce(first_name, '') || ' ' || coalesce(last_name, '')), '')) stored,
  phone           text,
  consent         boolean not null default false,   -- opt-in explicito a que le escriban
  max_step        int not null default 0,
  submitted_at    timestamptz,
  recovery_sent_at timestamptz,
  read_at         timestamptz,
  status          text not null default 'new',
  source          text,
  referrer        text,
  landing_page    text,        -- URL del sitio del estudio donde se abrio el form
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

-- Migraciones sobre bases ya creadas (los create table de arriba no las aplican).
alter table firms    add column if not exists logo_url text;
alter table firms    add column if not exists hero_url text;
alter table firms    add column if not exists intro    text;

alter table sessions add column if not exists first_name   text;
alter table sessions add column if not exists last_name    text;
alter table sessions add column if not exists consent      boolean not null default false;
alter table sessions add column if not exists landing_page text;
alter table sessions drop column if exists full_name;
alter table sessions add column if not exists full_name text generated always as
  (nullif(trim(coalesce(first_name, '') || ' ' || coalesce(last_name, '')), '')) stored;

create index if not exists idx_sessions_firm       on sessions (firm_id, created_at desc);
create index if not exists idx_sessions_recovery   on sessions (submitted_at, recovery_sent_at, updated_at) where email is not null;
create index if not exists idx_events_firm_type    on events (firm_id, type, created_at desc);
create index if not exists idx_events_session      on events (session_id);
create index if not exists idx_workflows_funnel    on workflows (funnel_id);

-- ---------------------------------------------------------------------------
-- Cuentas y acceso
--
-- No hay registro abierto: al panel se entra por invitacion. Cada usuario ve
-- solo los estudios donde tiene membresia; los usuarios de la agencia
-- (is_staff) ven todos.
-- ---------------------------------------------------------------------------

create table if not exists users (
  id            uuid primary key default gen_random_uuid(),
  email         text not null,
  name          text,
  image         text,
  password_hash text,        -- null = entra solo con Google
  is_staff      boolean not null default false,
  last_login_at timestamptz,
  created_at    timestamptz not null default now()
);
create unique index if not exists idx_users_email on users (lower(email));

create table if not exists memberships (
  user_id    uuid not null references users(id) on delete cascade,
  firm_id    uuid not null references firms(id) on delete cascade,
  role       text not null default 'member' check (role in ('owner', 'member')),
  created_at timestamptz not null default now(),
  primary key (user_id, firm_id)
);

-- Cuenta de Google vinculada. Un usuario puede tener password y Google a la vez.
create table if not exists oauth_accounts (
  provider            text not null,
  provider_account_id text not null,
  user_id             uuid not null references users(id) on delete cascade,
  created_at          timestamptz not null default now(),
  primary key (provider, provider_account_id)
);

-- Sesiones opacas: el token va en una cookie httpOnly y en la base solo queda
-- su hash, asi un volcado de la tabla no sirve para hacerse pasar por nadie.
create table if not exists auth_sessions (
  token_hash text primary key,
  user_id    uuid not null references users(id) on delete cascade,
  expires_at timestamptz not null,
  user_agent text,
  created_at timestamptz not null default now()
);
create index if not exists idx_auth_sessions_user on auth_sessions (user_id);

create table if not exists invitations (
  id         uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  email      text not null,
  firm_id    uuid not null references firms(id) on delete cascade,
  role       text not null default 'member' check (role in ('owner', 'member')),
  invited_by uuid references users(id) on delete set null,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_invitations_email on invitations (lower(email)) where accepted_at is null;


-- ---------------------------------------------------------------------------
-- Cierre para Supabase
--
-- Supabase deja privilegios por defecto que le dan acceso a los roles `anon` y
-- `authenticated` sobre las tablas del esquema `public`, y las publica sola a
-- traves de su API REST. Sin esto, cualquiera con la clave publica del
-- proyecto podria leer las consultas de los estudios desde el navegador.
--
-- Activar RLS sin definir ninguna politica cierra esa puerta por completo. La
-- app no se ve afectada: se conecta con el rol dueño de las tablas, y el dueño
-- no queda sujeto a RLS mientras no se use FORCE ROW LEVEL SECURITY. En un
-- Postgres local esto no cambia nada.
--
-- El control de acceso real lo hace la app: cada consulta filtra por firm_id
-- contra la membresia del usuario (ver src/lib/tenancy.ts).
-- ---------------------------------------------------------------------------

do $$
declare t text;
begin
  foreach t in array array[
    'firms', 'funnels', 'workflows', 'sessions', 'events',
    'users', 'memberships', 'oauth_accounts', 'auth_sessions', 'invitations'
  ] loop
    execute format('alter table %I enable row level security', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Pop-ups y clips
--
-- Cada uno es una entidad con su propia configuracion y sus propias metricas.
-- El widget se identifica con su id (/w.js?popup=<id>), asi la configuracion
-- se cambia desde el panel sin volver a tocar el sitio del estudio, y cada
-- visita queda atribuida al pop-up o clip que la trajo.
-- ---------------------------------------------------------------------------

create table if not exists popups (
  id          uuid primary key default gen_random_uuid(),
  firm_id     uuid not null references firms(id) on delete cascade,
  name        text not null,
  funnel_id   uuid references funnels(id) on delete set null,
  workflow_id uuid references workflows(id) on delete set null,
  trigger     text not null default 'delay:12',  -- delay:N | scroll:N | exit | now | button
  cta         text not null default 'Consultá tu caso',
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);
create index if not exists idx_popups_firm on popups (firm_id);

create table if not exists clips (
  id          uuid primary key default gen_random_uuid(),
  firm_id     uuid not null references firms(id) on delete cascade,
  name        text not null,
  video_url   text not null,
  poster_url  text,
  cta         text not null default 'Empezar',
  funnel_id   uuid references funnels(id) on delete set null,
  workflow_id uuid references workflows(id) on delete set null,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);
create index if not exists idx_clips_firm on clips (firm_id);

-- Que pop-up o clip trajo esta visita. surface ya dice de que tipo es.
alter table sessions add column if not exists surface_id uuid;
create index if not exists idx_sessions_surface on sessions (surface, surface_id);

do $rls$
declare t text;
begin
  foreach t in array array['popups', 'clips'] loop
    execute format('alter table %I enable row level security', t);
  end loop;
end $rls$;

-- ---------------------------------------------------------------------------
-- Recuperar la contrasena, y frenar la fuerza bruta
--
-- Sin esto, una persona del estudio que se olvida la contrasena depende de que
-- alguien le toque la base a mano, que es justo lo que no queremos.
-- ---------------------------------------------------------------------------

create table if not exists password_resets (
  id         uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  user_id    uuid not null references users(id) on delete cascade,
  expires_at timestamptz not null,
  used_at    timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_password_resets_user on password_resets (user_id) where used_at is null;

-- Un intento fallido por fila. La clave es el email o la IP: se limita por las
-- dos, porque limitar solo por email deja probar una contrasena comun contra
-- muchas cuentas, y limitar solo por IP deja hacerlo desde muchas.
create table if not exists login_attempts (
  id    bigserial primary key,
  clave text not null,
  at    timestamptz not null default now()
);
create index if not exists idx_login_attempts on login_attempts (clave, at);

do $rls2$
declare t text;
begin
  foreach t in array array['password_resets', 'login_attempts'] loop
    execute format('alter table %I enable row level security', t);
  end loop;
end $rls2$;

-- Que estudios se listan en la home publica.
--
-- Sin esto, dar de alta un estudio lo publica en la home sin que nadie lo
-- decida: un cliente puede no querer que se sepa con quien trabaja, y el
-- estudio de ejemplo del seed figuraba como si fuera un cliente real.
-- Arranca en true para no cambiar lo que ya se ve; se destilda por estudio.
alter table firms add column if not exists show_on_home boolean not null default true;

-- En que paginas del sitio del estudio se muestra cada widget.
--
-- Vacio = en todas, que es como venia funcionando. Una regla por linea, con *
-- de comodin; una linea que empieza con ! excluye. Se guarda como texto y no
-- como arreglo porque lo escribe una persona en un textarea, y un texto libre
-- no se rompe si alguien pega algo raro.
alter table popups add column if not exists paginas text;
alter table clips  add column if not exists paginas text;

-- Si el clip arranca solo. Siempre en silencio: los navegadores no dejan
-- autoreproducir con sonido, y un video que suena sin permiso espanta.
-- Apagarlo muestra la portada con un boton de play, y ademas ahorra ancho de
-- banda: solo se descarga el video de quien lo toca.
alter table clips add column if not exists autoplay boolean not null default true;

-- Cuantas veces se mostro cada pop-up y cada clip.
--
-- Hasta ahora se medía desde que se abría el formulario, o sea el escalón de
-- abajo del embudo. Sin las impresiones no se puede decir "el clip se mostró
-- 4.000 veces y trajo 30 consultas", que es el número con el que la agencia
-- justifica el trabajo, ni distinguir un widget que nadie ve de uno que se ve
-- mucho y no convierte: dos problemas opuestos que hoy se ven iguales.
--
-- Van en events, con el mismo surface_id que ya usan las sesiones, así el
-- embudo entero —mostrado, abierto, enviado— sale de dos tablas y no de tres.
-- Es la fila que más va a crecer: una por vista de página con el widget
-- puesto, de ahí el índice propio.
alter table events add column if not exists surface_id uuid;
create index if not exists idx_events_surface
  on events (firm_id, surface, surface_id, created_at desc)
  where surface_id is not null;

-- En que idioma habla cada estudio.
--
-- Un estudio argentino y uno de Estados Unidos usan la misma instalacion: el
-- idioma no puede ser global. Vive en el estudio y no en el usuario porque lo
-- que manda es a quien le habla el formulario —el cliente del estudio— y no
-- quien administra el panel.
--
-- Arranca en castellano para no cambiarle nada a los que ya estan.
alter table firms add column if not exists lang text not null default 'es'
  check (lang in ('es', 'en'));
