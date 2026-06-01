def shipping_cost_usd(weight_kg: float, rate_per_kg: float) -> float:
    return weight_kg * rate_per_kg


def max_amazon_price_usd(
    ml_price_ars: float,
    ml_to_usd: float,
    shipping_usd: float,
    min_margin: float,
) -> float:
    """
    Maximum Amazon product price (USD) to achieve at least min_margin net margin.

    earnings_usd = ml_price_ars × ml_to_usd   (ya incluye comisión ML)
    max_amazon   = earnings_usd × (1 - min_margin) - shipping_usd
    """
    earnings_usd = ml_price_ars * ml_to_usd
    return max(0.0, earnings_usd * (1 - min_margin) - shipping_usd)


def net_margin_pct(
    ml_price_ars: float,
    amazon_usd: float,
    ml_to_usd: float,
    shipping_usd: float,
) -> float:
    """Net margin % — todo en USD para evitar conversiones."""
    earnings_usd = ml_price_ars * ml_to_usd
    total_cost_usd = amazon_usd + shipping_usd
    if earnings_usd <= 0:
        return 0.0
    return (earnings_usd - total_cost_usd) / earnings_usd * 100
