"""
Cost database: maps ML item IDs to their real Amazon purchase cost.

File: cost_db.json (next to .env)
Format:
  {
    "MLA123456789": {"amazon_usd": 45.99, "weight_kg": 0.3},
    ...
  }

Podés popularlo a mano o desde el CSV que genera el arbitrage finder.
"""

import json
import os
from pathlib import Path

_PATH = Path(os.getenv("COST_DB_PATH", "cost_db.json"))


def load() -> dict:
    if not _PATH.exists():
        return {}
    with open(_PATH, encoding="utf-8") as f:
        return json.load(f)


def get(item_id: str) -> dict | None:
    return load().get(item_id)


def upsert(item_id: str, amazon_usd: float, weight_kg: float) -> None:
    db = load()
    db[item_id] = {"amazon_usd": amazon_usd, "weight_kg": weight_kg}
    with open(_PATH, "w", encoding="utf-8") as f:
        json.dump(db, f, indent=2, ensure_ascii=False)
