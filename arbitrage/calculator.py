def max_amazon_price_usd(
    ml_price_ars: float,
    commission_rate: float,
    blue_rate: float,
    import_factor: float,
    min_margin: float,
) -> float:
    """
    Maximum Amazon price (USD) that allows at least `min_margin` net margin.

    revenue   = ml_price × (1 - commission)
    max_cost  = revenue × (1 - min_margin)          [ARS]
    max_amz   = max_cost / (blue_rate × import_factor) [USD]
    """
    revenue_ars = ml_price_ars * (1 - commission_rate)
    max_cost_ars = revenue_ars * (1 - min_margin)
    return max_cost_ars / (blue_rate * import_factor)


def net_margin_pct(
    ml_price_ars: float,
    amazon_usd: float,
    commission_rate: float,
    blue_rate: float,
    import_factor: float,
) -> float:
    """Net margin % when buying at amazon_usd and selling at ml_price_ars."""
    revenue_ars = ml_price_ars * (1 - commission_rate)
    cost_ars = amazon_usd * blue_rate * import_factor
    if revenue_ars <= 0:
        return 0.0
    return (revenue_ars - cost_ars) / revenue_ars * 100
