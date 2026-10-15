import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const built = await build({absWorkingDir:root,entryPoints:['lib/monthly-report.ts'],bundle:true,write:false,platform:'node',format:'esm'});
const { monthlyReport } = await import('data:text/javascript;base64,'+Buffer.from(built.outputFiles[0].text).toString('base64'));
const blank = () => ({jasmineQty:0,jasmineUnit:'buds',jasmineRate:60,pinkQty:0,pinkUnit:'buds',pinkRate:1000});
const bill = (changes={}) => ({id:crypto.randomUUID(),customer:'Grower',phone:'9999999999',weekStart:'2026-08-30',days:Array.from({length:7},blank),openingBalance:0,amountPaid:0,...changes});

test('splits a week between months and preserves each line’s five-paise rounding',()=>{
  const b=bill();b.days[1].jasmineQty=100;b.days[2].jasmineQty=100;b.days[3].jasmineQty=100;
  const aug=monthlyReport([b],'2026-08');const sep=monthlyReport([b],'2026-09');
  assert.equal(aug.totals.flowers,1.85);assert.equal(sep.totals.flowers,3.70);
  assert.equal(sep.totals.mBuds,200);assert.deepEqual(sep.daily.map(d=>d.date),['2026-09-01','2026-09-02']);
});
test('uses saved M/J rates and chandu conversion',()=>{
  const b=bill({weekStart:'2026-09-06'});b.days[0]={jasmineQty:.75,jasmineUnit:'chendu',jasmineRate:800,pinkQty:300,pinkUnit:'buds',pinkRate:1000};
  const r=monthlyReport([b],'2026-09');assert.equal(r.totals.mBuds,600);assert.equal(r.totals.jBuds,300);assert.equal(r.totals.flowers,243.75);assert.equal(r.totals.mAmount,150);assert.equal(r.totals.jAmount,93.75);
});
test('counts payments by payment date even on an older bill and excludes undated paid totals',()=>{
  const b=bill({weekStart:'2026-08-02',amountPaid:150,paymentHistory:[{id:'p1',date:'2026-09-10',amount:100,method:'Cash',note:''},{id:'p2',date:'2026-10-01',amount:25,method:'UPI',note:''}]});
  const r=monthlyReport([b],'2026-09');assert.equal(r.totals.paid,100);assert.equal(r.totals.flowers,0);assert.equal(r.customers.length,1);assert.equal(r.hasUndatedPayments,true);assert.equal(monthlyReport([b],'2026-10').totals.paid,25);
});
test('latest-bill balance excludes carried debt on earlier weeks and separates people with different phones',()=>{
  const first=bill({weekStart:'2026-09-06',openingBalance:100});
  const next=bill({weekStart:'2026-09-13',openingBalance:100,amountPaid:25});
  const other=bill({weekStart:'2026-09-13',phone:'8888888888',openingBalance:50});
  const r=monthlyReport([next,other,first],'2026-09');assert.equal(r.latestBillPending,125);assert.equal(r.balances.length,2);assert.equal(r.totals.flowers,0);
});
test('empty months return zero totals and report generation does not modify records',()=>{
  const b=bill();const before=JSON.stringify(b);const r=monthlyReport([b],'2026-12');assert.equal(r.totals.flowers,0);assert.deepEqual(r.daily,[]);assert.equal(JSON.stringify(b),before);assert.throws(()=>monthlyReport([],'2026-13'),RangeError);
});
