import requests

from .auth import MLAuth

_BASE = "https://api.mercadolibre.com"


class MLClient:
    def __init__(self, auth: MLAuth):
        self.auth = auth

    # ── internals ──────────────────────────────────────────────────────────

    def _headers(self) -> dict:
        return {"Authorization": f"Bearer {self.auth.access_token}"}

    def _get(self, path: str, params: dict | None = None, _retry: bool = True) -> dict:
        resp = requests.get(f"{_BASE}{path}", headers=self._headers(), params=params)
        if resp.status_code == 401 and _retry:
            self.auth.refresh_access_token()
            return self._get(path, params, _retry=False)
        resp.raise_for_status()
        return resp.json()

    def _put(self, path: str, data: dict, _retry: bool = True) -> dict:
        resp = requests.put(f"{_BASE}{path}", headers=self._headers(), json=data)
        if resp.status_code == 401 and _retry:
            self.auth.refresh_access_token()
            return self._put(path, data, _retry=False)
        resp.raise_for_status()
        return resp.json()

    # ── public API ─────────────────────────────────────────────────────────

    def get_my_item_ids(self) -> list[str]:
        """Return all active item IDs for the authenticated seller."""
        ids: list[str] = []
        offset = 0
        limit = 100
        while True:
            data = self._get(
                f"/users/{self.auth.user_id}/items/search",
                params={"status": "active", "limit": limit, "offset": offset},
            )
            batch = data.get("results", [])
            ids.extend(batch)
            if len(batch) < limit:
                break
            offset += limit
        return ids

    def get_items_bulk(self, item_ids: list[str]) -> list[dict]:
        """Fetch up to 20 items in one request."""
        data = self._get("/items", params={"ids": ",".join(item_ids)})
        return [entry["body"] for entry in data if entry.get("code") == 200]

    def search_by_category(self, category_id: str, limit: int = 50) -> dict:
        return self._get(
            "/sites/MLA/search",
            params={"category": category_id, "limit": limit},
        )

    def update_price(self, item_id: str, new_price: float) -> dict:
        return self._put(f"/items/{item_id}", {"price": round(new_price, 2)})
