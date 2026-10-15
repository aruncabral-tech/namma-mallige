import { z } from "zod";
import { billingDb } from "@/db/billing";
import { AccountError, accountError, accountJson } from "@/lib/account-auth";
import { correctionColumns, requireBusinessOwner, smallJson } from "@/lib/customer-access";

export async function GET(request: Request) {
  try {
    const owner = await requireBusinessOwner(request);
    const url = new URL(request.url);
    const page = z.coerce.number().int().min(0).max(100000).safeParse(url.searchParams.get("page") ?? 0);
    if (!page.success) throw new AccountError("Choose a valid request page.", 400);
    const reviewed = url.searchParams.get("status") === "reviewed";
    const filter = reviewed ? "c.status <> 'pending'" : "c.status = 'pending'";
    const db = billingDb();
    const result = await db.prepare(`SELECT ${correctionColumns}, c.bill_id AS billId, b.version AS currentVersion, json_extract(b.payload, '$.customer') AS customer, json_extract(b.payload, '$.billNo') AS billNo, json_extract(b.payload, '$.weekStart') AS weekStart FROM bill_corrections c JOIN bills b ON b.id = c.bill_id AND b.owner_id = c.owner_id WHERE c.owner_id = ? AND ${filter} AND json_extract(b.payload, '$.deletedAt') IS NULL ORDER BY c.created_at DESC, c.id DESC LIMIT 51 OFFSET ?`).bind(owner.id, page.data * 50).all();
    const count = await db.prepare("SELECT COUNT(*) AS count FROM bill_corrections c JOIN bills b ON b.id = c.bill_id AND b.owner_id = c.owner_id WHERE c.owner_id = ? AND c.status = 'pending' AND json_extract(b.payload, '$.deletedAt') IS NULL").bind(owner.id).first() as { count: number };
    return accountJson({ requests: result.results.slice(0, 50), hasMore: result.results.length > 50, pendingCount: count.count });
  } catch (error) { return accountError(error); }
}
export async function POST(request: Request) {
  try {
    const owner = await requireBusinessOwner(request);
    const parsed = z.object({ id: z.string().uuid(), status: z.enum(["resolved", "declined"]), reply: z.string().trim().min(1).max(500) }).strict().safeParse(await smallJson(request));
    if (!parsed.success) throw new AccountError("Choose a result and write a reply for the customer (up to 500 characters).", 400);
    const input = parsed.data;
    const result = await billingDb().prepare("UPDATE bill_corrections SET status = ?, reply = ?, reviewed_at = ? WHERE id = ? AND owner_id = ? AND status = 'pending' AND EXISTS (SELECT 1 FROM bills b WHERE b.id = bill_corrections.bill_id AND b.owner_id = bill_corrections.owner_id AND json_extract(b.payload, '$.deletedAt') IS NULL) RETURNING id").bind(input.status, input.reply, new Date().toISOString(), input.id, owner.id).first();
    if (!result) throw new AccountError("This request is no longer waiting for review. Refresh the list.", 409);
    return accountJson({ reviewed: true });
  } catch (error) { return accountError(error); }
}
