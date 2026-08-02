// Aplica el esquema y carga el estudio de ejemplo.
//   node scripts/setup-db.mjs          -> esquema + estudio + forms
//   node scripts/setup-db.mjs --demo   -> ademas genera trafico falso para ver el panel con datos
//   node scripts/setup-db.mjs --reset  -> borra todo antes de cargar

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import postgres from "postgres";
import { randomBytes, scrypt as scryptCb } from "node:crypto";
import { promisify } from "node:util";
import { firm, funnels } from "../db/seed-data.mjs";
import { pgConfig } from "../db/pg-options.mjs";

const scrypt = promisify(scryptCb);

// Mismo formato que src/lib/auth.ts
async function hashPassword(plain) {
  const salt = randomBytes(16);
  const key = await scrypt(plain.normalize("NFKC"), salt, 64, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
  return `scrypt$32768$8$1$${salt.toString("base64")}$${key.toString("base64")}`;
}

const here = dirname(fileURLToPath(import.meta.url));

/**
 * Carga .env.local a mano.
 *
 * Next lo lee solo, pero un script suelto de Node no: sin esto el script se
 * conectaba al Postgres local por defecto e ignoraba la configuracion, que es
 * justo donde vive DATABASE_URL.
 */
async function cargarEnvLocal() {
  let texto;
  try {
    texto = await readFile(join(here, "..", ".env.local"), "utf8");
  } catch {
    return; // sin archivo: se usan las variables del entorno
  }

  for (const linea of texto.split(/\r?\n/)) {
    const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(linea);
    if (!m) continue;
    const clave = m[1];
    const valor = m[2].trim().replace(/^(['"])(.*)\1$/, "$2");
    // Lo que venga por entorno pisa al archivo.
    if (!(clave in process.env)) process.env[clave] = valor;
  }
}
await cargarEnvLocal();

/**
 * Revisa la cadena antes de pasarsela al driver.
 *
 * Los tres errores de abajo son los que aparecen al armar el .env.local a
 * mano, y sin esto el driver responde con un TypeError que no dice nada.
 */
function revisarUrl(v) {
  if (/^\s*DATABASE_URL\s*=/i.test(v)) {
    return 'La linea quedo duplicada: el valor arranca con "DATABASE_URL=".\n' +
           "En .env.local tiene que aparecer una sola vez, asi:\n\n" +
           "  DATABASE_URL=postgresql://usuario:clave@host:5432/postgres\n";
  }
  if (/TU_CONTRASE|TU-CONTRASE|YOUR-PASSWORD|\[[^\]]*\]/i.test(v)) {
    return "Falta reemplazar la contraseña: quedo el texto de ejemplo.\n" +
           "Poné la contraseña real de la base, sin corchetes.\n";
  }
  // new URL() sola no alcanza: acepta cualquier cosa con dos puntos como
  // esquema, y despues el driver intenta conectarse a un host inventado.
  let u;
  try {
    u = new URL(v);
  } catch {
    u = null;
  }
  if (!u || !/^postgres(ql)?:$/.test(u.protocol) || !u.hostname) {
    return "No parece una cadena de conexion valida. Tiene que empezar con\n" +
           "postgresql:// y estar toda en una sola linea:\n\n" +
           "  postgresql://usuario:clave@host:5432/postgres\n";
  }
  return null;
}

const rawUrl = process.env.DATABASE_URL || "postgres://postgres:postgres@127.0.0.1:5432/intake";
const problema = revisarUrl(rawUrl);
if (problema) {
  console.error(`\nDATABASE_URL mal configurada en .env.local\n\n${problema}`);
  process.exit(1);
}

const { url, options } = pgConfig(rawUrl);
const sql = postgres(url, options);

const demo = process.argv.includes("--demo");
const reset = process.argv.includes("--reset");

const schema = await readFile(join(here, "..", "db", "schema.sql"), "utf8");
try {
  await sql.unsafe(schema);
  console.log("esquema aplicado");
} catch (e) {
  console.error(`\nNo se pudo aplicar el esquema: ${e.message}\n`);
  if (/password authentication|SASL|SCRAM/i.test(e.message)) {
    console.error(
      "Parece la contraseña de la base. Revisá que en DATABASE_URL hayas\n" +
      "reemplazado [YOUR-PASSWORD]. Se regenera en Supabase, en\n" +
      "Project Settings > Database > Reset database password.\n",
    );
  } else if (/CONNECT_TIMEOUT|ETIMEDOUT|ECONNREFUSED/i.test(e.message)) {
    console.error(
      "No se llego al servidor. Suele ser la red bloqueando el puerto de\n" +
      "salida. Probalo con:\n\n" +
      "  Test-NetConnection <host>.pooler.supabase.com -Port 5432   (Windows)\n" +
      "  nc -vz <host>.pooler.supabase.com 5432                     (Mac/Linux)\n\n" +
      "Si da bloqueado, probá desde otra red (datos del celular) o usá la\n" +
      "cadena del transaction pooler, que va por el puerto 6543.\n",
    );
  } else if (/ENETUNREACH|EHOSTUNREACH|ENOTFOUND/i.test(e.message)) {
    console.error(
      "No hay ruta al servidor. Si copiaste la conexion directa\n" +
      "(db.<ref>.supabase.co), necesita IPv6: usa la cadena del pooler,\n" +
      "la que tiene 'pooler.supabase.com'.\n",
    );
  } else {
    console.error(
      "Alternativa: pega el contenido de db/schema.sql en el SQL Editor de\n" +
      "Supabase, ejecutalo, y volve a correr este comando.\n",
    );
  }
  process.exit(1);
}

if (reset) {
  // users y login_attempts tambien: ninguna tiene FK a firms, asi que sin
  // nombrarlas explicitamente sobreviven al reset y ensucian la corrida
  // siguiente. Con login_attempts el sintoma es peor que ensuciar: los
  // intentos fallidos de la corrida anterior dejan el login frenado y la
  // siguiente no puede entrar ni con la contrasena correcta.
  await sql`truncate events, sessions, workflows, funnels, firms, users, login_attempts
            restart identity cascade`;
  console.log("datos borrados");
}

const [f] = await sql`
  insert into firms (name, slug, notify_email, accent, logo_url, hero_url, intro)
  values (${firm.name}, ${firm.slug}, ${firm.notify_email}, ${firm.accent},
          ${firm.logo_url}, ${firm.hero_url}, ${firm.intro})
  on conflict (slug) do update set
    name = excluded.name, notify_email = excluded.notify_email, accent = excluded.accent,
    logo_url = excluded.logo_url, hero_url = excluded.hero_url, intro = excluded.intro
  returning *`;

const workflowIds = [];
for (const [i, fn] of funnels.entries()) {
  const [row] = await sql`
    insert into funnels (firm_id, name, slug, color, sort_order)
    values (${f.id}, ${fn.name}, ${fn.slug}, ${fn.color}, ${i})
    on conflict (firm_id, slug) do update set name = excluded.name, color = excluded.color, sort_order = excluded.sort_order
    returning *`;
  for (const [j, wf] of fn.workflows.entries()) {
    const [w] = await sql`
      insert into workflows (funnel_id, name, slug, steps, sort_order)
      values (${row.id}, ${wf.name}, ${wf.slug}, ${sql.json({ steps: wf.steps })}, ${j})
      on conflict (funnel_id, slug) do update set name = excluded.name, steps = excluded.steps
      returning *`;
    workflowIds.push({ funnel_id: row.id, workflow_id: w.id, steps: wf.steps.length });
  }
}
console.log(`estudio "${f.name}": ${funnels.length} areas, ${workflowIds.length} formularios`);

// Dos cuentas para arrancar: la de la agencia (ve todos los estudios) y la
// del estudio. La contraseña se cambia despues desde el panel.
const CUENTAS = [
  { email: process.env.SEED_STAFF_EMAIL || "hola@clickderecho.com", name: "Click Derecho", staff: true },
  { email: firm.notify_email, name: "Mariano Alzogaray", staff: false },
];
const PASS = process.env.SEED_PASSWORD || "clickderecho2026";

for (const c of CUENTAS) {
  const [u] = await sql`
    insert into users (email, name, password_hash, is_staff)
    values (${c.email.toLowerCase()}, ${c.name}, ${await hashPassword(PASS)}, ${c.staff})
    on conflict (lower(email)) do update set name = excluded.name, is_staff = excluded.is_staff
    returning id`;
  if (!c.staff) {
    await sql`insert into memberships (user_id, firm_id, role) values (${u.id}, ${f.id}, 'owner')
      on conflict (user_id, firm_id) do update set role = 'owner'`;
  }
}
console.log(`cuentas: ${CUENTAS.map((c) => c.email).join(", ")} — contraseña: ${PASS}`);

if (demo) {
  await sql`delete from sessions where firm_id = ${f.id} and data->>'_demo' = '1'`;

  const nombres = [["Martín", "Ruiz"], ["Carla", "Gómez"], ["Diego", "Fernández"], ["Lucía", "Paz"],
    ["Javier", "Sosa"], ["Ana", "Torres"], ["Nicolás", "Vega"], ["Sofía", "Ledesma"],
    ["Pablo", "Ibarra"], ["Valeria", "Cabrera"], ["Tomás", "Rivas"], ["Julieta", "Moyano"]];
  const fuentes = ["organic", "google", "instagram", "whatsapp", "referral", "direct", "facebook"];
  const superficies = ["page", "popup", "clip"];
  const rnd = (a) => a[Math.floor(Math.random() * a.length)];

  // Pauta de mentira, para que la tabla de campanas del panel muestre algo
  // parecido a lo que se ve con trafico real. El resto de las visitas queda
  // sin utm, como pasa con lo organico y lo directo.
  const campanas = [
    { utm_source: "google", utm_medium: "cpc", utm_campaign: "laboral-despidos", utm_content: "search-marca" },
    { utm_source: "google", utm_medium: "cpc", utm_campaign: "laboral-despidos", utm_content: "search-generico" },
    { utm_source: "google", utm_medium: "cpc", utm_campaign: "sucesiones-caba" },
    { utm_source: "instagram", utm_medium: "paid_social", utm_campaign: "reels-familia", utm_content: "video-15s" },
    { utm_source: "instagram", utm_medium: "paid_social", utm_campaign: "reels-familia", utm_content: "carrusel" },
    { utm_source: "facebook", utm_medium: "paid_social", utm_campaign: "remarketing-30d" },
    { utm_source: "newsletter", utm_medium: "email", utm_campaign: "septiembre" },
  ];

  let visitas = 0, envios = 0, abandonos = 0;
  for (let d = 60; d >= 0; d--) {
    // mas trafico los dias habiles, con algo de ruido
    const base = new Date(Date.now() - d * 864e5);
    const finde = base.getDay() === 0 || base.getDay() === 6;
    const n = Math.floor((finde ? 2 : 8) * (0.5 + Math.random()));

    for (let k = 0; k < n; k++) {
      const wf = rnd(workflowIds);
      const surface = Math.random() < 0.7 ? "page" : rnd(superficies);
      const at = new Date(base.getTime() + Math.random() * 864e5);

      // 55% viene de pauta: de ahi salen los utm. El resto es organico o directo.
      const camp = Math.random() < 0.55 ? rnd(campanas) : null;
      const fuente = camp ? camp.utm_source : rnd(fuentes);

      const [s] = await sql`
        insert into sessions (firm_id, funnel_id, workflow_id, source, surface, utm, created_at, updated_at, data)
        values (${f.id}, ${wf.funnel_id}, ${wf.workflow_id}, ${fuente}, ${surface},
                ${sql.json(camp ?? {})}, ${at}, ${at}, ${sql.json({ _demo: "1" })})
        returning id`;
      await sql`insert into events (session_id, firm_id, funnel_id, workflow_id, type, surface, created_at)
        values (${s.id}, ${f.id}, ${wf.funnel_id}, ${wf.workflow_id}, 'view', ${surface}, ${at})`;
      visitas++;

      // 45% ni empieza
      if (Math.random() < 0.45) continue;

      const [nombre, apellido] = rnd(nombres);
      const email = `${nombre}.${apellido}`.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") + "@gmail.com";
      const consent = Math.random() < 0.8;
      await sql`update sessions set first_name = ${nombre}, last_name = ${apellido}, email = ${email},
        consent = ${consent}, max_step = 1,
        data = ${sql.json({ _demo: "1", first_name: nombre, last_name: apellido, email, consent: consent ? "Sí" : "No" })}
        where id = ${s.id}`;
      await sql`insert into events (session_id, firm_id, funnel_id, workflow_id, type, step_index, surface, created_at)
        values (${s.id}, ${f.id}, ${wf.funnel_id}, ${wf.workflow_id}, 'start', 0, ${surface}, ${at})`;

      // avanza paso a paso, cayendose en el camino
      let step = 1;
      while (step < wf.steps && Math.random() < 0.72) step++;
      await sql`update sessions set max_step = ${step} where id = ${s.id}`;
      for (let i = 1; i <= step; i++) {
        await sql`insert into events (session_id, firm_id, funnel_id, workflow_id, type, step_index, surface, created_at)
          values (${s.id}, ${f.id}, ${wf.funnel_id}, ${wf.workflow_id}, 'step_complete', ${i - 1}, ${surface}, ${at})`;
      }

      if (step >= wf.steps) {
        const done = new Date(at.getTime() + 6e5);
        await sql`update sessions set submitted_at = ${done}, updated_at = ${done},
          read_at = ${Math.random() < 0.6 ? done : null} where id = ${s.id}`;
        await sql`insert into events (session_id, firm_id, funnel_id, workflow_id, type, step_index, surface, created_at)
          values (${s.id}, ${f.id}, ${wf.funnel_id}, ${wf.workflow_id}, 'submit', ${step - 1}, ${surface}, ${done})`;
        envios++;
      } else {
        abandonos++;
      }
    }
  }
  console.log(`demo: ${visitas} visitas, ${envios} consultas enviadas, ${abandonos} abandonos con mail`);
}

await sql.end();
