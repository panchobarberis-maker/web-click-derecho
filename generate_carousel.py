#!/usr/bin/env python3
"""
Generador de carruseles de Instagram para Click Derecho MKT.

Uso:
  python3 generate_carousel.py "Tu tema aquí"
  python3 generate_carousel.py "Marketing para abogados" --cliente "Estudio García"

Output: carpeta ./carruseles/<tema>/ con 6 JPG 1080x1350 (4:5)
"""

import sys
import os
import re
import json
import argparse
from pathlib import Path

import anthropic
from playwright.sync_api import sync_playwright

CHROMIUM_PATH = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome"

FONTS = """
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=DM+Sans:ital,wght@0,300;0,400;0,500;1,300&family=Cormorant+Garamond:ital,wght@0,300;0,600;0,700;1,300&display=swap" rel="stylesheet">
"""

BASE_CSS = """
* { box-sizing: border-box; margin: 0; padding: 0; }
:root {
  --bg: #0d1117;
  --gold: #c9922a;
  --gold-lt: #e8b84b;
  --gold-dim: rgba(201,146,42,0.14);
  --white: #f0f3ff;
  --muted: rgba(240,243,255,0.60);
  --line: rgba(201,146,42,0.32);
}
html, body {
  width: 1080px; height: 1350px; overflow: hidden;
  background: var(--bg); color: var(--white);
  font-family: 'DM Sans', sans-serif;
}
.slide {
  width: 1080px; height: 1350px;
  position: relative; overflow: hidden;
  display: flex; flex-direction: column;
}
.badge {
  position: absolute; top: 52px; left: 64px; z-index: 10;
  font-family: 'Bebas Neue', sans-serif;
  font-size: 22px; letter-spacing: 4px; color: var(--white);
  border: 1px solid var(--line); padding: 8px 22px;
  border-radius: 40px;
}
.num-badge {
  position: absolute; top: 52px; right: 64px; z-index: 10;
  font-family: 'Bebas Neue', sans-serif;
  font-size: 18px; letter-spacing: 3px; color: var(--muted);
}
.label {
  font-size: 17px; letter-spacing: 5px; text-transform: uppercase;
  color: var(--gold); margin-bottom: 18px; display: block;
}
.deco-line { width: 56px; height: 3px; background: var(--gold); margin-bottom: 28px; }
.display { font-family: 'Bebas Neue', sans-serif; letter-spacing: 2px; line-height: 0.92; }
"""


def build_portada(data: dict) -> str:
    titulo = data.get("titulo", "")
    subtitulo = data.get("subtitulo", "")
    return f"""<!DOCTYPE html><html><head><meta charset="UTF-8">{FONTS}<style>{BASE_CSS}
.portada {{
  background: radial-gradient(ellipse 90% 70% at 55% 50%, rgba(201,146,42,.18) 0%, rgba(8,10,15,.97) 65%), var(--bg);
  align-items: center; justify-content: center; text-align: center; padding: 80px;
}}
.titulo {{ font-size: 128px; line-height: 0.88; margin-bottom: 40px; }}
.subtitulo {{ font-size: 28px; color: var(--muted); line-height: 1.6; max-width: 760px; }}
.logo-word {{ color: var(--gold); }}
.sep {{ display: flex; align-items: center; gap: 32px; margin-top: 56px; justify-content: center; }}
.sep-line {{ width: 60px; height: 1px; background: var(--line); }}
.sep-text {{ font-size: 17px; letter-spacing: 4px; text-transform: uppercase; color: var(--muted); }}
</style></head><body>
<div class="slide portada">
  <div style="position:absolute;inset:0;background:radial-gradient(ellipse 60% 40% at 20% 80%,rgba(26,86,255,.08) 0%,transparent 60%);"></div>
  <div class="badge">Click Derecho MKT</div>
  <div class="display titulo">
    {titulo}
  </div>
  <p class="subtitulo">{subtitulo}</p>
  <div class="sep">
    <div class="sep-line"></div>
    <span class="sep-text">Especialistas en abogados/as</span>
    <div class="sep-line"></div>
  </div>
</div>
</body></html>"""


