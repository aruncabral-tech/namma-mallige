import type { AccountType } from "./account-types";
export const PLANS = { business: { monthly:150, yearly:1800 }, personal: { monthly:50, yearly:500 } } as const;
export const TRIAL_MS = 5 * 24 * 60 * 60 * 1000;
export function addMonths(time:number, months:number) {
  const date = new Date(time), day = date.getUTCDate();
  date.setUTCDate(1); date.setUTCMonth(date.getUTCMonth()+months);
  const last = new Date(Date.UTC(date.getUTCFullYear(),date.getUTCMonth()+1,0)).getUTCDate();
  date.setUTCDate(Math.min(day,last)); return date.getTime();
}
export function coverage(trialEndsAt:number, orders:{paid_at:number;months:number;coverage_from?:number|null}[]) {
  return orders.reduce((end,order)=>addMonths(Math.max(end,order.paid_at,order.coverage_from??0),order.months),trialEndsAt);
}
export type SubscriptionStatus = { suspended?:boolean; enabled:boolean; ready:boolean; active:boolean; trial:boolean; expiresAt:number|null; accountType:AccountType; prices:{monthly:number;yearly:number}; mode:"manual" };
