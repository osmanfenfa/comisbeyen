"""
Core pricing calculations for COMIS.
Kept as pure functions so they're easy to unit test and reused by both
the API layer and (mirrored logic in) the frontend live-preview.
"""


def calculate_moisture_deduction_price(
    weight_kg: float, water_percent: float, standard_percent: float, price_per_kg: float
) -> dict:
    """
    Used for Cocoa and Coffee.

    Excess moisture percentage above standard baseline is deducted proportionally
    from the gross weight:
      excess_percent = max(0.0, water_percent - standard_percent)
      moisture_deduction_kg = weight_kg * (excess_percent / 100.0)
      net_weight_kg = weight_kg - moisture_deduction_kg
      total_price = net_weight_kg * price_per_kg

    Example: weight=20kg, water_percent=12%, standard=7%, price=40
             -> excess=5%, deduction=20*0.05=1.0kg, net_weight=19.0kg, total_price=760.0
    """
    if water_percent < 0:
        raise ValueError("Water percentage cannot be negative.")

    computed_water_percent = max(water_percent, standard_percent)
    excess_percent = round(computed_water_percent - standard_percent, 2)
    moisture_deduction = round(weight_kg * (excess_percent / 100.0), 2)
    net_weight = round(weight_kg - moisture_deduction, 2)

    if net_weight <= 0:
        raise ValueError("Net weight is zero or negative — check the entered values.")

    total_price = round(net_weight * price_per_kg, 2)

    return {
        "moisture_deduction": moisture_deduction,
        "moisture_deduction_kg": moisture_deduction,
        "excess_percent": excess_percent,
        "net_weight_kg": net_weight,
        "total_price": total_price,
    }


def calculate_direct_price(weight_kg: float, price_per_kg: float) -> float:
    """Used for Cola (and future Spice) — simple weight x price, no deduction."""
    return round(weight_kg * price_per_kg, 2)


def calculate_loan_balance(loan_taken: float, total_paid: float) -> float:
    return round(loan_taken - total_paid, 2)
