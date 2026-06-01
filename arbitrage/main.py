"""
Amazon → MercadoLibre Arbitrage Finder

Uso:
  python -m arbitrage                           # analiza categorías del .env
  python -m arbitrage --categories MLA1051,MLA1071
  python -m arbitrage --min-sold 20 --min-margin 25
  python -m arbitrage --blue-rate 1250          # tipo de cambio manual
  python -m arbitrage --catalog-only            # solo productos en catálogo ML
  python -m arbitrage --shipping-rate 40        # USD por kg (default: 40)
"""

import argparse
import csv
import logging
import os
import sys
import time
from datetime import datetime

from dotenv import load_dotenv

load_dotenv()

from .rates import get_blue_dollar_rate
from .notify import send_whatsapp, build_message
from .ml_products import (
    search_category,
    get_items_bulk,
    extract_ean,
    extract_weight_kg,
    get_catalog_seller_count,
    build_search_query,
    commission_for,
)
from .amazon import search_amazon_price, amazon_search_url
from .calculator import shipping_cost_usd, max_amazon_price_usd, net_margin_pct

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(message)s",
    datefmt="%H:%M:%S",
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler("arbitrage.log", encoding="utf-8"),
    ],
)
logger = logging.getLogger(__name__)

KNOWN_CATEGORIES = {
    "MLA1071": "Celulares y telefonía",
    "MLA1051": "Electrónica",
    "MLA1000": "Electrodomésticos",
    "MLA1648": "Ropa y accesorios",
    "MLA1144": "Deportes y fitness",
    "MLA3937": "Juguetes",
    "MLA1499": "Hogar y jardín",
    "MLA1039": "Computación",
    "MLA1574": "Bebés",
}

_DEFAULT_WEIGHT_KG = 0.5  # fallback when ML doesn't have weight data


def _analyze_category(category_id: str, blue_rate: float, cfg: dict) -> list[dict]:
    cat_name = KNOWN_CATEGORIES.get(category_id, category_id)
    logger.info(f"▸ Analizando '{cat_name}' ({category_id})...")

    raw = search_category(category_id, limit=cfg["search_limit"], catalog_only=cfg["catalog_only"])
    candidates = [r for r in raw if r.get("sold_quantity", 0) >= cfg["min_sold"]]
    if not candidates:
        logger.info(f"  Sin productos con ≥{cfg['min_sold']} ventas")
        return []

    logger.info(f"  {len(candidates)} productos con ≥{cfg['min_sold']} ventas — obteniendo detalles...")

    opportunities: list[dict] = []
    ids = [r["id"] for r in candidates]

    for i in range(0, len(ids), 20):
        batch = get_items_bulk(ids[i : i + 20])
        for item in batch:
            ml_price = float(item.get("price", 0))
            if ml_price <= 0:
                continue

            cat = item.get("category_id", category_id)
            commission = commission_for(cat)
            ean = extract_ean(item)
            query = build_search_query(item)

            # Weight & shipping
            weight_kg = extract_weight_kg(item)
            weight_known = weight_kg is not None
            if not weight_known:
                weight_kg = _DEFAULT_WEIGHT_KG
            ship_usd = shipping_cost_usd(weight_kg, cfg["shipping_rate"])

            # Max Amazon price to reach target margin
            max_amz = max_amazon_price_usd(
                ml_price, commission, blue_rate, ship_usd, cfg["min_margin"] / 100,
            )

            # Catalog seller count (only if it's a catalog product)
            catalog_id = item.get("catalog_product_id")
            if catalog_id:
                sellers = get_catalog_seller_count(catalog_id)
                time.sleep(0.2)
            else:
                sellers = 0

            # Optional: auto Amazon price via PA API
            amz_price = search_amazon_price(query, ean)
            margin = (
                net_margin_pct(ml_price, amz_price, commission, blue_rate, ship_usd)
                if amz_price is not None
                else None
            )

            opportunities.append({
                "categoria": cat_name,
                "id_ml": item["id"],
                "titulo": item.get("title", "")[:70],
                "precio_ml_ars": round(ml_price),
                "ventas": item.get("sold_quantity", 0),
                "vendedores_catalogo": sellers,
                "comision_pct": round(commission * 100, 1),
                "peso_kg": round(weight_kg, 3) if weight_known else f"~{_DEFAULT_WEIGHT_KG}",
                "envio_usd": round(ship_usd, 2),
                "tipo_cambio_blue": round(blue_rate),
                "max_precio_amazon_usd": round(max_amz, 2),
                "precio_amazon_usd": round(amz_price, 2) if amz_price else "",
                "margen_neto_pct": round(margin, 1) if margin is not None else "",
                "ean": ean or "",
                "busqueda_amazon": query,
                "link_amazon": amazon_search_url(query),
                "link_ml": (
                    f"https://www.mercadolibre.com.ar/p/{catalog_id}"
                    if catalog_id
                    else f"https://articulo.mercadolibre.com.ar/{item['id']}"
                ),
            })
        time.sleep(0.3)

    return opportunities


