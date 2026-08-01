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
const { url, options } = pgConfig(
  process.env.DATABASE_URL || "postgres://postgres:postgres@127.0.0.1:5432/intake",
);
const sql = postgres(url, options);

const demo = process.argv.includes("--demo");
const reset = process.argv.includes("--reset");

const schema = await readFile(join(here, "..", "db", "schema.sql"), "utf8");
await sql.unsafe(schema);
console.log("esquema aplicado");

if (reset) {
  // users tambien: no tiene FK a firms, asi que sin nombrarla explicitamente
  // las cuentas sobreviven al reset y ensucian la corrida siguiente.
  await sql`truncate events, sessions, workflows, funnels, firms, users
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

      const [s] = await sql`
        insert into sessions (firm_id, funnel_id, workflow_id, source, surface, created_at, updated_at, data)
        values (${f.id}, ${wf.funnel_id}, ${wf.workflow_id}, ${rnd(fuentes)}, ${surface}, ${at}, ${at}, ${sql.json({ _demo: "1" })})
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
