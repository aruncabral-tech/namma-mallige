import type { OwnerAccount } from "@/lib/account-types";

type SyncPayload = {
  type: "bill_saved" | "daily_price_saved";
  owner: Pick<OwnerAccount, "ownerName" | "phone" | "companyName" | "location" | "accountType">;
  data: unknown;
};

function syncUrl(owner: Pick<OwnerAccount, "googleSheetUrl">) {
  const url = owner.googleSheetUrl?.trim();
  if (!url || !/^https:\/\/script\.google(?:usercontent)?\.com\/macros\/s\//.test(url)) return "";
  return url;
}

export async function syncGoogleSheet(owner: OwnerAccount, payload: Omit<SyncPayload, "owner">) {
  const url = syncUrl(owner);
  if (!url) return;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2500);
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...payload,
        owner: {
          ownerName: owner.ownerName,
          phone: owner.phone,
          companyName: owner.companyName,
          location: owner.location,
          accountType: owner.accountType,
        },
        syncedAt: new Date().toISOString(),
      }),
      signal: controller.signal,
    });
  } catch {
    // Sync must never block billing. Manual CSV backup remains available.
  } finally {
    clearTimeout(timeout);
  }
}
