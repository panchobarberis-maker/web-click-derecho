-- ===========================================================================
-- bootstrap.sql — deja la base lista de una sola vez.
--
-- GENERADO POR scripts/build-bootstrap.mjs — no editar a mano.
--
-- Pegá todo este archivo en el SQL Editor de Supabase y ejecutalo. Crea las
-- tablas, carga un estudio de ejemplo con sus formularios, genera tráfico de
-- prueba para que el panel no esté vacío, y deja dos cuentas para entrar.
--
-- Se puede correr más de una vez sin romper nada.
--
--   hola@clickderecho.com               (agencia: ve todos los estudios)
--   consultas@alzogarayserrano.com.ar  (dueño del estudio de ejemplo)
--   contraseña: clickderecho2026
--
-- CAMBIÁ ESA CONTRASEÑA apenas entres, desde Perfil: está publicada en el
-- repositorio, así que cualquiera que encuentre tu URL la conoce.
-- ===========================================================================

-- ----- esquema -----
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


-- ----- estudio de ejemplo, areas y formularios -----

insert into firms (name, slug, notify_email, accent, logo_url, hero_url, intro)
values ('Alzogaray & Serrano', 'alzogaray-serrano', 'consultas@alzogarayserrano.com.ar', '#8a6f4e',
        NULL, '/hero-default.svg', 'Tu privacidad nos importa. Todo lo que compartas en este formulario es estrictamente confidencial y se usa únicamente para evaluar tu caso. Nunca compartimos tu información con terceros sin tu consentimiento.')
on conflict (slug) do update set
  name = excluded.name, notify_email = excluded.notify_email, accent = excluded.accent,
  logo_url = excluded.logo_url, hero_url = excluded.hero_url, intro = excluded.intro;

insert into funnels (firm_id, name, slug, color, sort_order)
select id, 'Derecho Laboral', 'laboral', '#c9a227', 0 from firms where slug = 'alzogaray-serrano'
on conflict (firm_id, slug) do update set
  name = excluded.name, color = excluded.color, sort_order = excluded.sort_order;

insert into workflows (funnel_id, name, slug, steps, sort_order)
select f.id, 'Despido sin causa', 'despido-sin-causa', '{"steps":[{"title":"¿Con quién hablamos?","subtitle":"Con esto ya podemos abrir la consulta y contactarte.","fields":[{"key":"first_name","label":"Nombre","type":"text","required":true},{"key":"last_name","label":"Apellido","type":"text","required":true},{"key":"email","label":"Email","type":"email","required":true},{"key":"phone","label":"Teléfono / WhatsApp","type":"tel","required":false},{"key":"provincia","label":"¿En qué provincia?","type":"select","required":true,"options":["Ciudad Autónoma de Buenos Aires","Buenos Aires","Catamarca","Chaco","Chubut","Córdoba","Corrientes","Entre Ríos","Formosa","Jujuy","La Pampa","La Rioja","Mendoza","Misiones","Neuquén","Río Negro","Salta","San Juan","San Luis","Santa Cruz","Santa Fe","Santiago del Estero","Tierra del Fuego","Tucumán"]},{"key":"consent","label":"Quiero que me contacten por email y WhatsApp sobre mi consulta","type":"checkbox","required":false}]},{"title":"Sobre tu trabajo","fields":[{"key":"rol","label":"¿Consultás como...?","type":"radio","required":true,"options":["Empleado/a","Empleador/a o empresa"]},{"key":"empresa","label":"Empresa donde trabajabas","type":"text","required":true},{"key":"antiguedad","label":"Antigüedad","type":"select","required":true,"options":["Menos de 3 meses","3 a 12 meses","1 a 3 años","3 a 10 años","Más de 10 años"]},{"key":"sueldo","label":"Último sueldo bruto aproximado","type":"text","required":false}]},{"title":"Sobre el despido","fields":[{"key":"fecha_despido","label":"Fecha del despido","type":"date","required":true},{"key":"registrado","label":"¿Estabas registrado (en blanco)?","type":"radio","required":true,"options":["Sí, todo en blanco","Parcialmente en negro","Todo en negro","No sé"]},{"key":"telegrama","label":"¿Recibiste telegrama de despido?","type":"radio","required":true,"options":["Sí","No","No sé"]}]},{"title":"Contanos el caso","fields":[{"key":"hace_cuanto","label":"¿Hace cuánto ocurrió?","type":"select","required":true,"options":["Esta semana","Este mes","Hace 2 a 6 meses","Hace más de 6 meses","Hace más de 2 años"]}]},{"title":"Contanos y coordinamos","subtitle":"Lo último: tu caso en tus palabras, y cómo te viene bien que te contactemos.","fields":[{"key":"relato","label":"Contanos de qué se trata","type":"textarea","required":false},{"key":"urgencia","label":"¿Qué tan urgente es?","type":"radio","required":true,"options":["Es urgente, tengo un plazo venciendo","Quiero resolverlo este mes","Estoy averiguando, sin apuro"]},{"key":"contacto_pref","label":"¿Cómo preferís que te contactemos?","type":"radio","required":true,"options":["Llamada telefónica","WhatsApp","Email","Videollamada (Zoom o Meet)","Reunión presencial en el estudio"]},{"key":"franja","label":"¿En qué horario?","type":"select","required":false,"options":["Mañana (9 a 13)","Tarde (13 a 18)","Indistinto"]},{"key":"otro_abogado","label":"¿Ya consultaste este caso con otro abogado?","type":"radio","required":false,"options":["No","Sí, hice una consulta","Sí, tengo abogado en el caso"]}]}]}'::jsonb, 0
from funnels f join firms fi on fi.id = f.firm_id
where fi.slug = 'alzogaray-serrano' and f.slug = 'laboral'
on conflict (funnel_id, slug) do update set name = excluded.name, steps = excluded.steps;

