import { z } from "zod";
import { billingDb } from "@/db/billing";
import { AccountError, accountError, accountJson, createSession, hashMpin, newToken, requireOwner, throttle, tokenHash, validMpin, verifyMpin } from "@/lib/account-auth";
export async function POST(request: Request) {
  try {
    const owner = await requireOwner(request);
    const input = z.object({ currentMpin: z.string().optional(), mpin: z.string(), confirmMpin: z.string() }).safeParse(await request.json());
    if (!input.success || !validMpin(input.data.mpin) || input.data.mpin !== input.data.confirmMpin) throw new AccountError("Enter the same 4-digit MPIN twice.", 400);
    await throttle(request, owner.phone, "mpin");
    const db = billingDb();
    const row = await db.prepare("SELECT mpin_hash AS mpinHash FROM owners WHERE id = ?").bind(owner.id).first() as {mpinHash?: string | null};
    if (row.mpinHash && !verifyMpin(input.data.currentMpin ?? "", row.mpinHash)) throw new AccountError("The current MPIN is incorrect.", 401);
    const recoveryCode = newToken();
    const updated = await db.prepare("UPDATE owners SET mpin_hash = ?, recovery_hash = ?, auth_version = auth_version + 1 WHERE id = ? AND (mpin_hash IS ? OR mpin_hash = ?) RETURNING id").bind(hashMpin(input.data.mpin), tokenHash(recoveryCode), owner.id, row.mpinHash ?? null, row.mpinHash ?? "").first();
    if (!updated) throw new AccountError("The MPIN changed on another device. Sign in again.", 409);
    return accountJson({ recoveryCode }, 200, { "Set-Cookie": await createSession(owner.id) });
  } catch (error) { return accountError(error); }
}
