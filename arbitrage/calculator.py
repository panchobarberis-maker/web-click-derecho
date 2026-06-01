def shipping_cost_usd(weight_kg: float, rate_per_kg: float) -> float:
    return weight_kg * rate_per_kg


def max_amazon_price_usd(
    ml_price_ars: float,
    commission_rate: float,
    blue_rate: float,
    shipping_usd: float,
    min_margin: float,
) -> float:
    """
    Maximum Amazon product price (USD) that allows at least `min_margin` net margin.

    revenue_ars       = ml_price × (1 - commission)
    max_total_cost_usd = revenue_ars × (1 - min_margin) / blue_rate
    max_amazon_usd    = max_total_cost_usd - shipping_usd
    """
    revenue_ars = ml_price_ars * (1 - commission_rate)
    max_total_usd = revenue_ars * (1 - min_margin) / blue_rate
    return max(0.0, max_total_usd - shipping_usd)


def net_margin_pct(
    ml_price_ars: float,
    amazon_usd: float,
    commission_rate: float,
    blue_rate: float,
    shipping_usd: float,
) -> float:
    """Net margin % when buying amazon_usd + shipping and selling at ml_price_ars."""
    revenue_ars = ml_price_ars * (1 - commission_rate)
    total_cost_ars = (amazon_usd + shipping_usd) * blue_rate
    if revenue_ars <= 0:
        return 0.0
    return (revenue_ars - total_cost_ars) / revenue_ars * 100
