import { billingDb } from "@/db/billing";
import { AccountError, accountError, accountJson, checkAccountRequest, LEGACY_BOOK_ID, normalizePhone, throttle, tokenHash } from "@/lib/account-auth";
import { isLegacyOwner, legacyOwnerPhone } from "@/lib/legacy-owner";

export async function POST(request: Request) {
  try {
    checkAccountRequest(request);
    if (!await isLegacyOwner()) throw new AccountError("Sign in with the original owner's ChatGPT account first.", 403);
    const input = await request.json();
    const phone = legacyOwnerPhone();
    if (input.confirmation !== "DELETE MY BOOK" || typeof input.phone !== "string" || normalizePhone(input.phone) !== phone) throw new AccountError("Enter the owner number and DELETE MY BOOK to confirm.", 400);
    await throttle(request, phone, "owner-reset");
    const db = billingDb();
    const owner = await db.prepare("SELECT recovery_hash AS recoveryHash FROM owners WHERE id = ? AND phone = ?").bind(LEGACY_BOOK_ID, phone).first() as {recoveryHash: string} | null;
    if (!owner || input.challenge !== tokenHash("delete-book:" + owner.recoveryHash)) throw new AccountError("This account changed. Reload this page before continuing.", 409);
    // Each statement is guarded against a concurrent reset/re-registration. D1 batch is atomic.
    const guard = "EXISTS (SELECT 1 FROM owners WHERE id = ? AND phone = ? AND recovery_hash = ?)";
    const args = [LEGACY_BOOK_ID, phone, owner.recoveryHash];
    await db.batch([
      db.prepare(`DELETE FROM owner_sessions WHERE owner_id = ? AND ${guard}`).bind(LEGACY_BOOK_ID, ...args),
      db.prepare(`DELETE FROM bills WHERE owner_id = ? AND ${guard}`).bind(LEGACY_BOOK_ID, ...args),
      db.prepare(`DELETE FROM book_daily_prices WHERE owner_id = ? AND ${guard}`).bind(LEGACY_BOOK_ID, ...args),
      db.prepare(`DELETE FROM daily_prices WHERE ${guard}`).bind(...args),
      db.prepare("DELETE FROM owners WHERE id = ? AND phone = ? AND recovery_hash = ?").bind(...args),
    ]);
    return accountJson({deleted:true}, 200, {"Set-Cookie":"__Host-acs-session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0"});
  } catch (error) { return accountError(error); }
}
