/**
 * El video del clip que se ve en la esquina del sitio, para la grabacion.
 *
 * Es un relleno: una placa con la marca del estudio, con un acercamiento lento
 * para que sea video y no una foto quieta. Lo que va ahi de verdad es el
 * abogado hablando a camara —eso es lo que hace que un clip sirva—, asi que
 * cuando haya una grabacion real, esto se reemplaza y listo.
 *
 * Se ve a unos 200 px de ancho, o sea a un cuarto del tamaño en que se
 * compone: por eso `clip-fondo.html` tiene todo enorme.
 *
 *   node demo/clip.mjs
 */
import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const NAVEGADOR = process.env.CHROMIUM || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const FFMPEG = process.env.FFMPEG || fileURLToPath(new URL("../node_modules/ffmpeg-static/ffmpeg", import.meta.url));
const AQUI = fileURLToPath(new URL(".", import.meta.url));
const SALIDA = `${AQUI}salida`;

mkdirSync(SALIDA, { recursive: true });

const b = await chromium.launch({ executablePath: NAVEGADOR });
const p = await (await b.newContext({ viewport: { width: 720, height: 1280 } })).newPage();
await p.goto(new URL("./clip-fondo.html", import.meta.url).href);
await p.waitForTimeout(400);
await p.screenshot({ path: `${SALIDA}/clip-fondo.png` });
await b.close();

execFileSync(FFMPEG, [
  "-hide_banner", "-loglevel", "error", "-y",
  "-loop", "1", "-i", `${SALIDA}/clip-fondo.png`, "-t", "9",
  "-vf", "zoompan=z='min(1.0+0.0011*on,1.11)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)'" +
         ":d=1:s=720x1280:fps=25,fade=t=in:d=0.5",
  "-c:v", "libvpx", "-b:v", "900k", "-an", `${SALIDA}/clip-demo.webm`,
], { stdio: "inherit" });

console.log(`listo: ${SALIDA}/clip-demo.webm`);
