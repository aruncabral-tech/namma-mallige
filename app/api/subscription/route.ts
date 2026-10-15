import { z } from "zod";
import { billingDb } from "@/db/billing";
import { requireOwner, accountJson, accountError, AccountError, throttle } from "@/lib/account-auth";
import { paymentConfig, subscriptionIdentity, subscriptionStatus } from "@/lib/subscriptions";
export async function GET(request:Request) {
  try { const owner=await requireOwner(request);
    const requests=await billingDb().prepare("SELECT id,amount,months,reference,review_status,created_at FROM subscription_orders WHERE identity=? AND mode='manual' ORDER BY created_at DESC LIMIT 20").bind(subscriptionIdentity(owner.phone)).all();
    return accountJson({subscription:await subscriptionStatus(owner),requests:requests.results});
  } catch(e){return accountError(e);}
}
export async function POST(request:Request) {
  try {
    const owner=await requireOwner(request);
    const input=z.object({plan:z.enum(["monthly","yearly"]),reference:z.string().trim().regex(/^\d{12}$/)}).parse(await request.json());
    if(!paymentConfig().enabled) throw new AccountError("Subscriptions are not open yet.",409);
    await throttle(request,owner.phone,"subscription");
    const status=await subscriptionStatus(owner),db=billingDb();
    const result=await db.prepare("INSERT INTO subscription_orders(id,owner_id,identity,account_type,months,amount,mode,created_at,reference) VALUES(?,?,?,?,?,?,'manual',?,?) ON CONFLICT(reference) DO NOTHING").bind("nm_"+crypto.randomUUID(),owner.id,subscriptionIdentity(owner.phone),owner.accountType,input.plan==="yearly"?12:1,status.prices[input.plan],Date.now(),input.reference).run();
    if(!result.meta.changes) throw new AccountError("This payment reference has already been submitted. Check your payment status or contact the owner.",409);
    return accountJson({submitted:true});
  } catch(e){if(e instanceof z.ZodError)return accountJson({error:"Choose a plan and enter the 12-digit UPI reference (UTR)."},400);return accountError(e);}
}
