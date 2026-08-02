import { baseUrl } from "@/lib/base-url";
import { sql } from "@/lib/db";

export const dynamic = "force-dynamic";

type Cfg = {
  firm: string; mode: string; funnel: string; workflow: string;
  trigger: string; cta: string; accent: string; video: string; poster: string; id: string;
  paginas: string;
  autoplay: boolean;
  preview: boolean;
};

const VACIO: Cfg = { firm: "", mode: "", funnel: "", workflow: "", trigger: "", cta: "", accent: "", video: "", poster: "", id: "", paginas: "", autoplay: true, preview: false };

/**
 * Configuracion guardada de un pop-up o un clip.
 *
 * El sitio del estudio solo lleva el id; todo lo demas sale de la base. Asi
 * cambiar el disparador o el texto no obliga a volver a pegar el snippet, y
 * cada visita queda atribuida a ese pop-up o clip concreto.
 */
async function cargarCfg(url: URL): Promise<Cfg> {
  const popup = url.searchParams.get("popup");
  const clip = url.searchParams.get("clip");
  if (!popup && !clip) return VACIO;

  const tabla = popup ? "popups" : "clips";
  const id = popup ?? clip!;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return VACIO;

  const [row] = await sql<
    { name: string; cta: string; active: boolean; accent: string; firm: string;
      funnel: string | null; workflow: string | null; trigger?: string; video_url?: string; poster_url?: string;
      paginas?: string | null; autoplay?: boolean }[]
  >`
    select w.*, fi.slug as firm, fi.accent,
           f.slug as funnel, wf.slug as workflow
    from ${sql(tabla)} w
    join firms fi on fi.id = w.firm_id
    left join funnels f on f.id = w.funnel_id
    left join workflows wf on wf.id = w.workflow_id
    where w.id = ${id}`;

  if (!row || !row.active) return VACIO;

  return {
    firm: row.firm,
    mode: popup ? (row.trigger === "button" ? "button" : "popup") : "clip",
    funnel: row.funnel ?? "",
    workflow: row.workflow ?? "",
    trigger: row.trigger ?? "delay:12",
    cta: row.cta,
    accent: row.accent,
    video: row.video_url ?? "",
    poster: row.poster_url ?? "",
    paginas: row.paginas ?? "",
    autoplay: row.autoplay !== false,
    preview: url.searchParams.get("preview") === "1",
    id,
  };
}

/**
 * Widget embebible. El estudio pega una sola linea en su sitio:
 *
 *   <script src="https://app.tudominio.com/w.js"
 *           data-firm="alzogaray-serrano"
 *           data-mode="popup"
 *           data-trigger="delay:10"></script>
 *
 * Va todo dentro de un iframe a proposito: aisla el CSS del sitio del estudio,
 * que es de donde sale casi todo el soporte en este tipo de widgets.
 *
 * El widget es ademas el unico que puede ver la atribucion real: desde adentro
 * del iframe el referrer es el sitio del estudio. Por eso lee los utm_* y el
 * referrer de la pagina madre y los reenvia en la URL del iframe.
 */