insert into workflows (funnel_id, name, slug, steps, sort_order)
select f.id, 'Trabajo no registrado (en negro)', 'trabajo-no-registrado', '{"steps":[{"title":"¿Con quién hablamos?","subtitle":"Con esto ya podemos abrir la consulta y contactarte.","fields":[{"key":"first_name","label":"Nombre","type":"text","required":true},{"key":"last_name","label":"Apellido","type":"text","required":true},{"key":"email","label":"Email","type":"email","required":true},{"key":"phone","label":"Teléfono / WhatsApp","type":"tel","required":false},{"key":"provincia","label":"¿En qué provincia?","type":"select","required":true,"options":["Ciudad Autónoma de Buenos Aires","Buenos Aires","Catamarca","Chaco","Chubut","Córdoba","Corrientes","Entre Ríos","Formosa","Jujuy","La Pampa","La Rioja","Mendoza","Misiones","Neuquén","Río Negro","Salta","San Juan","San Luis","Santa Cruz","Santa Fe","Santiago del Estero","Tierra del Fuego","Tucumán"]},{"key":"consent","label":"Quiero que me contacten por email y WhatsApp sobre mi consulta","type":"checkbox","required":false}]},{"title":"Sobre la relación laboral","fields":[{"key":"rol","label":"¿Consultás como...?","type":"radio","required":true,"options":["Empleado/a","Empleador/a o empresa"]},{"key":"empresa","label":"Empresa o empleador","type":"text","required":true},{"key":"tarea","label":"¿Qué tareas hacías?","type":"text","required":true},{"key":"antiguedad","label":"¿Cuánto tiempo trabajaste ahí?","type":"select","required":true,"options":["Menos de 6 meses","6 a 12 meses","1 a 3 años","Más de 3 años"]}]},{"title":"Pruebas","fields":[{"key":"pruebas","label":"¿Con qué contás?","type":"select","required":true,"options":["Recibos o transferencias","Mensajes de WhatsApp","Testigos","Nada por ahora"]},{"key":"vinculo_actual","label":"¿Seguís trabajando ahí?","type":"radio","required":true,"options":["Sí","No"]}]},{"title":"Contanos y coordinamos","subtitle":"Lo último: tu caso en tus palabras, y cómo te viene bien que te contactemos.","fields":[{"key":"relato","label":"Contanos de qué se trata","type":"textarea","required":false},{"key":"urgencia","label":"¿Qué tan urgente es?","type":"radio","required":true,"options":["Es urgente, tengo un plazo venciendo","Quiero resolverlo este mes","Estoy averiguando, sin apuro"]},{"key":"contacto_pref","label":"¿Cómo preferís que te contactemos?","type":"radio","required":true,"options":["Llamada telefónica","WhatsApp","Email","Videollamada (Zoom o Meet)","Reunión presencial en el estudio"]},{"key":"franja","label":"¿En qué horario?","type":"select","required":false,"options":["Mañana (9 a 13)","Tarde (13 a 18)","Indistinto"]},{"key":"otro_abogado","label":"¿Ya consultaste este caso con otro abogado?","type":"radio","required":false,"options":["No","Sí, hice una consulta","Sí, tengo abogado en el caso"]}]}]}'::jsonb, 1
from funnels f join firms fi on fi.id = f.firm_id
where fi.slug = 'alzogaray-serrano' and f.slug = 'laboral'
on conflict (funnel_id, slug) do update set name = excluded.name, steps = excluded.steps;

