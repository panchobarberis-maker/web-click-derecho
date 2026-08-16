/**
 * El video del clip que se ve en la esquina del sitio durante la grabacion.
 *
 * Lo que va ahi es **un abogado hablando de su estudio**: es lo unico que hace
 * que un clip funcione, y una placa con la marca no lo reemplaza. Asi que este
 * script usa la grabacion real si esta, y solo fabrica un relleno si no hay.
 *
 * Para usar una de verdad, dejar el archivo en `demo/clip-abogado.mp4` (o .mov,
 * .webm) y volver a correr esto. No hay que tocar nada mas.
 *
 * El Chromium con el que se graba no reproduce H.264, asi que lo que venga se
 * pasa a webm igual: en un navegador de verdad el mp4 anda, pero en la
 * grabacion se veria un cuadro negro y el clip del video quedaria vacio.
 *
 *   node demo/clip.mjs
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const NAVEGADOR = process.env.CHROMIUM || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const FFMPEG = process.env.FFMPEG || fileURLToPath(new URL("../node_modules/ffmpeg-static/ffmpeg", import.meta.url));
const AQUI = fileURLToPath(new URL(".", import.meta.url));
const SALIDA = `${AQUI}salida`;
const DESTINO = `${SALIDA}/clip-demo.webm`;

mkdirSync(SALIDA, { recursive: true });

const ff = (args) => execFileSync(FFMPEG, ["-hide_banner", "-loglevel", "error", "-y", ...args], { stdio: "inherit" });

/** La grabacion del abogado, si la hay. */
const real = ["mp4", "mov", "webm", "m4v"]
  .map((ext) => `${AQUI}clip-abogado.${ext}`)
  .find(existsSync);

if (real) {
  // Se recorta a vertical por si viene apaisado: el clip se ve en una tarjeta
  // 9:16 y un video ancho quedaria con bandas o deformado.
  ff(["-i", real,
      "-vf", "scale=720:1280:force_original_aspect_ratio=increase,crop=720:1280,fps=25",
      "-c:v", "libvpx", "-b:v", "1200k", "-an", DESTINO]);
  console.log(`clip del abogado: ${real} → ${DESTINO}`);
} else {
  const b = await chromium.launch({ executablePath: NAVEGADOR });
  const p = await (await b.newContext({ viewport: { width: 720, height: 1280 } })).newPage();
  await p.goto(new URL("./clip-fondo.html", import.meta.url).href);
  await p.waitForTimeout(400);
  await p.screenshot({ path: `${SALIDA}/clip-fondo.png` });
  await b.close();

  ff(["-loop", "1", "-i", `${SALIDA}/clip-fondo.png`, "-t", "9",
      "-vf", "zoompan=z='min(1.0+0.0011*on,1.11)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)'" +
             ":d=1:s=720x1280:fps=25,fade=t=in:d=0.5",
      "-c:v", "libvpx", "-b:v", "900k", "-an", DESTINO]);

  console.log(`relleno: ${DESTINO}`);
  console.log("\n  ⚠  No hay grabacion del abogado, se uso una placa con la marca.");
  console.log("     Un clip funciona porque se ve la cara de quien habla.");
  console.log("     Dejá el video en demo/clip-abogado.mp4 y volvé a correr esto.\n");
}
