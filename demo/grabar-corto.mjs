/**
 * La version de un minuto.
 *
 * La larga cuenta una historia completa; esta tiene que mostrar el producto.
 * Cambia lo que se ve: entran los clips y las pantallas de pop-ups y clips
 * —que son funciones del producto y en la larga no aparecian— y se destaca de
 * donde vino cada consulta. Y cambia el ritmo: nada dura mas de lo necesario.
 *
 * El recorrido de abandono y recuperacion se cuenta en tres escenas en vez de
 * ocho: se va, queda en el panel, le sale el mail. Que vuelva y termine se da
 * por entendido.
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

const VOZ = (() => {
  try {
    return JSON.parse(readFileSync(`${SALIDA}/segmentos-corto.json`, "utf8")).map((s) => s.dura);
  } catch {
    return [];
  }
})();

const sql = postgres(/^DATABASE_URL=(.+)$/m.exec(readFileSync(new URL("../.env.local", import.meta.url), "utf8"))[1].trim(), { onnotice: () => {} });

const VISITANTE = {
  nombre: "Marina", apellido: "Cabrera",
  email: "marina.cabrera@gmail.com", tel: "(614) 555-0142", estado: "Ohio",
};

const [firm] = await sql`select id, accent from firms where slug = ${ESTUDIO.slug}`;
if (!firm) throw new Error("falta el estudio de demostración: corré estudio-en.mjs");

// La grabacion no crea widgets de descarte: usa los del estudio y les cambia
// lo justo —el disparador, para no esperar doce segundos en camara, y la
// direccion del video, que apunta al archivo local— y despues los deja como
// estaban. Asi la pantalla de Pop-ups muestra los de verdad, con sus numeros.
const [pop] = await sql`
  select id, trigger from popups where firm_id = ${firm.id} and active order by created_at limit 1`;
const [clip] = await sql`
  select id, video_url from clips where firm_id = ${firm.id} and active order by created_at limit 1`;
if (!pop || !clip) throw new Error("el estudio de demostración no tiene pop-ups ni clips");

const limpiar = async () => {
  await sql`delete from sessions where email = ${VISITANTE.email}`;
  await sql`update popups set trigger = ${pop.trigger} where id = ${pop.id}`;
  await sql`update clips set video_url = ${clip.video_url} where id = ${clip.id}`;
};
for (const s of ["SIGINT", "SIGTERM"]) process.on(s, async () => { await limpiar(); process.exit(1); });

let video;
let marcasFinales = [];
try {
  await limpiar();
  await sql`update popups set trigger = 'delay:2' where id = ${pop.id}`;
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

  // ---- 1. el pop-up en el sitio del estudio -------------------------------
  await p.goto(`${SITIO}/`, { waitUntil: "domcontentloaded" });
  anotarPlaca(1);
  await cartel("Right Lead", "Turn the visits you already pay for into signed cases");
  await pausa(VOZ.length ? VOZ[0] * 1000 + 300 : 2200);
  await cartel(null);

  await rotulo(p, "One line of code on the firm's site.");
  await p.locator('div[role="dialog"]').waitFor({ timeout: 20000 });
  await pausa(900);

  // ---- 2. el formulario se adapta -----------------------------------------
  await rotulo(p, "The form asks what the case is about…");
  await tocar(p, marco().locator(".pill-btn", { hasText: "Employment Law" }), rapido);
  await tocar(p, marco().locator(".pill-btn", { hasText: "Workplace injury" }), rapido);
  await marco().locator("#f-first_name").waitFor({ timeout: 15000 });

  await rotulo(p, "…then asks only what that case needs.");
  await escribir(p, marco().locator("#f-first_name"), VISITANTE.nombre, { ms: 20 });
  await escribir(p, marco().locator("#f-email"), VISITANTE.email, { ms: 20 });
  await escribir(p, marco().locator("#f-last_name"), VISITANTE.apellido, { ms: 20 });
  await marco().locator("#f-phone").fill(VISITANTE.tel);
  await marco().locator("#f-provincia").selectOption(VISITANTE.estado);
  await tocar(p, marco().locator(".fcheck"), { antes: 260, despues: 200 });
  await tocar(p, marco().locator(".fbtn", { hasText: "Continue" }), rapido);
  await marco().locator("#f-lesion").waitFor({ timeout: 15000 });

  // ---- 3. se va, ya con el mail guardado ----------------------------------
  await rotulo(p, "Then she leaves. Most people do.");
  await tocar(p, p.locator('div[role="dialog"] button[aria-label]').first(), rapido);
  await p.evaluate(() => window.__punteroFuera?.());
  await pausa(600);

  // ---- 4. pero quedo en el panel ------------------------------------------
  await p.goto(`${APP}/login`, { waitUntil: "domcontentloaded" });
  await p.fill("#email", ESTUDIO.usuario);
  await p.fill("#password", "rightlead2026");
  await p.click('button[type="submit"]');
  await p.waitForURL((u) => new URL(u).pathname === "/panel", { timeout: 20000 });
  await p.goto(`${APP}/responses?tab=abandonadas`, { waitUntil: "networkidle" });
  await rotulo(p, "You still have her — and where she stopped.");
  await pausa(1800);

  // ---- 5. el recordatorio -------------------------------------------------
  const fila = p.locator("tr", { hasText: VISITANTE.email });
  await rotulo(p, "A reminder goes out on its own.");
  await tocar(p, fila.locator("button", { hasText: "Send a reminder" }), rapido);
  await pausa(900);

  const [ses] = await sql`
    select s.id, s.full_name, f.name as area, f.slug as area_slug, w.slug as caso_slug
    from sessions s
    left join funnels f on f.id = s.funnel_id
    left join workflows w on w.id = s.workflow_id
    where s.email = ${VISITANTE.email} order by s.created_at desc limit 1`;
  mailHtml = recoveryEmail({
    name: ses.full_name, firm: ESTUDIO.name, accent: firm.accent, area: ses.area,
    url: `${APP}/f/${ESTUDIO.slug}/${ses.area_slug}/${ses.caso_slug}?retomar=${ses.id}`, lang: "en",
  }).html;
  await p.goto(`${SITIO}/mail`, { waitUntil: "networkidle" });
  await pausa(1600);

  // ---- 6. vuelve y termina, en tres movimientos ---------------------------
  await rotulo(p, "It puts her back exactly where she left off.");
  await tocar(p, p.locator("a", { hasText: "Finish my request" }), veloz);
  await p.waitForURL("**/f/**", { timeout: 20000 });
  await p.locator("#f-lesion").waitFor({ timeout: 20000 });
  await p.locator("#f-lesion").fill("Fractured wrist");
  await p.locator("#f-fecha").fill("2026-07-28");
  await tocar(p, p.locator(".fradios label", { hasText: "Yes, in writing" }), veloz);
  await tocar(p, p.locator(".fbtn", { hasText: "Continue" }), veloz);
  await tocar(p, p.locator(".fradios label", { hasText: "Still in treatment" }), veloz);
  await tocar(p, p.locator(".fbtn", { hasText: "Continue" }), veloz);
  await p.locator("#f-relato").fill("I fell off a ladder in the warehouse.");
  await tocar(p, p.locator(".fradios label", { hasText: "Urgent" }), veloz);
  await tocar(p, p.locator(".fradios label", { hasText: "Phone call" }), veloz);
  await tocar(p, p.locator(".fbtn", { hasText: "Send my request" }), veloz);
  await p.locator(".fdone").waitFor({ timeout: 20000 });
  await pausa(700);

  // ---- 7. la consulta, y de donde vino ------------------------------------
  await p.goto(`${APP}/responses`, { waitUntil: "networkidle" });
  await tocar(p, p.locator("a", { hasText: `${VISITANTE.nombre} ${VISITANTE.apellido}` }).first(), rapido);
  await p.waitForURL("**/responses/**", { timeout: 15000 });
  await rotulo(p, "The request lands complete…");
  await pausa(1400);
  // La ficha de la derecha es lo que hay que mirar: origen, superficie y pagina.
  await rotulo(p, "…and it says where the lead came from.");
  await mover(p, 1090, 300, { esperar: 500 });
  await mover(p, 1090, 470, { esperar: 1800 });

  // ---- 8. los pop-ups son una funcion, no un detalle ----------------------
  await p.goto(`${APP}/popups`, { waitUntil: "networkidle" });
  await rotulo(p, "Every pop-up and clip has its own code, and its own numbers.");
  await mover(p, 800, 210, { esperar: 2400 });

  // ---- 9. y los clips -----------------------------------------------------
  await p.goto(`${SITIO}/?w=clip=${clip.id}`, { waitUntil: "domcontentloaded" });
  await rotulo(p, "The same form inside a video clip, pinned to a corner.");
  await p.locator("video").waitFor({ timeout: 20000 });
  await pausa(2600);
  await tocar(p, p.locator("video"), { antes: 400, despues: 900 });
  await rotulo(p, "It opens the same intake.");
  await pausa(1400);

  // ---- 10. los numeros ----------------------------------------------------
  await p.goto(`${APP}/analytics`, { waitUntil: "networkidle" });
  await mover(p, 720, 500, { esperar: 200 });
  await p.mouse.wheel(0, 700);
  await pausa(500);
  await rotulo(p, "Which campaign brings cases, not clicks.");
  await pausa(2300);
  await p.mouse.wheel(0, -430);
  await pausa(400);
  await rotulo(p, "And the step where people quit.");
  await pausa(1900);
  await rotulo(p, "");

  // ---- 11. cierre ---------------------------------------------------------
  await cerrarLocucion();
  anotarPlaca(23);
  await cartel("Right Lead", "Intake forms that don't lose the case");
  await pausa(VOZ.length ? VOZ[VOZ.length - 1] * 1000 + 600 : 2600);

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
