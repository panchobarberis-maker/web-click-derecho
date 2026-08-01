export const dynamic = "force-dynamic";

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
 */
export async function GET(req: Request) {
  const origin = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin;

  const js = `(function () {
  "use strict";
  var ORIGIN = ${JSON.stringify(origin)};
  var s = document.currentScript;
  if (!s) return;

  var firm = s.getAttribute("data-firm");
  if (!firm) return console.error("[intake] falta data-firm");

  var mode    = s.getAttribute("data-mode") || "popup";        // popup | inline | button
  var funnel  = s.getAttribute("data-funnel") || "";
  var flow    = s.getAttribute("data-workflow") || "";
  var trigger = s.getAttribute("data-trigger") || "delay:12";  // delay:N | scroll:N | exit | now
  var cta     = s.getAttribute("data-cta") || "Consultá tu caso";
  var accent  = s.getAttribute("data-accent") || "#2d0a4e";
  var target  = s.getAttribute("data-target") || "";
  var once    = s.getAttribute("data-once") !== "false";
  var KEY     = "intake:popup:" + firm;

  function url(surface) {
    var p = "/f/" + firm + (funnel ? "/" + funnel : "") + (funnel && flow ? "/" + flow : "");
    return ORIGIN + p + "?surface=" + surface;
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

  // ---------- popup / button ----------
  var overlay, opened = false;

  function open() {
    if (opened) return;
    opened = true;
    try { if (once) sessionStorage.setItem(KEY, "1"); } catch (e) {}

    overlay = document.createElement("div");
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.style.cssText =
      "position:fixed;inset:0;z-index:2147483000;background:rgba(20,12,34,.55);" +
      "display:flex;align-items:center;justify-content:center;padding:20px;opacity:0;transition:opacity .2s";

    var panel = document.createElement("div");
    panel.style.cssText =
      "position:relative;width:100%;max-width:600px;height:min(88vh,720px);background:#f7f5f2;" +
      "border-radius:16px;overflow:hidden;box-shadow:0 24px 60px rgba(0,0,0,.3);transform:translateY(12px);transition:transform .25s";

    var close = document.createElement("button");
    close.innerHTML = "&times;";
    close.setAttribute("aria-label", "Cerrar");
    close.style.cssText =
      "position:absolute;top:12px;right:14px;z-index:2;width:32px;height:32px;border:0;border-radius:50%;" +
      "background:rgba(255,255,255,.92);color:#1c1230;font-size:22px;line-height:1;cursor:pointer;box-shadow:0 1px 4px rgba(0,0,0,.15)";
    close.onclick = shut;

    panel.appendChild(close);
    panel.appendChild(frame("popup"));
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

  if (mode === "button") {
    var btn = document.createElement("button");
    btn.textContent = cta;
    btn.style.cssText =
      "position:fixed;right:20px;bottom:20px;z-index:2147482000;background:" + accent + ";color:#fff;border:0;" +
      "padding:14px 26px;border-radius:99px;font:500 15px/1 system-ui,sans-serif;cursor:pointer;box-shadow:0 6px 20px rgba(0,0,0,.22)";
    btn.onclick = open;
    document.body.appendChild(btn);
    return;
  }

  try { if (once && sessionStorage.getItem(KEY)) return; } catch (e) {}

  var kind = trigger.split(":")[0];
  var arg = parseFloat(trigger.split(":")[1] || "0");

  if (kind === "now") open();
  else if (kind === "delay") setTimeout(open, (arg || 12) * 1000);
  else if (kind === "scroll") {
    var onScroll = function () {
      var h = document.documentElement;
      var pct = (h.scrollTop / (h.scrollHeight - h.clientHeight || 1)) * 100;
      if (pct >= (arg || 50)) { open(); window.removeEventListener("scroll", onScroll); }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
  } else if (kind === "exit") {
    var onOut = function (e) {
      if (e.clientY <= 0) { open(); document.removeEventListener("mouseout", onOut); }
    };
    document.addEventListener("mouseout", onOut);
    // En mobile no hay exit intent: se cae a un delay largo.
    if (matchMedia("(pointer:coarse)").matches) setTimeout(open, 25000);
  }
})();`;

  return new Response(js, {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "public, max-age=300",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
