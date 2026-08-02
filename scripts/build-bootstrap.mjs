// Genera db/bootstrap.sql: un solo archivo para pegar en el SQL Editor de
// Supabase y dejar la base lista sin pasar por la terminal.
//
//   node scripts/build-bootstrap.mjs
//
// Se regenera cada vez que cambian el esquema o los formularios de ejemplo.

import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { randomBytes, scrypt as scryptCb } from "node:crypto";
import { promisify } from "node:util";
import { firm, funnels } from "../db/seed-data.mjs";

const scrypt = promisify(scryptCb);
const here = dirname(fileURLToPath(import.meta.url));

const PASS = process.env.SEED_PASSWORD || "clickderecho2026";

async function hashPassword(plain) {
  const salt = randomBytes(16);
  const key = await scrypt(plain.normalize("NFKC"), salt, 64, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
  return `scrypt$32768$8$1$${salt.toString("base64")}$${key.toString("base64")}`;
}

/** Literal SQL con comillas escapadas. null -> NULL. */
const lit = (v) => (v == null ? "NULL" : `'${String(v).replace(/'/g, "''")}'`);

const schema = await readFile(join(here, "..", "db", "schema.sql"), "utf8");

const partes = [];
partes.push(`-- ===========================================================================
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
--   ${firm.notify_email.padEnd(35)}(dueño del estudio de ejemplo)
--   contraseña: ${PASS}
--
-- CAMBIÁ ESA CONTRASEÑA apenas entres, desde Perfil: está publicada en el
-- repositorio, así que cualquiera que encuentre tu URL la conoce.
-- ===========================================================================

`);

partes.push("-- ----- esquema -----\n");
partes.push(schema);

partes.push(`

-- ----- estudio de ejemplo, areas y formularios -----

insert into firms (name, slug, notify_email, accent, logo_url, hero_url, intro)
values (${lit(firm.name)}, ${lit(firm.slug)}, ${lit(firm.notify_email)}, ${lit(firm.accent)},
        ${lit(firm.logo_url)}, ${lit(firm.hero_url)}, ${lit(firm.intro)})
on conflict (slug) do update set
  name = excluded.name, notify_email = excluded.notify_email, accent = excluded.accent,
  logo_url = excluded.logo_url, hero_url = excluded.hero_url, intro = excluded.intro;
`);

for (const [i, fn] of funnels.entries()) {
  partes.push(`
insert into funnels (firm_id, name, slug, color, sort_order)
select id, ${lit(fn.name)}, ${lit(fn.slug)}, ${lit(fn.color)}, ${i} from firms where slug = ${lit(firm.slug)}
on conflict (firm_id, slug) do update set
  name = excluded.name, color = excluded.color, sort_order = excluded.sort_order;
`);
  for (const [j, wf] of fn.workflows.entries()) {
    const steps = JSON.stringify({ steps: wf.steps });
    partes.push(`
insert into workflows (funnel_id, name, slug, steps, sort_order)
select f.id, ${lit(wf.name)}, ${lit(wf.slug)}, ${lit(steps)}::jsonb, ${j}
from funnels f join firms fi on fi.id = f.firm_id
where fi.slug = ${lit(firm.slug)} and f.slug = ${lit(fn.slug)}
on conflict (funnel_id, slug) do update set name = excluded.name, steps = excluded.steps;
`);
  }
}

partes.push(`

-- ----- cuentas -----

insert into users (email, name, password_hash, is_staff)
values ('hola@clickderecho.com', 'Click Derecho', ${lit(await hashPassword(PASS))}, true)
on conflict (lower(email)) do update set name = excluded.name, is_staff = excluded.is_staff;

insert into users (email, name, password_hash, is_staff)
values (${lit(firm.notify_email.toLowerCase())}, 'Mariano Alzogaray', ${lit(await hashPassword(PASS))}, false)
on conflict (lower(email)) do update set name = excluded.name;

insert into memberships (user_id, firm_id, role)
select u.id, f.id, 'owner'
from users u, firms f
where lower(u.email) = ${lit(firm.notify_email.toLowerCase())} and f.slug = ${lit(firm.slug)}
on conflict (user_id, firm_id) do update set role = 'owner';
`);

// El trafico de prueba se genera del lado del servidor: un archivo con miles de
// INSERT seria imposible de pegar en el editor.
partes.push(`

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
  select id into v_firm from firms where slug = ${lit(firm.slug)};
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
`);

await writeFile(join(here, "..", "db", "bootstrap.sql"), partes.join(""));
console.log("db/bootstrap.sql generado");
