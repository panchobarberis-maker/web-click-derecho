/**
 * La capa que hace mirable una grabacion: un puntero y los subtitulos.
 *
 * Playwright no graba el cursor del sistema, asi que sin esto el video son
 * cosas que pasan solas y no se entiende quien las hace. El puntero es un
 * elemento de la pagina que movemos nosotros; el click de verdad lo sigue
 * haciendo el navegador en las mismas coordenadas.
 *
 * Todo vive en el marco de arriba. Si se dibujara tambien dentro del iframe
 * del formulario, apareceria un segundo puntero en cuanto el mouse entra ahi.
 */

export const CAPA = () => {
  if (window.top !== window) return;             // solo el marco de arriba

  // El script corre antes de que el documento exista, asi que dibujar aca
  // mismo tira y se pierde todo lo de abajo —incluidas las funciones que usa
  // el guion, que despues fallan sin decir nada porque las llamadas van con
  // catch. Se intenta poner la capa en cada uso y cuando el documento esta.
  const poner = () => {
    const raiz = document.body || document.documentElement;
    if (!raiz || document.getElementById("__demo")) return;
    const capa = document.createElement("div");
    capa.id = "__demo";
    capa.innerHTML = `
      <style>
        #__demo, #__demo * { pointer-events: none; }
        #__demo { position: fixed; inset: 0; z-index: 2147483647; font-synthesis: none; }
        #__cur {
          position: fixed; left: 0; top: 0; width: 24px; height: 30px;
          transition: transform .62s cubic-bezier(.33,.9,.28,1); opacity: 0;
          filter: drop-shadow(0 2px 4px rgba(0,0,0,.4));
        }
        #__cur.visible { opacity: 1; }
        #__ring {
          position: fixed; left: 0; top: 0; width: 26px; height: 26px; margin: -13px 0 0 -13px;
          border-radius: 50%; border: 2px solid rgba(28,20,12,.6); opacity: 0;
        }
        @keyframes __toque { from { opacity:.85; transform: scale(1) } to { opacity:0; transform: scale(2.6) } }
        #__ring.toca { animation: __toque .5s ease-out forwards; }
        #__rot {
          position: fixed; left: 50%; bottom: 18px; transform: translateX(-50%) translateY(10px);
          max-width: 78%; padding: .62rem 1.35rem; border-radius: 10px;
          background: rgba(24,17,10,.93); color: #fbf7f0;
          font: 500 18px/1.4 'Liberation Sans', Arial, sans-serif; text-align: center;
          letter-spacing: .002em; box-shadow: 0 10px 34px rgba(0,0,0,.34);
          opacity: 0; transition: opacity .34s ease, transform .34s ease;
        }
        #__rot.visible { opacity: 1; transform: translateX(-50%) translateY(0); }
        #__cartel {
          position: fixed; inset: 0; display: flex; flex-direction: column;
          align-items: center; justify-content: center; gap: .9rem;
          background: #faf6ef; opacity: 0; transition: opacity .5s ease;
        }
        #__cartel.visible { opacity: 1; }
        #__cartel .marca {
          font: 400 76px/1 'Liberation Serif', Georgia, serif; color: #3a2c1c; letter-spacing: -.01em;
        }
        #__cartel .bajada { font: 400 21px/1.5 'Liberation Sans', Arial, sans-serif; color: #7a6a56; }
      </style>
      <div id="__ring"></div>
      <div id="__cur"><svg viewBox="0 0 24 30" width="24" height="30">
        <path d="M2 1.6 L2 24 L7.6 18.6 L11.2 27.4 L14.9 25.8 L11.3 17.2 L19.2 17 Z"
              fill="#fff" stroke="#1c140c" stroke-width="1.7" stroke-linejoin="round"/>
      </svg></div>
      <div id="__rot"></div>
      <div id="__cartel"></div>`;
    raiz.appendChild(capa);
  };

  const $ = (id) => { poner(); return document.getElementById(id); };

  window.__mover = (x, y, instantaneo) => {
    const c = $("__cur");
    if (!c) return;
    if (instantaneo) {
      c.style.transition = "none";
      c.style.transform = `translate(${x}px, ${y}px)`;
      void c.offsetWidth;
      c.style.transition = "";
    } else {
      c.style.transform = `translate(${x}px, ${y}px)`;
    }
    c.classList.add("visible");
  };

  window.__toque = (x, y) => {
    const r = $("__ring");
    if (!r) return;
    r.style.transform = `translate(${x}px, ${y}px)`;
    r.classList.remove("toca");
    void r.offsetWidth;
    r.classList.add("toca");
  };

  window.__punteroFuera = () => $("__cur")?.classList.remove("visible");

  document.addEventListener("DOMContentLoaded", poner);
  if (document.readyState !== "loading") poner();

  window.__rotulo = (texto) => {
    const r = $("__rot");
    if (!r) return;
    if (!texto) return r.classList.remove("visible");
    // Cambiar el texto con el cartel arriba se lee como un parpadeo; si ya hay
    // uno puesto, primero se va.
    if (r.classList.contains("visible") && r.textContent !== texto) {
      r.classList.remove("visible");
      setTimeout(() => { r.textContent = texto; r.classList.add("visible"); }, 340);
    } else {
      r.textContent = texto;
      r.classList.add("visible");
    }
  };

  window.__cartel = (marca, bajada) => {
    const c = $("__cartel");
    if (!c) return;
    if (!marca) return c.classList.remove("visible");
    c.innerHTML = `<div class="marca">${marca}</div><div class="bajada">${bajada ?? ""}</div>`;
    c.classList.add("visible");
  };
};

