import { z } from "zod";
import { billingDb } from "@/db/billing";
import { AccountError, accountError, accountJson, newToken, tokenHash } from "@/lib/account-auth";
import { accessState, readOwnerBill, recipientHash, requireBusinessOwner, SHARE_LIFETIME, smallJson } from "@/lib/customer-access";

const inputSchema = z.object({ billId: z.string().uuid(), version: z.number().int().positive(), confirmed: z.literal(true) }).strict();
export async function GET(request: Request) {
  try {
    const owner = await requireBusinessOwner(request);
    const billId = z.string().uuid().safeParse(new URL(request.url).searchParams.get("billId"));
    if (!billId.success) throw new AccountError("Choose a saved bill.", 400);
    const { bill } = await readOwnerBill(owner.id, billId.data);
    const row = await billingDb().prepare("SELECT expires_at, revoked_at, recipient_hash FROM bill_access WHERE bill_id = ? AND owner_id = ?").bind(bill.id, owner.id).first() as { expires_at: number; revoked_at: string | null; recipient_hash: string } | null;
    return accountJson({ access: accessState(row, bill) });
  } catch (error) { return accountError(error); }
}
export async function POST(request: Request) {
  try {
    const owner = await requireBusinessOwner(request);
    const parsed = inputSchema.safeParse(await smallJson(request));
    if (!parsed.success) throw new AccountError("Confirm the saved bill before creating its link.", 400);
    const { bill, payload } = await readOwnerBill(owner.id, parsed.data.billId);
    if (bill.version !== parsed.data.version) throw new AccountError("This bill has changed. Refresh and reopen it before sharing.", 409);
    const token = newToken();
    const expiresAt = Date.now() + SHARE_LIFETIME;
    const result = await billingDb().prepare("INSERT INTO bill_access (bill_id, owner_id, token_hash, recipient_hash, created_at, expires_at, revoked_at) SELECT id, owner_id, ?, ?, ?, ?, NULL FROM bills WHERE id = ? AND owner_id = ? AND version = ? AND payload = ? AND json_extract(payload, '$.deletedAt') IS NULL ON CONFLICT(bill_id) DO UPDATE SET token_hash = excluded.token_hash, recipient_hash = excluded.recipient_hash, created_at = excluded.created_at, expires_at = excluded.expires_at, revoked_at = NULL WHERE bill_access.owner_id = excluded.owner_id RETURNING bill_id").bind(tokenHash(token), recipientHash(bill), new Date().toISOString(), expiresAt, bill.id, owner.id, bill.version, payload).first();
    if (!result) throw new AccountError("This bill has changed. Refresh your book before sharing.", 409);
    // The fragment is not sent in requests or referrers. Store only its hash.
    return accountJson({ path: `/customer-bill#${token}`, access: { active: true, reason: "active", expiresAt } }, 201);
  } catch (error) { return accountError(error); }
}
export async function DELETE(request: Request) {
  try {
    const owner = await requireBusinessOwner(request);
    const parsed = z.object({ billId: z.string().uuid(), confirmed: z.literal(true) }).strict().safeParse(await smallJson(request));
    if (!parsed.success) throw new AccountError("Confirm which bill link to turn off.", 400);
    await readOwnerBill(owner.id, parsed.data.billId);
    await billingDb().prepare("UPDATE bill_access SET revoked_at = ? WHERE bill_id = ? AND owner_id = ?").bind(new Date().toISOString(), parsed.data.billId, owner.id).run();
    return accountJson({ revoked: true });
  } catch (error) { return accountError(error); }
}
