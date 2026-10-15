import { requireBookOwner, AccountError, accountError, verifyMpin } from "@/lib/account-auth";
import { ownerPrices, insertOwnerPrice } from "@/lib/owner-prices";
import { z } from "zod";
import { billingDb } from "@/db/billing";
import { syncGoogleSheet } from "@/lib/google-sheet-sync";

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
  const parsed = new Date(value + "T12:00:00Z");
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
});
const rate = z.number().finite().min(0).max(100000000);
const priceSchema = z.object({ date, jasmineRate: rate, pinkRate: rate, mpin: z.string().regex(/^\d{4}$/).optional() });

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const parsed = z.object({ from: date, to: date }).safeParse({ from: params.get("from"), to: params.get("to") ?? params.get("from") });
  if (!parsed.success || parsed.data.to < parsed.data.from || (Date.parse(parsed.data.to) - Date.parse(parsed.data.from)) / 86400000 > 366) return Response.json({ error: "Choose a valid date range of up to one year." }, { status: 400 });
  try {
    const owner = await requireBookOwner(request);
    const prices = await ownerPrices(owner.id, parsed.data.from, parsed.data.to);
    return Response.json({ prices }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof AccountError) return accountError(error);
    console.error(error);
    return Response.json({ error: "Could not load daily prices. Please retry." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  try {
    const owner = await requireBookOwner(request);
    const parsed = priceSchema.safeParse(await request.json());
    if (!parsed.success) return Response.json({ error: "Enter a valid flower date and both non-negative prices per atte." }, { status: 400 });
    const { date, jasmineRate, pinkRate } = parsed.data;
    const saved = await insertOwnerPrice(owner.id, {date, jasmineRate, pinkRate});
    if (saved) {
      await syncGoogleSheet(owner, { type: "daily_price_saved", data: saved });
      return Response.json({ price: saved }, { status: 201 });
    }
    const [existing] = await ownerPrices(owner.id, date, date);
    if (existing?.jasmineRate === jasmineRate && existing?.pinkRate === pinkRate) return Response.json({ price: existing });
    if (!parsed.data.mpin) return Response.json({ error: "Prices are fixed. Enter your 4-digit MPIN to unlock and change them.", price: existing, needsMpin: true }, { status: 409 });
    const row = await billingDb().prepare("SELECT mpin_hash AS mpinHash FROM owners WHERE id = ?").bind(owner.id).first() as {mpinHash?: string | null} | null;
    if (!row?.mpinHash || !verifyMpin(parsed.data.mpin, row.mpinHash)) return Response.json({ error: "The MPIN is incorrect." }, { status: 401 });
    const legacy = owner.id === "existing-book";
    const table = legacy ? "daily_prices" : "book_daily_prices";
    const ownerValue = legacy ? [] : [owner.id];
    const updated = await billingDb().prepare(`UPDATE ${table} SET jasmine_rate = ?, pink_rate = ?, created_at = ? WHERE ${legacy ? "date = ?" : "owner_id = ? AND date = ?"} RETURNING date, jasmine_rate AS jasmineRate, pink_rate AS pinkRate, created_at AS createdAt`).bind(jasmineRate, pinkRate, new Date().toISOString(), ...ownerValue, date).first();
    if (updated) await syncGoogleSheet(owner, { type: "daily_price_saved", data: updated });
    return updated ? Response.json({ price: updated, changed: true }) : Response.json({ error: "Could not update this date's prices." }, { status: 503 });
  } catch (error) {
    if (error instanceof AccountError) return accountError(error);
    console.error(error);
    return Response.json({ error: "Price save could not be confirmed. Your entered prices are kept. Refresh to check before retrying." }, { status: 503 });
  }
}
