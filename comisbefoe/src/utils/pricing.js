/**
 * Mirrors backend/app/services/pricing.py so the mobile UI can show a
 * live price preview before the user hits Save (no round-trip needed).
 * IMPORTANT: the backend is still the source of truth / final validator.
 */
export function calculateMoistureDeductionPrice(weightKg, waterPercent, standardPercent, pricePerKg) {
  const computedWater = Math.max(waterPercent, standardPercent);
  const excessPercent = +(computedWater - standardPercent).toFixed(2);
  const moistureDeduction = +((weightKg * excessPercent) / 100).toFixed(2);
  const netWeight = +(weightKg - moistureDeduction).toFixed(2);
  const totalPrice = +(netWeight * pricePerKg).toFixed(2);
  return {
    moistureDeduction,
    moistureDeductionKg: moistureDeduction,
    excessPercent,
    netWeight,
    totalPrice,
  };
}

export function calculateDirectPrice(weightKg, pricePerKg) {
  return +(weightKg * pricePerKg).toFixed(2);
}
