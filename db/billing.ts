import { env } from "cloudflare:workers";
export function billingDb() {
  if (!env.DB) throw new Error("Billing storage unavailable");
  return env.DB;
}
