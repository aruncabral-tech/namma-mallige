import { billingDb } from "@/db/billing";
import { AccountError, accountJson, requireBookOwner, tokenHash } from "@/lib/account-auth";
import { billSchema } from "@/lib/bill-schema";
import { BUDS, flowerAmount, sumAmounts } from "@/lib/flower-calculation";
import { flowerDate } from "@/lib/daily-prices";
import { billBalance } from "@/lib/bill-payments";
import type { AccessState, CustomerBill, Correction } from "@/lib/customer-bill-types";
import type { z } from "zod";

export type SavedBill = z.infer<typeof billSchema>;
export const SHARE_LIFETIME = 30 * 24 * 60 * 60 * 1000;
export const correctionColumns = "c.id, c.bill_version AS billVersion, c.day_index AS dayIndex, c.category, c.message, c.status, c.reply, c.created_at AS createdAt, c.reviewed_at AS reviewedAt";
export const recipientHash = (bill: { customer: string; phone: string }) => tokenHash(JSON.stringify([bill.customer, bill.phone]));
export async function requireBusinessOwner(request: Request) {
  const owner = await requireBookOwner(request);
  if (owner.accountType === "personal") throw new AccountError("Customer sharing is available in business accounts only.", 403);
  return owner;
}
export async function readOwnerBill(ownerId: string, billId: string) {
  const row = await billingDb().prepare("SELECT id, payload, version FROM bills WHERE owner_id = ? AND id = ? AND json_extract(payload, '$.deletedAt') IS NULL").bind(ownerId, billId).first() as { id: string; payload: string; version: number } | null;
  if (!row) throw new AccountError("This saved bill is no longer available. Refresh your book.", 404);
  return { ...row, bill: billSchema.parse({ ...JSON.parse(row.payload), id: row.id, version: row.version }) };
}
export function accessState(row: { expires_at: number; revoked_at: string | null; recipient_hash: string } | null, bill: SavedBill): AccessState {
  const reason = !row ? "none" : row.revoked_at ? "revoked" : row.expires_at <= Date.now() ? "expired" : row.recipient_hash !== recipientHash(bill) ? "recipient_changed" : "active";
  return { active: reason === "active", reason, expiresAt: row?.expires_at ?? null };
}
export type SharedRow = { bill_id: string; owner_id: string; token_hash: string; recipient_hash: string; expires_at: number; payload: string; version: number; updated_at: string; company_name: string; owner_name: string; location: string };
export async function readSharedBill(request: Request) {
  const token = request.headers.get("Authorization")?.match(/^Bearer ([a-f0-9]{64})$/)?.[1];
  const unavailable = () => new AccountError("This bill link is unavailable or has expired. Ask the business owner for a new link.", 404);
  if (!token) throw unavailable();
  const hash = tokenHash(token);
  const row = await billingDb().prepare("SELECT a.bill_id, a.owner_id, a.token_hash, a.recipient_hash, a.expires_at, b.payload, b.version, b.updated_at, o.company_name, o.owner_name, o.location FROM bill_access a JOIN bills b ON b.id = a.bill_id AND b.owner_id = a.owner_id JOIN owners o ON o.id = a.owner_id WHERE a.token_hash = ? AND a.revoked_at IS NULL AND a.expires_at > ? AND o.account_type = 'business' AND json_extract(b.payload, '$.deletedAt') IS NULL").bind(hash, Date.now()).first() as SharedRow | null;
  if (!row) throw unavailable();
  const owner = await billingDb().prepare("SELECT phone, account_type AS accountType FROM owners WHERE id=?").bind(row.owner_id).first() as {phone:string;accountType:"business"};
  const { ensureSubscription } = await import("@/lib/subscriptions");
  await ensureSubscription(owner);
  const bill = billSchema.parse({ ...JSON.parse(row.payload), id: row.bill_id, version: row.version });
  if (recipientHash(bill) !== row.recipient_hash) throw unavailable();
  return { row, bill };
}
export async function customerView(row: SharedRow, bill: SavedBill): Promise<CustomerBill> {
  const result = await billingDb().prepare(`SELECT ${correctionColumns} FROM bill_corrections c WHERE c.access_hash = ? ORDER BY c.created_at DESC, c.id DESC LIMIT 100`).bind(row.token_hash).all();
  // Explicit projection: never expose account credentials, phone numbers, internal
  // payment notes, raw payloads, other bills, or other link generations' requests.
  return {
    version: row.version, customer: bill.customer, billNo: bill.billNo, weekStart: bill.weekStart,
    business: { name: row.company_name || row.owner_name, location: row.location },
    updatedAt: row.updated_at, expiresAt: row.expires_at,
    days: bill.days.map((day, i) => {
      const flowers = [
        { code: "M" as const, buds: day.jasmineQty * BUDS[day.jasmineUnit], rate: day.jasmineRate, amount: flowerAmount(day.jasmineQty, day.jasmineUnit, day.jasmineRate) },
        { code: "J" as const, buds: day.pinkQty * BUDS[day.pinkUnit], rate: day.pinkRate, amount: flowerAmount(day.pinkQty, day.pinkUnit, day.pinkRate) },
      ];
      return { date: flowerDate(bill.weekStart, i), total: sumAmounts(flowers.map(f => f.amount)), flowers };
    }),
    balance: billBalance(bill),
    payments: (bill.paymentHistory ?? []).map(({ date, amount, method }) => ({ date, amount, method })),
    requests: result.results as Correction[],
  };
}
export const customerJson = (data: unknown, status = 200) => accountJson(data, status, { "Vary": "Authorization", "Referrer-Policy": "no-referrer", "X-Robots-Tag": "noindex, nofollow, nosnippet" });
export async function smallJson(request: Request) {
  const body = await request.text();
  if (body.length > 5000) throw new AccountError("This message is too long. Please shorten it.", 413);
  return JSON.parse(body);
}
