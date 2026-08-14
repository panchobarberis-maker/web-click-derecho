/**
 * El estudio de demostracion en ingles, con historial propio.
 *
 * El estudio que trae el seed tiene las preguntas escritas en castellano, asi
 * que para un video en ingles no sirve: el panel saldria en ingles y el
 * formulario en castellano. Este arma uno entero —areas, formularios y dos
 * meses de trafico— para que Analytics tenga algo que mostrar.
 *
 * Es idempotente: borrarlo y volver a crearlo es la forma de correrlo dos veces.
 */
import { readFileSync } from "node:fs";
import postgres from "postgres";
import { pasoDeContacto, pasoDeCoordinacion } from "./.build/forms.js";

const sql = postgres(/^DATABASE_URL=(.+)$/m.exec(readFileSync(new URL("../.env.local", import.meta.url), "utf8"))[1].trim(), { onnotice: () => {} });

export const ESTUDIO = {
  name: "Whitfield & Marsh",
  slug: "whitfield-marsh",
  accent: "#1f5d7a",
  notify: "intake@whitfieldmarsh.com",
  intro: "Whatever you tell us is confidential and only our attorneys see it.",
  usuario: "dana@whitfieldmarsh.com",
};

const AREAS = [
  {
    name: "Employment Law", slug: "employment", color: "#1f5d7a",
    casos: [
      {
        name: "Workplace injury", slug: "workplace-injury",
        pasos: [
          {
            title: "The injury",
            subtitle: "The basics of what happened, so an attorney can size it up.",
            fields: [
              { key: "fecha", label: "When did it happen?", type: "date", required: true },
              { key: "lesion", label: "What was the injury?", type: "text", required: true },
              {
                key: "reportado", label: "Did you report it to your employer?", type: "radio",
                required: true, options: ["Yes, in writing", "Yes, verbally", "Not yet"],
              },
            ],
          },
          {
            title: "Where things stand",
            fields: [
              {
                key: "alta", label: "Have you been cleared to return to work?", type: "radio",
                required: true, options: ["Yes", "No", "Still in treatment"],
              },
              { key: "secuelas", label: "Any lasting effects?", type: "textarea", required: false },
            ],
          },
        ],
      },
      {
        name: "Wrongful termination", slug: "wrongful-termination",
        pasos: [{
          title: "The termination",
          fields: [
            { key: "fecha_despido", label: "Date you were let go", type: "date", required: true },
            { key: "motivo", label: "What reason were you given?", type: "textarea", required: false },
            {
              key: "por_escrito", label: "Did you get it in writing?", type: "radio",
              required: true, options: ["Yes", "No"],
            },
          ],
        }],
      },
      {
        name: "Unpaid wages or overtime", slug: "unpaid-wages",
        pasos: [{
          title: "The pay",
          fields: [
            { key: "cuanto", label: "Roughly how much is owed?", type: "text", required: false },
            {
              key: "cuanto_tiempo", label: "How long has this been going on?", type: "select",
              required: true, options: ["Under a month", "One to six months", "Over six months"],
            },
          ],
        }],
      },
    ],
  },
  {
    name: "Personal Injury", slug: "personal-injury", color: "#a4633a",
    casos: [
      {
        name: "Car accident", slug: "car-accident",
        pasos: [{
          title: "The accident",
          fields: [
            { key: "fecha", label: "When did it happen?", type: "date", required: true },
            {
              key: "lesionado", label: "Was anyone hurt?", type: "radio",
              required: true, options: ["Yes, me", "Yes, someone else", "No, property damage only"],
            },
            { key: "parte", label: "Was a police report filed?", type: "radio", required: false, options: ["Yes", "No", "Not sure"] },
          ],
        }],
      },
      {
        name: "Slip and fall", slug: "slip-and-fall",
        pasos: [{
          title: "The fall",
          fields: [
            { key: "donde", label: "Where did it happen?", type: "text", required: true },
            { key: "lesion", label: "What was the injury?", type: "text", required: true },
          ],
        }],
      },
    ],
  },
  {
    name: "Family Law", slug: "family", color: "#5d5a8a",
    casos: [
      {
        name: "Divorce", slug: "divorce",
        pasos: [{
          title: "Your situation",
          fields: [
            { key: "acuerdo", label: "Is it uncontested?", type: "radio", required: true, options: ["Yes", "No", "Not sure yet"] },
            { key: "hijos", label: "Are there children involved?", type: "radio", required: true, options: ["Yes", "No"] },
          ],
        }],
      },
      {
        name: "Child support", slug: "child-support",
        pasos: [{
          title: "Your situation",
          fields: [
            { key: "orden", label: "Is there an order in place already?", type: "radio", required: true, options: ["Yes", "No"] },
          ],
        }],
      },
    ],
  },
];

// ------------------------------------------------------------------ trafico
const NOMBRES = [["Marcus", "Reyes"], ["Danielle", "Foster"], ["Andre", "Whitaker"], ["Priya", "Raman"],
  ["Kevin", "O'Doherty"], ["Sasha", "Bell"], ["Tyler", "Nguyen"], ["Imani", "Brooks"],
  ["Greg", "Salvatore"], ["Nora", "Lindqvist"], ["Devon", "Pierce"], ["Rosa", "Iglesias"]];

