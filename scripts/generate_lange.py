#!/usr/bin/env python3
"""
Lange Firm Instagram Carousel Generator
Usage: python3 scripts/generate_lange.py "<topic>" '<content_json>'

content_json structure:
{
  "cover":   {"title": "...", "subtitle": "..."},
  "rights":  [{"title": "...", "desc": "..."}, ...],   # 3 items
  "stat":    {"number": "...", "unit": "...", "title": "...", "desc": "...", "bullets": ["..."]},
  "signs":   [{"title": "...", "desc": "..."}, ...],   # 3 items
  "actions": [{"title": "...", "desc": "..."}, ...],   # 3 items
}
"""

import sys, json, base64, urllib.request, re
from pathlib import Path
from playwright.sync_api import sync_playwright

CHROMIUM_PATH = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome"
REPO_RAW = "https://raw.githubusercontent.com/panchobarberis-maker/Carrousels/main"

BG_FILES = [
    "ChatGPT%20Image%20May%2021%2C%202026%2C%2006_41_43%20PM%20(1).png",
    "ChatGPT%20Image%20May%2021%2C%202026%2C%2006_41_43%20PM%20(2).png",
    "ChatGPT%20Image%20May%2021%2C%202026%2C%2006_41_44%20PM%20(3).png",
    "ChatGPT%20Image%20May%2021%2C%202026%2C%2006_41_44%20PM%20(4).png",
    "ChatGPT%20Image%20May%2021%2C%202026%2C%2006_41_45%20PM%20(5).png",
]

def fetch_b64(url, ext="png"):
    with urllib.request.urlopen(url) as r:
        data = r.read()
    return f"data:image/{ext};base64,{base64.b64encode(data).decode()}"

def load_assets():
    print("Downloading assets...")
    evan = fetch_b64(f"{REPO_RAW}/evan.jpeg", "jpeg")
    bgs  = [fetch_b64(f"{REPO_RAW}/{f}") for f in BG_FILES]
    print("Assets ready.")
    return evan, bgs

FONTS = """
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;0,700;1,400;1,700&family=DM+Sans:wght@300;400;500&display=swap" rel="stylesheet">
"""

BASE = """
* { box-sizing:border-box; margin:0; padding:0; }
:root {
  --gold:#C9A84C; --gold-lt:#E2C97E;
  --white:#F5F0E8; --muted:rgba(245,240,232,0.75); --line:rgba(201,168,76,0.35);
}
html,body { width:1080px; height:1350px; overflow:hidden;
  color:var(--white); font-family:'DM Sans',sans-serif; }
.slide { width:1080px; height:1350px; position:relative; overflow:hidden; display:flex; flex-direction:column; }
.bg { position:absolute;inset:0; background-size:cover; background-position:center; }
.ov { position:absolute;inset:0; }
"""

LOGO_CSS = """
.lange-logo { display:flex; flex-direction:column; align-items:center; }
.logo-top { font-family:'Cormorant Garamond',serif; font-weight:700; font-size:30px; letter-spacing:9px; color:#9B7020; line-height:1; }
.logo-rule { width:200px; height:1px; background:linear-gradient(90deg,transparent,#C9A84C,transparent); margin:4px 0; }
.logo-bottom { font-family:'Cormorant Garamond',serif; font-weight:700; font-size:30px; letter-spacing:12px; color:#C9A84C; line-height:1; }
"""

LOGO_HTML = """<div class="lange-logo">
  <span class="logo-top">THE LANGE</span>
  <div class="logo-rule"></div>
  <span class="logo-bottom">FIRM</span>
</div>"""

BOX_CSS = """
.box { display:flex; gap:20px; align-items:flex-start;
  background:rgba(10,10,10,.55); border:1px solid rgba(201,168,76,.30);
  border-radius:10px; padding:20px 28px; margin-bottom:18px; font-size:26px;
  backdrop-filter:blur(6px); }
.arr { color:var(--gold); flex-shrink:0; font-size:22px; margin-top:3px; }
.box strong { font-size:26px; font-weight:500; }
.box .sub { font-size:22px; opacity:.82; font-weight:300; }
"""

def box(num, title, desc=""):
    inner = f"<strong>{title}</strong>"
    if desc:
        inner += f'<br><span class="sub">{desc}</span>'
    return f'<div class="box"><span class="arr">{num}</span><div style="line-height:1.45">{inner}</div></div>'

def num_badge(n):
    return f'<div style="position:absolute;top:56px;right:72px;z-index:3;font-size:16px;letter-spacing:4px;color:var(--muted)">{n} / 6</div>'

def logo_tl():
    return f'<div style="position:absolute;top:44px;left:68px;z-index:3">{LOGO_HTML}</div>'

