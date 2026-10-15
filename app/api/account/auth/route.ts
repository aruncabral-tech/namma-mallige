import { z } from "zod";
import { billingDb } from "@/db/billing";
import { AccountError, accountError, accountJson, checkAccountRequest, createSession, endSession, hashMpin, hashPassword, LEGACY_BOOK_ID, newToken, normalizePhone, ownerColumns, ownerFromRow, throttle, tokenHash, verifyMpin, verifyPassword } from "@/lib/account-auth";
import { isLegacyOwner, legacyOwnerPhone } from "@/lib/legacy-owner";

const password = z.string().min(15).max(128);
const mpin = z.string().regex(/^\d{4}$/);
const credentials = z.object({ phone: z.string().max(40), mpin: mpin.optional(), password: z.string().min(1).max(128).optional() });
const registration = z.object({
  phone: z.string().max(40),
  ownerName: z.string().trim().min(2).max(100),
  accountType: z.enum(["personal", "business"]).default("business"),
  companyName: z.string().trim().max(150).optional(),
  location: z.string().trim().max(200).optional(),
  mpin: mpin.optional(),
  password: password.optional(),
}).superRefine((value, context) => {
  if (!value.mpin && !value.password) context.addIssue({ code: z.ZodIssueCode.custom, path: ["mpin"], message: "Enter an MPIN." });
  if (value.mpin && value.accountType === "business" && (!value.companyName?.trim() || !value.location?.trim())) context.addIssue({ code: z.ZodIssueCode.custom, path: ["companyName"], message: "Business accounts need a name and location." });
});
export async function POST(request: Request) {
  try {
    checkAccountRequest(request);
    const data = await request.json();
    const db = billingDb();
    if (data.action === "logout") return accountJson({ signedOut: true }, 200, { "Set-Cookie": await endSession(request) });
    if (!["login", "register", "setup", "recover"].includes(data.action)) throw new AccountError("Choose sign in or create an account.", 400);
    const parsed = credentials.safeParse(data);
    if (!parsed.success) throw new AccountError("Enter your WhatsApp number and 4-digit MPIN.", 400);
    const phone = normalizePhone(parsed.data.phone);
    await throttle(request, phone, data.action === "setup" ? "register" : data.action);
    let ownerId: string;
    let recoveryCode: string | undefined;
    if (data.action === "login") {
      const row = await db.prepare("SELECT id, password_hash AS passwordHash, mpin_hash AS mpinHash FROM owners WHERE phone = ?").bind(phone).first() as {id: string; passwordHash: string; mpinHash?: string | null} | null;
      const valid = verifyMpin(parsed.data.mpin ?? "", row?.mpinHash ?? undefined) || (!!parsed.data.password && verifyPassword(parsed.data.password, row?.passwordHash));
      if (!valid || !row) throw new AccountError("The WhatsApp number or MPIN is incorrect.", 401);
      ownerId = row.id;
    } else if (data.action === "recover") {
      const input = z.object({ phone: z.string().max(40), recoveryCode: z.string().regex(/^[a-f0-9]{64}$/), mpin: mpin.optional(), password: password.optional() }).superRefine((value, context) => { if (!value.mpin && !value.password) context.addIssue({ code: z.ZodIssueCode.custom, path: ["mpin"], message: "Enter a new MPIN." }); }).safeParse(data);
      if (!input.success) throw new AccountError("Enter your recovery code and a new 4-digit MPIN.", 400);
      const previousHash = tokenHash(input.data.recoveryCode);
      const row = await db.prepare("SELECT id FROM owners WHERE phone = ? AND recovery_hash = ?").bind(phone, previousHash).first() as {id: string} | null;
      if (!row) throw new AccountError("The number or recovery code is incorrect.", 401);
      recoveryCode = newToken();
      const updated = await db.prepare("UPDATE owners SET password_hash = CASE WHEN ? IS NULL THEN password_hash ELSE ? END, mpin_hash = CASE WHEN ? IS NULL THEN mpin_hash ELSE ? END, recovery_hash = ?, auth_version = auth_version + 1 WHERE id = ? AND recovery_hash = ? RETURNING id").bind(input.data.password ?? null, input.data.password ? hashPassword(input.data.password) : null, input.data.mpin ?? null, input.data.mpin ? hashMpin(input.data.mpin) : null, tokenHash(recoveryCode), row.id, previousHash).first();
      if (!updated) throw new AccountError("This recovery code has already been used. Try signing in.", 409);
      ownerId = row.id;
    } else {
      const input = registration.safeParse(data);
      if (!input.success) throw new AccountError("Enter your name and a 4-digit MPIN. Business accounts also need a business name and location.", 400);
      const existingBookOwner = phone === legacyOwnerPhone() && await isLegacyOwner();
      if (phone === legacyOwnerPhone() && !existingBookOwner) throw new AccountError("This WhatsApp number is reserved for the existing owner account.", data.action === "setup" ? 403 : 409);
      if (data.action === "setup" && !existingBookOwner) throw new AccountError("This account cannot claim the existing book.", 403);
      ownerId = existingBookOwner ? LEGACY_BOOK_ID : crypto.randomUUID();
      recoveryCode = newToken();
      const storedPassword = input.data.password ?? `mpin-bootstrap-${newToken()}`;
      if (existingBookOwner && data.action === "register") {
        const current = await db.prepare("SELECT mpin_hash AS mpinHash FROM owners WHERE id = ?").bind(ownerId).first() as {mpinHash?: string | null} | null;
        if (current) {
          if (current.mpinHash) throw new AccountError("An account already uses these details. Sign in or use your recovery code.", 409);
          const updated = await db.prepare("UPDATE owners SET owner_name = ?, account_type = ?, company_name = ?, location = ?, password_hash = ?, mpin_hash = ?, recovery_hash = ?, auth_version = auth_version + 1, google_sheet_url = COALESCE(google_sheet_url, '') WHERE id = ? AND mpin_hash IS NULL RETURNING id").bind(input.data.ownerName, input.data.accountType, input.data.companyName ?? "Namma Mallige", input.data.location ?? "", hashPassword(storedPassword), input.data.mpin ? hashMpin(input.data.mpin) : null, tokenHash(recoveryCode), ownerId).first();
          if (!updated) throw new AccountError("An account already uses these details. Sign in or use your recovery code.", 409);
        } else {
          const created = await db.prepare("INSERT INTO owners (id, owner_name, phone, account_type, company_name, location, password_hash, mpin_hash, recovery_hash, auth_version, google_sheet_url, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, '', ?) ON CONFLICT DO NOTHING RETURNING id").bind(ownerId, input.data.ownerName, phone, input.data.accountType, input.data.companyName ?? "Namma Mallige", input.data.location ?? "", hashPassword(storedPassword), input.data.mpin ? hashMpin(input.data.mpin) : null, tokenHash(recoveryCode), new Date().toISOString()).first();
          if (!created) throw new AccountError("An account already uses these details. Sign in or use your recovery code.", 409);
        }
      } else {
      const created = await db.prepare("INSERT INTO owners (id, owner_name, phone, account_type, company_name, location, password_hash, mpin_hash, recovery_hash, auth_version, google_sheet_url, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, '', ?) ON CONFLICT DO NOTHING RETURNING id").bind(ownerId, input.data.ownerName, phone, input.data.accountType, input.data.companyName ?? (existingBookOwner ? "Namma Mallige" : ""), input.data.location ?? "", hashPassword(storedPassword), input.data.mpin ? hashMpin(input.data.mpin) : null, tokenHash(recoveryCode), new Date().toISOString()).first();
      if (!created) throw new AccountError("An account already uses these details. Sign in or use your recovery code.", 409);
      }
    }
    const owner = ownerFromRow(await db.prepare(`SELECT ${ownerColumns} FROM owners WHERE id = ?`).bind(ownerId).first() as never);
    const cookie = await createSession(ownerId);
    // Expired tokens and rate-limit windows are never used and need not accumulate.
    await db.batch([
      db.prepare("DELETE FROM owner_sessions WHERE expires_at <= ?").bind(Date.now()),
      db.prepare("DELETE FROM auth_throttle WHERE expires_at <= ?").bind(Date.now()),
    ]);
    return accountJson({ owner, needsMpin: !owner?.mpinConfigured, ...(recoveryCode ? { recoveryCode } : {}) }, 200, { "Set-Cookie": cookie });
  } catch (error) { return accountError(error); }
}
