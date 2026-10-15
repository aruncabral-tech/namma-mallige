export type Unit = "buds" | "chendu" | "atte";
export const BUDS: Record<Unit, number> = { buds: 1, chendu: 800, atte: 3200 };

// Calculate each flower line once, then round down to a five-paise step.
// The tiny tolerance prevents binary floating-point error at exact boundaries.
export function flowerAmount(qty: number, unit: Unit, rate: number): number {
  if (!Number.isFinite(qty) || !Number.isFinite(rate) || qty < 0 || rate < 0) {
    throw new RangeError("Quantity and rate must be finite, non-negative numbers.");
  }
  const steps = qty * BUDS[unit] * rate / 160;
  return Math.floor(steps + Number.EPSILON * Math.max(1, steps) * 4) / 20;
}

export function sumAmounts(amounts: number[]): number {
  return amounts.reduce((paise, amount) => paise + Math.round(amount * 100), 0) / 100;
}
