"""
Amazon.com price scraper — para uso personal / bajo volumen.

Usa una sesión HTTP persistente con headers de navegador real, delays
aleatorios y rotación de User-Agent para reducir bloqueos.

Limitaciones conocidas:
- Amazon puede pedir CAPTCHA después de muchas requests seguidas.
- Si ocurre, el scraper espera y reintenta; si persiste, pausa la sesión.
- Para volumen alto (>200 productos/día) conviene usar Rainforest API.
"""

import logging
import random
import re
import time

import requests
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)

_USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:122.0) Gecko/20100101 Firefox/122.0",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
]

_MIN_DELAY = 2.5   # seconds between requests
_MAX_DELAY = 5.0
_CAPTCHA_WAIT = 20  # seconds to wait after CAPTCHA before retrying


class AmazonScraper:
    def __init__(self):
        self._session = requests.Session()
        self._last_request_at = 0.0
        self._consecutive_blocks = 0
        self._rotate_ua()

    def _rotate_ua(self) -> None:
        ua = random.choice(_USER_AGENTS)
        self._session.headers.update({
            "User-Agent": ua,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
            "Accept-Encoding": "gzip, deflate, br",
            "Connection": "keep-alive",
            "Upgrade-Insecure-Requests": "1",
            "Sec-Fetch-Dest": "document",
            "Sec-Fetch-Mode": "navigate",
            "Sec-Fetch-Site": "none",
            "Sec-Fetch-User": "?1",
            "Cache-Control": "max-age=0",
        })

    def _throttle(self) -> None:
        elapsed = time.time() - self._last_request_at
        target = random.uniform(_MIN_DELAY, _MAX_DELAY)
        if elapsed < target:
            time.sleep(target - elapsed)
        self._last_request_at = time.time()

    def _is_captcha(self, html: str) -> bool:
        return (
            "Type the characters you see in this image" in html
            or "Enter the characters you see below" in html
            or "api-services-support@amazon.com" in html
            or 'id="captchacharacters"' in html
        )

    def _parse_lowest_price(self, html: str) -> float | None:
        soup = BeautifulSoup(html, "html.parser")
        prices: list[float] = []

        # Method 1: a-offscreen spans (most reliable — contains "$XX.XX" text)
        for span in soup.select("span.a-offscreen"):
            text = span.get_text(strip=True)
            match = re.search(r"\$([\d,]+\.?\d{0,2})", text)
            if match:
                try:
                    prices.append(float(match.group(1).replace(",", "")))
                except ValueError:
                    pass

        # Method 2: whole + fraction spans inside search result cards
        if not prices:
            for card in soup.select("div[data-component-type='s-search-result']"):
                whole = card.select_one("span.a-price-whole")
                frac = card.select_one("span.a-price-fraction")
                if whole:
                    try:
                        w = re.sub(r"[^\d]", "", whole.get_text())
                        f = re.sub(r"[^\d]", "", frac.get_text()) if frac else "00"
                        prices.append(float(f"{w}.{f[:2]}"))
                    except ValueError:
                        pass

        # Filter out clearly wrong values (< $0.50 or > $5,000)
        valid = [p for p in prices if 0.5 <= p <= 5000]
        return min(valid) if valid else None

    def search_price(self, query: str, ean: str | None = None) -> float | None:
        """Return the lowest Amazon.com price (USD) for the given query or EAN."""
        if self._consecutive_blocks >= 3:
            logger.warning("Amazon: demasiados bloqueos seguidos — pausando scraper por esta sesión")
            return None

        # Prefer EAN search (more precise product match)
        for term in ([ean, query] if ean else [query]):
            self._throttle()
            try:
                resp = self._session.get(
                    "https://www.amazon.com/s",
                    params={"k": term, "i": "aps"},
                    timeout=15,
                )
            except Exception as exc:
                logger.warning(f"Amazon request error: {exc}")
                return None

            if resp.status_code != 200:
                logger.warning(f"Amazon HTTP {resp.status_code} para '{term}'")
                return None

            if self._is_captcha(resp.text):
                self._consecutive_blocks += 1
                logger.warning(
                    f"Amazon CAPTCHA ({self._consecutive_blocks}/3) — "
                    f"esperando {_CAPTCHA_WAIT}s y rotando User-Agent..."
                )
                self._rotate_ua()
                time.sleep(_CAPTCHA_WAIT)
                return None

            self._consecutive_blocks = 0
            price = self._parse_lowest_price(resp.text)
            if price is not None:
                logger.debug(f"Amazon '{term}' → ${price:.2f}")
                return price

        return None


# Module-level singleton: reuses the same session across all calls in a run
_scraper: AmazonScraper | None = None


def get_scraper() -> AmazonScraper:
    global _scraper
    if _scraper is None:
        _scraper = AmazonScraper()
    return _scraper
