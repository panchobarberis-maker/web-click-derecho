/**
 * Lista los avatares y las voces que tenes disponibles en HeyGen.
 *
 *     HEYGEN_API_KEY=... node demo/heygen-listar.mjs
 *     node demo/heygen-listar.mjs --voces bella      # filtra por nombre
 *
 * Para que no haya que elegir a ciegas mirando la galeria. Imprime el id de
 * cada uno —que es lo que despues se le pasa a la API— y el link de la
 * previsualizacion.
 *
 * En HeyGen el "look" no es una opcion del avatar: es el avatar. El mismo
 * personaje con otra ropa o en otro encuadre es otro avatar_id. Por eso esto
 * lista looks, no personas, y por eso vas a ver el mismo nombre repetido.
 *
 * La voz va aparte (voice_id) y se combina libre con cualquier look.
 *
 * La clave NO va en el codigo ni se pega en un chat: ponela en .env.local
 * (esta en el .gitignore) o pasala por el entorno al correr esto.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const RAIZ = resolve(import.meta.dirname, "..");
const BASE = "https://api.heygen.com";

/** Lee HEYGEN_API_KEY del entorno o de .env.local, sin traerse una libreria. */
function clave() {
  if (process.env.HEYGEN_API_KEY) return process.env.HEYGEN_API_KEY;
  try {
    const env = readFileSync(resolve(RAIZ, ".env.local"), "utf8");
    const m = env.match(/^\s*HEYGEN_API_KEY\s*=\s*"?([^"\n\r]+)"?/m);
    if (m) return m[1].trim();
  } catch {}
  console.error(`
No encontre la clave.

  1. Sacala en HeyGen (Settings → API).
  2. Agregala a .env.local en la raiz del proyecto:

       HEYGEN_API_KEY=la-clave

.env.local esta en el .gitignore, asi que no se sube. No la pegues en un chat
ni la escribas en un archivo del repositorio.
`);
  process.exit(1);
}

async function traer(ruta, api) {
  const r = await fetch(BASE + ruta, { headers: { "x-api-key": api, accept: "application/json" } });
  const texto = await r.text();
  if (!r.ok) {
    // El mensaje de HeyGen sirve mas que uno inventado por mi: si cambiaron el
    // endpoint o la clave no tiene permisos, lo dice la respuesta.
    throw new Error(`${ruta} → HTTP ${r.status}\n${texto.slice(0, 600)}`);
  }
  return JSON.parse(texto);
}

/** Las respuestas vienen envueltas de formas distintas segun la version. */
function lista(json, ...nombres) {
  const d = json?.data ?? json;
  for (const n of nombres) if (Array.isArray(d?.[n])) return d[n];
  if (Array.isArray(d)) return d;
  return null;
}

const corto = (s, n) => (!s ? "" : s.length <= n ? s.padEnd(n) : s.slice(0, n - 1) + "…");

async function main() {
  const api = clave();
  const filtro = (() => {
    const i = process.argv.findIndex((a) => a === "--voces" || a === "--avatares");
    return i === -1 ? null : { que: process.argv[i].slice(2), texto: (process.argv[i + 1] || "").toLowerCase() };
  })();

  const [av, vo] = await Promise.all([traer("/v2/avatars", api), traer("/v2/voices", api)]);

  let avatares = lista(av, "avatars");
  if (!avatares) {
    console.log("No reconoci la forma de /v2/avatars. Respuesta cruda:\n");
    console.log(JSON.stringify(av, null, 2).slice(0, 3000));
  } else {
    if (filtro?.que === "avatares") {
      avatares = avatares.filter((a) => JSON.stringify(a).toLowerCase().includes(filtro.texto));
    }
    console.log(`\n═══ LOOKS  (${avatares.length}) ═══`);
    console.log("Cada fila es un look distinto: el id es lo que se le pasa a la API.\n");
    for (const a of avatares) {
      const id = a.avatar_id ?? a.id ?? "?";
      console.log(`  ${corto(a.avatar_name ?? a.name ?? "", 34)}  ${corto(a.gender ?? "", 7)}  ${id}`);
      if (a.preview_video_url || a.preview_image_url) {
        console.log(`      ${a.preview_video_url ?? a.preview_image_url}`);
      }
    }
    const fotos = lista(av, "talking_photos");
    if (fotos?.length) console.log(`\n  (+ ${fotos.length} talking photos, foto fija animada)`);
  }

  let voces = lista(vo, "voices");
  if (!voces) {
    console.log("\nNo reconoci la forma de /v2/voices. Respuesta cruda:\n");
    console.log(JSON.stringify(vo, null, 2).slice(0, 2000));
  } else {
    if (filtro?.que === "voces") {
      voces = voces.filter((v) => JSON.stringify(v).toLowerCase().includes(filtro.texto));
    }
    // Sin filtro son cientos y no se lee nada; para el reel importan las de ingles.
    const mostrar = filtro ? voces : voces.filter((v) => (v.language ?? "").toLowerCase().includes("english"));
    console.log(`\n═══ VOCES  (${mostrar.length} de ${voces.length}${filtro ? "" : ", solo ingles — usá --voces <texto> para buscar otras"}) ═══\n`);
    for (const v of mostrar.slice(0, 60)) {
      const id = v.voice_id ?? v.id ?? "?";
      console.log(`  ${corto(v.name ?? "", 28)}  ${corto(v.gender ?? "", 7)}  ${corto(v.language ?? "", 20)}  ${id}`);
      if (v.preview_audio) console.log(`      ${v.preview_audio}`);
    }
    if (!filtro && mostrar.length > 60) console.log(`\n  … y ${mostrar.length - 60} mas. Filtrá con --voces <texto>.`);
  }

  console.log(`
Para el splitscreen conviene un look de pecho para arriba y con fondo liso: en
una franja de 1080x840 un plano de cuerpo entero deja la cara del tamaño de una
moneda, y un fondo con movimiento pelea con la app que va arriba.

Pasame el avatar_id y el voice_id que elijas —no son secretos— y sigo con eso.
`);
}

main().catch((e) => {
  console.error("\n" + e.message + "\n");
  process.exit(1);
});