insert into workflows (funnel_id, name, slug, steps, sort_order)
select f.id, 'Accidente de trabajo / ART', 'accidente-laboral', '{"steps":[{"title":"¿Con quién hablamos?","subtitle":"Con esto ya podemos abrir la consulta y contactarte.","fields":[{"key":"first_name","label":"Nombre","type":"text","required":true},{"key":"last_name","label":"Apellido","type":"text","required":true},{"key":"email","label":"Email","type":"email","required":true},{"key":"phone","label":"Teléfono / WhatsApp","type":"tel","required":false},{"key":"provincia","label":"¿En qué provincia?","type":"select","required":true,"options":["Ciudad Autónoma de Buenos Aires","Buenos Aires","Catamarca","Chaco","Chubut","Córdoba","Corrientes","Entre Ríos","Formosa","Jujuy","La Pampa","La Rioja","Mendoza","Misiones","Neuquén","Río Negro","Salta","San Juan","San Luis","Santa Cruz","Santa Fe","Santiago del Estero","Tierra del Fuego","Tucumán"]},{"key":"consent","label":"Quiero que me contacten por email y WhatsApp sobre mi consulta","type":"checkbox","required":false}]},{"title":"El accidente","fields":[{"key":"fecha","label":"Fecha del accidente","type":"date","required":true},{"key":"lesion","label":"¿Qué lesión tuviste?","type":"text","required":true},{"key":"denuncia_art","label":"¿Se denunció a la ART?","type":"radio","required":true,"options":["Sí","No","No sé"]}]},{"title":"Estado actual","fields":[{"key":"alta","label":"¿Te dieron el alta médica?","type":"radio","required":true,"options":["Sí","No","Todavía en tratamiento"]},{"key":"secuelas","label":"¿Te quedaron secuelas?","type":"textarea","required":false}]},{"title":"Contanos y coordinamos","subtitle":"Lo último: tu caso en tus palabras, y cómo te viene bien que te contactemos.","fields":[{"key":"relato","label":"Contanos de qué se trata","type":"textarea","required":false},{"key":"urgencia","label":"¿Qué tan urgente es?","type":"radio","required":true,"options":["Es urgente, tengo un plazo venciendo","Quiero resolverlo este mes","Estoy averiguando, sin apuro"]},{"key":"contacto_pref","label":"¿Cómo preferís que te contactemos?","type":"radio","required":true,"options":["Llamada telefónica","WhatsApp","Email","Videollamada (Zoom o Meet)","Reunión presencial en el estudio"]},{"key":"franja","label":"¿En qué horario?","type":"select","required":false,"options":["Mañana (9 a 13)","Tarde (13 a 18)","Indistinto"]},{"key":"otro_abogado","label":"¿Ya consultaste este caso con otro abogado?","type":"radio","required":false,"options":["No","Sí, hice una consulta","Sí, tengo abogado en el caso"]}]}]}'::jsonb, 2
from funnels f join firms fi on fi.id = f.firm_id
where fi.slug = 'alzogaray-serrano' and f.slug = 'laboral'
on conflict (funnel_id, slug) do update set name = excluded.name, steps = excluded.steps;

insert into workflows (funnel_id, name, slug, steps, sort_order)
select f.id, 'Otro tema laboral', 'otro-tema-laboral', '{"steps":[{"title":"¿Con quién hablamos?","subtitle":"Con esto ya podemos abrir la consulta y contactarte.","fields":[{"key":"first_name","label":"Nombre","type":"text","required":true},{"key":"last_name","label":"Apellido","type":"text","required":true},{"key":"email","label":"Email","type":"email","required":true},{"key":"phone","label":"Teléfono / WhatsApp","type":"tel","required":false},{"key":"provincia","label":"¿En qué provincia?","type":"select","required":true,"options":["Ciudad Autónoma de Buenos Aires","Buenos Aires","Catamarca","Chaco","Chubut","Córdoba","Corrientes","Entre Ríos","Formosa","Jujuy","La Pampa","La Rioja","Mendoza","Misiones","Neuquén","Río Negro","Salta","San Juan","San Luis","Santa Cruz","Santa Fe","Santiago del Estero","Tierra del Fuego","Tucumán"]},{"key":"consent","label":"Quiero que me contacten por email y WhatsApp sobre mi consulta","type":"checkbox","required":false}]},{"title":"Contanos tu situación","fields":[{"key":"rol","label":"¿Consultás como...?","type":"radio","required":true,"options":["Empleado/a","Empleador/a o empresa"]},{"key":"tema","label":"¿De qué se trata?","type":"select","required":true,"options":["Licencias o vacaciones","Acoso o maltrato laboral","Diferencias salariales","Cambio de tareas u horario","Renuncia o acuerdo de desvinculación","Encuadre en el convenio","Otro"]},{"key":"empresa","label":"Empresa o empleador","type":"text","required":false},{"key":"vinculo_actual","label":"¿Seguís trabajando ahí?","type":"radio","required":true,"options":["Sí","No"]}]},{"title":"Contanos y coordinamos","subtitle":"Lo último: tu caso en tus palabras, y cómo te viene bien que te contactemos.","fields":[{"key":"relato","label":"Contanos de qué se trata","type":"textarea","required":false},{"key":"urgencia","label":"¿Qué tan urgente es?","type":"radio","required":true,"options":["Es urgente, tengo un plazo venciendo","Quiero resolverlo este mes","Estoy averiguando, sin apuro"]},{"key":"contacto_pref","label":"¿Cómo preferís que te contactemos?","type":"radio","required":true,"options":["Llamada telefónica","WhatsApp","Email","Videollamada (Zoom o Meet)","Reunión presencial en el estudio"]},{"key":"franja","label":"¿En qué horario?","type":"select","required":false,"options":["Mañana (9 a 13)","Tarde (13 a 18)","Indistinto"]},{"key":"otro_abogado","label":"¿Ya consultaste este caso con otro abogado?","type":"radio","required":false,"options":["No","Sí, hice una consulta","Sí, tengo abogado en el caso"]}]}]}'::jsonb, 3
from funnels f join firms fi on fi.id = f.firm_id
where fi.slug = 'alzogaray-serrano' and f.slug = 'laboral'
on conflict (funnel_id, slug) do update set name = excluded.name, steps = excluded.steps;

insert into funnels (firm_id, name, slug, color, sort_order)
select id, 'Accidentes de Tránsito', 'accidentes-transito', '#b05c3c', 1 from firms where slug = 'alzogaray-serrano'
on conflict (firm_id, slug) do update set
  name = excluded.name, color = excluded.color, sort_order = excluded.sort_order;

