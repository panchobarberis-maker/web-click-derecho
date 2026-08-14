/**
 * El sitio del estudio y su casilla de mail, para el video.
 *
 * Nada de esto es parte de la aplicacion: es el escenario. El sitio existe
 * para mostrar el widget corriendo en una pagina ajena, que es como lo ve el
 * visitante, y la casilla para mostrar el mail de recuperacion tal cual sale
 * —el HTML lo arma la misma funcion que usa la app, no una copia.
 */
import http from "node:http";
import { createReadStream, statSync } from "node:fs";

const TIPO = { "Content-Type": "text/html; charset=utf-8" };

export function servirSitio({ puerto = 80, widget, mail = () => "", video = null }) {
  return http.createServer((req, res) => {
    const u = new URL(req.url, `http://localhost:${puerto}`);

    if (u.pathname === "/mail") {
      res.writeHead(200, TIPO);
      return res.end(buzon(mail()));
    }

    // El clip: sin soporte de Range el navegador no reproduce nada.
    if (u.pathname === "/clip.webm" && video) return servirVideo(req, res, video);

    // Con ?w= se cambia el widget sin levantar otro servidor: el mismo sitio
    // sirve para mostrar el pop-up y despues el clip.
    const cual = u.searchParams.get("w");
    res.writeHead(200, TIPO);
    res.end(sitio(u.pathname, cual ? widget.replace(/\?.*$/, `?${cual}`) : widget));
  }).listen(puerto);
}

function servirVideo(req, res, archivo) {
  const tam = statSync(archivo).size;
  const r = /bytes=(\d*)-(\d*)/.exec(req.headers.range || "");
  const ini = r && r[1] ? Number(r[1]) : 0;
  const fin = r && r[2] ? Number(r[2]) : tam - 1;
  res.writeHead(r ? 206 : 200, {
    "Content-Type": "video/webm",
    "Accept-Ranges": "bytes",
    "Content-Length": fin - ini + 1,
    ...(r ? { "Content-Range": `bytes ${ini}-${fin}/${tam}` } : {}),
  });
  createReadStream(archivo, { start: ini, end: fin }).pipe(res);
}

