// The hosted app keeps using the existing bills API. The standalone HTML export
// replaces this module at build time with its device-local storage adapter.
let activeOwner = "";
export function setBillingOwner(ownerId: string) { activeOwner = ownerId; }
export async function accountRequest(path: string, init?: RequestInit) {
  const headers = new Headers(init?.headers);
  headers.set("X-ACS-Request", "1");
  if (activeOwner) headers.set("X-ACS-Owner", activeOwner);
  if (init?.body) headers.set("Content-Type", "application/json");
  const response = await fetch(path, { ...init, cache: "no-store", credentials: "same-origin", headers });
  if(response.status === 401 && typeof window !== "undefined" && path !== "/api/account/auth") window.dispatchEvent(new Event("account-session-expired"));
  if(response.status === 402 && typeof window !== "undefined") window.dispatchEvent(new Event("subscription-expired"));
  return response;
}
export const billsRequest = (init?: RequestInit) => accountRequest("/api/bills", init);
export const dailyPricesRequest = (from: string, to = from, init?: RequestInit) => accountRequest(`/api/daily-prices?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`, init);