// ------------------------------------------------------------------ acciones

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * En que segundo del video entra cada linea.
 *
 * Sirve para dos cosas: escribir el guion de la locucion con tiempos reales, y
 * despues volver a grabar ajustando las esperas a lo que dure cada audio.
 */
export const linea = [];
let t0 = 0;
export const arrancarReloj = () => { t0 = Date.now(); linea.length = 0; };
const anotar = (texto) => {
  if (texto) linea.push({ seg: (Date.now() - t0) / 1000, texto });
};

/**
 * Lo que dura cada frase de la locucion, en orden.
 *
 * Con esto el video sigue a la voz: ninguna escena se corta antes de que su
 * frase termine de decirse. Si las acciones de esa escena tardan mas, no pasa
 * nada —queda un silencio, que es lo normal en una demostracion—; si tardan
 * menos, la escena espera.
 */
let duraciones = [];
let desde = 0;
let cuantas = 0;
export const usarLocucion = (segundos) => { duraciones = segundos; cuantas = 0; };

/**
 * Lo que tarda en leerse un cartel.
 *
 * Sin locucion no hay nada que marque el ritmo y los carteles se pisaban: uno
 * de un segundo no se llega a leer. Se calcula por largo, con un piso.
 */
const leer = (texto) => Math.min(4600, Math.max(1700, 900 + texto.length * 45));

let ultimo = "";

/** Espera lo que le falte a la frase que esta sonando, o a que se lea el cartel. */
async function terminarFrase() {
  if (!cuantas && !ultimo) return;
  const cuanto = cuantas ? duraciones[cuantas - 1] * 1000 : leer(ultimo);
  const falta = cuanto - (Date.now() - desde);
  if (falta > 0) await dormir(falta);
}

/** Al final del guion, para que la ultima frase suene entera. */
export async function cerrarLocucion() {
  await terminarFrase();
  cuantas = 0;
}

/** Centro de un elemento, en coordenadas de la ventana de arriba. */
export async function centro(loc) {
  const c = await loc.boundingBox();
  if (!c) throw new Error("no se ve el elemento que hay que tocar");
  return { x: Math.round(c.x + c.width / 2), y: Math.round(c.y + c.height / 2) };
}

export async function rotulo(page, texto, ms = 0) {
  // El cartel anterior tiene que haberse podido leer —o su frase haber
  // terminado de sonar— antes de cambiarlo.
  await terminarFrase();
  if (texto) {
    desde = Date.now();
    ultimo = texto;
    if (duraciones.length) cuantas++;
  } else {
    ultimo = "";
  }
  anotar(texto);
  await page.evaluate((t) => window.__rotulo?.(t), texto).catch(() => {});
  if (ms) await dormir(ms);
}

export async function mover(page, x, y, { esperar = 700 } = {}) {
  await page.evaluate(([a, b]) => window.__mover?.(a, b), [x, y]).catch(() => {});
  await page.mouse.move(x, y, { steps: 12 });
  await dormir(esperar);
}

/** Va hasta el elemento, lo toca, y se ve el recorrido. */
export async function tocar(page, loc, { antes = 640, despues = 620 } = {}) {
  await loc.scrollIntoViewIfNeeded().catch(() => {});
  const { x, y } = await centro(loc);
  await mover(page, x, y, { esperar: antes });
  await page.evaluate(([a, b]) => window.__toque?.(a, b), [x, y]).catch(() => {});
  await page.mouse.click(x, y);
  await dormir(despues);
}

/** Escribe letra por letra: de un saque parece un autocompletado. */
export async function escribir(page, loc, texto, { ms = 55 } = {}) {
  const { x, y } = await centro(loc);
  await mover(page, x, y, { esperar: 380 });
  await page.evaluate(([a, b]) => window.__toque?.(a, b), [x, y]).catch(() => {});
  await loc.click();
  await loc.pressSequentially(texto, { delay: ms });
  await dormir(280);
}

export const pausa = dormir;
