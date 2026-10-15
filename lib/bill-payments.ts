import { flowerAmount, sumAmounts, type Unit } from "./flower-calculation";

type FlowerDay = { jasmineQty:number; jasmineUnit:Unit; jasmineRate:number; pinkQty:number; pinkUnit:Unit; pinkRate:number };
export type PaymentRecord = {id:string; date:string; amount:number; method:"Cash"|"UPI"|"Bank transfer"|"Other"; note:string};
export type PaymentFields = { openingBalance?:number; amountPaid?:number; paymentHistory?:PaymentRecord[] };
export function isPaymentAmount(value: number) {
  return Number.isFinite(value) && value >= 0 && value <= 100000000 && Math.abs(value * 100 - Math.round(value * 100)) < 0.00001;
}
export function paymentFields(incoming: PaymentFields, previous?: PaymentFields) {
  return { openingBalance:incoming.openingBalance ?? previous?.openingBalance ?? 0, amountPaid:incoming.amountPaid ?? previous?.amountPaid ?? 0, ...((incoming.paymentHistory ?? previous?.paymentHistory) ? {paymentHistory:incoming.paymentHistory ?? previous?.paymentHistory} : {}) };
}
export function paymentSummary(flowerTotal: number, openingBalance = 0, amountPaid = 0) {
  const totalPayable = sumAmounts([flowerTotal, openingBalance]);
  return { flowerTotal, openingBalance, amountPaid, totalPayable, pending:sumAmounts([totalPayable, -amountPaid]) };
}
export function billBalance(bill: PaymentFields & { days:FlowerDay[] }) {
  const flowerTotal = sumAmounts(bill.days.map(day => sumAmounts([
    flowerAmount(day.jasmineQty, day.jasmineUnit, day.jasmineRate),
    flowerAmount(day.pinkQty, day.pinkUnit, day.pinkRate),
  ])));
  return paymentSummary(flowerTotal, bill.openingBalance ?? 0, bill.amountPaid ?? 0);
}
