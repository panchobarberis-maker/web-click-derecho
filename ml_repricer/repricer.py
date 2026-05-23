import logging
import os
import time

from .client import MLClient

logger = logging.getLogger(__name__)


class RepricingRule:
    """Encapsulates the configured repricing strategy and price limits."""

    def __init__(self):
        # undercut_min  → precio mínimo del mercado menos el margen
        # match_min     → igualar el precio mínimo
        # undercut_avg  → precio promedio del mercado menos el margen
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
        else:  # undercut_min (default)
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
            # skip own listings
            if str(r.get("seller", {}).get("id")) == self.my_user_id:
                continue
            # match condition (new / used)
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

        target = self.rule.target_price(prices)
        if target is None:
            return {"item_id": item_id, "action": "skip", "reason": "no_target"}

        logger.info(
            f"[{item_id}] '{title}' | "
            f"actual=${current:.2f}  competidores: min=${min(prices):.2f} "
            f"avg=${sum(prices)/len(prices):.2f}  objetivo=${target:.2f}"
        )

        if not self.rule.should_update(current, target):
            logger.info(f"[{item_id}] Cambio menor al umbral ({self.rule.min_change_pct}%) — omitido")
            return {
                "item_id": item_id,
                "action": "skip",
                "reason": "below_threshold",
                "current": current,
                "target": target,
            }

        try:
            self.client.update_price(item_id, target)
            logger.info(f"[{item_id}] ✓ Precio actualizado ${current:.2f} → ${target:.2f}")
            return {"item_id": item_id, "action": "updated", "old": current, "new": target}
        except Exception as exc:
            logger.error(f"[{item_id}] Error al actualizar: {exc}")
            return {"item_id": item_id, "action": "error", "reason": str(exc)}

    def run(self) -> dict:
        logger.info("Obteniendo publicaciones activas...")
        ids = self.client.get_my_item_ids()
        logger.info(f"Total: {len(ids)} publicaciones activas\n")

        counts = {"updated": 0, "skipped": 0, "errors": 0}

        # ML bulk endpoint accepts up to 20 IDs at a time
        for i in range(0, len(ids), 20):
            items = self.client.get_items_bulk(ids[i : i + 20])
            for item in items:
                result = self._reprice_one(item)
                counts[result["action"] if result["action"] in counts else "errors"] += 1
                time.sleep(0.4)  # avoid rate-limit

        logger.info(
            f"\n── Resumen ──────────────────────────────\n"
            f"  Actualizados : {counts['updated']}\n"
            f"  Sin cambio   : {counts['skipped']}\n"
            f"  Errores      : {counts['errors']}\n"
            f"─────────────────────────────────────────"
        )
        return counts