def build_contenido(data: dict, num: int, total: int) -> str:
    titulo = data.get("titulo", "")
    puntos = data.get("puntos", [])
    intro = data.get("intro", "")

    puntos_html = ""
    for i, p in enumerate(puntos[:4]):
        titulo_p = p.get("titulo", "") if isinstance(p, dict) else str(p)
        desc_p = p.get("desc", "") if isinstance(p, dict) else ""
        puntos_html += f"""
        <div class="item">
          <div class="item-num">{str(i+1).zfill(2)}</div>
          <div class="item-body">
            <h4>{titulo_p}</h4>
            {f'<p>{desc_p}</p>' if desc_p else ''}
          </div>
        </div>"""

    return f"""<!DOCTYPE html><html><head><meta charset="UTF-8">{FONTS}<style>{BASE_CSS}
.cont {{
  background: linear-gradient(160deg,rgba(201,146,42,.16) 0%,rgba(13,17,23,.94) 38%,rgba(26,86,255,.08) 100%),
              radial-gradient(ellipse 70% 50% at 88% 12%,rgba(201,146,42,.20) 0%,transparent 55%), var(--bg);
  padding: 140px 80px 80px;
  justify-content: center;
}}
.title {{ font-size: 82px; margin-bottom: 32px; }}
.title em {{ color: var(--gold); font-style: normal; }}
.intro {{ font-size: 24px; color: var(--muted); line-height: 1.65; margin-bottom: 48px; max-width: 860px; }}
.item {{ display: flex; align-items: flex-start; gap: 28px; margin-bottom: 32px; }}
.item-num {{
  width: 64px; height: 64px; border-radius: 50%;
  border: 1px solid var(--gold); background: var(--gold-dim);
  display: flex; align-items: center; justify-content: center;
  font-family: 'Bebas Neue', sans-serif; font-size: 26px; color: var(--gold); flex-shrink: 0;
}}
.item-body h4 {{ font-size: 26px; font-weight: 500; margin-bottom: 6px; }}
.item-body p {{ font-size: 21px; color: var(--muted); line-height: 1.6; }}
</style></head><body>
<div class="slide cont">
  <div class="badge">Click Derecho MKT</div>
  <div class="num-badge">{num}/{total}</div>
  <span class="label">Punto clave</span>
  <div class="deco-line"></div>
  <h2 class="display title">{titulo}</h2>
  {f'<p class="intro">{intro}</p>' if intro else ''}
  {puntos_html}
</div>
</body></html>"""


def build_dato(data: dict, num: int, total: int) -> str:
    stat = data.get("stat", "")
    unidad = data.get("unidad", "")
    titulo = data.get("titulo", "")
    descripcion = data.get("descripcion", "")
    contexto = data.get("contexto", [])

    ctx_html = ""
    for c in contexto[:3]:
        ctx_html += f'<div class="ctx-item"><span class="ctx-arrow">→</span><span>{c}</span></div>'

    return f"""<!DOCTYPE html><html><head><meta charset="UTF-8">{FONTS}<style>{BASE_CSS}
.dato {{
  background: linear-gradient(160deg,rgba(201,146,42,.20) 0%,rgba(13,17,23,.94) 45%,rgba(26,86,255,.10) 100%),
              radial-gradient(ellipse 65% 55% at 15% 85%,rgba(26,86,255,.12) 0%,transparent 55%), var(--bg);
  align-items: center; justify-content: center; text-align: center; padding: 100px 80px;
}}
.big-stat {{
  font-family: 'Bebas Neue', sans-serif;
  font-size: 240px; line-height: 0.85; color: var(--gold-lt);
  letter-spacing: 4px;
}}
.unidad {{ font-size: 72px; color: var(--gold); letter-spacing: 4px; display: block; margin-bottom: 24px; }}
.stat-title {{ font-size: 52px; line-height: 1.05; margin-bottom: 24px; max-width: 760px; }}
.stat-desc {{ font-size: 24px; color: var(--muted); line-height: 1.6; max-width: 700px; margin-bottom: 48px; }}
.ctx-list {{ display: flex; flex-direction: column; gap: 16px; max-width: 680px; text-align: left; }}
.ctx-item {{ display: flex; align-items: center; gap: 16px; font-size: 22px; color: var(--muted); }}
.ctx-arrow {{ color: var(--gold); flex-shrink: 0; }}
</style></head><body>
<div class="slide dato">
  <div class="badge">Click Derecho MKT</div>
  <div class="num-badge">{num}/{total}</div>
  <span class="big-stat">{stat}</span>
  {f'<span class="unidad">{unidad}</span>' if unidad else ''}
  <h2 class="display stat-title">{titulo}</h2>
  {f'<p class="stat-desc">{descripcion}</p>' if descripcion else ''}
  {f'<div class="ctx-list">{ctx_html}</div>' if ctx_html else ''}
</div>
</body></html>"""