insert into workflows (funnel_id, name, slug, steps, sort_order)
select f.id, 'Choque con lesiones', 'choque-con-lesiones', '{"steps":[{"title":"¿Con quién hablamos?","subtitle":"Con esto ya podemos abrir la consulta y contactarte.","fields":[{"key":"first_name","label":"Nombre","type":"text","required":true},{"key":"last_name","label":"Apellido","type":"text","required":true},{"key":"email","label":"Email","type":"email","required":true},{"key":"phone","label":"Teléfono / WhatsApp","type":"tel","required":false},{"key":"provincia","label":"¿En qué provincia?","type":"select","required":true,"options":["Ciudad Autónoma de Buenos Aires","Buenos Aires","Catamarca","Chaco","Chubut","Córdoba","Corrientes","Entre Ríos","Formosa","Jujuy","La Pampa","La Rioja","Mendoza","Misiones","Neuquén","Río Negro","Salta","San Juan","San Luis","Santa Cruz","Santa Fe","Santiago del Estero","Tierra del Fuego","Tucumán"]},{"key":"consent","label":"Quiero que me contacten por email y WhatsApp sobre mi consulta","type":"checkbox","required":false}]},{"title":"El siniestro","fields":[{"key":"fecha","label":"Fecha del accidente","type":"date","required":true},{"key":"rol","label":"¿Vos qué eras?","type":"radio","required":true,"options":["Conductor","Acompañante","Peatón","Ciclista o motociclista"]},{"key":"lugar","label":"¿Dónde ocurrió?","type":"text","required":false}]},{"title":"Lesiones y cobertura","fields":[{"key":"lesiones","label":"¿Qué lesiones sufriste?","type":"textarea","required":true},{"key":"hospital","label":"¿Te atendieron en un hospital?","type":"radio","required":true,"options":["Sí","No"]},{"key":"seguro_tercero","label":"¿El tercero tenía seguro?","type":"radio","required":true,"options":["Sí","No","No sé"]}]},{"title":"Último paso","fields":[{"key":"denuncia_policial","label":"¿Hubo denuncia policial?","type":"radio","required":true,"options":["Sí","No","No sé"]},{"key":"detalle","label":"Contanos brevemente qué pasó","type":"textarea","required":false}]},{"title":"Contanos y coordinamos","subtitle":"Lo último: tu caso en tus palabras, y cómo te viene bien que te contactemos.","fields":[{"key":"relato","label":"Contanos de qué se trata","type":"textarea","required":false},{"key":"urgencia","label":"¿Qué tan urgente es?","type":"radio","required":true,"options":["Es urgente, tengo un plazo venciendo","Quiero resolverlo este mes","Estoy averiguando, sin apuro"]},{"key":"contacto_pref","label":"¿Cómo preferís que te contactemos?","type":"radio","required":true,"options":["Llamada telefónica","WhatsApp","Email","Videollamada (Zoom o Meet)","Reunión presencial en el estudio"]},{"key":"franja","label":"¿En qué horario?","type":"select","required":false,"options":["Mañana (9 a 13)","Tarde (13 a 18)","Indistinto"]},{"key":"otro_abogado","label":"¿Ya consultaste este caso con otro abogado?","type":"radio","required":false,"options":["No","Sí, hice una consulta","Sí, tengo abogado en el caso"]}]}]}'::jsonb, 0
from funnels f join firms fi on fi.id = f.firm_id
where fi.slug = 'alzogaray-serrano' and f.slug = 'accidentes-transito'
on conflict (funnel_id, slug) do update set name = excluded.name, steps = excluded.steps;

insert into workflows (funnel_id, name, slug, steps, sort_order)
select f.id, 'Daños materiales', 'danos-materiales', '{"steps":[{"title":"¿Con quién hablamos?","subtitle":"Con esto ya podemos abrir la consulta y contactarte.","fields":[{"key":"first_name","label":"Nombre","type":"text","required":true},{"key":"last_name","label":"Apellido","type":"text","required":true},{"key":"email","label":"Email","type":"email","required":true},{"key":"phone","label":"Teléfono / WhatsApp","type":"tel","required":false},{"key":"provincia","label":"¿En qué provincia?","type":"select","required":true,"options":["Ciudad Autónoma de Buenos Aires","Buenos Aires","Catamarca","Chaco","Chubut","Córdoba","Corrientes","Entre Ríos","Formosa","Jujuy","La Pampa","La Rioja","Mendoza","Misiones","Neuquén","Río Negro","Salta","San Juan","San Luis","Santa Cruz","Santa Fe","Santiago del Estero","Tierra del Fuego","Tucumán"]},{"key":"consent","label":"Quiero que me contacten por email y WhatsApp sobre mi consulta","type":"checkbox","required":false}]},{"title":"El siniestro","fields":[{"key":"fecha","label":"Fecha del accidente","type":"date","required":true},{"key":"vehiculo","label":"Vehículo dañado","type":"text","required":true},{"key":"presupuesto","label":"¿Tenés presupuesto de reparación?","type":"radio","required":true,"options":["Sí","No"]}]},{"title":"Contanos y coordinamos","subtitle":"Lo último: tu caso en tus palabras, y cómo te viene bien que te contactemos.","fields":[{"key":"relato","label":"Contanos de qué se trata","type":"textarea","required":false},{"key":"urgencia","label":"¿Qué tan urgente es?","type":"radio","required":true,"options":["Es urgente, tengo un plazo venciendo","Quiero resolverlo este mes","Estoy averiguando, sin apuro"]},{"key":"contacto_pref","label":"¿Cómo preferís que te contactemos?","type":"radio","required":true,"options":["Llamada telefónica","WhatsApp","Email","Videollamada (Zoom o Meet)","Reunión presencial en el estudio"]},{"key":"franja","label":"¿En qué horario?","type":"select","required":false,"options":["Mañana (9 a 13)","Tarde (13 a 18)","Indistinto"]},{"key":"otro_abogado","label":"¿Ya consultaste este caso con otro abogado?","type":"radio","required":false,"options":["No","Sí, hice una consulta","Sí, tengo abogado en el caso"]}]}]}'::jsonb, 1
from funnels f join firms fi on fi.id = f.firm_id
where fi.slug = 'alzogaray-serrano' and f.slug = 'accidentes-transito'
on conflict (funnel_id, slug) do update set name = excluded.name, steps = excluded.steps;

