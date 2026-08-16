/**
 * La version corta, contada en el orden en que se entiende.
 *
 * Primero el proceso entero de punta a punta —alguien llega, consulta, y al
 * estudio le llega la consulta completa—, recien despues que pasa cuando
 * alguien no termina. Al reves no se entiende: no se puede explicar el abandono
 * de algo que todavia no se mostro.
 *
 * Despues las dos formas que tiene el formulario de aparecer en un sitio —el
 * pop-up y el clip— y por ultimo de donde vino cada consulta, que es lo que
 * decide donde poner la plata.
 *
 * La visita entra por una nota del blog a proposito: asi la ficha de la
 * consulta muestra la nota que la trajo, y no "el sitio" en general.
 */
import { fileURLToPath } from "node:url";
import { readFileSync, writeFileSync } from "node:fs";
import { chromium } from "playwright";
import postgres from "postgres";
import { servirSitio } from "./sitio.mjs";
import {
  CAPA, rotulo, tocar, escribir, mover, pausa, linea, arrancarReloj, usarLocucion, cerrarLocucion,
} from "./escena.mjs";
import { recoveryEmail } from "./.build/mailer.js";
import { ESTUDIO } from "./estudio-en.mjs";

/** El navegador de Playwright. Se puede apuntar a otro con CHROMIUM. */
const NAVEGADOR = process.env.CHROMIUM || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";

const SALIDA = fileURLToPath(new URL("./salida", import.meta.url));
const APP = "http://localhost:3000";
const SITIO = "http://whitfieldmarsh.com";
const NOTA = `${SITIO}/blog/report-workplace-injury-ohio`
  + "?utm_source=google&utm_medium=cpc&utm_campaign=workplace-injury";

const VOZ = (() => {
  try {
    return JSON.parse(readFileSync(`${SALIDA}/segmentos-corto.json`, "utf8")).map((s) => s.dura);
  } catch {
    return [];
  }
})();

const sql = postgres(readFileSync(new URL("../.env.local", import.meta.url), "utf8")
  .match(/^DATABASE_URL=(.+)$/m)[1].trim(), { onnotice: () => {} });

const VISITANTE = {
  nombre: "Marina", apellido: "Cabrera",
  email: "marina.cabrera@gmail.com", tel: "(614) 555-0142", estado: "Ohio",
};

const [firm] = await sql`select id, accent from firms where slug = ${ESTUDIO.slug}`;
if (!firm) throw new Error("falta el estudio de demostración: corré estudio-en.mjs");

const [pop] = await sql`
  select id, trigger, cta from popups where firm_id = ${firm.id} and active order by created_at limit 1`;
const ctaAviso = pop?.cta ?? "";
const [clip] = await sql`
  select id, video_url from clips where firm_id = ${firm.id} and active order by created_at limit 1`;
if (!pop || !clip) throw new Error("el estudio de demostración no tiene pop-ups ni clips");

// El que abandono es otra persona, de las que ya tiene el estudio: la que
// consulta en la primera parte termina, y mezclar las dos historias en la misma
// persona es lo que hacia confuso el orden anterior.
const [dejado] = await sql`
  select s.id, s.full_name, s.email, f.name as area, f.slug as area_slug, w.slug as caso_slug
  from sessions s
  join funnels f on f.id = s.funnel_id
  join workflows w on w.id = s.workflow_id
  where s.firm_id = ${firm.id} and s.submitted_at is null
    and s.email is not null and s.max_step >= 1 and s.recovery_sent_at is null
  order by s.updated_at desc limit 1`;
if (!dejado) throw new Error("no hay ninguna consulta abandonada para mostrar");

const limpiar = async () => {
  await sql`delete from sessions where email = ${VISITANTE.email}`;
  await sql`update popups set trigger = ${pop.trigger} where id = ${pop.id}`;
  await sql`update clips set video_url = ${clip.video_url} where id = ${clip.id}`;
  // Todas, no solo la que se usa: cada grabacion manda un recordatorio y a la
  // tercera la lista de abandonos aparece con medio panel ya recordado.
  await sql`update sessions set recovery_sent_at = null
            where firm_id = ${firm.id} and data->>'_demo' = '1'`;
  await sql`update sessions set recovery_sent_at = null where id = ${dejado.id}`;
};
for (const s of ["SIGINT", "SIGTERM"]) process.on(s, async () => { await limpiar(); process.exit(1); });

