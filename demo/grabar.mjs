/**
 * Graba el video de demostracion de Right Lead, en ingles.
 *
 * No es una animacion ni un montaje de capturas: es la aplicacion de verdad
 * contra la base de verdad. Lo unico agregado es el puntero y los subtitulos,
 * porque Playwright no graba el cursor del sistema.
 *
 * El estudio es Whitfield & Marsh, inventado para esto y con su propio
 * historial, asi que el video no muestra datos de ningun cliente.
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

/**
 * Lo que dura cada frase de la locucion, si ya esta grabada.
 *
 * Con el archivo presente el video se acomoda a la voz; sin el, corre con los
 * tiempos de antes y sirve igual para grabar el mudo.
 */
const VOZ = (() => {
  try {
    return JSON.parse(readFileSync(`${SALIDA}/segmentos.json`, "utf8")).map((s) => s.dura);
  } catch {
    return [];
  }
})();

const sql = postgres(/^DATABASE_URL=(.+)$/m.exec(readFileSync(new URL("../.env.local", import.meta.url), "utf8"))[1].trim(), { onnotice: () => {} });

const VISITANTE = {
  nombre: "Marina", apellido: "Cabrera",
  email: "marina.cabrera@gmail.com", tel: "(614) 555-0142",
  estado: "Ohio",
};

const [firm] = await sql`select id, accent from firms where slug = ${ESTUDIO.slug}`;
if (!firm) throw new Error("falta el estudio de demostración: corré estudio-en.mjs");

const limpiar = async () => {
  await sql`delete from sessions where email = ${VISITANTE.email}`;
  await sql`delete from popups where firm_id = ${firm.id} and name = 'Video'`;
};
for (const s of ["SIGINT", "SIGTERM"]) process.on(s, async () => { await limpiar(); process.exit(1); });

