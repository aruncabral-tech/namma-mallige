import { z } from "zod";
import { isPaymentAmount } from "./bill-payments";
const number = z.number().finite().min(0).max(100000000);
const unit = z.enum(["buds", "chendu", "atte"]);
const day = z.object({ jasmineQty: number, jasmineUnit: unit, jasmineRate: number, pinkQty: number, pinkUnit: unit, pinkRate: number, jasminePriceLocked: z.boolean().optional(), pinkPriceLocked: z.boolean().optional() });
export const billSchema = z.object({
  id: z.string().uuid(), version: z.number().int().min(0),
  customer: z.string().trim().min(1).max(200), phone: z.string().max(40),
  billNo: z.string().trim().min(1).max(80),
  weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(s => { const d = new Date(s + "T12:00:00Z"); return !isNaN(d.getTime()) && d.toISOString().slice(0,10) === s; }),
  days: z.array(day).length(7),
  openingBalance: z.number().refine(isPaymentAmount).optional(),
  paymentHistory: z.array(z.object({ id:z.string().uuid(), date:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(s=>{const d=new Date(s+"T12:00:00Z");return !isNaN(d.getTime())&&d.toISOString().slice(0,10)===s;}), amount:z.number().refine(isPaymentAmount).refine(n=>n>0), method:z.enum(["Cash","UPI","Bank transfer","Other"]), note:z.string().max(200) })).max(500).refine(rows=>new Set(rows.map(r=>r.id)).size===rows.length).optional(),
  amountPaid: z.number().refine(isPaymentAmount).optional(),
});