def build_cta(data: dict) -> str:
    titulo = data.get("titulo", "¿Listo para el siguiente paso?")
    accion = data.get("accion", "Escribinos hoy")
    beneficio = data.get("beneficio", "Primera consulta sin costo")
    contacto = data.get("contacto", "+54 2944 538946")
    bajada = data.get("bajada", "Especialistas en marketing para abogados/as")

    return f"""<!DOCTYPE html><html><head><meta charset="UTF-8">{FONTS}<style>{BASE_CSS}
.cta {{
  background: radial-gradient(ellipse 85% 65% at 50% 55%, rgba(201,146,42,.22) 0%, rgba(8,10,15,.97) 60%), var(--bg);
  align-items: center; justify-content: center; text-align: center; padding: 80px;
}}
.cta-title {{ font-size: 108px; line-height: 0.90; margin-bottom: 40px; }}
.cta-title em {{ color: var(--gold); font-style: normal; }}
.cta-bajada {{ font-size: 26px; color: var(--muted); margin-bottom: 64px; }}
.cta-btn {{
  display: inline-block;
  background: var(--gold); color: #0d1117;
  font-family: 'DM Sans', sans-serif; font-weight: 500;
  font-size: 24px; letter-spacing: 4px; text-transform: uppercase;
  padding: 28px 72px; border-radius: 6px; margin-bottom: 40px;
}}
.beneficio {{
  font-size: 22px; color: var(--gold-lt); letter-spacing: 3px;
  text-transform: uppercase; margin-bottom: 48px;
  border: 1px solid var(--line); padding: 14px 40px; border-radius: 40px;
  display: inline-block;
}}
.contacto-block {{ margin-top: 48px; }}
.wsp-label {{ font-size: 17px; letter-spacing: 4px; text-transform: uppercase; color: var(--muted); margin-bottom: 12px; }}
.wsp-num {{ font-family: 'Bebas Neue', sans-serif; font-size: 52px; color: var(--gold-lt); letter-spacing: 4px; }}
.logo-footer {{
  position: absolute; bottom: 52px; left: 0; right: 0;
  text-align: center; font-family: 'Bebas Neue', sans-serif;
  font-size: 28px; letter-spacing: 8px; color: var(--muted);
}}
</style></head><body>
<div class="slide cta">
  <div class="badge">Click Derecho MKT</div>
  <h2 class="display cta-title">{titulo}</h2>
  <p class="cta-bajada">{bajada}</p>
  <div class="cta-btn">{accion}</div>
  <div class="beneficio">{beneficio}</div>
  <div class="contacto-block">
    <p class="wsp-label">WhatsApp</p>
    <p class="wsp-num">{contacto}</p>
  </div>
  <div class="logo-footer">Click Derecho MKT</div>
</div>
</body></html>"""


