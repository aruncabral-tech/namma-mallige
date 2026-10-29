import type { Unit } from "./flower-calculation";

export type FlowerDay = {
  jasmineQty: number; jasmineUnit: Unit; jasmineRate: number;
  pinkQty: number; pinkUnit: Unit; pinkRate: number;
  jasminePriceLocked?: boolean; pinkPriceLocked?: boolean;
};
export type DailyPrice = { date: string; jasmineRate: number; pinkRate: number; createdAt: string };
export type FlowerKind = "jasmine" | "pink";
export const FLOWER_KINDS = ["jasmine", "pink"] as const;

export function flowerDate(weekStart: string, index: number) {
  const date = new Date(weekStart + "T12:00:00Z");
  date.setUTCDate(date.getUTCDate() + index);
  return date.toISOString().slice(0, 10);
}
export function todayInIndia() {
  const parts = new Intl.DateTimeFormat("en", { timeZone: "Asia/Kolkata", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  return ["year", "month", "day"].map(type => parts.find(part => part.type === type)!.value).join("-");
}
export function hasSavedFlowerPrice(day: FlowerDay | undefined, kind: FlowerKind) {
  // Older saved entries have no marker. Preserve their prices when flowers were recorded.
  return Boolean(day && (day[`${kind}PriceLocked`] || day[`${kind}Qty`] > 0));
}
export function withDailyPrices(entries: FlowerDay[], previous: FlowerDay[] | undefined, weekStart: string, prices: Record<string, DailyPrice>): FlowerDay[] {
  return entries.map((entry, index) => {
    const day = { ...entry };
    const price = prices[flowerDate(weekStart, index)];
    for (const kind of FLOWER_KINDS) {
      const saved = previous?.[index];
      // Keep the current bill's editable rate. Saved entries initialize this value,
      // but a customer-specific correction must not be overwritten by the old saved copy.
      const explicitlyEdited = Boolean(day[`${kind}PriceLocked`]);
      const preserveCurrent = explicitlyEdited || hasSavedFlowerPrice(saved, kind);
      day[`${kind}Rate`] = preserveCurrent ? day[`${kind}Rate`] : price?.[`${kind}Rate`] ?? day[`${kind}Rate`] ?? 0;
      day[`${kind}PriceLocked`] = preserveCurrent;
    }
    return day;
  });
}
export function checkBillPrices(entries: FlowerDay[], previous: FlowerDay[] | undefined, weekStart: string, prices: Record<string, DailyPrice>) {
  for (const [index, day] of entries.entries()) {
    const date = flowerDate(weekStart, index);
    for (const kind of FLOWER_KINDS) {
      const code = kind === "jasmine" ? "M" : "J";
      const saved = previous?.[index];
      if (hasSavedFlowerPrice(saved, kind)) {
        if (day[`${kind}Rate`] !== saved![`${kind}Rate`]) return { status: 409, error: `${date}: the saved ${code} price is fixed. Reopen the saved bill before continuing.` };
      } else if (day[`${kind}Qty`] > 0) {
        if (!prices[date]) return { status: 400, error: `Set the daily M and J prices for ${date} before saving flowers for that date.` };
        if (day[`${kind}Rate`] !== prices[date][`${kind}Rate`]) return { status: 409, error: `${date}: use the fixed daily ${code} price. Refresh daily prices before saving again.` };
      }
    }
  }
  return null;
}
export function lockBillPrices(entries: FlowerDay[], previous: FlowerDay[] | undefined, weekStart: string, prices: Record<string, DailyPrice>) {
  return withDailyPrices(entries, previous, weekStart, prices).map(day => ({
    ...day,
    jasminePriceLocked: Boolean(day.jasminePriceLocked || day.jasmineQty > 0),
    pinkPriceLocked: Boolean(day.pinkPriceLocked || day.pinkQty > 0),
  }));
}