insert into funnels (firm_id, name, slug, color, sort_order)
select id, 'Familia', 'familia', '#4b7a68', 2 from firms where slug = 'alzogaray-serrano'
on conflict (firm_id, slug) do update set
  name = excluded.name, color = excluded.color, sort_order = excluded.sort_order;

insert into workflows (funnel_id, name, slug, steps, sort_order)
select f.id, 'Divorcio', 'divorcio', '{"steps":[{"title":"¿Con quién hablamos?","subtitle":"Con esto ya podemos abrir la consulta y contactarte.","fields":[{"key":"first_name","label":"Nombre","type":"text","required":true},{"key":"last_name","label":"Apellido","type":"text","required":true},{"key":"email","label":"Email","type":"email","required":true},{"key":"phone","label":"Teléfono / WhatsApp","type":"tel","required":false},{"key":"provincia","label":"¿En qué provincia?","type":"select","required":true,"options":["Ciudad Autónoma de Buenos Aires","Buenos Aires","Catamarca","Chaco","Chubut","Córdoba","Corrientes","Entre Ríos","Formosa","Jujuy","La Pampa","La Rioja","Mendoza","Misiones","Neuquén","Río Negro","Salta","San Juan","San Luis","Santa Cruz","Santa Fe","Santiago del Estero","Tierra del Fuego","Tucumán"]},{"key":"consent","label":"Quiero que me contacten por email y WhatsApp sobre mi consulta","type":"checkbox","required":false}]},{"title":"Situación","fields":[{"key":"acuerdo","label":"¿Hay acuerdo entre las partes?","type":"radio","required":true,"options":["Sí, de común acuerdo","No","No sé"]},{"key":"hijos","label":"¿Tienen hijos menores?","type":"radio","required":true,"options":["Sí","No"]},{"key":"bienes","label":"¿Hay bienes a dividir?","type":"radio","required":true,"options":["Sí","No","No sé"]}]},{"title":"Contanos y coordinamos","subtitle":"Lo último: tu caso en tus palabras, y cómo te viene bien que te contactemos.","fields":[{"key":"relato","label":"Contanos de qué se trata","type":"textarea","required":false},{"key":"urgencia","label":"¿Qué tan urgente es?","type":"radio","required":true,"options":["Es urgente, tengo un plazo venciendo","Quiero resolverlo este mes","Estoy averiguando, sin apuro"]},{"key":"contacto_pref","label":"¿Cómo preferís que te contactemos?","type":"radio","required":true,"options":["Llamada telefónica","WhatsApp","Email","Videollamada (Zoom o Meet)","Reunión presencial en el estudio"]},{"key":"franja","label":"¿En qué horario?","type":"select","required":false,"options":["Mañana (9 a 13)","Tarde (13 a 18)","Indistinto"]},{"key":"otro_abogado","label":"¿Ya consultaste este caso con otro abogado?","type":"radio","required":false,"options":["No","Sí, hice una consulta","Sí, tengo abogado en el caso"]}]}]}'::jsonb, 0
from funnels f join firms fi on fi.id = f.firm_id
where fi.slug = 'alzogaray-serrano' and f.slug = 'familia'
on conflict (funnel_id, slug) do update set name = excluded.name, steps = excluded.steps;

