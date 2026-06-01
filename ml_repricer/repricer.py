import logging
import os
import time

import requests

from .client import MLClient
from . import cost_db

logger = logging.getLogger(__name__)

# Commission rates by ML category prefix (Argentina 2025)
_COMMISSION = {
    "MLA1071": 0.14, "MLA1051": 0.14, "MLA1000": 0.12,
    "MLA1648": 0.17, "MLA1144": 0.14, "MLA3937": 0.14,
    "MLA1499": 0.13, "MLA1747": 0.10, "MLA1182": 0.14,
    "MLA1574": 0.14, "MLA1039": 0.14,
}


def _commission_for(category_id: str) -> float:
    for prefix, rate in _COMMISSION.items():
        if category_id.startswith(prefix):
            return rate
    return float(os.getenv("ML_COMMISSION_PERCENT", "13")) / 100


def _fetch_blue_rate() -> float | None:
    try:
        resp = requests.get("https://dolarapi.com/v1/dolares/blue", timeout=8)
        resp.raise_for_status()
        return float(resp.json()["venta"])
    except Exception:
        fallback = os.getenv("FALLBACK_BLUE_RATE", "")
        return float(fallback) if fallback else None


class RepricingRule:
    def __init__(self):
        self.strategy: str = os.getenv("STRATEGY", "undercut_min")
        self.margin_pct: float = float(os.getenv("MARGIN_PERCENT", "2"))
        self.min_price: float = float(os.getenv("MIN_PRICE", "0"))
        self.max_price: float = float(os.getenv("MAX_PRICE", "9999999"))
        self.min_change_pct: float = float(os.getenv("MIN_CHANGE_THRESHOLD", "1"))

    def target_price(self, competitor_prices: list[float]) -> float | None:
        if not competitor_prices:
            return None
        if self.strategy == "match_min":
            base = min(competitor_prices)
        elif self.strategy == "undercut_avg":
            avg = sum(competitor_prices) / len(competitor_prices)
            base = avg * (1 - self.margin_pct / 100)
        else:  # undercut_min
            base = min(competitor_prices) * (1 - self.margin_pct / 100)
        return max(self.min_price, min(self.max_price, base))

    def should_update(self, current: float, target: float) -> bool:
        if current == 0:
            return True
        return abs(target - current) / current * 100 >= self.min_change_pct


class Repricer:
    def __init__(self, client: MLClient):
        self.client = client
        self.rule = RepricingRule()
        self.my_user_id = str(client.auth.user_id)
        self._blue_rate: float | None = None

    def _get_blue_rate(self) -> float | None:
        if self._blue_rate is None:
            self._blue_rate = _fetch_blue_rate()
        return self._blue_rate

    def _min_viable_price(self, item: dict) -> float:
        """
        Minimum ARS price to cover real Amazon cost + desired margin.

        formula: P_min = (amazon_usd + shipping_usd) / (ml_to_usd × (1 - min_margin))
        """
        cost = cost_db.get(item["id"])
        if not cost:
            return self.rule.min_price

        ml_to_usd = float(os.getenv("ML_TO_USD_RATE", "0.00056"))
        shipping_rate = float(os.getenv("SHIPPING_RATE_PER_KG", "40"))
        min_margin = float(os.getenv("MIN_MARGIN_PERCENT", "30")) / 100

        total_cost_usd = cost["amazon_usd"] + cost["weight_kg"] * shipping_rate
        viable = total_cost_usd / (ml_to_usd * (1 - min_margin))
        return max(viable, self.rule.min_price)

    def _competitor_prices(self, item: dict) -> list[float]:
        category_id = item.get("category_id")
        if not category_id:
            return []
        try:
            results = self.client.search_by_category(category_id, limit=50)
        except Exception as exc:
            logger.warning(f"[{item['id']}] Error buscando competidores: {exc}")
            return []

        prices = []
        for r in results.get("results", []):
            if str(r.get("seller", {}).get("id")) == self.my_user_id:
                continue
            if r.get("condition") != item.get("condition"):
                continue
            price = r.get("price")
            if price and price > 0:
                prices.append(float(price))
        return prices

    def _reprice_one(self, item: dict) -> dict:
        item_id = item["id"]
        current = float(item.get("price", 0))
        title = item.get("title", item_id)[:45]

        prices = self._competitor_prices(item)
        if not prices:
            logger.info(f"[{item_id}] '{title}' — sin competidores, sin cambio")
            return {"item_id": item_id, "action": "skip", "reason": "no_competitors"}

        # Apply cost-aware floor per item
        floor = self._min_viable_price(item)
        original_min = self.rule.min_price
        self.rule.min_price = floor

        target = self.rule.target_price(prices)
        self.rule.min_price = original_min  # restore global setting

        if target is None:
            return {"item_id": item_id, "action": "skip", "reason": "no_target"}

        cost_note = f" [floor=${floor:,.0f}]" if floor > self.rule.min_price else ""
        logger.info(
            f"[{item_id}] '{title}' | "
            f"actual=${current:.2f}  min=${min(prices):.2f}  objetivo=${target:.2f}{cost_note}"
        )

        if not self.rule.should_update(current, target):
            logger.info(f"[{item_id}] Cambio menor al umbral — omitido")
            return {"item_id": item_id, "action": "skip", "reason": "below_threshold",
                    "current": current, "target": target}

        try:
            self.client.update_price(item_id, target)
            logger.info(f"[{item_id}] ✓ ${current:.2f} → ${target:.2f}")
            return {"item_id": item_id, "action": "updated", "old": current, "new": target}
        except Exception as exc:
            logger.error(f"[{item_id}] Error: {exc}")
            return {"item_id": item_id, "action": "error", "reason": str(exc)}

    def run(self) -> dict:
        logger.info("Obteniendo publicaciones activas...")

        blue = self._get_blue_rate()
        if blue:
            logger.info(f"Dólar blue: ${blue:,.0f} ARS/USD")
        else:
            logger.warning("No se pudo obtener dólar blue — items con cost_db usarán FALLBACK_BLUE_RATE")

        ids = self.client.get_my_item_ids()
        logger.info(f"Total: {len(ids)} publicaciones activas\n")

        counts = {"updated": 0, "skipped": 0, "errors": 0}
        for i in range(0, len(ids), 20):
            items = self.client.get_items_bulk(ids[i : i + 20])
            for item in items:
                result = self._reprice_one(item)
                counts[result["action"] if result["action"] in counts else "errors"] += 1
                time.sleep(0.4)

        logger.info(
            f"\n── Resumen ──────────────────────────────\n"
            f"  Actualizados : {counts['updated']}\n"
            f"  Sin cambio   : {counts['skipped']}\n"
            f"  Errores      : {counts['errors']}\n"
            f"─────────────────────────────────────────"
        )
        return counts
