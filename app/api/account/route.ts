import { z } from "zod";
import { billingDb } from "@/db/billing";
import { AccountError, accountError, accountJson, currentOwner, ownerColumns, ownerFromRow, requireOwner } from "@/lib/account-auth";
export async function GET(request: Request) {
  try { return accountJson({ owner: await currentOwner(request) }); }
  catch (error) { return accountError(error); }
}
export async function PATCH(request: Request) {
  try {
    const owner = await requireOwner(request);
    const parsed = z.object({ ownerName: z.string().trim().min(2).max(100), accountType: z.enum(["personal", "business"]).optional(), companyName: z.string().trim().max(150).optional(), location: z.string().trim().max(200).optional(), googleSheetUrl: z.string().trim().url().or(z.literal("")).optional() }).safeParse(await request.json());
    if (!parsed.success) throw new AccountError("Enter valid owner, account, business, location and Google Sheets details.", 400);
    const ownerName = parsed.data.ownerName;
    const accountType = parsed.data.accountType ?? owner.accountType;
    const { paymentConfig } = await import("@/lib/subscriptions");
    if(paymentConfig().enabled && accountType !== owner.accountType) throw new AccountError("Contact support to change your subscription account type.",409);
    const companyName = parsed.data.companyName ?? owner.companyName;
    const location = parsed.data.location ?? owner.location;
    const googleSheetUrl = parsed.data.googleSheetUrl ?? owner.googleSheetUrl;
    if (accountType === "business" && (!companyName || !location)) throw new AccountError("Business accounts need a business / katte name and location.", 400);
    const updated = ownerFromRow(await billingDb().prepare(`UPDATE owners SET owner_name = ?, account_type = ?, company_name = ?, location = ?, google_sheet_url = ? WHERE id = ? RETURNING ${ownerColumns}`).bind(ownerName, accountType, companyName, location, googleSheetUrl, owner.id).first() as never);
    return accountJson({ owner: updated });
  } catch (error) { return accountError(error); }
}
