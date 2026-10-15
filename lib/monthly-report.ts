import { BUDS, flowerAmount, sumAmounts } from "./flower-calculation";
import { flowerDate, type FlowerDay } from "./daily-prices";
import { billBalance, type PaymentFields } from "./bill-payments";

export type ReportBill = PaymentFields & {
  id: string; customer: string; phone: string; weekStart: string; days: FlowerDay[];
};
type Figures = { mBuds: number; jBuds: number; mAmount: number; jAmount: number; flowers: number; paid: number };
export type ReportCustomer = Figures & { key: string; customer: string; phone: string };
const zero = (): Figures => ({ mBuds: 0, jBuds: 0, mAmount: 0, jAmount: 0, flowers: 0, paid: 0 });
// This book identifies a customer by name and phone, not by weekly bill ID.
const customerKey = (b: ReportBill) => JSON.stringify([b.customer.trim().toLocaleLowerCase(), b.phone.trim()]);
const add = (a: number, b: number) => sumAmounts([a, b]);

export function monthlyReport(bills: ReportBill[], month: string) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new RangeError("Choose a valid month.");
  const customers = new Map<string, ReportCustomer>();
  const dates = new Map<string, Figures>();
  const latest = new Map<string, ReportBill>();
  const totals = zero();
  let hasUndatedPayments = false;
  const rowFor = (b: ReportBill) => {
    const key = customerKey(b);
    if (!customers.has(key)) customers.set(key, { key, customer: b.customer, phone: b.phone, ...zero() });
    return customers.get(key)!;
  };
  const dateFor = (date: string) => {
    if (!dates.has(date)) dates.set(date, zero());
    return dates.get(date)!;
  };
  for (const bill of bills) {
    const key = customerKey(bill);
    if (!latest.has(key) || bill.weekStart > latest.get(key)!.weekStart) latest.set(key, bill);
    for (const [index, day] of bill.days.entries()) {
      const date = flowerDate(bill.weekStart, index);
      if (date.slice(0, 7) !== month) continue;
      const mBuds = day.jasmineQty * BUDS[day.jasmineUnit];
      const jBuds = day.pinkQty * BUDS[day.pinkUnit];
      if (mBuds === 0 && jBuds === 0) continue;
      // Reuse the billing calculation, including rounding each flower line.
      const mAmount = flowerAmount(day.jasmineQty, day.jasmineUnit, day.jasmineRate);
      const jAmount = flowerAmount(day.pinkQty, day.pinkUnit, day.pinkRate);
      for (const row of [totals, rowFor(bill), dateFor(date)]) {
        row.mBuds += mBuds; row.jBuds += jBuds;
        row.mAmount = add(row.mAmount, mAmount); row.jAmount = add(row.jAmount, jAmount);
        row.flowers = sumAmounts([row.flowers, mAmount, jAmount]);
      }
    }
    const history = bill.paymentHistory ?? [];
    if ((bill.amountPaid ?? 0) > sumAmounts(history.map(p => p.amount))) hasUndatedPayments = true;
    for (const payment of history) {
      if (payment.date.slice(0, 7) !== month) continue;
      for (const row of [totals, rowFor(bill), dateFor(payment.date)]) row.paid = add(row.paid, payment.amount);
    }
  }
  const balances = Array.from(latest, ([key, bill]) => ({ key, customer: bill.customer, phone: bill.phone, weekStart: bill.weekStart, pending: billBalance(bill).pending })).sort((a,b) => a.customer.localeCompare(b.customer));
  return {
    month, totals, hasUndatedPayments,
    customers: Array.from(customers.values()).sort((a,b) => a.customer.localeCompare(b.customer)),
    daily: Array.from(dates, ([date, figures]) => ({ date, ...figures })).sort((a,b) => a.date.localeCompare(b.date)),
    balances, latestBillPending: sumAmounts(balances.map(b => b.pending)),
  };
}
