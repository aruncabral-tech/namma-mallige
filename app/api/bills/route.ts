import { requireBookOwner, AccountError, accountError } from "@/lib/account-auth";
import { ownerPrices } from "@/lib/owner-prices";
import { billingDb } from "@/db/billing";
import { z } from "zod";
import { billBalance, isPaymentAmount, paymentFields } from "@/lib/bill-payments";
import { checkBillPrices, flowerDate, lockBillPrices, type FlowerDay } from "@/lib/daily-prices";
import { billSchema as schema } from "@/lib/bill-schema";
import { syncGoogleSheet } from "@/lib/google-sheet-sync";
export async function GET(request: Request) {
  try {
    const owner = await requireBookOwner(request);
    const result = await billingDb().prepare("SELECT id, payload, version FROM bills WHERE owner_id = ? AND json_extract(payload, '$.deletedAt') IS NULL ORDER BY updated_at DESC").bind(owner.id).all<{id:string;payload:string;version:number}>();
    return Response.json({ bills: result.results.map((r: {payload: string; id: string; version: number}) => ({ ...JSON.parse(r.payload), id: r.id, version: r.version })) }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) { if (e instanceof AccountError) return accountError(e); console.error(e); return Response.json({ error: "Could not load saved bills. Please retry." }, { status: 503 }); }
}
export async function POST(request: Request) {
  try {
    const owner = await requireBookOwner(request);
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return Response.json({ error: "Check the customer, date, quantities and amounts. Payment amounts must be non-negative, with at most two decimal places." }, { status: 400 });
    const { id, version, ...payload } = parsed.data;
    const db = billingDb();
    const current = version > 0
      ? await db.prepare("SELECT payload, version FROM bills WHERE owner_id = ? AND id = ? AND json_extract(payload, '$.deletedAt') IS NULL").bind(owner.id, id).first() as {payload:string;version:number} | null
      : null;
    if(version > 0 && (!current || current.version !== version)) return Response.json({error:"This bill changed on another device. Refresh and reopen the saved bill before editing again."}, {status:409});
    const previous = current ? JSON.parse(current.payload) as { days: FlowerDay[]; weekStart: string; openingBalance?: number; amountPaid?: number; paymentHistory?: import("@/lib/bill-payments").PaymentRecord[] } : undefined;
    if (previous && previous.weekStart !== payload.weekStart) return Response.json({ error: "A saved bill keeps its original flower dates. Create a new weekly bill for another week." }, { status: 400 });
    const records = await ownerPrices(owner.id, payload.weekStart, flowerDate(payload.weekStart, 6));
    const prices = Object.fromEntries(records.map(price => [price.date, price]));
    const priceError = checkBillPrices(payload.days, previous?.days, payload.weekStart, prices);
    if (priceError) return Response.json({ error: priceError.error }, { status: priceError.status });
    // Preserve payment fields when an older open copy of the app omits them.
    const savedPayload = { ...payload, days: lockBillPrices(payload.days, previous?.days, payload.weekStart, prices), ...paymentFields(payload, previous) };
    if ((savedPayload.paymentHistory ?? []).reduce((n,p) => n + Math.round(p.amount * 100),0) > Math.round(savedPayload.amountPaid * 100)) return Response.json({error:"Payment history cannot exceed the total paid. Refresh this bill."}, {status:400});
    if(billBalance(savedPayload).pending < 0) return Response.json({error:"Amount paid cannot be more than this week's flowers plus the old pending amount."}, {status:400});
    const row = version === 0
      ? await db.prepare("INSERT INTO bills (id, payload, version, updated_at, owner_id) VALUES (?, ?, 1, ?, ?) ON CONFLICT(id) DO NOTHING RETURNING version").bind(id, JSON.stringify(savedPayload), new Date().toISOString(), owner.id).first()
      : await db.prepare("UPDATE bills SET payload = ?, version = version + 1, updated_at = ? WHERE owner_id = ? AND id = ? AND version = ? AND json_extract(payload, '$.deletedAt') IS NULL RETURNING version").bind(JSON.stringify(savedPayload), new Date().toISOString(), owner.id, id, version).first();
    if (!row) return Response.json({ error: "This bill changed on another device or a previous save completed. Reopen the saved bill before editing again. Your current entries are still shown." }, { status: 409 });
    await syncGoogleSheet(owner, { type: "bill_saved", data: { ...savedPayload, id, version: row.version } });
    return Response.json({ version: row.version, bill: { ...savedPayload, id, version: row.version } });
  } catch(e) { if (e instanceof AccountError) return accountError(e); console.error(e); return Response.json({ error: "Save could not be confirmed. Your entries remain here. Retry or reopen saved bills to check." }, { status: 503 }); }
}
export async function DELETE(request: Request) {
  try {
    const owner = await requireBookOwner(request);
    const parsed = z.object({ id: z.string().uuid(), version: z.number().int().min(1), confirmed: z.literal(true) }).safeParse(await request.json());
    if (!parsed.success) return Response.json({ error: "Please confirm the specific saved bill before deleting." }, { status: 400 });
    const { id, version } = parsed.data;
    const now = new Date().toISOString();
    // Keep a recoverable copy; remove only this bill from the active book.
    const row = await billingDb().prepare("UPDATE bills SET payload = json_set(payload, '$.deletedAt', ?), version = version + 1, updated_at = ? WHERE owner_id = ? AND id = ? AND version = ? AND json_extract(payload, '$.deletedAt') IS NULL RETURNING id").bind(now, now, owner.id, id, version).first();
    if (!row) return Response.json({ error: "This bill changed or was already deleted. Cancel, refresh saved bills, then check the latest bill before deleting." }, { status: 409 });
    return Response.json({ deleted: true, id });
  } catch (e) {
    if (e instanceof AccountError) return accountError(e);
    console.error(e);
    return Response.json({ error: "Deletion could not be confirmed. Cancel and refresh saved bills to check before trying again." }, { status: 503 });
  }
}
