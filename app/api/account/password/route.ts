import { z } from "zod";
import { billingDb } from "@/db/billing";
import { AccountError, accountError, accountJson, createSession, hashPassword, newToken, requireOwner, throttle, tokenHash, verifyPassword } from "@/lib/account-auth";
export async function POST(request: Request) {
  try {
    const owner = await requireOwner(request);
    const input = z.object({ currentPassword: z.string().min(1).max(128), password: z.string().min(15).max(128) }).safeParse(await request.json());
    if (!input.success) throw new AccountError("Enter your current password and a new password of 15–128 characters.", 400);
    await throttle(request, owner.phone, "password");
    const db = billingDb();
    const row = await db.prepare("SELECT password_hash AS passwordHash FROM owners WHERE id = ?").bind(owner.id).first() as {passwordHash: string};
    if (!verifyPassword(input.data.currentPassword, row.passwordHash)) throw new AccountError("The current password is incorrect.", 401);
    const recoveryCode = newToken();
    const updated = await db.prepare("UPDATE owners SET password_hash = ?, recovery_hash = ?, auth_version = auth_version + 1 WHERE id = ? AND password_hash = ? RETURNING id").bind(hashPassword(input.data.password), tokenHash(recoveryCode), owner.id, row.passwordHash).first();
    if (!updated) throw new AccountError("The password was changed on another device. Sign in again.", 409);
    return accountJson({ recoveryCode }, 200, { "Set-Cookie": await createSession(owner.id) });
  } catch (error) { return accountError(error); }
}
