import { billingDb } from "@/db/billing";
import { LEGACY_BOOK_ID } from "@/lib/account-auth";
import type { DailyPrice } from "@/lib/daily-prices";
const columns = "date, jasmine_rate AS jasmineRate, pink_rate AS pinkRate, created_at AS createdAt";
export async function ownerPrices(ownerId: string, from: string, to: string): Promise<DailyPrice[]> {
  const legacy = ownerId === LEGACY_BOOK_ID;
  const query = billingDb().prepare(`SELECT ${columns} FROM ${legacy ? "daily_prices" : "book_daily_prices"} WHERE ${legacy ? "" : "owner_id = ? AND "}date >= ? AND date <= ? ORDER BY date`);
  const result = await query.bind(...(legacy ? [from, to] : [ownerId, from, to])).all();
  return result.results as DailyPrice[];
}
export async function insertOwnerPrice(ownerId: string, price: Omit<DailyPrice, "createdAt">): Promise<DailyPrice | null> {
  const legacy = ownerId === LEGACY_BOOK_ID;
  const values = [price.date, price.jasmineRate, price.pinkRate, new Date().toISOString()];
  return await billingDb().prepare(`INSERT INTO ${legacy ? "daily_prices" : "book_daily_prices"} (${legacy ? "" : "owner_id, "}date, jasmine_rate, pink_rate, created_at) VALUES (${legacy ? "" : "?, "}?, ?, ?, ?) ON CONFLICT(${legacy ? "" : "owner_id, "}date) DO NOTHING RETURNING ${columns}`).bind(...(legacy ? values : [ownerId, ...values])).first() as DailyPrice | null;
}
