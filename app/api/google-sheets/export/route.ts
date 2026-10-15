import { AccountError, accountError, requireBookOwner } from "@/lib/account-auth";
import { billingDb } from "@/db/billing";
import { ownerPrices } from "@/lib/owner-prices";
import { billBalance } from "@/lib/bill-payments";
import { flowerAmount, BUDS, type Unit } from "@/lib/flower-calculation";
import { flowerDate, type FlowerDay } from "@/lib/daily-prices";

type SavedBill = { id: string; version: number; customer: string; phone: string; billNo: string; weekStart: string; days: FlowerDay[]; openingBalance?: number; amountPaid?: number; paymentHistory?: import("@/lib/bill-payments").PaymentRecord[] };

function csvCell(value: unknown) {
  const text = value === null || value === undefined ? "" : String(value);
  const safe = /^[=+\-@]/.test(text) ? `'${text}` : text;
  return /[",\n\r]/.test(safe) ? `"${safe.replaceAll('"', '""')}"` : safe;
}
function csvRow(values: unknown[]) { return values.map(csvCell).join(","); }
function amount(value: number) { return value.toFixed(2); }
function buds(day: FlowerDay, kind: "jasmine" | "pink") { return day[`${kind}Qty`] * BUDS[day[`${kind}Unit`] as Unit]; }

export async function GET(request: Request) {
  try {
    const owner = await requireBookOwner(request);
    const db = billingDb();
    const priceRows = await ownerPrices(owner.id, "0000-01-01", "9999-12-31");
    const billRows = await db.prepare("SELECT id, payload, version FROM bills WHERE owner_id = ? AND json_extract(payload, '$.deletedAt') IS NULL ORDER BY updated_at, id").bind(owner.id).all<{id:string;payload:string;version:number}>();
    const bills = billRows.results.map((row: { id: string; payload: string; version: number }) => ({ ...JSON.parse(row.payload), id: row.id, version: row.version })) as SavedBill[];
    const rows: string[] = [];
    rows.push(csvRow(["Namma Mallige - Google Sheets export"]));
    rows.push(csvRow(["App headline", "Where Beautiful Blooms Meet Happy Clients."]));
    rows.push(csvRow(["Owner name", owner.ownerName]));
    rows.push(csvRow(["Account type", owner.accountType]));
    rows.push(csvRow(["Katte / company", owner.companyName]));
    rows.push(csvRow(["Location", owner.location]));
    rows.push(csvRow(["WhatsApp number", owner.phone]));
    rows.push(csvRow(["Saved Google Sheet", owner.googleSheetUrl]));
    rows.push("");
    rows.push(csvRow(["Daily prices"]));
    rows.push(csvRow(["Date", "M price per atte (₹)", "J price per atte (₹)", "Saved at"]));
    for (const price of priceRows) rows.push(csvRow([price.date, amount(price.jasmineRate), amount(price.pinkRate), price.createdAt]));
    rows.push("");
    rows.push(csvRow(["Daily billing"]));
    rows.push(csvRow(["Bill no", "Customer", "Customer WhatsApp", "Week start", "Date", "M quantity", "M unit", "M buds", "M price per atte (₹)", "M amount (₹)", "J quantity", "J unit", "J buds", "J price per atte (₹)", "J amount (₹)", "Daily total (₹)", "Old pending (₹)", "Paid (₹)", "Pending (₹)"]));
    for (const bill of bills) {
      const balance = billBalance(bill);
      for (const [index, day] of bill.days.entries()) {
        const mBuds = buds(day, "jasmine");
        const jBuds = buds(day, "pink");
        const mAmount = flowerAmount(day.jasmineQty, day.jasmineUnit, day.jasmineRate);
        const jAmount = flowerAmount(day.pinkQty, day.pinkUnit, day.pinkRate);
        rows.push(csvRow([bill.billNo, bill.customer, bill.phone, bill.weekStart, flowerDate(bill.weekStart, index), day.jasmineQty, day.jasmineUnit, mBuds, amount(day.jasmineRate), amount(mAmount), day.pinkQty, day.pinkUnit, jBuds, amount(day.pinkRate), amount(jAmount), amount(mAmount + jAmount), amount(balance.openingBalance), amount(balance.amountPaid), amount(balance.pending)]));
      }
    }
    rows.push("");rows.push(csvRow(["Payment history"]));rows.push(csvRow(["Bill no","Customer","Date","Amount","Method","Note"]));
    for (const bill of bills) for (const p of bill.paymentHistory ?? []) rows.push(csvRow([bill.billNo,bill.customer,p.date,amount(p.amount),p.method,p.note]));
    const body = `${rows.join("\r\n")}\r\n`;
    return new Response(body, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="Namma-Mallige-google-sheets.csv"', "Cache-Control": "no-store, private", "X-Content-Type-Options": "nosniff" } });
  } catch (error) {
    if (error instanceof AccountError) return accountError(error);
    console.error("Google Sheets export could not be completed.");
    return Response.json({ error: "Could not prepare the Google Sheets file. Please retry." }, { status: 503 });
  }
}