let video;
let marcasFinales = [];
try {
  await limpiar();
  await sql`update popups set trigger = 'delay:5' where id = ${pop.id}`;
  await sql`update clips set video_url = ${`${SITIO}/clip.webm`} where id = ${clip.id}`;

  let mailHtml = "";
  const sitio = servirSitio({
    puerto: 80,
    widget: `${APP}/w.js?popup=${pop.id}`,
    mail: () => mailHtml,
    video: `${SALIDA}/clip-demo.webm`,
  });

  const b = await chromium.launch({ executablePath: NAVEGADOR });
  const ctx = await b.newContext({
    viewport: { width: 1440, height: 810 },
    recordVideo: { dir: `${SALIDA}/crudo-corto`, size: { width: 1440, height: 810 } },
    locale: "en-US",
  });
  await ctx.addInitScript(CAPA);
  const p = await ctx.newPage();
  const arranque = Date.now();
  const marco = () => p.frameLocator('div[role="dialog"] iframe');
  const cartel = (m, b2) => p.evaluate(([a, c]) => window.__cartel?.(a, c), [m, b2]);

  arrancarReloj();
  if (VOZ.length) usarLocucion(VOZ.slice(1, -1));
  const marcas = [];
  const anotarPlaca = (n) => marcas.push({ n, seg: (Date.now() - arranque) / 1000 });

  const rapido = { antes: 300, despues: 240 };
  const veloz = { antes: 200, despues: 150 };

  // Se llama dos veces y la segunda ya hay sesion abierta: entrar de nuevo
  // llevaria a /login, que redirige al panel y no tiene donde escribir.
  const entrar = async () => {
    await p.goto(`${APP}/panel`, { waitUntil: "domcontentloaded" });
    if (new URL(p.url()).pathname === "/panel") return;
    await p.fill("#email", ESTUDIO.usuario);
    await p.fill("#password", "rightlead2026");
    await p.click('button[type="submit"]');
    await p.waitForURL((u) => new URL(u).pathname === "/panel", { timeout: 20000 });
  };

  // ======================= 1. el proceso, de punta a punta =================
  await p.goto(NOTA, { waitUntil: "domcontentloaded" });
  anotarPlaca(1);
  await cartel("Right Lead", "Turn the visits you already pay for into signed cases");
  await pausa(VOZ.length ? VOZ[0] * 1000 + 300 : 2200);
  await cartel(null);

  await rotulo(p, "So this is the firm's blog. Someone's reading it — they came in from an ad.");
  await mover(p, 700, 400, { esperar: 300 });
  await p.mouse.wheel(0, 300);
  await p.locator('div[role="dialog"]').waitFor({ timeout: 20000 });
  await pausa(300);

  // El pop-up no es el formulario: es un aviso que invita a consultar.
  await rotulo(p, "And there's the pop-up. Notice it's not the form. It just asks.");
  await pausa(700);
  await tocar(p, p.locator('div[role="dialog"] button', { hasText: ctaAviso }).first(), rapido);
  await marco().locator(".pill-btn").first().waitFor({ timeout: 20000 });

  await rotulo(p, "She taps it, and now it asks what her case is about.");
  await tocar(p, marco().locator(".pill-btn", { hasText: "Employment Law" }), rapido);
  await tocar(p, marco().locator(".pill-btn", { hasText: "Workplace injury" }), rapido);
  await marco().locator("#f-first_name").waitFor({ timeout: 15000 });

  await rotulo(p, "Employment, workplace injury. From here it only asks what that case needs.");
  await escribir(p, marco().locator("#f-first_name"), VISITANTE.nombre, { ms: 16 });
  await escribir(p, marco().locator("#f-email"), VISITANTE.email, { ms: 14 });
  await marco().locator("#f-last_name").fill(VISITANTE.apellido);
  await marco().locator("#f-phone").fill(VISITANTE.tel);
  await marco().locator("#f-provincia").selectOption(VISITANTE.estado);
  await tocar(p, marco().locator(".fcheck"), veloz);
  await tocar(p, marco().locator(".fbtn", { hasText: "Continue" }), veloz);

  await rotulo(p, "Name, email, what happened to her. And she sends it.");
  await marco().locator("#f-lesion").waitFor({ timeout: 15000 });
  await marco().locator("#f-lesion").fill("Fractured wrist");
  await marco().locator("#f-fecha").fill("2026-07-28");
  await tocar(p, marco().locator(".fradios label", { hasText: "Yes, in writing" }), veloz);
  await tocar(p, marco().locator(".fbtn", { hasText: "Continue" }), veloz);
  await tocar(p, marco().locator(".fradios label", { hasText: "Still in treatment" }), veloz);
  await tocar(p, marco().locator(".fbtn", { hasText: "Continue" }), veloz);
  await marco().locator("#f-relato").fill("I fell off a ladder in the warehouse.");
  await tocar(p, marco().locator(".fradios label", { hasText: "Urgent" }), veloz);
  await tocar(p, marco().locator(".fradios label", { hasText: "Phone call" }), veloz);
  await tocar(p, marco().locator(".fbtn", { hasText: "Send my request" }), veloz);
  await marco().locator(".fdone").waitFor({ timeout: 20000 });
  await pausa(600);

  await entrar();
  await p.goto(`${APP}/responses`, { waitUntil: "networkidle" });
  await tocar(p, p.locator("a", { hasText: `${VISITANTE.nombre} ${VISITANTE.apellido}` }).first(), rapido);
  await p.waitForURL("**/responses/**", { timeout: 15000 });
  await rotulo(p, "And here it is on the firm's side. Every answer, and how urgent she says it is.");
  await pausa(2200);

  // ======================= 2. y cuando no terminan =========================
  await p.goto(`${APP}/responses?tab=abandonadas`, { waitUntil: "networkidle" });
  await rotulo(p, "Now — most people never get that far. That's the part everybody loses.");
  await pausa(1900);
  await rotulo(p, "Not here. You've got her email and the exact step she stopped at.");
  await pausa(1700);

  // Por id y no por mail: los nombres del historial se repiten y la fila de
  // arriba puede ser otra consulta de la misma persona, ya recordada.
  const fila = p.locator(`tr:has(a[href="/responses/${dejado.id}"])`);
  await rotulo(p, "One reminder goes out, with a link straight back to her own form.");
  await tocar(p, fila.locator("button", { hasText: "Send a reminder" }), rapido);
  await pausa(700);

  mailHtml = recoveryEmail({
    name: dejado.full_name, firm: ESTUDIO.name, accent: firm.accent, area: dejado.area,
    url: `${APP}/f/${ESTUDIO.slug}/${dejado.area_slug}/${dejado.caso_slug}?retomar=${dejado.id}`,
    lang: "en",
  }).html;
  await p.goto(`${SITIO}/mail`, { waitUntil: "networkidle" });
  await pausa(1500);
  await tocar(p, p.locator("a", { hasText: "Finish my request" }), rapido);
  await p.waitForURL("**/f/**", { timeout: 20000 });
  await p.locator(".fsteps").waitFor({ timeout: 20000 });
  await rotulo(p, "And look — everything she typed is still there.");
  await pausa(2000);

  // ======================= 3. donde vive el formulario =====================
  await p.goto(`${APP}/popups`, { waitUntil: "networkidle" });
  await rotulo(p, "The form can live in a pop-up. Each one has its own snippet and its own numbers.");
  await mover(p, 800, 210, { esperar: 1800 });

  await p.goto(`${SITIO}/?w=clip=${clip.id}`, { waitUntil: "domcontentloaded" });
  await rotulo(p, "Or in a little video of you, down in the corner.");
  // Sin remate propio: que el clip abre el mismo formulario ya se vio con el
  // pop-up, y el click se sigue viendo igual.
  await p.locator("video").waitFor({ timeout: 20000 });
  await pausa(2100);
  await tocar(p, p.locator("video"), { antes: 400, despues: 1100 });

  // ======================= 4. de donde vino ================================
  await entrar();
  await p.goto(`${APP}/responses`, { waitUntil: "networkidle" });
  await tocar(p, p.locator("a", { hasText: `${VISITANTE.nombre} ${VISITANTE.apellido}` }).first(), veloz);
  await p.waitForURL("**/responses/**", { timeout: 15000 });
  await rotulo(p, "And every request tells you where it came from. Right down to the blog post.");
  await mover(p, 1090, 300, { esperar: 400 });
  await mover(p, 1090, 445, { esperar: 2000 });

  await p.goto(`${APP}/analytics`, { waitUntil: "networkidle" });
  await mover(p, 720, 500, { esperar: 200 });
  await p.mouse.wheel(0, 700);
  await pausa(250);
  await rotulo(p, "So you can see which campaign is actually bringing you cases.");
  await pausa(1900);
  await rotulo(p, "");

  // ======================= cierre ==========================================
  await cerrarLocucion();
  anotarPlaca(99);
  await cartel("Right Lead", "Intake forms that don't lose the case");
  await pausa(VOZ.length ? VOZ[VOZ.length - 1] * 1000 + 600 : 1900);

  marcasFinales = marcas;
  video = await p.video().path();
  await ctx.close();
  await b.close();
  sitio.close();
} finally {
  await limpiar();
  await sql.end();
}

const entradas = [
  { n: 1, seg: marcasFinales[0].seg },
  ...linea.map((l, i) => ({ n: i + 2, seg: l.seg, texto: l.texto })),
  { n: linea.length + 2, seg: marcasFinales[1].seg },
];
writeFileSync(`${SALIDA}/tiempos-corto.json`, JSON.stringify(entradas, null, 2));
for (const e of entradas) console.log(`${String(e.n).padStart(2)}  ${e.seg.toFixed(1).padStart(6)}s  ${e.texto ?? "(placa)"}`);
console.log(video ?? "sin video");
