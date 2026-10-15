import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
async function loadModule(entry, plugins=[]) {
  const result = await build({absWorkingDir:root,entryPoints:[entry],tsconfig:root+'tsconfig.json',bundle:true,write:false,platform:'node',format:'esm',plugins});
  return import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].text).toString('base64'));
}
const payments = await loadModule('lib/bill-payments.ts');
const portable = await loadModule('portable/bills-client.ts');
const api = await loadModule('app/api/bills/route.ts', [{name:'test-database',setup(bundler) {
  bundler.onResolve({filter:/^@\/db\/billing$/},()=>({path:'billing',namespace:'test-db'}));
  bundler.onLoad({filter:/.*/,namespace:'test-db'},()=>({contents:'export function billingDb(){ return globalThis.__testBillingDb; }'}));
  bundler.onResolve({filter:/^@\/lib\/account-auth$/},()=>({path:'auth',namespace:'test-auth'}));
  bundler.onLoad({filter:/.*/,namespace:'test-auth'},()=>({contents:'export const LEGACY_BOOK_ID="existing-book"; export class AccountError extends Error{}; export function accountError(e){return Response.json({error:e.message},{status:401});} export async function requireBookOwner(){return {id:LEGACY_BOOK_ID};}'}));
}}]);
const blank = () => ({jasmineQty:0,jasmineUnit:'buds',jasmineRate:800,pinkQty:0,pinkUnit:'buds',pinkRate:60});
const legacyBill = () => ({id:crypto.randomUUID(),version:1,customer:'Test customer',phone:'',billNo:'TEST-1',weekStart:'2026-09-06',days:Array.from({length:7},(_,i)=>({...blank(),jasmineQty:i===0?1000:0}))});

function storageEngine(kind, initial) {
  if(kind==='HTML') {
    const values = new Map([['anni-shetty-jasmine-html-bills-v1',JSON.stringify([initial])]]);
    Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)}});
    return {request:(method,body)=>portable.billsRequest({method,...(body ? {body:JSON.stringify(body)} : {})}),close:()=>{}};
  }
  const db = new DatabaseSync(':memory:');
  for (const file of readdirSync(root+'drizzle').filter(f=>f.endsWith('.sql')).sort()) db.exec(readFileSync(root+'drizzle/'+file,'utf8'));
  const {id,version,...payload} = initial;
  db.prepare('INSERT INTO bills (id,payload,version,updated_at) VALUES (?,?,?,?)').run(id,JSON.stringify(payload),version,new Date().toISOString());
  globalThis.__testBillingDb = {prepare(sql) {
    const statement = db.prepare(sql);
    let values = [];
    return {bind(...args){values=args;return this;},first:()=>statement.get(...values)??null,all:()=>({results:statement.all(...values)})};
  }};
  return {request:(method,body)=>api[method](new Request('https://billing.test/api/bills',{method,...(body ? {body:JSON.stringify(body)} : {})})),close:()=>db.close()};
}

test('pending amounts use exact paise and keep flower rounding unchanged',()=>{
  const bill=legacyBill();
  bill.days[1].jasmineQty=100;
  bill.days[1].jasmineRate=60;
  const result=payments.billBalance({...bill,openingBalance:200.15,amountPaid:100.25});
  assert.equal(result.flowerTotal,251.85);
  assert.equal(result.totalPayable,452);
  assert.equal(result.pending,351.75);
  assert.deepEqual(payments.paymentFields({}, {openingBalance:200,amountPaid:50}),{openingBalance:200,amountPaid:50});
  assert.deepEqual(payments.paymentFields({openingBalance:0,amountPaid:0}, {openingBalance:200,amountPaid:50}),{openingBalance:0,amountPaid:0});
  assert.equal(payments.isPaymentAmount(1.234),false);
});

for(const kind of ['HTML','server']) test(`${kind}: old bills, payment persistence, validation and carry-forward`,async()=>{
  const initial=legacyBill();
  const engine=storageEngine(kind,initial);
  try {
    const read=async()=> (await (await engine.request('GET')).json()).bills;
    let current=(await read())[0];
    assert.equal(payments.billBalance(current).pending,250);
    let response=await engine.request('POST',{...current,openingBalance:200.15,amountPaid:100.25});
    assert.equal(response.status,200);
    current=(await read())[0];
    assert.equal(current.version,2);
    assert.equal(payments.billBalance(current).pending,349.90);
    for(const invalid of [{amountPaid:1000},{openingBalance:-1},{amountPaid:1.234}]) {
      assert.equal((await engine.request('POST',{...current,...invalid})).status,400);
      assert.equal((await read())[0].version,2);
    }
    // An older app omits the new fields. Its edits must not erase payments.
    const {openingBalance,amountPaid,...olderClient}=current;
    olderClient.days=olderClient.days.map((d,i)=>({...d,jasmineQty:i===0?2000:d.jasmineQty}));
    assert.equal((await engine.request('POST',olderClient)).status,200);
    current=(await read())[0];
    assert.equal(current.version,3);
    assert.equal(current.openingBalance,200.15);
    assert.equal(current.amountPaid,100.25);
    assert.equal(payments.billBalance(current).pending,599.90);
    assert.equal((await engine.request('POST',olderClient)).status,409);
    const next={...legacyBill(),id:crypto.randomUUID(),version:0,billNo:'TEST-2',weekStart:'2026-09-13',days:Array.from({length:7},blank),openingBalance:payments.billBalance(current).pending,amountPaid:0};
    assert.equal((await engine.request('POST',next)).status,200);
    const carried=(await read()).find(b=>b.id===next.id);
    assert.equal(payments.billBalance(carried).pending,599.90);
    assert.equal((await engine.request('DELETE',{id:current.id,version:current.version})).status,400);
    assert.equal((await engine.request('DELETE',{id:current.id,version:current.version,confirmed:true})).status,200);
    assert.equal((await read()).length,1);
    assert.equal(payments.billBalance((await read())[0]).pending,599.90);
  } finally {engine.close();}
});
