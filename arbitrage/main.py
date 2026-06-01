"""
Amazon → MercadoLibre Arbitrage Finder

Uso:
  python -m arbitrage                          # analiza categorías del .env
  python -m arbitrage --categories MLA1051,MLA1071
  python -m arbitrage --min-sold 20 --min-margin 25
  python -m arbitrage --blue-rate 1250         # tipo de cambio manual
  python -m arbitrage --catalog-only          # solo productos en catálogo ML
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
from .ml_products import (
    search_category,
    get_items_bulk,
    extract_ean,
    build_search_query,
    commission_for,
)
from .amazon import search_amazon_price, amazon_search_url
from .calculator import max_amazon_price_usd, net_margin_pct

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

# Category ID → friendly name (Argentina)
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


def _analyze_category(
    category_id: str,
    blue_rate: float,
    cfg: dict,
) -> list[dict]:
    cat_name = KNOWN_CATEGORIES.get(category_id, category_id)
    logger.info(f"▸ Analizando '{cat_name}' ({category_id})...")

    raw = search_category(category_id, limit=cfg["search_limit"], catalog_only=cfg["catalog_only"])

    # Filter by minimum sold quantity (search results include sold_quantity)
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

            max_amz = max_amazon_price_usd(
                ml_price, commission, blue_rate,
                cfg["import_factor"], cfg["min_margin"] / 100,
            )

            amz_price = search_amazon_price(query, ean)
            margin = (
                net_margin_pct(ml_price, amz_price, commission, blue_rate, cfg["import_factor"])
                if amz_price is not None
                else None
            )

            opportunities.append({
                "categoria": cat_name,
                "id_ml": item["id"],
                "titulo": item.get("title", "")[:70],
                "precio_ml_ars": round(ml_price),
                "ventas": item.get("sold_quantity", 0),
                "comision_pct": round(commission * 100, 1),
                "tipo_cambio_blue": round(blue_rate),
                "factor_importacion": cfg["import_factor"],
                "max_precio_amazon_usd": round(max_amz, 2),
                "precio_amazon_usd": round(amz_price, 2) if amz_price else "",
                "margen_neto_pct": round(margin, 1) if margin is not None else "",
                "ean": ean or "",
                "busqueda_amazon": query,
                "link_amazon": amazon_search_url(query),
                "link_ml": f"https://www.mercadolibre.com.ar/p/{item.get('catalog_product_id', item['id'])}",
            })
        time.sleep(0.3)

    return opportunities


def _print_table(ops: list[dict], blue_rate: float) -> None:
    sorted_ops = sorted(ops, key=lambda x: x["ventas"], reverse=True)
    has_amz_prices = any(op["precio_amazon_usd"] != "" for op in ops)

    w = 115 if has_amz_prices else 100
    print(f"\n{'─' * w}")
    header = (
        f"{'Producto':<48} {'ARS':>12} {'Ventas':>7} {'Comis':>6} "
        f"{'Max Amazon $':>13}"
    )
    if has_amz_prices:
        header += f"  {'Amazon $':>10}  {'Margen':>7}"
    print(header)
    print(f"{'─' * w}")

    for op in sorted_ops[:40]:
        line = (
            f"{op['titulo'][:48]:<48} "
            f"${op['precio_ml_ars']:>11,}  "
            f"{op['ventas']:>6}  "
            f"{op['comision_pct']:>4.0f}%  "
            f"${op['max_precio_amazon_usd']:>12,.2f}"
        )
        if has_amz_prices:
            amz = f"${op['precio_amazon_usd']:>9,.2f}" if op["precio_amazon_usd"] != "" else "  ver link→"
            margin = f"{op['margen_neto_pct']:>6.1f}%" if op["margen_neto_pct"] != "" else "       —"
            line += f"  {amz}  {margin}"
        print(line)

    print(f"{'─' * w}")
    print(f"\nDólar blue usado: ${blue_rate:,.0f} ARS/USD")
    if not has_amz_prices:
        print("Columna 'Amazon $' vacía — configurá la PA API o revisá los links manualmente.")


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
    parser.add_argument("--import-factor", type=float, default=float(os.getenv("IMPORT_COST_FACTOR", "1.4")))
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
        "import_factor": args.import_factor,
        "search_limit": args.search_limit,
        "catalog_only": args.catalog_only,
    }

    # ── Categories ───────────────────────────────────────────────────────────
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
        f"import_factor={cfg['import_factor']}x | catalog_only={cfg['catalog_only']}\n"
    )

    # ── Analyze ──────────────────────────────────────────────────────────────
    all_ops: list[dict] = []
    for cat_id in category_ids:
        ops = _analyze_category(cat_id, blue_rate, cfg)
        all_ops.extend(ops)
        logger.info(f"  → {len(ops)} oportunidades encontradas\n")
        time.sleep(1)

    if not all_ops:
        logger.info("No se encontraron productos. Probá reducir --min-sold.")
        return

    _print_table(all_ops, blue_rate)

    ts = datetime.now().strftime("%Y%m%d_%H%M")
    _save_csv(all_ops, f"arbitrage_{ts}.csv")
    logger.info(f"Total analizado: {len(all_ops)} productos")

    if not os.getenv("AMAZON_ACCESS_KEY"):
        print(
            "\n── Amazon PA API (opcional, gratis) ─────────────────────────────────\n"
            "Para obtener precios de Amazon automáticamente:\n"
            "  1. Creá cuenta en affiliate-program.amazon.com (gratis)\n"
            "  2. Pedí acceso a Product Advertising API en tu panel Associates\n"
            "  3. Agregá al .env:\n"
            "       AMAZON_ACCESS_KEY=...\n"
            "       AMAZON_SECRET_KEY=...\n"
            "       AMAZON_ASSOCIATE_TAG=tu-tag-20\n"
            "─────────────────────────────────────────────────────────────────────"
        )


if __name__ == "__main__":
    main()