SYSTEM_PROMPT = """Sos un experto en marketing de contenidos para estudios jurídicos argentinos.
Generás contenido para carruseles de Instagram de Click Derecho MKT, una agencia especializada en abogados/as.

El tono es: profesional pero directo, sin jerga innecesaria. Enfocado en resultados concretos.
El público son abogados/as que quieren más clientes.

Devolvés ÚNICAMENTE JSON válido, sin texto adicional, sin markdown, sin bloques de código.
"""

SLIDE_SCHEMA = """
{
  "portada": {
    "titulo": "TÍTULO EN MAYÚSCULAS (máx 5 palabras, impactante)",
    "subtitulo": "Subtítulo que expande el tema (1 oración, 15-20 palabras)"
  },
  "slides": [
    {
      "tipo": "contenido",
      "titulo": "TÍTULO DEL SLIDE (3-5 palabras en mayúsculas)",
      "intro": "Oración introductoria opcional (máx 20 palabras)",
      "puntos": [
        {"titulo": "Punto breve", "desc": "Descripción en 1-2 oraciones (máx 20 palabras)"},
        {"titulo": "Punto breve", "desc": "Descripción en 1-2 oraciones (máx 20 palabras)"},
        {"titulo": "Punto breve", "desc": "Descripción en 1-2 oraciones (máx 20 palabras)"},
        {"titulo": "Punto breve", "desc": "Descripción en 1-2 oraciones (máx 20 palabras)"}
      ]
    },
    {
      "tipo": "dato",
      "stat": "número impactante (ej: 87)",
      "unidad": "unidad (ej: %, casos, días) o vacío",
      "titulo": "QUÉ REPRESENTA ESE DATO (3-5 palabras)",
      "descripcion": "Explicación del dato en 1-2 oraciones",
      "contexto": ["dato adicional 1", "dato adicional 2", "dato adicional 3"]
    },
    {
      "tipo": "contenido",
      "titulo": "TERCER SLIDE CONTENIDO",
      "intro": "",
      "puntos": [
        {"titulo": "Punto", "desc": "Descripción"},
        {"titulo": "Punto", "desc": "Descripción"},
        {"titulo": "Punto", "desc": "Descripción"},
        {"titulo": "Punto", "desc": "Descripción"}
      ]
    },
    {
      "tipo": "contenido",
      "titulo": "CUARTO SLIDE CONTENIDO",
      "intro": "",
      "puntos": [
        {"titulo": "Punto", "desc": "Descripción"},
        {"titulo": "Punto", "desc": "Descripción"},
        {"titulo": "Punto", "desc": "Descripción"},
        {"titulo": "Punto", "desc": "Descripción"}
      ]
    }
  ],
  "cta": {
    "titulo": "LLAMADA A LA ACCIÓN (máx 5 palabras impactantes)",
    "bajada": "Frase que refuerza la propuesta de valor (máx 12 palabras)",
    "accion": "Texto del botón (2-4 palabras, imperativo)",
    "beneficio": "Beneficio concreto (4-6 palabras)",
    "contacto": "+54 2944 538946"
  }
}
"""


def generate_content(tema: str, cliente: str = "") -> dict:
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        raise ValueError("Falta ANTHROPIC_API_KEY en las variables de entorno.")

    client = anthropic.Anthropic(api_key=api_key)

    contexto_cliente = f" El carrusel es para el cliente: {cliente}." if cliente else ""
    prompt = f"""Generá el contenido para un carrusel de Instagram de 6 slides sobre el tema: "{tema}".{contexto_cliente}

El carrusel tiene esta estructura exacta (4 slides de contenido + 1 dato estadístico):
- Slide 1: Portada (título + subtítulo)
- Slide 2: Primer bloque de contenido con 4 puntos
- Slide 3: Dato estadístico impactante
- Slide 4: Segundo bloque de contenido con 4 puntos
- Slide 5: Tercer bloque de contenido con 4 puntos
- Slide 6: CTA (llamada a la acción)

Devolvé el JSON con esta estructura exacta:
{SLIDE_SCHEMA}

IMPORTANTE: Solo JSON válido, sin ningún texto extra."""

    message = client.messages.create(
        model="claude-opus-4-7",
        max_tokens=2048,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": prompt}]
    )

    raw = message.content[0].text.strip()
    # Limpiar bloques de código si vienen
    raw = re.sub(r'^```(?:json)?\s*', '', raw)
    raw = re.sub(r'\s*```$', '', raw)
    return json.loads(raw)