def _filter_profitable(ops: list[dict], min_margin: float) -> list[dict]:
    """Keep only items with confirmed Amazon price AND margin ≥ min_margin."""
    return [
        op for op in ops
        if isinstance(op.get("margen_neto_pct"), (int, float))
        and op["margen_neto_pct"] >= min_margin
    ]


def _print_table(ops: list[dict], blue_rate: float, shipping_rate: float) -> None:
    sorted_ops = sorted(ops, key=lambda x: x["ventas"], reverse=True)
    has_amz = any(op["precio_amazon_usd"] != "" for op in ops)

    w = 130 if has_amz else 112
    print(f"\n{'─' * w}")
    header = (
        f"{'Producto':<44} {'ARS':>11} {'Vtas':>6} {'Vend':>5} "
        f"{'Peso':>6} {'Envío$':>7} {'Max Amz$':>9}"
    )
    if has_amz:
        header += f"  {'Amz$':>8}  {'Margen':>7}"
    print(header)
    print(f"{'─' * w}")

    for op in sorted_ops[:40]:
        peso_str = f"{op['peso_kg']}kg" if isinstance(op["peso_kg"], float) else str(op["peso_kg"])
        line = (
            f"{op['titulo'][:44]:<44} "
            f"${op['precio_ml_ars']:>10,}  "
            f"{op['ventas']:>5}  "
            f"{op['vendedores_catalogo']:>4}  "
            f"{peso_str:>6}  "
            f"${op['envio_usd']:>5.2f}  "
            f"${op['max_precio_amazon_usd']:>8,.2f}"
        )
        if has_amz:
            amz = f"${op['precio_amazon_usd']:>7,.2f}" if op["precio_amazon_usd"] != "" else "  ver →"
            mgn = f"{op['margen_neto_pct']:>6.1f}%" if op["margen_neto_pct"] != "" else "      —"
            line += f"  {amz}  {mgn}"
        print(line)

    print(f"{'─' * w}")
    print(
        f"\nDólar blue: ${blue_rate:,.0f} ARS/USD  |  "
        f"Envío: ${shipping_rate}/kg  |  "
        f"Peso '~0.5kg' = estimado (ML no informó)"
    )
    if not has_amz:
        print("Precio Amazon vacío → revisá la columna 'link_amazon' del CSV manualmente.")