insert into workflows (funnel_id, name, slug, steps, sort_order)
select f.id, 'Cuota alimentaria', 'cuota-alimentaria', '{"steps":[{"title":"¿Con quién hablamos?","subtitle":"Con esto ya podemos abrir la consulta y contactarte.","fields":[{"key":"first_name","label":"Nombre","type":"text","required":true},{"key":"last_name","label":"Apellido","type":"text","required":true},{"key":"email","label":"Email","type":"email","required":true},{"key":"phone","label":"Teléfono / WhatsApp","type":"tel","required":false},{"key":"provincia","label":"¿En qué provincia?","type":"select","required":true,"options":["Ciudad Autónoma de Buenos Aires","Buenos Aires","Catamarca","Chaco","Chubut","Córdoba","Corrientes","Entre Ríos","Formosa","Jujuy","La Pampa","La Rioja","Mendoza","Misiones","Neuquén","Río Negro","Salta","San Juan","San Luis","Santa Cruz","Santa Fe","Santiago del Estero","Tierra del Fuego","Tucumán"]},{"key":"consent","label":"Quiero que me contacten por email y WhatsApp sobre mi consulta","type":"checkbox","required":false}]},{"title":"Situación","fields":[{"key":"rol","label":"¿Qué necesitás?","type":"radio","required":true,"options":["Reclamar una cuota","Que me la reduzcan","Ejecutar una cuota impaga"]},{"key":"hijos_cantidad","label":"¿Cuántos hijos involucra?","type":"select","required":true,"options":["1","2","3 o más"]},{"key":"cuota_actual","label":"¿Hay cuota fijada hoy?","type":"radio","required":true,"options":["Sí","No"]}]},{"title":"Contanos y coordinamos","subtitle":"Lo último: tu caso en tus palabras, y cómo te viene bien que te contactemos.","fields":[{"key":"relato","label":"Contanos de qué se trata","type":"textarea","required":false},{"key":"urgencia","label":"¿Qué tan urgente es?","type":"radio","required":true,"options":["Es urgente, tengo un plazo venciendo","Quiero resolverlo este mes","Estoy averiguando, sin apuro"]},{"key":"contacto_pref","label":"¿Cómo preferís que te contactemos?","type":"radio","required":true,"options":["Llamada telefónica","WhatsApp","Email","Videollamada (Zoom o Meet)","Reunión presencial en el estudio"]},{"key":"franja","label":"¿En qué horario?","type":"select","required":false,"options":["Mañana (9 a 13)","Tarde (13 a 18)","Indistinto"]},{"key":"otro_abogado","label":"¿Ya consultaste este caso con otro abogado?","type":"radio","required":false,"options":["No","Sí, hice una consulta","Sí, tengo abogado en el caso"]}]}]}'::jsonb, 1
from funnels f join firms fi on fi.id = f.firm_id
where fi.slug = 'alzogaray-serrano' and f.slug = 'familia'
on conflict (funnel_id, slug) do update set name = excluded.name, steps = excluded.steps;

insert into funnels (firm_id, name, slug, color, sort_order)
select id, 'Sucesiones', 'sucesiones', '#7a5c9e', 3 from firms where slug = 'alzogaray-serrano'
on conflict (firm_id, slug) do update set
  name = excluded.name, color = excluded.color, sort_order = excluded.sort_order;

insert into workflows (funnel_id, name, slug, steps, sort_order)
select f.id, 'Iniciar una sucesión', 'iniciar-sucesion', '{"steps":[{"title":"¿Con quién hablamos?","subtitle":"Con esto ya podemos abrir la consulta y contactarte.","fields":[{"key":"first_name","label":"Nombre","type":"text","required":true},{"key":"last_name","label":"Apellido","type":"text","required":true},{"key":"email","label":"Email","type":"email","required":true},{"key":"phone","label":"Teléfono / WhatsApp","type":"tel","required":false},{"key":"provincia","label":"¿En qué provincia?","type":"select","required":true,"options":["Ciudad Autónoma de Buenos Aires","Buenos Aires","Catamarca","Chaco","Chubut","Córdoba","Corrientes","Entre Ríos","Formosa","Jujuy","La Pampa","La Rioja","Mendoza","Misiones","Neuquén","Río Negro","Salta","San Juan","San Luis","Santa Cruz","Santa Fe","Santiago del Estero","Tierra del Fuego","Tucumán"]},{"key":"consent","label":"Quiero que me contacten por email y WhatsApp sobre mi consulta","type":"checkbox","required":false}]},{"title":"Sobre la sucesión","fields":[{"key":"vinculo","label":"Tu vínculo con el causante","type":"select","required":true,"options":["Hijo/a","Cónyuge","Hermano/a","Otro"]},{"key":"testamento","label":"¿Hay testamento?","type":"radio","required":true,"options":["Sí","No","No sé"]},{"key":"bienes","label":"¿Qué bienes hay?","type":"textarea","required":false},{"key":"herederos","label":"¿Cuántos herederos son?","type":"select","required":true,"options":["1","2","3","4 o más"]}]},{"title":"Contanos y coordinamos","subtitle":"Lo último: tu caso en tus palabras, y cómo te viene bien que te contactemos.","fields":[{"key":"relato","label":"Contanos de qué se trata","type":"textarea","required":false},{"key":"urgencia","label":"¿Qué tan urgente es?","type":"radio","required":true,"options":["Es urgente, tengo un plazo venciendo","Quiero resolverlo este mes","Estoy averiguando, sin apuro"]},{"key":"contacto_pref","label":"¿Cómo preferís que te contactemos?","type":"radio","required":true,"options":["Llamada telefónica","WhatsApp","Email","Videollamada (Zoom o Meet)","Reunión presencial en el estudio"]},{"key":"franja","label":"¿En qué horario?","type":"select","required":false,"options":["Mañana (9 a 13)","Tarde (13 a 18)","Indistinto"]},{"key":"otro_abogado","label":"¿Ya consultaste este caso con otro abogado?","type":"radio","required":false,"options":["No","Sí, hice una consulta","Sí, tengo abogado en el caso"]}]}]}'::jsonb, 0
from funnels f join firms fi on fi.id = f.firm_id
where fi.slug = 'alzogaray-serrano' and f.slug = 'sucesiones'
on conflict (funnel_id, slug) do update set name = excluded.name, steps = excluded.steps;