export async function GET(req: Request) {
  const origin = baseUrl() || new URL(req.url).origin;
  const cfg = await cargarCfg(new URL(req.url));

  const js = `(function () {
  "use strict";
  var ORIGIN = ${JSON.stringify(origin)};
  var CFG = ${JSON.stringify(cfg)};
  var s = document.currentScript;
  if (!s) return;

  // Los atributos del <script> pisan lo guardado en el panel.
  var attr = function (n, def) { return s.getAttribute("data-" + n) || CFG[n] || def; };

  var firm = attr("firm", "");
  if (!firm) return console.error("[intake] falta data-firm o un pop-up/clip valido");

  var mode    = attr("mode", "popup");        // popup | inline | button | clip
  var funnel  = attr("funnel", "");
  var flow    = attr("workflow", "");
  var trigger = attr("trigger", "delay:12");  // delay:N | scroll:N | exit | now
  var cta     = attr("cta", "Consultá tu caso");
  var accent  = attr("accent", "#2d0a4e");
  var target  = s.getAttribute("data-target") || "";
  var video   = attr("video", "");
  var poster  = attr("poster", "");
  var wid     = CFG.id || "";
  var once    = s.getAttribute("data-once") !== "false";
  var paginas = CFG.paginas || "";
  var arranca = s.getAttribute("data-autoplay") !== "false" && CFG.autoplay !== false;
  // En la vista previa del panel el formulario no registra visitas: si no,
  // probar un pop-up le ensuciaria las estadisticas al estudio.
  var vistaPrevia = CFG.preview === true;

  /**
   * En que paginas del sitio del estudio corresponde mostrarse.
   *
   * Una regla por linea, contra la ruta de la pagina. El * es comodin y una
   * linea que arranca con ! excluye. Sin reglas, en todas —que es como venia
   * funcionando y no queremos cambiarselo a quien ya lo tiene puesto.
   *
   * Excluir gana sobre incluir: es lo que uno espera al escribir "en todo el
   * sitio menos /contacto", y es el lado seguro si las dos listas se pisan.
   */
  function correspondeAca() {
    var lineas = paginas.split("\\n").map(function (l) { return l.trim(); })
                        .filter(function (l) { return l.length > 0; });
    if (!lineas.length) return true;

    var ruta = location.pathname.replace(/\\/+$/, "") || "/";

    // Comparacion literal por tramos en vez de armar una expresion regular:
    // una ruta puede traer parentesis, puntos o signos de pregunta, y escapar
    // todo eso a mano para meterlo en un regex es de donde salen los bugs.
    function coincide(regla) {
      var r = regla.replace(/\\/+$/, "") || "/";
      // Aceptamos que peguen la URL entera; nos quedamos con la ruta.
      if (/^https?:/i.test(r)) { try { r = new URL(r).pathname.replace(/\\/+$/, "") || "/"; } catch (e) {} }
      if (r.charAt(0) !== "/") r = "/" + r;

      var partes = r.split("*");
      if (partes.length === 1) return ruta === r;
      if (ruta.indexOf(partes[0]) !== 0) return false;

      var pos = partes[0].length;
      for (var i = 1; i < partes.length - 1; i++) {
        var idx = ruta.indexOf(partes[i], pos);
        if (idx < 0) return false;
        pos = idx + partes[i].length;
      }
      var ult = partes[partes.length - 1];
      return ruta.length - pos >= ult.length &&
             ruta.lastIndexOf(ult) === ruta.length - ult.length;
    }

    var incluir = [], excluir = [];
    for (var i = 0; i < lineas.length; i++) {
      if (lineas[i].charAt(0) === "!") excluir.push(lineas[i].slice(1).trim());
      else incluir.push(lineas[i]);
    }

    for (var j = 0; j < excluir.length; j++) if (coincide(excluir[j])) return false;
    if (!incluir.length) return true;
    for (var k = 0; k < incluir.length; k++) if (coincide(incluir[k])) return true;
    return false;
  }

  if (!correspondeAca()) return;
  var KEY     = "intake:popup:" + firm;
  var ATTR    = "intake:attr:" + firm;

  var ATTR_KEYS = ["utm_source","utm_medium","utm_campaign","utm_content","utm_term",
                   "gclid","fbclid","ttclid","msclkid"];

  /**
   * Atribucion de la pagina madre. Se guarda en el primer aterrizaje: si la
   * persona llega desde Instagram, navega tres paginas y recien ahi abre el
   * form, el origen sigue siendo Instagram.
   */
  function attribution() {
    var qs = new URLSearchParams(location.search);
    var found = {};
    for (var i = 0; i < ATTR_KEYS.length; i++) {
      var v = qs.get(ATTR_KEYS[i]);
      if (v) found[ATTR_KEYS[i]] = v;
    }

    var ref = document.referrer || "";
    var mismoSitio = false;
    try { mismoSitio = !!ref && new URL(ref).hostname === location.hostname; } catch (e) {}

    var fresh = Object.keys(found).length > 0 || (ref && !mismoSitio);
    if (fresh) {
      var data = { utm: found, ref: ref, lp: location.href, t: Date.now() };
      try { sessionStorage.setItem(ATTR, JSON.stringify(data)); } catch (e) {}
      return data;
    }

    try {
      var saved = JSON.parse(sessionStorage.getItem(ATTR) || "null");
      if (saved) return saved;
    } catch (e) {}

    return { utm: {}, ref: ref, lp: location.href };
  }

  function url(surface) {
    var a = attribution();
    var p = "/f/" + firm + (funnel ? "/" + funnel : "") + (funnel && flow ? "/" + flow : "");
    var q = new URLSearchParams();
    q.set("surface", surface);
    if (wid) q.set("sid", wid);
    if (vistaPrevia) q.set("preview", "1");
    for (var k in a.utm) if (Object.prototype.hasOwnProperty.call(a.utm, k)) q.set(k, a.utm[k]);
    if (a.ref) q.set("ref", a.ref);
    if (a.lp) q.set("lp", a.lp);
    return ORIGIN + p + "?" + q.toString();
  }

  function frame(surface) {
    var f = document.createElement("iframe");
    f.src = url(surface);
    f.title = "Formulario de consulta";
    f.loading = "lazy";
    f.style.cssText = "width:100%;height:100%;border:0;display:block;background:#f7f5f2";
    return f;
  }

  // ---------- inline: el form embebido en la pagina ----------
  if (mode === "inline") {
    var host = target ? document.querySelector(target) : null;
    var box = document.createElement("div");
    box.style.cssText = "width:100%;height:640px;max-width:640px;margin:0 auto;border-radius:16px;overflow:hidden;border:1px solid rgba(0,0,0,.08)";
    box.appendChild(frame("page"));
    if (host) host.appendChild(box);
    else s.parentNode.insertBefore(box, s);
    return;
  }

  // ---------- popup ----------
  var overlay, opened = false, surfaceActual = "popup";

  function open(surface) {
    if (opened) return;
    opened = true;
    surfaceActual = surface || "popup";
    try { if (once) sessionStorage.setItem(KEY, "1"); } catch (e) {}

    overlay = document.createElement("div");
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.style.cssText =
      "position:fixed;inset:0;z-index:2147483000;background:rgba(20,12,34,.55);" +
      "display:flex;align-items:center;justify-content:center;padding:20px;opacity:0;transition:opacity .2s";

    var panel = document.createElement("div");
    panel.style.cssText =
      "position:relative;width:100%;max-width:920px;height:min(90vh,760px);background:#f7f5f2;" +
      "border-radius:16px;overflow:hidden;box-shadow:0 24px 60px rgba(0,0,0,.3);transform:translateY(12px);transition:transform .25s";

    var close = document.createElement("button");
    close.innerHTML = "&times;";
    close.setAttribute("aria-label", "Cerrar");
    close.style.cssText =
      "position:absolute;top:12px;right:14px;z-index:2;width:32px;height:32px;border:0;border-radius:50%;" +
      "background:rgba(255,255,255,.92);color:#1c1230;font-size:22px;line-height:1;cursor:pointer;box-shadow:0 1px 4px rgba(0,0,0,.15)";
    close.onclick = shut;

    panel.appendChild(close);
    panel.appendChild(frame(surfaceActual));
    overlay.appendChild(panel);
    overlay.onclick = function (e) { if (e.target === overlay) shut(); };
    document.body.appendChild(overlay);
    document.body.style.overflow = "hidden";

    requestAnimationFrame(function () {
      overlay.style.opacity = "1";
      panel.style.transform = "translateY(0)";
    });
  }

  function shut() {
    if (!overlay) return;
    overlay.remove();
    overlay = null;
    opened = false;
    document.body.style.overflow = "";
  }

  document.addEventListener("keydown", function (e) { if (e.key === "Escape") shut(); });

  // Cerrar solo despues de enviar, dandole tiempo a leer el mensaje de exito.
  window.addEventListener("message", function (e) {
    if (e.origin !== ORIGIN || !e.data) return;
    if (e.data.type === "intake:submit") setTimeout(shut, 3500);
  });

  // ---------- clip: video corto en una esquina que lleva al form ----------
  if (mode === "clip") {
    if (!video) return console.error("[intake] el modo clip necesita data-video");

    var card = document.createElement("div");
    card.style.cssText =
      "position:fixed;right:20px;bottom:20px;z-index:2147482000;width:230px;border-radius:14px;" +
      "overflow:hidden;background:#000;box-shadow:0 10px 34px rgba(0,0,0,.28);font:400 14px/1.3 system-ui,sans-serif";

    var v = document.createElement("video");
    v.src = video;
    if (poster) v.poster = poster;
    // Siempre silenciado: ningun navegador deja autoreproducir con sonido, y
    // un video que suena sin permiso hace cerrar la pestaña.
    v.muted = true; v.loop = true; v.playsInline = true;
    v.setAttribute("muted", ""); v.setAttribute("playsinline", "");
    v.style.cssText = "width:100%;height:306px;object-fit:cover;display:block;cursor:pointer";
    v.onclick = function () { open("clip"); };

    if (arranca) {
      v.autoplay = true;
      v.play().catch(function () { /* si el navegador lo bloquea queda el poster */ });
    } else {
      // Sin autoplay no se baja el video hasta que lo tocan: se ve la portada
      // y recien al darle play empieza la descarga. Es la diferencia entre
      // pagar ancho de banda por cada visita o solo por quien se interesa.
      v.preload = "none";
      v.setAttribute("preload", "none");
    }

    var bar = document.createElement("div");
    bar.style.cssText = "position:absolute;top:8px;left:8px;right:8px;display:flex;gap:6px;align-items:center";

    function chip(label, aria, fn) {
      var btn = document.createElement("button");
      btn.innerHTML = label;
      btn.setAttribute("aria-label", aria);
      btn.style.cssText =
        "width:26px;height:26px;border:0;border-radius:50%;background:rgba(0,0,0,.45);color:#fff;" +
        "font-size:13px;line-height:1;cursor:pointer;display:grid;place-items:center;flex:none";
      btn.onclick = fn;
      return btn;
    }

    var play = chip("&#10073;&#10073;", "Pausar", function () {
      if (v.paused) { v.play(); play.innerHTML = "&#10073;&#10073;"; play.setAttribute("aria-label", "Pausar"); }
      else { v.pause(); play.innerHTML = "&#9654;"; play.setAttribute("aria-label", "Reproducir"); }
    });
    var sound = chip("&#128263;", "Activar sonido", function () {
      v.muted = !v.muted;
      sound.innerHTML = v.muted ? "&#128263;" : "&#128266;";
      sound.setAttribute("aria-label", v.muted ? "Activar sonido" : "Silenciar");
    });
    var hide = chip("&times;", "Cerrar el video", function () { card.remove(); });
    hide.style.marginLeft = "auto";

    bar.appendChild(play);
    bar.appendChild(chip("&#8635;", "Volver a empezar", function () { v.currentTime = 0; v.play(); }));
    bar.appendChild(sound);
    bar.appendChild(hide);

    var go = document.createElement("button");
    go.textContent = cta;
    go.style.cssText =
      "display:block;width:100%;border:0;background:" + accent + ";color:#fff;padding:12px;" +
      "font:500 14px/1 system-ui,sans-serif;cursor:pointer";
    go.onclick = function () { open("clip"); };

    card.appendChild(v);
    card.appendChild(bar);
    card.appendChild(go);
    document.body.appendChild(card);
    return;
  }

  // ---------- boton flotante ----------
  if (mode === "button") {
    var btn = document.createElement("button");
    btn.textContent = cta;
    btn.style.cssText =
      "position:fixed;right:20px;bottom:20px;z-index:2147482000;background:" + accent + ";color:#fff;border:0;" +
      "padding:14px 26px;border-radius:99px;font:500 15px/1 system-ui,sans-serif;cursor:pointer;box-shadow:0 6px 20px rgba(0,0,0,.22)";
    btn.onclick = function () { open("popup"); };
    document.body.appendChild(btn);
    return;
  }

  try { if (once && sessionStorage.getItem(KEY)) return; } catch (e) {}

  var kind = trigger.split(":")[0];
  var arg = parseFloat(trigger.split(":")[1] || "0");

  if (kind === "now") open("popup");
  else if (kind === "delay") setTimeout(function () { open("popup"); }, (arg || 12) * 1000);
  else if (kind === "scroll") {
    var onScroll = function () {
      var h = document.documentElement;
      var pct = (h.scrollTop / (h.scrollHeight - h.clientHeight || 1)) * 100;
      if (pct >= (arg || 50)) { open("popup"); window.removeEventListener("scroll", onScroll); }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
  } else if (kind === "exit") {
    var onOut = function (e) {
      if (e.clientY <= 0) { open("popup"); document.removeEventListener("mouseout", onOut); }
    };
    document.addEventListener("mouseout", onOut);
    // En mobile no hay exit intent: se cae a un delay largo.
    if (matchMedia("(pointer:coarse)").matches) setTimeout(function () { open("popup"); }, 25000);
  }
})();`;

  return new Response(js, {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      // El script lleva adentro la configuracion del widget, asi que el cache
      // es tambien el retraso con el que se ve un cambio hecho en el panel.
      // Un minuto de cache firme y cinco de reuso mientras se revalida: el
      // sitio del estudio no paga la ida al servidor en cada visita, y quien
      // cambia una regla la ve aplicada en el proximo minuto y no en cinco.
      "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