def slide_cover(c, bg):
    title = c["title"].replace("\n","<br>")
    return f"""<!DOCTYPE html><html><head><meta charset="UTF-8">{FONTS}<style>{BASE}{LOGO_CSS}
.bg {{ background-image:url("{bg}"); }}
.ov {{ background:linear-gradient(170deg,rgba(8,6,2,.82) 0%,rgba(8,6,2,.55) 50%,rgba(12,8,2,.88) 100%); }}
.content {{ position:relative;z-index:2;display:flex;flex-direction:column;
  align-items:center;justify-content:center;padding:220px 80px;height:100%;text-align:center; }}
.pill {{ font-size:16px;letter-spacing:5px;text-transform:uppercase;color:var(--gold);
  border:1px solid var(--line);padding:10px 32px;border-radius:40px;margin-bottom:48px; }}
.title {{ font-family:'Cormorant Garamond',serif;font-weight:700;
  font-size:112px;line-height:.86;color:var(--white);margin-bottom:28px; }}
.title em {{ color:var(--gold);font-style:italic; }}
.sub {{ font-size:28px;color:var(--white);line-height:1.55;max-width:700px;margin-bottom:52px;opacity:.85; }}
.sep {{ display:flex;align-items:center;gap:24px; }}
.sep-line {{ width:64px;height:1px;background:var(--line); }}
.sep-text {{ font-size:15px;letter-spacing:4px;text-transform:uppercase;color:var(--muted); }}
.logo-wrap {{ margin-top:48px; }}
</style></head><body><div class="slide">
  <div class="bg"></div><div class="ov"></div>
  <div class="content">
    <span class="pill">Employment Law · Houston, TX</span>
    <h1 class="title">{title}</h1>
    <p class="sub">{c['subtitle']}</p>
    <div class="sep"><div class="sep-line"></div><span class="sep-text">Free Consultation Available</span><div class="sep-line"></div></div>
    <div class="logo-wrap">{LOGO_HTML}</div>
  </div>
</div></body></html>"""

def slide_content(heading, label, items, bg, num, em_last=True):
    boxes = "".join(box("→", it["title"], it.get("desc","")) for it in items)
    title_html = heading.replace("\n","<br>")
    return f"""<!DOCTYPE html><html><head><meta charset="UTF-8">{FONTS}<style>{BASE}{LOGO_CSS}{BOX_CSS}
.bg {{ background-image:url("{bg}"); }}
.ov {{ background:linear-gradient(160deg,rgba(8,6,2,.78) 0%,rgba(8,6,2,.68) 100%); }}
.body {{ position:relative;z-index:2;display:flex;flex-direction:column;
  justify-content:center;height:100%;padding:148px 72px 80px; }}
.lbl {{ font-size:15px;letter-spacing:6px;text-transform:uppercase;color:var(--gold);margin-bottom:12px;display:block; }}
.deco {{ width:52px;height:2px;background:var(--gold);margin-bottom:36px; }}
.ttl {{ font-family:'Cormorant Garamond',serif;font-weight:700;font-size:80px;line-height:.90;margin-bottom:44px; }}
.ttl em {{ color:var(--gold);font-style:italic; }}
</style></head><body><div class="slide">
  <div class="bg"></div><div class="ov"></div>
  {logo_tl()}{num_badge(num)}
  <div class="body">
    <span class="lbl">{label}</span>
    <div class="deco"></div>
    <h2 class="ttl">{title_html}</h2>
    {boxes}
  </div>
</div></body></html>"""

def slide_stat(s, bg):
    bullets = "".join(box("→", b) for b in s["bullets"])
    return f"""<!DOCTYPE html><html><head><meta charset="UTF-8">{FONTS}<style>{BASE}{LOGO_CSS}{BOX_CSS}
.bg {{ background-image:url("{bg}"); }}
.ov {{ background:linear-gradient(180deg,rgba(8,6,2,.72) 0%,rgba(8,6,2,.65) 50%,rgba(8,6,2,.78) 100%); }}
.content {{ position:relative;z-index:2;display:flex;flex-direction:column;
  align-items:center;justify-content:center;height:100%;text-align:center;padding:80px; }}
.big {{ font-family:'Cormorant Garamond',serif;font-weight:700;font-size:260px;line-height:.78;color:var(--gold-lt); }}
.unit {{ font-family:'Cormorant Garamond',serif;font-weight:700;font-size:88px;color:var(--gold);line-height:1;display:block;margin-bottom:24px; }}
.ttl {{ font-family:'Cormorant Garamond',serif;font-weight:700;font-size:52px;line-height:1.1;margin-bottom:16px;max-width:740px; }}
.desc {{ font-size:28px;color:var(--white);line-height:1.55;max-width:720px;margin-bottom:32px; }}
.notes {{ width:100%;max-width:780px;text-align:left; }}
</style></head><body><div class="slide">
  <div class="bg"></div><div class="ov"></div>
  <div style="position:absolute;top:44px;left:0;right:0;display:flex;justify-content:center;z-index:3">{LOGO_HTML}</div>
  {num_badge(3)}
  <div class="content">
    <span class="big">{s['number']}</span>
    <span class="unit">{s['unit']}</span>
    <h2 class="ttl">{s['title']}</h2>
    <p class="desc">{s['desc']}</p>
    <div class="notes">{bullets}</div>
  </div>
</div></body></html>"""