insert into funnels (firm_id, name, slug, color, sort_order)
select id, 'Defensa del Consumidor', 'defensa-consumidor', '#3c6fb0', 4 from firms where slug = 'alzogaray-serrano'
on conflict (firm_id, slug) do update set
  name = excluded.name, color = excluded.color, sort_order = excluded.sort_order;

insert into workflows (funnel_id, name, slug, steps, sort_order)
select f.id, 'Problema con banco o tarjeta', 'banco-tarjeta', '{"steps":[{"title":"¿Con quién hablamos?","subtitle":"Con esto ya podemos abrir la consulta y contactarte.","fields":[{"key":"first_name","label":"Nombre","type":"text","required":true},{"key":"last_name","label":"Apellido","type":"text","required":true},{"key":"email","label":"Email","type":"email","required":true},{"key":"phone","label":"Teléfono / WhatsApp","type":"tel","required":false},{"key":"provincia","label":"¿En qué provincia?","type":"select","required":true,"options":["Ciudad Autónoma de Buenos Aires","Buenos Aires","Catamarca","Chaco","Chubut","Córdoba","Corrientes","Entre Ríos","Formosa","Jujuy","La Pampa","La Rioja","Mendoza","Misiones","Neuquén","Río Negro","Salta","San Juan","San Luis","Santa Cruz","Santa Fe","Santiago del Estero","Tierra del Fuego","Tucumán"]},{"key":"consent","label":"Quiero que me contacten por email y WhatsApp sobre mi consulta","type":"checkbox","required":false}]},{"title":"El problema","fields":[{"key":"entidad","label":"Banco o entidad","type":"text","required":true},{"key":"problema","label":"¿Qué pasó?","type":"select","required":true,"options":["Consumos que no reconozco","Estafa / phishing","Cobros indebidos","Reporte al Veraz","Otro"]},{"key":"monto","label":"Monto aproximado involucrado","type":"text","required":false},{"key":"reclamo_previo","label":"¿Reclamaste a la entidad?","type":"radio","required":true,"options":["Sí","No"]}]},{"title":"Contanos y coordinamos","subtitle":"Lo último: tu caso en tus palabras, y cómo te viene bien que te contactemos.","fields":[{"key":"relato","label":"Contanos de qué se trata","type":"textarea","required":false},{"key":"urgencia","label":"¿Qué tan urgente es?","type":"radio","required":true,"options":["Es urgente, tengo un plazo venciendo","Quiero resolverlo este mes","Estoy averiguando, sin apuro"]},{"key":"contacto_pref","label":"¿Cómo preferís que te contactemos?","type":"radio","required":true,"options":["Llamada telefónica","WhatsApp","Email","Videollamada (Zoom o Meet)","Reunión presencial en el estudio"]},{"key":"franja","label":"¿En qué horario?","type":"select","required":false,"options":["Mañana (9 a 13)","Tarde (13 a 18)","Indistinto"]},{"key":"otro_abogado","label":"¿Ya consultaste este caso con otro abogado?","type":"radio","required":false,"options":["No","Sí, hice una consulta","Sí, tengo abogado en el caso"]}]}]}'::jsonb, 0
from funnels f join firms fi on fi.id = f.firm_id
where fi.slug = 'alzogaray-serrano' and f.slug = 'defensa-consumidor'
on conflict (funnel_id, slug) do update set name = excluded.name, steps = excluded.steps;


-- ----- cuentas -----

insert into users (email, name, password_hash, is_staff)
values ('hola@clickderecho.com', 'Click Derecho', 'scrypt$32768$8$1$CIEyFg3tksq8/N2WPzb4eQ==$TjTG6ymOgqkqMdySObgyW3M24D+oDhXrh8qh3EISmpp/kqXmnLwsuuIXOCLnCJNye+8W/wJtuNAJhmdtXfDhwA==', true)
on conflict (lower(email)) do update set name = excluded.name, is_staff = excluded.is_staff;

insert into users (email, name, password_hash, is_staff)
values ('consultas@alzogarayserrano.com.ar', 'Mariano Alzogaray', 'scrypt$32768$8$1$agHtfAbHveEPwJnhZv3LyA==$x9X/tExDYwajgMmG36UIlK1s0T1qHcA/ynWYaS1IMZ7454yX687LcWQY5PIVMJj1ywiRIiDrBIf6O/AXW3sRjA==', false)
on conflict (lower(email)) do update set name = excluded.name;

insert into memberships (user_id, firm_id, role)
select u.id, f.id, 'owner'
from users u, firms f
where lower(u.email) = 'consultas@alzogarayserrano.com.ar' and f.slug = 'alzogaray-serrano'
on conflict (user_id, firm_id) do update set role = 'owner';


-- ----- trafico de prueba de los ultimos 60 dias -----
-- Solo para que el panel no arranque vacio. Se borra con:
--   delete from sessions where data->>'_demo' = '1';