const CAMPANAS = [
  { utm_source: "google", utm_medium: "cpc", utm_campaign: "workplace-injury", utm_content: "exact-match" },
  { utm_source: "google", utm_medium: "cpc", utm_campaign: "workplace-injury", utm_content: "broad-match" },
  { utm_source: "google", utm_medium: "cpc", utm_campaign: "car-accident-local" },
  { utm_source: "instagram", utm_medium: "paid_social", utm_campaign: "know-your-rights", utm_content: "reel-15s" },
  { utm_source: "facebook", utm_medium: "paid_social", utm_campaign: "retargeting-30d" },
  { utm_source: "newsletter", utm_medium: "email", utm_campaign: "march" },
];

const rnd = (a) => a[Math.floor(Math.random() * a.length)];

export async function crearEstudio() {
  const previo = await sql`select id from firms where slug = ${ESTUDIO.slug}`;
  for (const f of previo) {
    await sql`delete from events where firm_id = ${f.id}`;
    await sql`delete from sessions where firm_id = ${f.id}`;
    await sql`delete from popups where firm_id = ${f.id}`;
    await sql`delete from clips where firm_id = ${f.id}`;
    await sql`delete from workflows w using funnels fu where w.funnel_id = fu.id and fu.firm_id = ${f.id}`;
    await sql`delete from funnels where firm_id = ${f.id}`;
    await sql`delete from memberships where firm_id = ${f.id}`;
    await sql`delete from firms where id = ${f.id}`;
  }

  const [firm] = await sql`
    insert into firms (name, slug, accent, notify_email, intro, lang, show_on_home)
    values (${ESTUDIO.name}, ${ESTUDIO.slug}, ${ESTUDIO.accent}, ${ESTUDIO.notify},
            ${ESTUDIO.intro}, 'en', false)
    returning id, accent`;

  // Su propia cuenta, para que el video no muestre el mail de nadie real. La
  // contraseña es la misma que la del resto del entorno de prueba: se copia el
  // hash en vez de recalcularlo, asi no hay una segunda implementacion de como
  // se guardan las contraseñas dando vueltas.
  const [modelo] = await sql`select password_hash from users where password_hash is not null limit 1`;
  const [u] = await sql`
    insert into users (email, name, password_hash)
    values (${ESTUDIO.usuario}, 'Dana Whitfield', ${modelo?.password_hash ?? null})
    on conflict (lower(email)) do update set name = excluded.name
    returning id`;
  await sql`insert into memberships (firm_id, user_id, role) values (${firm.id}, ${u.id}, 'owner')
            on conflict do nothing`;

  const wfs = [];
  let orden = 0;
  for (const area of AREAS) {
    const [fu] = await sql`
      insert into funnels (firm_id, name, slug, color, sort_order, active, on_storefront)
      values (${firm.id}, ${area.name}, ${area.slug}, ${area.color}, ${orden++}, true, true)
      returning id`;
    let o = 0;
    for (const caso of area.casos) {
      // Contacto adelante y coordinacion al final: igual que arma la aplicacion.
      const steps = [pasoDeContacto("en"), ...caso.pasos, pasoDeCoordinacion("en")];
      const [w] = await sql`
        insert into workflows (funnel_id, name, slug, steps, sort_order, active)
        values (${fu.id}, ${caso.name}, ${caso.slug}, ${sql.json({ steps })}, ${o++}, true)
        returning id`;
      wfs.push({ funnel_id: fu.id, workflow_id: w.id, pasos: steps.length });
    }
  }

  // Los pop-ups y los clips del estudio. Sin esto la pantalla muestra uno solo
  // —el que crea la grabacion— con "1 de 1" y parece de mentira.
  const popups = [];
  // El orden importa: la pantalla los lista del ultimo creado al primero, y no
  // conviene que abra con el pausado en cero.
  for (const [nombre, disparador, cta, activo] of [
    ["Mobile — halfway down", "scroll:50", "Free case review", false],
    ["Employment page — 12s", "delay:12", "Talk to an attorney", true],
    ["Home — exit intent", "exit", "Ask about your case", true],
  ]) {
    const [w] = await sql`
      insert into popups (firm_id, name, trigger, cta, active)
      values (${firm.id}, ${nombre}, ${disparador}, ${cta}, ${activo})
      returning id`;
    popups.push({ ...w, activo });
  }

  const clips = [];
  for (const [nombre, cta] of [
    ["Dana — workplace injury", "Talk to us"],
    ["Front page — 20s intro", "Start here"],
  ]) {
    const [w] = await sql`
      insert into clips (firm_id, name, video_url, cta, autoplay, active)
      values (${firm.id}, ${nombre}, 'https://cdn.example.com/clip.webm', ${cta}, true, true)
      returning id`;
    clips.push(w);
  }

  const activos = { popup: popups.filter((w) => w.activo), clip: clips };

  // Dos meses de trafico, para que el panel no arranque vacio.
  let visitas = 0, envios = 0, abandonos = 0;
  for (let d = 60; d >= 0; d--) {
    const base = new Date(Date.now() - d * 864e5);
    const finde = base.getDay() === 0 || base.getDay() === 6;
    const n = Math.floor((finde ? 2 : 9) * (0.5 + Math.random()));

    for (let k = 0; k < n; k++) {
      const wf = rnd(wfs);
      const surface = Math.random() < 0.62 ? "page" : (Math.random() < 0.7 ? "popup" : "clip");
      const at = new Date(Math.min(Date.now() - 25 * 6e4, base.getTime() + Math.random() * 864e5));
      const camp = Math.random() < 0.58 ? rnd(CAMPANAS) : null;
      const fuente = camp ? camp.utm_source : rnd(["organic", "google", "direct", "referral"]);

      const widget = surface === "page" ? null : rnd(activos[surface]);
      const [s] = await sql`
        insert into sessions (firm_id, funnel_id, workflow_id, source, surface, surface_id,
                              utm, created_at, updated_at, data)
        values (${firm.id}, ${wf.funnel_id}, ${wf.workflow_id}, ${fuente}, ${surface},
                ${widget?.id ?? null},
                ${sql.json(camp ?? {})}, ${at}, ${at}, ${sql.json({ _demo: "1" })})
        returning id`;
      await sql`insert into events (session_id, firm_id, funnel_id, workflow_id, type, surface, created_at)
        values (${s.id}, ${firm.id}, ${wf.funnel_id}, ${wf.workflow_id}, 'view', ${surface}, ${at})`;
      visitas++;

      if (Math.random() < 0.44) continue;

      const [nombre, apellido] = rnd(NOMBRES);
      const email = `${nombre}.${apellido}`.toLowerCase().replace(/[^a-z.]/g, "") + "@gmail.com";
      const consent = Math.random() < 0.82;
      await sql`update sessions set first_name = ${nombre}, last_name = ${apellido}, email = ${email},
        consent = ${consent}, max_step = 1,
        data = ${sql.json({ _demo: "1", first_name: nombre, last_name: apellido, email, consent: consent ? "Yes" : "No" })}
        where id = ${s.id}`;
      await sql`insert into events (session_id, firm_id, funnel_id, workflow_id, type, step_index, surface, created_at)
        values (${s.id}, ${firm.id}, ${wf.funnel_id}, ${wf.workflow_id}, 'start', 0, ${surface}, ${at})`;

      let step = 1;
      while (step < wf.pasos && Math.random() < 0.74) step++;
      await sql`update sessions set max_step = ${step} where id = ${s.id}`;
      for (let i = 1; i <= step; i++) {
        await sql`insert into events (session_id, firm_id, funnel_id, workflow_id, type, step_index, surface, created_at)
          values (${s.id}, ${firm.id}, ${wf.funnel_id}, ${wf.workflow_id}, 'step_complete', ${i - 1}, ${surface}, ${at})`;
      }

      if (step >= wf.pasos) {
        const done = new Date(Math.min(Date.now() - 6e4, at.getTime() + 6e5));
        await sql`update sessions set submitted_at = ${done}, updated_at = ${done},
          read_at = ${Math.random() < 0.55 ? done : null} where id = ${s.id}`;
        await sql`insert into events (session_id, firm_id, funnel_id, workflow_id, type, step_index, surface, created_at)
          values (${s.id}, ${firm.id}, ${wf.funnel_id}, ${wf.workflow_id}, 'submit', ${step - 1}, ${surface}, ${done})`;
        envios++;
      } else {
        abandonos++;
      }
    }
  }

  // Cuantas veces se mostro cada pop-up y cada clip. Se abre entre el 3% y el
  // 9% de las veces que se muestra, que es el orden de magnitud real; sin esto
  // la tasa de apertura del panel daria 100%.
  let impresiones = 0;
  for (const [surface, lista] of [["popup", popups], ["clip", clips]]) {
    for (const w of lista) {
      const [{ n }] = await sql`
        select count(*)::int as n from sessions
        where firm_id = ${firm.id} and surface_id = ${w.id}::uuid`;
      const veces = Math.round(Number(n) * (11 + Math.random() * 22)) + 40;
      for (let i = 0; i < veces; i++) {
        const at = new Date(Date.now() - Math.random() * 60 * 864e5);
        await sql`
          insert into events (firm_id, type, surface, surface_id, created_at, meta)
          values (${firm.id}, 'impression', ${surface}, ${w.id}, ${at},
                  ${sql.json({ lp: "https://whitfieldmarsh.com/" })})`;
        impresiones++;
      }
    }
  }

  return { id: firm.id, accent: firm.accent, visitas, envios, abandonos, impresiones };
}

if (process.argv[1]?.endsWith("estudio-en.mjs")) {
  const r = await crearEstudio();
  console.log(`${ESTUDIO.name}: ${r.visitas} visits, ${r.envios} sent, ${r.abandonos} abandoned, ${r.impresiones} impressions`);
  await sql.end();
}
