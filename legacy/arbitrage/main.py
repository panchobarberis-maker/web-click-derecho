"""
Amazon → MercadoLibre Arbitrage Finder

Uso:
  python -m arbitrage                           # analiza categorías del .env
  python -m arbitrage --categories MLA1051,MLA1071
  python -m arbitrage --min-sold 20 --min-margin 30
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

from .notify import send_whatsapp, build_message
from .ml_products import (
    search_category,
    get_items_bulk,
    extract_ean,
    extract_weight_kg,
    get_catalog_seller_count,
    build_search_query,
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

_DEFAULT_WEIGHT_KG = 0.5


def _analyze_category(category_id: str, ml_to_usd: float, cfg: dict) -> list[dict]:
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

            ean = extract_ean(item)
            query = build_search_query(item)

            weight_kg = extract_weight_kg(item)
            weight_known = weight_kg is not None
            if not weight_known:
                weight_kg = _DEFAULT_WEIGHT_KG
            ship_usd = shipping_cost_usd(weight_kg, cfg["shipping_rate"])

            max_amz = max_amazon_price_usd(
                ml_price, ml_to_usd, ship_usd, cfg["min_margin"] / 100,
            )

            if max_amz > cfg["max_amazon_usd"]:
                continue

            catalog_id = item.get("catalog_product_id")
            if catalog_id:
                sellers = get_catalog_seller_count(catalog_id)
                time.sleep(0.2)
            else:
                sellers = 0

            amz_price = search_amazon_price(query, ean)
            margin = (
                net_margin_pct(ml_price, amz_price, ml_to_usd, ship_usd)
                if amz_price is not None
                else None
            )

            # Earnings in USD = what you pocket after selling on ML
            earnings_usd = round(ml_price * ml_to_usd, 2)

            opportunities.append({
                "categoria": cat_name,
                "id_ml": item["id"],
                "titulo": item.get("title", "")[:70],
                "precio_ml_ars": round(ml_price),
                "ganancias_usd": earnings_usd,
                "ventas": item.get("sold_quantity", 0),
                "vendedores_catalogo": sellers,
                "peso_kg": round(weight_kg, 3) if weight_known else f"~{_DEFAULT_WEIGHT_KG}",
                "envio_usd": round(ship_usd, 2),
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
    return [
        op for op in ops
        if isinstance(op.get("margen_neto_pct"), (int, float))
        and op["margen_neto_pct"] >= min_margin
    ]


def _print_table(ops: list[dict], ml_to_usd: float, shipping_rate: float) -> None:
    sorted_ops = sorted(ops, key=lambda x: x["ventas"], reverse=True)
    has_amz = any(op["precio_amazon_usd"] != "" for op in ops)

    w = 130 if has_amz else 112
    print(f"\n{'─' * w}")
    header = (
        f"{'Producto':<44} {'ARS':>11} {'Cobro$':>7} {'Vtas':>6} {'Vend':>5} "
        f"{'Peso':>6} {'Envio$':>6} {'MaxAmz$':>8}"
    )
    if has_amz:
        header += f"  {'Amz$':>7}  {'Margen':>7}"
    print(header)
    print(f"{'─' * w}")

    for op in sorted_ops[:40]:
        peso_str = f"{op['peso_kg']}kg" if isinstance(op["peso_kg"], float) else str(op["peso_kg"])
        line = (
            f"{op['titulo'][:44]:<44} "
            f"${op['precio_ml_ars']:>10,}  "
            f"${op['ganancias_usd']:>5.2f}  "
            f"{op['ventas']:>5}  "
            f"{op['vendedores_catalogo']:>4}  "
            f"{peso_str:>6}  "
            f"${op['envio_usd']:>4.2f}  "
            f"${op['max_precio_amazon_usd']:>7,.2f}"
        )
        if has_amz:
            amz = f"${op['precio_amazon_usd']:>6,.2f}" if op["precio_amazon_usd"] != "" else "  ver→"
            mgn = f"{op['margen_neto_pct']:>6.1f}%" if op["margen_neto_pct"] != "" else "      —"
            line += f"  {amz}  {mgn}"
        print(line)

    print(f"{'─' * w}")
    print(f"Tasa ARS→USD: ×{ml_to_usd} | Envío: ${shipping_rate}/kg | Peso '~0.5kg' = estimado")
    if not has_amz:
        print("Precio Amazon vacío → revisá 'link_amazon' en el CSV.")


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
    parser.add_argument("--min-margin", type=float, default=float(os.getenv("MIN_MARGIN_PERCENT", "30")))
    parser.add_argument("--shipping-rate", type=float, default=float(os.getenv("SHIPPING_RATE_PER_KG", "40")))
    parser.add_argument("--max-amazon-usd", type=float, default=float(os.getenv("MAX_AMAZON_PRICE_USD", "100")))
    parser.add_argument("--ml-to-usd", type=float, default=float(os.getenv("ML_TO_USD_RATE", "0.00056")),
                        help="Multiplicador ARS→USD (default: 0.00056)")
    parser.add_argument("--search-limit", type=int, default=50)
    parser.add_argument("--catalog-only", action="store_true", default=False)
    args = parser.parse_args()

    ml_to_usd = args.ml_to_usd
    logger.info(f"Tasa ARS→USD: ×{ml_to_usd}  (precio ARS × {ml_to_usd} = USD que cobrás)")

    cfg = {
        "min_sold": args.min_sold,
        "min_margin": args.min_margin,
        "shipping_rate": args.shipping_rate,
        "max_amazon_usd": args.max_amazon_usd,
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
        f"Config: min_sold={cfg['min_sold']} | min_margin={cfg['min_margin']}% | "
        f"max_amazon=${cfg['max_amazon_usd']} | envío=${cfg['shipping_rate']}/kg | "
        f"catalog_only={cfg['catalog_only']}\n"
    )

    all_ops: list[dict] = []
    for cat_id in category_ids:
        ops = _analyze_category(cat_id, ml_to_usd, cfg)
        all_ops.extend(ops)
        logger.info(f"  → {len(ops)} candidatos\n")
        time.sleep(1)

    if not all_ops:
        logger.info("Sin productos. Probá reducir --min-sold.")
        return

    profitable = _filter_profitable(all_ops, cfg["min_margin"])
    display_ops = profitable if profitable else all_ops

    print(f"\n{'═' * 60}")
    if profitable:
        print(f"  {len(profitable)} productos con >= {cfg['min_margin']:.0f}% margen")
    else:
        print(f"  {len(all_ops)} candidatos (sin precios Amazon aun)")
    print(f"{'═' * 60}")

    _print_table(display_ops, ml_to_usd, cfg["shipping_rate"])

    ts = datetime.now().strftime("%Y%m%d_%H%M")
    _save_csv(all_ops, f"arbitrage_{ts}.csv")

    msg = build_message(all_ops, ml_to_usd, cfg["min_margin"])
    if send_whatsapp(msg):
        logger.info("✓ WhatsApp enviado")

    if not os.getenv("AMAZON_ACCESS_KEY"):
        print("\nTIP: sin PA API de Amazon el scraper funciona igual, pero mas lento.")


if __name__ == "__main__":
    main()