const sitio = (ruta, widget) => `<!doctype html>
<html lang="es"><head><meta charset="utf-8">
<title>Whitfield &amp; Marsh — Attorneys at Law</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Liberation Sans',Arial,sans-serif;color:#1d2b3a;background:#fff;-webkit-font-smoothing:antialiased}
  header{display:flex;align-items:center;justify-content:space-between;padding:1.4rem 4rem;border-bottom:1px solid #e6eaef}
  .marca{font-family:'Liberation Serif',Georgia,serif;font-size:1.5rem;letter-spacing:.01em}
  .marca span{color:#1e5f88}
  nav{display:flex;gap:2.2rem;font-size:.9rem;color:#54677c}
  .hero{display:grid;grid-template-columns:1.1fr .9fr;gap:3rem;align-items:center;padding:4.5rem 4rem 4rem;background:linear-gradient(160deg,#f6f9fc,#fff)}
  h1{font-family:'Liberation Serif',Georgia,serif;font-size:3.4rem;line-height:1.06;font-weight:400;letter-spacing:-.01em}
  .hero p{margin-top:1.2rem;font-size:1.05rem;line-height:1.65;color:#54677c;max-width:34rem}
  .btns{margin-top:2rem;display:flex;gap:.8rem}
  .btn{padding:.8rem 1.7rem;border-radius:6px;font-size:.92rem;font-weight:500;text-decoration:none}
  .lleno{background:#1e5f88;color:#fff}
  .vacio{border:1px solid #cbd6e1;color:#1d2b3a}
  .foto{aspect-ratio:4/3;border-radius:10px;background:
      linear-gradient(140deg,#20486b 0%,#2f6d97 55%,#4a90b8 100%);position:relative;overflow:hidden}
  .foto:after{content:"";position:absolute;inset:0;
      background:repeating-linear-gradient(115deg,rgba(255,255,255,.06) 0 2px,transparent 2px 26px)}
  .areas{padding:3.5rem 4rem;border-top:1px solid #e6eaef}
  .areas h2{font-family:'Liberation Serif',serif;font-weight:400;font-size:1.7rem;margin-bottom:1.6rem}
  .grid{display:grid;grid-template-columns:repeat(4,1fr);gap:1rem}
  .card{border:1px solid #e6eaef;border-radius:8px;padding:1.2rem}
  .card b{display:block;font-size:.95rem;font-weight:500;margin-bottom:.35rem}
  .card small{color:#7b8b9d;font-size:.82rem;line-height:1.5;display:block}
</style></head>
<body>
  <header>
    <div class="marca">Whitfield <span>&amp; Marsh</span></div>
    <nav><a>The firm</a><a>Practice areas</a><a>Results</a><a>Contact</a></nav>
  </header>

  <section class="hero">
    <div>
      <h1>Employment attorneys<br>in Columbus, Ohio</h1>
      <p>Thirty years representing workers and small businesses. Workplace injuries,
         wrongful termination and unpaid wages.</p>
      <div class="btns">
        <a class="btn lleno">Request a consultation</a>
        <a class="btn vacio">Meet the team</a>
      </div>
    </div>
    <div class="foto"></div>
  </section>

  <section class="areas">
    <h2>What we handle</h2>
    <div class="grid">
      <div class="card"><b>Employment law</b><small>Workplace injuries, wrongful termination, unpaid wages.</small></div>
      <div class="card"><b>Personal injury</b><small>Car accidents and premises liability.</small></div>
      <div class="card"><b>Family law</b><small>Divorce, custody and child support.</small></div>
      <div class="card"><b>Estate planning</b><small>Wills, trusts and probate.</small></div>
    </div>
  </section>

  <script src="${widget}"></script>
</body></html>`;

/** El mail dentro de una casilla, para que se entienda que es un mail. */
const buzon = (html) => `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><title>Casilla</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Liberation Sans',Arial,sans-serif;background:#eef1f5;color:#202124;padding:2.5rem 0}
  .ventana{max-width:820px;margin:0 auto;background:#fff;border-radius:12px;
      box-shadow:0 12px 40px rgba(20,30,50,.12);overflow:hidden}
  .barra{display:flex;align-items:center;gap:.5rem;padding:.85rem 1.2rem;background:#f6f8fb;border-bottom:1px solid #e3e8ee}
  .luz{width:11px;height:11px;border-radius:50%}
  .cabecera{padding:1.5rem 2rem 1.1rem;border-bottom:1px solid #edf0f4}
  .asunto{font-size:1.28rem;font-weight:500;margin-bottom:1rem}
  .de{display:flex;align-items:center;gap:.75rem;font-size:.9rem}
  .av{width:38px;height:38px;border-radius:50%;background:#1f5d7a;color:#fff;display:flex;
      align-items:center;justify-content:center;font-weight:600;font-size:.95rem}
  .de b{font-weight:500}
  .de small{color:#5f6368;display:block;font-size:.82rem}
  .cuerpo{padding:2rem}
</style></head>
<body>
  <div class="ventana">
    <div class="barra">
      <i class="luz" style="background:#ff5f57"></i><i class="luz" style="background:#febc2e"></i>
      <i class="luz" style="background:#28c840"></i>
      <span style="margin-left:.6rem;font-size:.8rem;color:#7b8794">Inbox</span>
    </div>
    <div class="cabecera">
      <div class="asunto">Your request at Whitfield &amp; Marsh is half finished</div>
      <div class="de">
        <div class="av">W</div>
        <div><b>Whitfield &amp; Marsh</b><small>intake@whitfieldmarsh.com — to me</small></div>
      </div>
    </div>
    <div class="cuerpo">${html}</div>
  </div>
</body></html>`;