do $demo$
declare
  v_firm uuid;
  v_wf   record;
  v_ses  uuid;
  d      int;
  k      int;
  n      int;
  paso   int;
  pasos  int;
  cuando timestamptz;
  nombre text;
  apellido text;
  sup    text;
  nombres text[] := array['Martín','Carla','Diego','Lucía','Javier','Ana','Nicolás','Sofía','Pablo','Valeria'];
  apellidos text[] := array['Ruiz','Gómez','Fernández','Paz','Sosa','Torres','Vega','Ledesma','Ibarra','Cabrera'];
  fuentes text[] := array['organic','google','instagram','whatsapp','referral','direct','facebook'];
  v_utm  jsonb;
  -- Pauta de mentira, para que la tabla de campañas del panel muestre algo
  -- parecido a lo que se ve con trafico real. El resto queda sin utm, como
  -- pasa con lo organico y lo directo.
  campanas jsonb[] := array[
    '{"utm_source":"google","utm_medium":"cpc","utm_campaign":"laboral-despidos","utm_content":"search-marca"}',
    '{"utm_source":"google","utm_medium":"cpc","utm_campaign":"laboral-despidos","utm_content":"search-generico"}',
    '{"utm_source":"google","utm_medium":"cpc","utm_campaign":"sucesiones-caba"}',
    '{"utm_source":"instagram","utm_medium":"paid_social","utm_campaign":"reels-familia","utm_content":"video-15s"}',
    '{"utm_source":"instagram","utm_medium":"paid_social","utm_campaign":"reels-familia","utm_content":"carrusel"}',
    '{"utm_source":"facebook","utm_medium":"paid_social","utm_campaign":"remarketing-30d"}',
    '{"utm_source":"newsletter","utm_medium":"email","utm_campaign":"septiembre"}'
  ]::jsonb[];
begin
  select id into v_firm from firms where slug = 'alzogaray-serrano';
  delete from sessions where firm_id = v_firm and data->>'_demo' = '1';

  for d in reverse 60..0 loop
    n := floor(random() * 8) + 1;
    for k in 1..n loop
      select w.id as wid, w.funnel_id, jsonb_array_length(w.steps->'steps') as pasos
        into v_wf
      from workflows w join funnels f on f.id = w.funnel_id
      where f.firm_id = v_firm
      order by random() limit 1;

      cuando := now() - (d || ' days')::interval + (random() * 8 || ' hours')::interval;
      sup := case when random() < 0.7 then 'page'
                  when random() < 0.5 then 'popup' else 'clip' end;

      -- 55% viene de pauta: de ahi salen los utm y la fuente.
      v_utm := case when random() < 0.55
                    then campanas[1 + floor(random() * array_length(campanas, 1))::int]
                    else '{}'::jsonb end;

      insert into sessions (firm_id, funnel_id, workflow_id, source, surface, utm, created_at, updated_at, data)
      values (v_firm, v_wf.funnel_id, v_wf.wid,
              coalesce(v_utm->>'utm_source',
                       fuentes[1 + floor(random() * array_length(fuentes, 1))::int]),
              sup, v_utm, cuando, cuando, '{"_demo":"1"}'::jsonb)
      returning id into v_ses;

      insert into events (session_id, firm_id, funnel_id, workflow_id, type, surface, created_at)
      values (v_ses, v_firm, v_wf.funnel_id, v_wf.wid, 'view', sup, cuando);

      continue when random() < 0.45;   -- casi la mitad ni empieza

      nombre   := nombres[1 + floor(random() * array_length(nombres, 1))::int];
      apellido := apellidos[1 + floor(random() * array_length(apellidos, 1))::int];

      update sessions set
        first_name = nombre, last_name = apellido,
        email = lower(nombre || '.' || apellido || '@gmail.com'),
        consent = random() < 0.8, max_step = 1,
        data = jsonb_build_object('_demo','1','first_name',nombre,'last_name',apellido)
      where id = v_ses;

      insert into events (session_id, firm_id, funnel_id, workflow_id, type, step_index, surface, created_at)
      values (v_ses, v_firm, v_wf.funnel_id, v_wf.wid, 'start', 0, sup, cuando);

      pasos := greatest(v_wf.pasos, 1);
      paso := 1;
      while paso < pasos and random() < 0.72 loop
        paso := paso + 1;
      end loop;

      update sessions set max_step = paso where id = v_ses;
      for k in 1..paso loop
        insert into events (session_id, firm_id, funnel_id, workflow_id, type, step_index, surface, created_at)
        values (v_ses, v_firm, v_wf.funnel_id, v_wf.wid, 'step_complete', k - 1, sup, cuando);
      end loop;

      if paso >= pasos then
        update sessions set
          submitted_at = cuando + interval '10 minutes',
          updated_at   = cuando + interval '10 minutes',
          read_at      = case when random() < 0.6 then cuando + interval '20 minutes' end
        where id = v_ses;
        insert into events (session_id, firm_id, funnel_id, workflow_id, type, step_index, surface, created_at)
        values (v_ses, v_firm, v_wf.funnel_id, v_wf.wid, 'submit', paso - 1, sup, cuando + interval '10 minutes');
      end if;
    end loop;
  end loop;
end
$demo$;

select 'listo: ' || count(*) || ' consultas de prueba' as resultado
from sessions where data->>'_demo' = '1';
