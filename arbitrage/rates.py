import requests


def get_blue_dollar_rate() -> float:
    """Fetch current blue dollar rate (ARS per USD) from dolarapi.com."""
    resp = requests.get("https://dolarapi.com/v1/dolares/blue", timeout=10)
    resp.raise_for_status()
    return float(resp.json()["venta"])
