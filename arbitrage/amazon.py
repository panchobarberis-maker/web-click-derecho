"""
Amazon price lookup — dos métodos en cascada:

1. PA API v5 (si AMAZON_ACCESS_KEY está configurada) — oficial y confiable.
2. Scraper (fallback automático) — funciona para volumen bajo (~50 productos/sesión).
"""

import hashlib
import hmac
import json
import os
from datetime import datetime, timezone
from urllib.parse import quote_plus

import requests

_HOST = "webservices.amazon.com"
_PATH = "/paapi5/searchitems"
_REGION = "us-east-1"
_SERVICE = "ProductAdvertisingAPI"
_TARGET = "com.amazon.paapi5.v1.ProductAdvertisingAPIv1.SearchItems"


def amazon_search_url(query: str) -> str:
    return f"https://www.amazon.com/s?k={quote_plus(query)}"


# ── AWS Signature V4 ────────────────────────────────────────────────────────

def _sign(key: bytes, msg: str) -> bytes:
    return hmac.new(key, msg.encode("utf-8"), hashlib.sha256).digest()


def _signing_key(secret: str, date_stamp: str) -> bytes:
    k1 = _sign(("AWS4" + secret).encode("utf-8"), date_stamp)
    k2 = _sign(k1, _REGION)
    k3 = _sign(k2, _SERVICE)
    return _sign(k3, "aws4_request")


def _paapi_post(payload: dict) -> dict:
    access_key = os.getenv("AMAZON_ACCESS_KEY", "")
    secret_key = os.getenv("AMAZON_SECRET_KEY", "")

    now = datetime.now(timezone.utc)
    amz_date = now.strftime("%Y%m%dT%H%M%SZ")
    date_stamp = now.strftime("%Y%m%d")

    body = json.dumps(payload)
    body_hash = hashlib.sha256(body.encode()).hexdigest()

    signed_headers_map = {
        "content-encoding": "amz-1.0",
        "content-type": "application/json; charset=utf-8",
        "host": _HOST,
        "x-amz-date": amz_date,
        "x-amz-target": _TARGET,
    }
    canonical_headers = "".join(f"{k}:{v}\n" for k, v in sorted(signed_headers_map.items()))
    signed_headers_str = ";".join(sorted(signed_headers_map.keys()))

    canonical_request = "\n".join([
        "POST", _PATH, "",
        canonical_headers, signed_headers_str, body_hash,
    ])

    credential_scope = f"{date_stamp}/{_REGION}/{_SERVICE}/aws4_request"
    string_to_sign = "\n".join([
        "AWS4-HMAC-SHA256", amz_date, credential_scope,
        hashlib.sha256(canonical_request.encode()).hexdigest(),
    ])

    sig = hmac.new(
        _signing_key(secret_key, date_stamp),
        string_to_sign.encode(),
        hashlib.sha256,
    ).hexdigest()

    auth = (
        f"AWS4-HMAC-SHA256 Credential={access_key}/{credential_scope}, "
        f"SignedHeaders={signed_headers_str}, Signature={sig}"
    )

    resp = requests.post(
        f"https://{_HOST}{_PATH}",
        data=body,
        headers={**signed_headers_map, "Authorization": auth},
        timeout=15,
    )
    resp.raise_for_status()
    return resp.json()


# ── Public interface ────────────────────────────────────────────────────────

def search_amazon_price(query: str, ean: str | None = None) -> float | None:
    """
    Return the lowest Amazon.com price (USD) for the given query/EAN.
    Tries PA API first; falls back to scraper automatically.
    """
    # 1. PA API (if configured)
    if os.getenv("AMAZON_ACCESS_KEY"):
        associate_tag = os.getenv("AMAZON_ASSOCIATE_TAG", "")
        payload = {
            "Keywords": ean if ean else query,
            "Marketplace": "www.amazon.com",
            "PartnerTag": associate_tag,
            "PartnerType": "Associates",
            "Resources": ["Offers.Listings.Price"],
            "SearchIndex": "All",
        }
        try:
            data = _paapi_post(payload)
            for item in data.get("SearchResult", {}).get("Items", []):
                for listing in item.get("Offers", {}).get("Listings", []):
                    price = listing.get("Price", {}).get("Amount")
                    if price:
                        return float(price)
        except Exception:
            pass  # fall through to scraper

    # 2. Scraper fallback
    from .amazon_scraper import get_scraper
    return get_scraper().search_price(query, ean)
