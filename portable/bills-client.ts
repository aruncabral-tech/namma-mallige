import { z } from "zod";
import { billBalance, isPaymentAmount, paymentFields } from "../lib/bill-payments";
import { checkBillPrices, lockBillPrices, type DailyPrice } from "../lib/daily-prices";

const STORAGE_KEY = "anni-shetty-jasmine-html-bills-v1";
const PRICE_STORAGE_KEY = "anni-shetty-jasmine-html-daily-prices-v1";
const value = z.number().finite().min(0).max(100000000);
const unit = z.enum(["buds", "chendu", "atte"]);
const entry = z.object({ jasmineQty:value, jasmineUnit:unit, jasmineRate:value, pinkQty:value, pinkUnit:unit, pinkRate:value, jasminePriceLocked:z.boolean().optional(), pinkPriceLocked:z.boolean().optional() });
const billSchema = z.object({
  id:z.string().uuid(), version:z.number().int().min(0),
  customer:z.string().trim().min(1).max(200), phone:z.string().max(40), billNo:z.string().trim().min(1).max(80),
  weekStart:z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(s => { const d = new Date(s + "T12:00:00Z"); return !isNaN(d.getTime()) && d.toISOString().slice(0,10) === s; }),
  days:z.array(entry).length(7), deletedAt:z.string().optional(),
  openingBalance:z.number().refine(isPaymentAmount).optional(),
  amountPaid:z.number().refine(isPaymentAmount).optional(),
});
const reply = (body:unknown, status=200) => new Response(JSON.stringify(body), { status, headers:{"Content-Type":"application/json"} });
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => { const parsed = new Date(value + "T12:00:00Z"); return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0,10) === value; });
const priceSchema = z.object({date,jasmineRate:value,pinkRate:value,createdAt:z.string()});
const readPrices = () => z.array(priceSchema).parse(JSON.parse(localStorage.getItem(PRICE_STORAGE_KEY) ?? "[]"));

export async function dailyPricesRequest(from: string, to = from, init?: RequestInit): Promise<Response> {
  try {
    const prices = readPrices();
    if ((init?.method ?? "GET") === "GET") return reply({prices:prices.filter(price => price.date >= from && price.date <= to)});
    if (init?.method !== "POST") return reply({error:"This action is not supported."},405);
    const parsed = priceSchema.omit({createdAt:true}).safeParse(JSON.parse(String(init.body ?? "{}")));
    if (!parsed.success) return reply({error:"Enter a valid flower date and both non-negative prices per atte."},400);
    const existing = prices.find(price => price.date === parsed.data.date);
    if (existing) return existing.jasmineRate === parsed.data.jasmineRate && existing.pinkRate === parsed.data.pinkRate ? reply({price:existing}) : reply({error:"Prices for this date are already fixed.",price:existing},409);
    const price: DailyPrice = {...parsed.data,createdAt:new Date().toISOString()};
    localStorage.setItem(PRICE_STORAGE_KEY,JSON.stringify([...prices,price]));
    return reply({price},201);
  } catch { return reply({error:"Could not read or save this browser’s daily prices. Your entries are kept."},503); }
}

export async function billsRequest(init?: RequestInit): Promise<Response> {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    const parsed = z.array(billSchema).safeParse(stored ? JSON.parse(stored) : []);
    if(!parsed.success) return reply({error:"Saved bills could not be read. The existing browser data has been kept."},500);
    const bills = parsed.data;
    const method = init?.method ?? "GET";
    if(method === "GET") return reply({ bills:bills.filter(b => !b.deletedAt) });
    const body = JSON.parse(String(init?.body ?? "{}"));
    if(method === "POST") {
      const result = billSchema.safeParse(body);
      if(!result.success) return reply({error:"Enter a customer, bill number, valid date and non-negative quantities and prices up to 100,000,000."},400);
      const bill = result.data;
      const existing = bills.find(b => b.id === bill.id);
      if((bill.version === 0 && existing) || (bill.version > 0 && (!existing || existing.deletedAt || existing.version !== bill.version))) {
        return reply({error:"This bill changed in another window. Refresh and reopen the saved bill before editing again."},409);
      }
      if (existing && existing.weekStart !== bill.weekStart) return reply({error:"A saved bill keeps its original flower dates."},400);
      const prices = Object.fromEntries(readPrices().map(price => [price.date,price]));
      const priceError = checkBillPrices(bill.days,existing?.days,bill.weekStart,prices);
      if (priceError) return reply({error:priceError.error},priceError.status);
      const saved = {...bill,days:lockBillPrices(bill.days,existing?.days,bill.weekStart,prices),...paymentFields(bill,existing),version:bill.version+1};
      if(billBalance(saved).pending < 0) return reply({error:"Amount paid cannot be more than this week's flowers plus the old pending amount."},400);
      delete saved.deletedAt;
      localStorage.setItem(STORAGE_KEY, JSON.stringify([saved,...bills.filter(b => b.id !== bill.id)]));
      return reply({version:saved.version,bill:saved});
    }
    if(method === "DELETE") {
      const check = z.object({id:z.string().uuid(),version:z.number().int().min(1),confirmed:z.literal(true)}).safeParse(body);
      if(!check.success) return reply({error:"Confirm the selected bill before deleting."},400);
      const target = bills.find(b => b.id === check.data.id);
      if(!target || target.deletedAt || target.version !== check.data.version) return reply({error:"This bill changed or was already deleted. Refresh the account book and try again."},409);
      target.deletedAt = new Date().toISOString();
      target.version += 1;
      localStorage.setItem(STORAGE_KEY, JSON.stringify(bills));
      return reply({deleted:true,id:target.id});
    }
    return reply({error:"This action is not supported."},405);
  } catch {
    return reply({error:"The browser could not read or save these bills. Your entries are still on screen. Open this HTML file in a normal browser window with storage enabled."},503);
  }
}