def _save_csv(ops: list[dict], path: str) -> None:
    if not ops:
        return
    with open(path, "w", newline="", encoding="utf-8-sig") as f:
        writer = csv.DictWriter(f, fieldnames=list(ops[0].keys()))
        writer.writeheader()
        writer.writerows(ops)
    logger.info(f"CSV guardado: {path}")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Amazon→ML Arbitrage Finder",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument("--categories", help="IDs ML separados por coma (ej: MLA1051,MLA1071)")
    parser.add_argument("--min-sold", type=int, default=int(os.getenv("MIN_SOLD_QUANTITY", "10")))
    parser.add_argument("--min-margin", type=float, default=float(os.getenv("MIN_MARGIN_PERCENT", "20")))
    parser.add_argument("--shipping-rate", type=float, default=float(os.getenv("SHIPPING_RATE_PER_KG", "40")))
    parser.add_argument("--search-limit", type=int, default=50)
    parser.add_argument("--blue-rate", type=float, help="Tipo de cambio manual (ARS/USD)")
    parser.add_argument("--catalog-only", action="store_true", default=False,
                        help="Analizar solo productos en catálogo ML")
    args = parser.parse_args()

    # ── Dollar rate ──────────────────────────────────────────────────────────
    if args.blue_rate:
        blue_rate = args.blue_rate
        logger.info(f"Tipo de cambio manual: ${blue_rate:,.0f} ARS/USD")
    else:
        logger.info("Obteniendo dólar blue (dolarapi.com)...")
        try:
            blue_rate = get_blue_dollar_rate()
            logger.info(f"Dólar blue: ${blue_rate:,.0f} ARS/USD")
        except Exception as exc:
            logger.error(f"No se pudo obtener el dólar blue: {exc}")
            logger.info("Usá --blue-rate VALOR para ingresarlo manualmente.")
            sys.exit(1)

    cfg = {
        "min_sold": args.min_sold,
        "min_margin": args.min_margin,
        "shipping_rate": args.shipping_rate,
        "search_limit": args.search_limit,
        "catalog_only": args.catalog_only,
    }

    if args.categories:
        category_ids = [c.strip() for c in args.categories.split(",")]
    else:
        cats_env = os.getenv("ML_ARBITRAGE_CATEGORIES", "")
        category_ids = (
            [c.strip() for c in cats_env.split(",") if c.strip()]
            if cats_env
            else ["MLA1071", "MLA1051", "MLA3937"]
        )

    logger.info(
        f"Configuración: min_sold={cfg['min_sold']} | min_margin={cfg['min_margin']}% | "
        f"envío=${cfg['shipping_rate']}/kg | catalog_only={cfg['catalog_only']}\n"
    )

    all_ops: list[dict] = []
    for cat_id in category_ids:
        ops = _analyze_category(cat_id, blue_rate, cfg)
        all_ops.extend(ops)
        logger.info(f"  → {len(ops)} oportunidades encontradas\n")
        time.sleep(1)

    if not all_ops:
        logger.info("No se encontraron productos. Probá reducir --min-sold.")
        return

    profitable = _filter_profitable(all_ops, cfg["min_margin"])
    display_ops = profitable if profitable else all_ops

    print(f"\n{'═'*60}")
    if profitable:
        print(f"  {len(profitable)} productos con ≥{cfg['min_margin']:.0f}% margen confirmado")
    else:
        print(f"  Mostrando todos ({len(all_ops)}) — sin precios Amazon cargados aún")
    print(f"{'═'*60}")

    _print_table(display_ops, blue_rate, cfg["shipping_rate"])

    ts = datetime.now().strftime("%Y%m%d_%H%M")
    _save_csv(all_ops, f"arbitrage_{ts}.csv")
    logger.info(f"Total analizado: {len(all_ops)} | Rentables ≥{cfg['min_margin']:.0f}%: {len(profitable)}")

    # WhatsApp notification
    msg = build_message(all_ops, blue_rate, cfg["min_margin"])
    if send_whatsapp(msg):
        logger.info("✓ Notificación WhatsApp enviada")
    elif os.getenv("WPP_PHONE"):
        logger.warning("Error enviando WhatsApp — revisá WPP_PHONE y WPP_APIKEY en .env")

    if not os.getenv("AMAZON_ACCESS_KEY"):
        print(
            "\n── Amazon PA API (opcional, gratis) ─────────────────────────────────\n"
            "Para obtener precios de Amazon automáticamente:\n"
            "  1. Creá cuenta en affiliate-program.amazon.com\n"
            "  2. Pedí acceso a PA API en tu panel Associates\n"
            "  3. Agregá AMAZON_ACCESS_KEY, AMAZON_SECRET_KEY, AMAZON_ASSOCIATE_TAG al .env\n"
            "─────────────────────────────────────────────────────────────────────"
        )


if __name__ == "__main__":
    main()
