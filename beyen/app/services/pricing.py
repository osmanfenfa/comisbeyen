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

    moisture_deduction = water_percent - standard_percent
    net_weight = weight_kg - moisture_deduction
    total_price = net_weight * price_per_kg

    Example: weight=40, water_percent=13.7, standard=7, price=40
             -> deduction=6.7, net_weight=33.3, total_price=1332.0
    """
    if water_percent < 0:
        raise ValueError("Water percentage cannot be negative.")

    computed_water_percent = max(water_percent, standard_percent)
    moisture_deduction = round(computed_water_percent - standard_percent, 2)
    net_weight = round(weight_kg - moisture_deduction, 2)

    if net_weight <= 0:
        raise ValueError("Net weight is zero or negative — check the entered values.")

    total_price = round(net_weight * price_per_kg, 2)

    return {
        "moisture_deduction": moisture_deduction,
        "net_weight_kg": net_weight,
        "total_price": total_price,
    }


def calculate_direct_price(weight_kg: float, price_per_kg: float) -> float:
    """Used for Cola (and future Spice) — simple weight x price, no deduction."""
    return round(weight_kg * price_per_kg, 2)


def calculate_loan_balance(loan_taken: float, total_paid: float) -> float:
    return round(loan_taken - total_paid, 2)
