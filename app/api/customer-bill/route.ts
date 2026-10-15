import { z } from "zod";
import { billingDb } from "@/db/billing";
import { AccountError, checkAccountRequest, throttle } from "@/lib/account-auth";
import { customerJson, customerView, readSharedBill, smallJson } from "@/lib/customer-access";
import { CORRECTION_CATEGORIES } from "@/lib/customer-bill-types";

const inputSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("view") }).strict(),
  z.object({ action: z.literal("request"), id: z.string().uuid(), version: z.number().int().positive(), dayIndex: z.number().int().min(0).max(6).nullable(), category: z.enum(CORRECTION_CATEGORIES), message: z.string().trim().min(5).max(1000) }).strict(),
]);
export async function POST(request: Request) {
  try {
    checkAccountRequest(request);
    const parsed = inputSchema.safeParse(await smallJson(request));
    if (!parsed.success) throw new AccountError("Check the date and write a short explanation (5–1,000 characters).", 400);
    const { row, bill } = await readSharedBill(request);
    const input = parsed.data;
    if (input.action === "request") {
      const db = billingDb();
      const existing = await db.prepare("SELECT id FROM bill_corrections WHERE id = ? AND access_hash = ?").bind(input.id, row.token_hash).first();
      if (!existing) {
        if (input.version !== row.version) throw new AccountError("The owner has updated this bill. Refresh it and check the latest entries before sending your request.", 409);
        await throttle(request, row.token_hash, "customer-correction");
        const inserted = await db.prepare("INSERT INTO bill_corrections (id, bill_id, owner_id, access_hash, bill_version, day_index, category, message, status, reply, created_at) SELECT ?, a.bill_id, a.owner_id, a.token_hash, b.version, ?, ?, ?, 'pending', '', ? FROM bill_access a JOIN bills b ON b.id = a.bill_id AND b.owner_id = a.owner_id JOIN owners o ON o.id = a.owner_id WHERE a.token_hash = ? AND a.revoked_at IS NULL AND a.expires_at > ? AND b.version = ? AND b.payload = ? AND o.account_type = 'business' AND json_extract(b.payload, '$.deletedAt') IS NULL AND (SELECT COUNT(*) FROM bill_corrections c WHERE c.access_hash = a.token_hash AND c.status = 'pending') < 5 AND (SELECT COUNT(*) FROM bill_corrections c WHERE c.access_hash = a.token_hash) < 100 ON CONFLICT(id) DO NOTHING RETURNING id").bind(input.id, input.dayIndex, input.category, input.message, new Date().toISOString(), row.token_hash, Date.now(), row.version, row.payload).first();
        if (!inserted) throw new AccountError("The bill or link changed, or your request limit was reached (5 waiting, 100 per link). Refresh and check your requests, or contact the owner.", 409);
      }
    }
    // Recheck access after mutation; a concurrently revoked link reveals nothing.
    const current = input.action === "request" ? await readSharedBill(request) : { row, bill };
    return customerJson({ bill: await customerView(current.row, current.bill) });
  } catch (error) {
    if (error instanceof AccountError) return customerJson({ error: error.message }, error.status);
    if (error instanceof SyntaxError) return customerJson({ error: "Please check your request and try again." }, 400);
    return customerJson({ error: "Could not load or update this bill page. Please retry." }, 503);
  }
}
