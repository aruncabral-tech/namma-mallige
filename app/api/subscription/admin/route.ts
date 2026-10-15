import { z } from "zod";
import { billingDb } from "@/db/billing";
import { isLegacyOwner } from "@/lib/legacy-owner";
import { accountJson,accountError,AccountError,checkAccountRequest } from "@/lib/account-auth";
import { reviewPayment } from "@/lib/subscriptions";
async function authorize(request:Request){checkAccountRequest(request);if(!await isLegacyOwner())throw new AccountError("Sign in with the site owner's ChatGPT account.",403);}
export async function GET(request:Request){try{await authorize(request);const rows=await billingDb().prepare("SELECT s.id,s.amount,s.months,s.reference,s.account_type,s.review_status,s.created_at,o.owner_name,o.phone FROM subscription_orders s LEFT JOIN owners o ON o.id=s.owner_id WHERE s.mode='manual' ORDER BY CASE WHEN s.review_status='pending' THEN 0 ELSE 1 END,s.created_at DESC LIMIT 200").all();return accountJson({requests:rows.results});}catch(e){return accountError(e);}}
export async function POST(request:Request){try{await authorize(request);const input=z.object({id:z.string().regex(/^nm_[a-f0-9-]{36}$/),approve:z.boolean()}).parse(await request.json());await reviewPayment(input.id,input.approve);return accountJson({ok:true});}catch(e){if(e instanceof z.ZodError)return accountJson({error:"Invalid review."},400);return accountError(e);}}
