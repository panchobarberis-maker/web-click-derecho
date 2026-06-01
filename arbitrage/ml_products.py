import os
import time

import requests
from dotenv import load_dotenv

load_dotenv()

_BASE = "https://api.mercadolibre.com"

# Approximate ML commission rates by category ID prefix (Argentina 2025)
_COMMISSION: dict[str, float] = {
    "MLA1071": 0.14,  # Celulares y telefonía
    "MLA1051": 0.14,  # Electrónica
    "MLA1000": 0.12,  # Electrodomésticos
    "MLA1648": 0.17,  # Ropa y accesorios
    "MLA1144": 0.14,  # Deportes y fitness
    "MLA3937": 0.14,  # Juguetes
    "MLA1499": 0.13,  # Hogar, muebles y jardín
    "MLA1747": 0.10,  # Autos y motos
    "MLA1182": 0.14,  # Herramientas
    "MLA1574": 0.14,  # Bebés
    "MLA1039": 0.14,  # Computación
}


def _headers() -> dict:
    token = os.getenv("ML_ACCESS_TOKEN", "")
    return {"Authorization": f"Bearer {token}"}


def commission_for(category_id: str) -> float:
    for prefix, rate in _COMMISSION.items():
        if category_id.startswith(prefix):
            return rate
    return float(os.getenv("ML_COMMISSION_PERCENT", "13")) / 100


def search_category(category_id: str, limit: int = 50, catalog_only: bool = False) -> list[dict]:
    """Search ML for products in a category sorted by relevance (best sellers rank high)."""
    params: dict = {"category": category_id, "sort": "relevance", "limit": limit}
    resp = requests.get(
        f"{_BASE}/sites/MLA/search",
        headers=_headers(),
        params=params,
        timeout=15,
    )
    resp.raise_for_status()
    results = resp.json().get("results", [])

    if catalog_only:
        results = [r for r in results if r.get("catalog_product_id")]

    return results


def get_items_bulk(item_ids: list[str]) -> list[dict]:
    """Fetch up to 20 item details in a single API call."""
    resp = requests.get(
        f"{_BASE}/items",
        headers=_headers(),
        params={"ids": ",".join(item_ids)},
        timeout=15,
    )
    resp.raise_for_status()
    return [e["body"] for e in resp.json() if e.get("code") == 200]


def extract_ean(item: dict) -> str | None:
    for attr in item.get("attributes", []):
        if attr.get("id") in ("EAN", "UPC", "ISBN", "GTIN"):
            v = attr.get("value_name", "")
            if v and v not in ("N/A", "0", ""):
                return v
    return None


def extract_brand_model(item: dict) -> tuple[str, str]:
    attrs = {a["id"]: a.get("value_name", "") for a in item.get("attributes", [])}
    return attrs.get("BRAND", ""), attrs.get("MODEL", "")


def build_search_query(item: dict) -> str:
    """Build a clean Amazon search query from item attributes or title."""
    brand, model = extract_brand_model(item)
    if brand and model:
        return f"{brand} {model}"
    # Fall back to title, removing common ML noise
    _noise = {"usado", "refabricado", "nuevo", "original", "sellado", "unidad", "pack"}
    words = [w for w in item.get("title", "").split() if w.lower() not in _noise]
    return " ".join(words[:8])
