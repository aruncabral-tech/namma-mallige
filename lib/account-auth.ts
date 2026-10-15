import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { billingDb } from "@/db/billing";
import type { OwnerAccount } from "@/lib/account-types";

export const LEGACY_BOOK_ID = "existing-book";
const COOKIE = "__Host-acs-session";
const LIFETIME = 7 * 24 * 60 * 60;
export const ownerColumns = "id, owner_name AS ownerName, phone, account_type AS accountType, company_name AS companyName, location, google_sheet_url AS googleSheetUrl, CASE WHEN mpin_hash IS NOT NULL THEN 1 ELSE 0 END AS mpinConfigured";
const qualifiedOwnerColumns = "o.id, o.owner_name AS ownerName, o.phone, o.account_type AS accountType, o.company_name AS companyName, o.location, o.google_sheet_url AS googleSheetUrl, CASE WHEN o.mpin_hash IS NOT NULL THEN 1 ELSE 0 END AS mpinConfigured";
export function ownerFromRow(row: (OwnerAccount & { mpinConfigured?: boolean | number }) | null): OwnerAccount | null {
  if (!row) return null;
  return { ...row, accountType: row.accountType === "personal" ? "personal" : "business", companyName: row.companyName ?? "", location: row.location ?? "", googleSheetUrl: row.googleSheetUrl ?? "", mpinConfigured: Boolean(row.mpinConfigured) };
}
export class AccountError extends Error {
  constructor(message: string, public status: number) { super(message); }
}
export function accountJson(data: unknown, status = 200, headers: Record<string, string> = {}) {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store, private", "Vary": "Cookie", "X-Content-Type-Options": "nosniff", ...headers } });
}
export function accountError(error: unknown) {
  if (error instanceof AccountError) return accountJson({ error: error.message }, error.status);
  if (error instanceof SyntaxError) return accountJson({ error: "Please check the entered details." }, 400);
  console.error("Account request could not be completed.");
  return accountJson({ error: "Could not complete this request. Please try again." }, 503);
}
export function checkAccountRequest(request: Request) {
  if (["GET", "HEAD"].includes(request.method)) return;
  const origin = request.headers.get("Origin");
  if (request.headers.get("X-ACS-Request") !== "1" ||
      !request.headers.get("Content-Type")?.toLowerCase().startsWith("application/json") ||
      (origin && origin !== new URL(request.url).origin) ||
      request.headers.get("Sec-Fetch-Site") === "cross-site") {
    throw new AccountError("Please open the app and try again.", 403);
  }
}
export function normalizePhone(value: string) {
  let digits = value.replace(/[\s()+-]/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (/^\d{10}$/.test(digits)) digits = "91" + digits;
  if (!/^[1-9]\d{9,14}$/.test(digits)) throw new AccountError("Enter a valid WhatsApp number with country code.", 400);
  return "+" + digits;
}
export const tokenHash = (value: string) => createHash("sha256").update(value).digest("hex");
export const newToken = () => randomBytes(32).toString("hex");
export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 32, { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 }).toString("hex");
  return `scrypt:32768:8:3:${salt}:${hash}`;
}
export function validMpin(mpin: string) { return /^\d{4}$/.test(mpin); }
export function hashMpin(mpin: string) {
  if (!validMpin(mpin)) throw new AccountError("MPIN must contain exactly 4 digits.", 400);
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(mpin, salt, 32, { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 }).toString("hex");
  return `scrypt:32768:8:3:${salt}:${hash}`;
}
export function verifyMpin(mpin: string, encoded?: string) {
  const parts = (encoded ?? "").split(":");
  const valid = validMpin(mpin) && parts.length === 6 && parts.slice(0, 4).join(":") === "scrypt:32768:8:3" && /^[a-f0-9]{32}$/.test(parts[4]) && /^[a-f0-9]{64}$/.test(parts[5]);
  const hash = scryptSync(valid ? mpin : "0000", valid ? parts[4] : "0".repeat(32), 32, { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 });
  return timingSafeEqual(hash, Buffer.from(valid ? parts[5] : "0".repeat(64), "hex")) && valid;
}
export function verifyPassword(password: string, encoded?: string) {
  const parts = (encoded ?? "").split(":");
  const valid = parts.length === 6 && parts.slice(0, 4).join(":") === "scrypt:32768:8:3" && /^[a-f0-9]{32}$/.test(parts[4]) && /^[a-f0-9]{64}$/.test(parts[5]);
  // Unknown numbers take the same password-hashing work as existing accounts.
  const hash = scryptSync(password, valid ? parts[4] : "0".repeat(32), 32, { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 });
  return timingSafeEqual(hash, Buffer.from(valid ? parts[5] : "0".repeat(64), "hex")) && valid;
}
function sessionToken(request: Request) {
  const value = request.headers.get("Cookie")?.split(";").map(v => v.trim()).find(v => v.startsWith(COOKIE + "="))?.slice(COOKIE.length + 1);
  return value && /^[a-f0-9]{64}$/.test(value) ? value : null;
}
export async function currentOwner(request: Request): Promise<OwnerAccount | null> {
  const token = sessionToken(request);
  if (!token) return null;
  const row = await billingDb().prepare(`SELECT ${qualifiedOwnerColumns} FROM owners o JOIN owner_sessions s ON s.owner_id = o.id AND s.auth_version = o.auth_version WHERE s.token_hash = ? AND s.expires_at > ?`).bind(tokenHash(token), Date.now()).first() as (OwnerAccount & {mpinConfigured: number}) | null;
  return ownerFromRow(row);
}
export async function requireOwner(request: Request) {
  checkAccountRequest(request);
  const owner = await currentOwner(request);
  if (!owner) throw new AccountError("Please sign in to open your customer book.", 401);
  const expectedOwner = request.headers.get("X-ACS-Owner");
  if (expectedOwner && expectedOwner !== owner.id) throw new AccountError("The signed-in account changed. Reload the app before continuing.", 409);
  return owner;
}
export async function requireBookOwner(request: Request) {
  const owner = await requireOwner(request);
  if (request.headers.get("X-ACS-Owner") !== owner.id) throw new AccountError("Reload the app to open your customer book.", 409);
  const { ensureSubscription } = await import("@/lib/subscriptions");
  await ensureSubscription(owner);
  return owner;
}
export async function createSession(ownerId: string) {
  const token = newToken();
  const result = await billingDb().prepare("INSERT INTO owner_sessions (token_hash, owner_id, auth_version, expires_at) SELECT ?, id, auth_version, ? FROM owners WHERE id = ? RETURNING owner_id").bind(tokenHash(token), Date.now() + LIFETIME * 1000, ownerId).first();
  if (!result) throw new AccountError("Please sign in again.", 401);
  return `${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${LIFETIME}`;
}
export async function endSession(request: Request) {
  const token = sessionToken(request);
  if (token) await billingDb().prepare("DELETE FROM owner_sessions WHERE token_hash = ?").bind(tokenHash(token)).run();
  return `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}
export async function throttle(request: Request, phone: string, action: string) {
  const db = billingDb();
  const now = Date.now();
  const windowEnd = now + 15 * 60 * 1000;
  const ip = request.headers.get("CF-Connecting-IP") ?? "unknown";
  for (const [subject, limit] of [[`ip:${ip}`, 60], [`phone:${phone}`, 12]] as const) {
    const row = await db.prepare("INSERT INTO auth_throttle (key, hits, expires_at) VALUES (?, 1, ?) ON CONFLICT(key) DO UPDATE SET hits = CASE WHEN expires_at <= ? THEN 1 ELSE hits + 1 END, expires_at = CASE WHEN expires_at <= ? THEN excluded.expires_at ELSE expires_at END RETURNING hits").bind(tokenHash(action + ":" + subject), windowEnd, now, now).first() as {hits: number};
    if (row.hits > limit) throw new AccountError("Too many attempts. Wait 15 minutes before trying again.", 429);
  }
}