def slide_cta(evan):
    return f"""<!DOCTYPE html><html><head><meta charset="UTF-8">{FONTS}<style>{BASE}{LOGO_CSS}
.photo-half {{ position:absolute;top:0;left:0;right:0;height:52%;
  background:url("{evan}") center 15%/cover no-repeat; }}
.photo-fade {{ position:absolute;top:0;left:0;right:0;height:60%;
  background:linear-gradient(180deg,rgba(8,6,2,.20) 0%,rgba(8,6,2,.10) 35%,rgba(8,6,2,1) 100%); }}
.bottom {{ position:absolute;top:48%;bottom:0;left:0;right:0;
  background:linear-gradient(175deg,#1c1508 0%,#0e0f14 100%); }}
.content {{ position:relative;z-index:3;display:flex;flex-direction:column;
  align-items:center;justify-content:flex-end;height:100%;text-align:center;padding:0 80px 72px; }}
.name {{ font-family:'Cormorant Garamond',serif;font-weight:700;font-size:42px;color:var(--white);letter-spacing:3px; }}
.role {{ font-size:18px;letter-spacing:4px;text-transform:uppercase;color:var(--muted);margin-top:8px;margin-bottom:40px; }}
.cta-title {{ font-family:'Cormorant Garamond',serif;font-weight:700;font-size:92px;line-height:.90;margin-bottom:32px; }}
.cta-title em {{ color:var(--gold);font-style:italic; }}
.btn {{ display:inline-block;background:var(--gold);color:#0e0f14;
  font-family:'DM Sans',sans-serif;font-weight:500;font-size:22px;letter-spacing:5px;
  text-transform:uppercase;padding:26px 68px;border-radius:4px;margin-bottom:24px; }}
.sub {{ font-size:20px;letter-spacing:3px;text-transform:uppercase;
  color:var(--white);border:1px solid var(--line);padding:14px 36px;
  border-radius:40px;margin-bottom:40px;opacity:.80; }}
</style></head><body><div class="slide">
  <div class="photo-half"></div><div class="photo-fade"></div><div class="bottom"></div>
  <div class="content">
    <p class="name">Evan Lange</p>
    <p class="role">Employment Attorney · Houston, TX</p>
    <h2 class="cta-title">WE FIGHT<br>FOR <em>YOU.</em></h2>
    <div class="btn">Free Consultation</div>
    <div class="sub">No fee unless we win</div>
    {LOGO_HTML}
  </div>
</div></body></html>"""

def slugify(text):
    text = text.lower()
    text = re.sub(r'[^a-z0-9]+', '-', text)
    return text.strip('-')[:40]

def generate(topic, content):
    evan, bgs = load_assets()

    c = content
    slides = [
        slide_cover(c["cover"], bgs[0]),
        slide_content("THE LAW IS\nON YOUR SIDE.", "Your Protections",
                      c["rights"], bgs[1], 2),
        slide_stat(c["stat"], bgs[2]),
        slide_content("SIGNS YOU\nMAY HAVE\nA CLAIM.", "Red Flags",
                      c["signs"], bgs[3], 4),
        slide_content("WHAT TO DO\nRIGHT NOW.", "Take Action",
                      c["actions"], bgs[4], 5),
        slide_cta(evan),
    ]

    out = Path("carruseles/lange") / slugify(topic)
    out.mkdir(parents=True, exist_ok=True)

    with sync_playwright() as p:
        browser = p.chromium.launch(
            executable_path=CHROMIUM_PATH,
            args=["--no-sandbox","--disable-dev-shm-usage","--font-render-hinting=none"]
        )
        page = browser.new_page(viewport={"width":1080,"height":1350})
        for i, html in enumerate(slides, 1):
            page.set_content(html, wait_until="networkidle")
            path = out / f"slide_{i:02d}.jpg"
            page.screenshot(path=str(path), type="jpeg", quality=95,
                clip={"x":0,"y":0,"width":1080,"height":1350})
            print(f"  ✓ Slide {i}/6 → {path}")
        browser.close()

    return list(out.glob("slide_*.jpg"))

if __name__ == "__main__":
    topic   = sys.argv[1]
    content = json.loads(sys.argv[2])
    paths   = generate(topic, content)
    print(f"\n✅ {len(paths)} slides en: {paths[0].parent}/")
