import os

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


def extract_weight_kg(item: dict) -> float | None:
    """Extract item weight in kg from ML attributes. Returns None if not found."""
    for attr in item.get("attributes", []):
        if attr.get("id") != "WEIGHT":
            continue
        vs = attr.get("value_struct")
        if vs:
            number = float(vs.get("number", 0) or 0)
            unit = (vs.get("unit") or "g").lower()
            if unit in ("kg", "kilogram", "kilogramo", "kilogramos"):
                return number
            if unit in ("g", "gram", "gramo", "gramos"):
                return number / 1000
            if unit in ("lb", "lbs", "pound", "libra"):
                return number * 0.453592
        # fallback: parse value_name like "500 g" or "1.2 kg"
        value_name = attr.get("value_name", "") or ""
        for suffix, factor in (("kg", 1), ("g", 0.001), ("lb", 0.453592)):
            if suffix in value_name.lower():
                try:
                    return float(value_name.lower().replace(suffix, "").strip()) * factor
                except ValueError:
                    pass
    return None


def get_catalog_seller_count(catalog_product_id: str) -> int:
    """Count active sellers competing in a catalog listing."""
    resp = requests.get(
        f"{_BASE}/sites/MLA/search",
        headers=_headers(),
        params={"catalog_product_id": catalog_product_id, "limit": 50},
        timeout=15,
    )
    if resp.status_code != 200:
        return 0
    results = resp.json().get("results", [])
    seller_ids = {r.get("seller", {}).get("id") for r in results if r.get("seller")}
    return len(seller_ids)
