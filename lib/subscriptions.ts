import { env } from "cloudflare:workers";
import { createHash } from "node:crypto";
import { billingDb } from "@/db/billing";
import { AccountError } from "@/lib/account-auth";
import type { OwnerAccount } from "@/lib/account-types";
import { PLANS, TRIAL_MS, coverage, type SubscriptionStatus } from "./subscription-plans";
export const config = () => env as unknown as Record<string,string|undefined>;
export function paymentConfig() {
  const e=config();
  return {enabled:e.SUBSCRIPTIONS_ENABLED!=="false", ready:true, mode:"manual" as const};
}
export const subscriptionIdentity = (phone:string) => createHash("sha256").update("subscription:"+phone).digest("hex");
export async function subscriptionStatus(owner:Pick<OwnerAccount,"phone"|"accountType">):Promise<SubscriptionStatus> {
  const c=paymentConfig(), prices=PLANS[owner.accountType];
  if(!c.enabled) return {...c,active:true,trial:false,expiresAt:null,accountType:owner.accountType,prices};
  const db=billingDb(), identity=subscriptionIdentity(owner.phone);
  await db.prepare("INSERT INTO subscriptions(identity,trial_ends_at) VALUES(?,?) ON CONFLICT(identity) DO NOTHING").bind(identity,Date.now()+TRIAL_MS).run();
  const row=await db.prepare("SELECT trial_ends_at,suspended,access_until FROM subscriptions WHERE identity=?").bind(identity).first() as {trial_ends_at:number;suspended:number;access_until:number|null};
  const result=await db.prepare("SELECT paid_at,months,coverage_from FROM subscription_orders WHERE identity=? AND account_type=? AND mode=? AND paid_at IS NOT NULL ORDER BY paid_at,id").bind(identity,owner.accountType,c.mode).all();
  const orders=result.results as {paid_at:number;months:number;coverage_from:number|null}[];
  const expiresAt=Math.max(coverage(row.trial_ends_at,orders),row.access_until??0);
  return {...c,active:!row.suspended&&expiresAt>Date.now(),suspended:!!row.suspended,trial:orders.length===0&&!row.access_until,expiresAt,accountType:owner.accountType,prices};
}
export async function ensureSubscription(owner:Pick<OwnerAccount,"phone"|"accountType">) {
  if(!(await subscriptionStatus(owner)).active) throw new AccountError("Your access has expired. Renew your subscription to continue. Your saved data is safe.",402);
}
export async function reviewPayment(id:string, approve:boolean) {
  const db=billingDb();
  const row=await db.prepare("SELECT id FROM subscription_orders WHERE id=? AND mode='manual'").bind(id).first();
  if(!row) throw new AccountError("Payment request not found.",404);
  await db.prepare("UPDATE subscription_orders SET review_status=?,paid_at=?,reviewed_at=?,coverage_from=(SELECT access_until FROM subscriptions WHERE identity=subscription_orders.identity) WHERE id=? AND review_status='pending' AND paid_at IS NULL").bind(approve?"approved":"rejected",approve?Date.now():null,Date.now(),id).run();
}