let video;
let marcasFinales = [];
try {
  await limpiar();
  const [pop] = await sql`
    insert into popups (firm_id, name, trigger, cta, paginas)
    values (${firm.id}, 'Video', 'delay:3', 'Ask about your case', null)
    returning id`;

  let mailHtml = "";
  const sitio = servirSitio({ puerto: 80, widget: `${APP}/w.js?popup=${pop.id}`, mail: () => mailHtml });

  const b = await chromium.launch({ executablePath: NAVEGADOR });
  const ctx = await b.newContext({
    viewport: { width: 1440, height: 810 },
    recordVideo: { dir: `${SALIDA}/crudo`, size: { width: 1440, height: 810 } },
    locale: "en-US",
  });
  await ctx.addInitScript(CAPA);
  const p = await ctx.newPage();
  const arranque = Date.now();
  const marco = () => p.frameLocator('div[role="dialog"] iframe');
  const cartel = (m, b2) => p.evaluate(([a, c]) => window.__cartel?.(a, c), [m, b2]);

  // El video empieza a grabar cuando se abre la pagina, asi que el reloj del
  // guion arranca aca.
  arrancarReloj();
  // Las placas de principio y fin llevan la primera y la ultima frase; las 21
  // del medio son los subtitulos.
  if (VOZ.length) usarLocucion(VOZ.slice(1, -1));
  const marcas = [];
  const anotarPlaca = (n) => marcas.push({ n, seg: (Date.now() - arranque) / 1000 });

  // ---- 0. portada ---------------------------------------------------------
  await p.goto(`${SITIO}/`, { waitUntil: "domcontentloaded" });
  anotarPlaca(1);
  await cartel("Right Lead", "Turn the visits you already pay for into signed cases");
  await pausa(VOZ.length ? VOZ[0] * 1000 + 500 : 2800);
  await cartel(null);
  await pausa(900);

  // ---- 1. el sitio del estudio -------------------------------------------
  await rotulo(p, "A law firm's own website. Right Lead installs with one line of code.", 2800);
  await mover(p, 720, 380, { esperar: 400 });
  await p.mouse.wheel(0, 260);
  await pausa(1300);
  await p.mouse.wheel(0, -260);

  // ---- 2. aparece el formulario ------------------------------------------
  await rotulo(p, "A few seconds in, the intake form comes up over the page.");
  await p.locator('div[role="dialog"]').waitFor({ timeout: 20000 });
  await pausa(2400);

  await rotulo(p, "It isn't a contact form. It asks what the case is about first.", 2400);
  await tocar(p, marco().locator(".pill-btn", { hasText: "Employment Law" }));
  await pausa(800);
  await rotulo(p, "And the questions change with the answer.", 2000);
  await tocar(p, marco().locator(".pill-btn", { hasText: "Workplace injury" }));
  await marco().locator("#f-first_name").waitFor({ timeout: 15000 });
  await pausa(700);

  // ---- 3. deja sus datos --------------------------------------------------
  await rotulo(p, "Step one: who they are and how to reach them.");
  await escribir(p, marco().locator("#f-first_name"), VISITANTE.nombre);
  await escribir(p, marco().locator("#f-last_name"), VISITANTE.apellido);
  await escribir(p, marco().locator("#f-email"), VISITANTE.email, { ms: 40 });
  await rotulo(p, "That email is already saved — before anything is submitted.");
  await escribir(p, marco().locator("#f-phone"), VISITANTE.tel, { ms: 44 });
  await tocar(p, marco().locator("#f-provincia"), { despues: 280 });
  await marco().locator("#f-provincia").selectOption(VISITANTE.estado);
  await pausa(700);
  await tocar(p, marco().locator(".fcheck"), { despues: 500 });
  await tocar(p, marco().locator(".fbtn", { hasText: "Continue" }));
  await pausa(1000);

  // ---- 4. y se va ---------------------------------------------------------
  await rotulo(p, "She starts the second step…");
  await escribir(p, marco().locator("#f-lesion"), "Fractured wrist", { ms: 50 });
  await pausa(700);
  await rotulo(p, "…gets interrupted, and closes the tab.", 1700);
  await tocar(p, p.locator('div[role="dialog"] button[aria-label]').first());
  await p.evaluate(() => window.__punteroFuera?.());
  await pausa(400);
  await rotulo(p, "With an ordinary contact form, this person never existed.", 3400);
  await rotulo(p, "");

  // ---- 5. en el panel del estudio, si existe ------------------------------
  await p.goto(`${APP}/login`, { waitUntil: "networkidle" });
  await rotulo(p, "The firm opens its panel.");
  await escribir(p, p.locator("#email"), ESTUDIO.usuario, { ms: 26 });
  await escribir(p, p.locator("#password"), "rightlead2026", { ms: 38 });
  await tocar(p, p.locator('button[type="submit"]'));
  await p.waitForURL((u) => new URL(u).pathname === "/panel", { timeout: 20000 });
  await pausa(1500);
  await rotulo(p, "Visits, requests, and the ones that stopped halfway.", 3200);

  await tocar(p, p.locator("nav a", { hasText: "Requests" }).first());
  await p.waitForURL("**/responses**", { timeout: 15000 });
  await pausa(800);
  await tocar(p, p.locator("a", { hasText: /^Abandoned/ }));
  await pausa(1000);
  await rotulo(p, "There she is: who she is, where she stopped, and how to reach her.", 3400);

  // ---- 6. el recordatorio -------------------------------------------------
  await rotulo(p, "A reminder goes out on its own. It can also be sent by hand.");
  const fila = p.locator("tr", { hasText: VISITANTE.email });
  await tocar(p, fila.locator("button", { hasText: "Send a reminder" }));
  await pausa(1800);

  // La direccion se arma igual que en la aplicacion: al formulario que estaba
  // completando, no a la portada.
  const [ses] = await sql`
    select s.id, s.full_name, f.name as area, f.slug as area_slug, w.slug as caso_slug
    from sessions s
    left join funnels f on f.id = s.funnel_id
    left join workflows w on w.id = s.workflow_id
    where s.email = ${VISITANTE.email} order by s.created_at desc limit 1`;
  mailHtml = recoveryEmail({
    name: ses.full_name, firm: ESTUDIO.name, accent: firm.accent, area: ses.area,
    url: `${APP}/f/${ESTUDIO.slug}/${ses.area_slug}/${ses.caso_slug}?retomar=${ses.id}`,
    lang: "en",
  }).html;

  await p.goto(`${SITIO}/mail`, { waitUntil: "networkidle" });
  await rotulo(p, "This is the email she gets, in the firm's own colors.", 3600);

  // ---- 7. vuelve y termina ------------------------------------------------
  await rotulo(p, "And the link puts her back exactly where she left off.");
  await tocar(p, p.locator("a", { hasText: "Finish my request" }));
  await p.waitForURL("**/f/**", { timeout: 20000 });
  await p.locator("#f-lesion").waitFor({ timeout: 20000 });
  await pausa(2000);
  await rotulo(p, "Nothing she already typed has to be typed again.", 2800);

  await p.locator("#f-fecha").fill("2026-07-28");
  await tocar(p, p.locator(".fradios label", { hasText: "Yes, in writing" }), { antes: 420, despues: 380 });
  await tocar(p, p.locator(".fbtn", { hasText: "Continue" }), { antes: 420 });
  await pausa(700);
  await tocar(p, p.locator(".fradios label", { hasText: "Still in treatment" }), { antes: 420, despues: 380 });
  await escribir(p, p.locator("#f-secuelas"), "I still can't put weight on my right hand.", { ms: 24 });
  await tocar(p, p.locator(".fbtn", { hasText: "Continue" }), { antes: 420 });
  await pausa(700);

  await rotulo(p, "The last step is the one that pays off: the case in her words, and how to reach her.");
  await escribir(p, p.locator("#f-relato"), "I fell off a ladder in the warehouse. They say it was my fault.", { ms: 24 });
  await tocar(p, p.locator(".fradios label", { hasText: "Urgent" }), { antes: 400, despues: 340 });
  await tocar(p, p.locator(".fradios label", { hasText: "Phone call" }), { antes: 400, despues: 340 });
  await tocar(p, p.locator(".fbtn", { hasText: "Send my request" }), { antes: 420 });
  await p.locator(".fdone").waitFor({ timeout: 20000 });
  await pausa(2600);

  // ---- 8. al estudio le llega ordenada ------------------------------------
  await p.goto(`${APP}/responses`, { waitUntil: "networkidle" });
  await rotulo(p, "On the other side, the request lands complete.", 2200);
  await tocar(p, p.locator("a", { hasText: `${VISITANTE.nombre} ${VISITANTE.apellido}` }).first());
  await p.waitForURL("**/responses/**", { timeout: 15000 });
  await pausa(1300);
  await rotulo(p, "Contact details, every answer, how urgent it is, and where she came from.", 3800);
  await mover(p, 720, 520, { esperar: 300 });
  await p.mouse.wheel(0, 320);
  await pausa(2200);

  // ---- 9. y los numeros ---------------------------------------------------
  await p.goto(`${APP}/analytics`, { waitUntil: "networkidle" });
  await rotulo(p, "And above all of it, the numbers.", 2600);
  await rotulo(p, "Which campaigns bring real requests, and which step people quit on.");
  await mover(p, 720, 500, { esperar: 400 });
  await p.mouse.wheel(0, 380);
  await pausa(3400);
  await p.mouse.wheel(0, 420);
  await pausa(3200);
  await rotulo(p, "");

  // ---- 10. cierre ---------------------------------------------------------
  await cerrarLocucion();
  anotarPlaca(23);
  await cartel("Right Lead", "Intake forms that don't lose the case");
  await pausa(VOZ.length ? VOZ[22] * 1000 + 700 : 3200);

  marcasFinales = marcas;
  video = await p.video().path();
  await ctx.close();
  await b.close();
  sitio.close();
} finally {
  await limpiar();
  await sql.end();
}

// Cuando entra cada una de las 23 frases en el video, para pegar el audio.
const entradas = [
  { n: 1, seg: marcasFinales[0].seg },
  ...linea.map((l, i) => ({ n: i + 2, seg: l.seg, texto: l.texto })),
  { n: 23, seg: marcasFinales[1].seg },
];
writeFileSync(`${SALIDA}/tiempos.json`, JSON.stringify(entradas, null, 2));
for (const e of entradas) console.log(`${String(e.n).padStart(2)}  ${e.seg.toFixed(1).padStart(6)}s  ${e.texto ?? "(placa)"}`);
console.log(video ?? "sin video");