def render_slides(content: dict) -> list[str]:
    slides_html = []
    slides_html.append(build_portada(content["portada"]))

    slide_num = 2
    total = 6
    for slide_data in content.get("slides", []):
        tipo = slide_data.get("tipo", "contenido")
        if tipo == "dato":
            slides_html.append(build_dato(slide_data, slide_num, total))
        else:
            slides_html.append(build_contenido(slide_data, slide_num, total))
        slide_num += 1

    slides_html.append(build_cta(content["cta"]))
    return slides_html


def capture_slides(slides_html: list[str], output_dir: Path) -> list[Path]:
    output_dir.mkdir(parents=True, exist_ok=True)
    paths = []

    with sync_playwright() as p:
        browser = p.chromium.launch(
            executable_path=CHROMIUM_PATH,
            args=["--no-sandbox", "--disable-dev-shm-usage", "--font-render-hinting=none"]
        )
        page = browser.new_page(viewport={"width": 1080, "height": 1350})

        for i, html in enumerate(slides_html, 1):
            page.set_content(html, wait_until="networkidle")
            out_path = output_dir / f"slide_{i:02d}.jpg"
            page.screenshot(
                path=str(out_path),
                type="jpeg",
                quality=95,
                full_page=False,
                clip={"x": 0, "y": 0, "width": 1080, "height": 1350}
            )
            paths.append(out_path)
            print(f"  ✓ Slide {i}/6 → {out_path.name}")

        browser.close()

    return paths


def slugify(text: str) -> str:
    text = text.lower()
    text = re.sub(r'[áàä]', 'a', text)
    text = re.sub(r'[éèë]', 'e', text)
    text = re.sub(r'[íìï]', 'i', text)
    text = re.sub(r'[óòö]', 'o', text)
    text = re.sub(r'[úùü]', 'u', text)
    text = re.sub(r'[ñ]', 'n', text)
    text = re.sub(r'[^a-z0-9]+', '-', text)
    return text.strip('-')[:50]


def main():
    parser = argparse.ArgumentParser(description="Generador de carruseles Click Derecho")
    parser.add_argument("tema", help="Tema del carrusel (ej: 'Marketing digital para abogados')")
    parser.add_argument("--cliente", default="", help="Nombre del cliente (opcional)")
    parser.add_argument("--out", default="./carruseles", help="Carpeta de salida")
    args = parser.parse_args()

    print(f"\n🎯 Generando carrusel: \"{args.tema}\"")
    if args.cliente:
        print(f"   Cliente: {args.cliente}")

    print("\n⏳ Consultando a Claude para generar el contenido...")
    try:
        content = generate_content(args.tema, args.cliente)
    except json.JSONDecodeError as e:
        print(f"Error al parsear la respuesta de Claude: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"Error al consultar Claude API: {e}")
        sys.exit(1)

    print("✓ Contenido generado")
    portada_titulo = content.get("portada", {}).get("titulo", args.tema)
    print(f"  Título: {portada_titulo}")

    print("\n⏳ Renderizando slides...")
    slides_html = render_slides(content)

    slug = slugify(args.tema)
    output_dir = Path(args.out) / slug
    paths = capture_slides(slides_html, output_dir)

    print(f"\n✅ Listo. {len(paths)} slides en: {output_dir}/")
    print("\nArchivos:")
    for p in paths:
        size_kb = p.stat().st_size // 1024
        print(f"  {p.name}  ({size_kb} KB)")


if __name__ == "__main__":
    main()
