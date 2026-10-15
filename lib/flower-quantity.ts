import { BUDS, type Unit } from "./flower-calculation";

export function chenduAndBuds(chendus: number, extraBuds: number): number {
  if (!Number.isSafeInteger(chendus) || !Number.isSafeInteger(extraBuds) || chendus < 0 || extraBuds < 0) {
    throw new RangeError("Enter whole, non-negative numbers for chendus and extra buds.");
  }
  const buds = chendus * BUDS.chendu + extraBuds;
  if (!Number.isSafeInteger(buds)) throw new RangeError("This quantity is too large.");
  return buds;
}

export function splitChenduAndBuds(qty: number, unit: Unit) {
  const totalBuds = qty * BUDS[unit];
  const chendus = Math.floor(totalBuds / BUDS.chendu);
  return { chendus, extraBuds: totalBuds - chendus * BUDS.chendu, totalBuds };
}
