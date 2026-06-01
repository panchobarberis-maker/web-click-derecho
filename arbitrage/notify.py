"""
WhatsApp notifications via CallMeBot (free, no account needed).

Setup (solo una vez):
  1. Agregá al WhatsApp el número: +34 644 60 09 93
  2. Mandále este mensaje exacto: "I allow callmebot to send me messages"
  3. Te responde con tu API key
  4. Agregá al .env:
       WPP_PHONE=+5491123456789   (tu número con código de país)
       WPP_APIKEY=xxxxxxx
"""

import os
import requests


def send_whatsapp(message: str) -> bool:
    phone = os.getenv("WPP_PHONE", "")
    apikey = os.getenv("WPP_APIKEY", "")
    if not phone or not apikey:
        return False
    try:
        resp = requests.get(
            "https://api.callmebot.com/whatsapp.php",
            params={"phone": phone, "text": message, "apikey": apikey},
            timeout=15,
        )
        return resp.status_code == 200
    except Exception:
        return False


def build_message(ops: list[dict], blue_rate: float, min_margin: float) -> str:
    profitable = [
        op for op in ops
        if isinstance(op.get("margen_neto_pct"), (int, float))
        and op["margen_neto_pct"] >= min_margin
    ]

    if not profitable:
        top = sorted(ops, key=lambda x: x["max_precio_amazon_usd"], reverse=True)[:3]
        lines = [
            f"🔍 Arbitrage ML — {len(ops)} productos analizados",
            f"💵 Blue: ${blue_rate:,.0f} ARS/USD",
            f"⚠️ Sin precios Amazon cargados aún. Top 3 potencial:\n",
        ]
        for op in top:
            lines.append(
                f"• {op['titulo'][:40]}\n"
                f"  ML ${op['precio_ml_ars']:,} | Max Amazon ${op['max_precio_amazon_usd']:.2f}"
                f" | Envío ${op['envio_usd']:.2f} | {op['vendedores_catalogo']} vendedores"
            )
        return "\n".join(lines)

    best = sorted(profitable, key=lambda x: x["margen_neto_pct"], reverse=True)
    lines = [
        f"🚀 {len(profitable)} oportunidades ≥{min_margin:.0f}% margen",
        f"💵 Blue: ${blue_rate:,.0f} ARS/USD\n",
    ]
    for op in best[:5]:
        lines.append(
            f"✅ {op['titulo'][:40]}\n"
            f"   ML ${op['precio_ml_ars']:,} | Amazon ${op['precio_amazon_usd']:.2f}"
            f" | Margen {op['margen_neto_pct']:.1f}%"
            f" | {op['vendedores_catalogo']} vendedores"
        )
    if len(profitable) > 5:
        lines.append(f"\n...y {len(profitable) - 5} más en el CSV.")
    return "\n".join(lines)
