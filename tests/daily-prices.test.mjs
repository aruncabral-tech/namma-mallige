import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const root = fileURLToPath(new URL('../', import.meta.url));
async function loadModule(entry, database = false) {
  const result = await build({absWorkingDir:root,entryPoints:[entry],tsconfig:root+'tsconfig.json',bundle:true,write:false,platform:'node',format:'esm',plugins:database?[{name:'pricing-test-db',setup(bundler){
    bundler.onResolve({filter:/^@\/db\/billing$/},()=>({path:'billing',namespace:'test-db'}));
    bundler.onLoad({filter:/.*/,namespace:'test-db'},()=>({contents:'export function billingDb(){return globalThis.__dailyPriceTestDb;}'}));
    bundler.onResolve({filter:/^@\/lib\/account-auth$/},()=>({path:'auth',namespace:'test-auth'}));
    bundler.onLoad({filter:/.*/,namespace:'test-auth'},()=>({contents:'export const LEGACY_BOOK_ID="existing-book"; export class AccountError extends Error{}; export function accountError(e){return Response.json({error:e.message},{status:401});} export async function requireBookOwner(){return {id:LEGACY_BOOK_ID};} export function verifyMpin(){return true;}'}));
  }}]:[]});
  return import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].text).toString('base64'));
}
const [billsApi,pricesApi,portable,pricing,payments] = await Promise.all([
  loadModule('app/api/bills/route.ts',true),loadModule('app/api/daily-prices/route.ts',true),loadModule('portable/bills-client.ts'),loadModule('lib/daily-prices.ts'),loadModule('lib/bill-payments.ts'),
]);
const migrationFiles = (await readdir(root+'drizzle')).filter(name=>name.endsWith('.sql')).sort();
const migrations = await Promise.all(migrationFiles.map(name=>readFile(root+'drizzle/'+name,'utf8')));
const blank = () => ({jasmineQty:0,jasmineUnit:'buds',jasmineRate:0,pinkQty:0,pinkUnit:'buds',pinkRate:0});
const makeBill = (customer='Customer A') => ({id:crypto.randomUUID(),version:0,customer,phone:'',billNo:'CHECK-'+customer,weekStart:'2026-09-06',days:Array.from({length:7},blank),openingBalance:0,amountPaid:0});
const request = (path,method,body) => new Request('https://billing.test'+path,{method,...(body?{headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}:{})});
async function engine(kind) {
  if(kind==='HTML') {
    const values=new Map();
    Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value)}});
    return {
      price:(method,body,from='2026-09-06',to='2026-09-12')=>portable.dailyPricesRequest(from,to,{method,...(body?{body:JSON.stringify(body)}:{})}),
      bill:(method,body)=>portable.billsRequest({method,...(body?{body:JSON.stringify(body)}:{})}),
      seed:bill=>values.set('anni-shetty-jasmine-html-bills-v1',JSON.stringify([bill])),close:()=>{},
    };
  }
  const db=new DatabaseSync(':memory:');
  for(const sql of migrations) db.exec(sql);
  globalThis.__dailyPriceTestDb={prepare(sql){const statement=db.prepare(sql);let values=[];return {bind(...args){values=args;return this;},first:()=>statement.get(...values)??null,all:()=>({results:statement.all(...values)})};}};
  return {
    price:(method,body,from='2026-09-06',to='2026-09-12')=>pricesApi[method](request('/api/daily-prices?from='+from+'&to='+to,method,body)),
    bill:(method,body)=>billsApi[method](request('/api/bills',method,body)),
    seed:bill=>{const {id,version,...payload}=bill;db.prepare('INSERT INTO bills (id,payload,version,updated_at) VALUES(?,?,?,?)').run(id,JSON.stringify(payload),version,new Date().toISOString());},
    close:()=>db.close(),
  };
}

for(const kind of ['server','HTML']) {
  test(`${kind}: one fixed pair per date, shared customers, next-day prices and tamper protection`,async()=>{
    const e=await engine(kind);
    try {
      const friday={date:'2026-09-11',jasmineRate:800,pinkRate:600};
      const saturday={date:'2026-09-12',jasmineRate:1000,pinkRate:200};
      assert.equal((await e.price('POST',friday)).status,201);
      assert.equal((await e.price('POST',friday)).status,200);
      assert.equal((await e.price('POST',{...friday,jasmineRate:900})).status,409);
      assert.equal((await e.price('POST',saturday)).status,201);
      const records=(await (await e.price('GET')).json()).prices;
      assert.equal(records.find(p=>p.date===friday.date).jasmineRate,800);
      const prices=Object.fromEntries(records.map(p=>[p.date,p]));
      const original=makeBill();
      original.days[5]={...blank(),jasmineQty:600,pinkQty:100};
      original.days[6]={...blank(),jasmineQty:300,pinkQty:50};
      original.days=pricing.withDailyPrices(original.days,undefined,original.weekStart,prices);
      const before=JSON.stringify(original);
      const save=await e.bill('POST',original);
      assert.equal(save.status,200);
      const saved=(await save.json()).bill;
      assert.equal(saved.days[5].jasmineRate,800);
      assert.equal(saved.days[6].jasmineRate,1000);
      assert.equal(saved.days[5].pinkRate,600);
      assert.equal(saved.days[6].pinkRate,200);
      assert.equal(saved.days[5].jasminePriceLocked,true);
      assert.equal(payments.billBalance(saved).flowerTotal,265.60);
      assert.equal(JSON.stringify(original),before,'pricing must not mutate source entries');
      const second={...original,id:crypto.randomUUID(),customer:'Customer B'};
      second.days[5].jasmineRate=750;second.days[5].jasminePriceLocked=true;
      assert.equal((await e.bill('POST',second)).status,200);
      const stored=(await (await e.bill('GET')).json()).bills;
      assert.equal(stored.length,2);
      assert.notEqual(stored.find(b=>b.customer==='Customer A').days[5].jasmineRate,stored.find(b=>b.customer==='Customer B').days[5].jasmineRate,'each customer keeps their own price');
      const tampered=structuredClone(saved);
      tampered.days[5].jasmineRate=1000;
      assert.equal((await e.bill('POST',tampered)).status,200,'saved customer price can be corrected without MPIN');
      const forged=structuredClone(second);
      forged.id=crypto.randomUUID();forged.days[5].jasmineRate=1;forged.days[5].jasminePriceLocked=true;
      assert.equal((await e.bill('POST',forged)).status,200,'a new customer bill may use its own rate');
      const missing=makeBill('Missing price');missing.days[4].jasmineQty=100;
      assert.equal((await e.bill('POST',missing)).status,200,'the bill can be saved with its entered individual rate');
      assert.equal((await e.bill('POST',{...tampered,version:2,weekStart:'2026-09-13'})).status,400);
      const after=(await (await e.bill('GET')).json()).bills.find(b=>b.id===saved.id);
      assert.equal(after.days[5].jasmineRate,1000);
      assert.equal(after.version,1);
      assert.equal((await e.price('POST',{...friday,date:'2026-09-31'})).status,400);
      assert.equal((await e.price('POST',{...friday,date:'2026-09-13',pinkRate:-1})).status,400);
    } finally {e.close();}
  });

  test(`${kind}: customer-specific rates remain editable and defaults are used only initially`,async()=>{
    const e=await engine(kind);
    try {
      const legacy={...makeBill('Older bill'),version:1};
      legacy.days[5]={...blank(),jasmineQty:1000,jasmineRate:540,pinkRate:3200};
      e.seed(legacy);
      await e.price('POST',{date:'2026-09-11',jasmineRate:800,pinkRate:600});
      const records=(await (await e.price('GET')).json()).prices;
      const prices=Object.fromEntries(records.map(p=>[p.date,p]));
      let updated={...legacy,days:pricing.withDailyPrices(legacy.days,legacy.days,legacy.weekStart,prices),openingBalance:100,amountPaid:50};
      assert.equal(updated.days[5].jasmineRate,540);
      assert.equal(updated.days[5].pinkRate,600);
      let response=await e.bill('POST',updated);
      assert.equal(response.status,200);
      updated=(await response.json()).bill;
      assert.equal(payments.billBalance(updated).flowerTotal,168.75);
      updated.days[5].jasmineQty=0;
      response=await e.bill('POST',updated);assert.equal(response.status,200);
      updated=(await response.json()).bill;
      assert.equal(updated.days[5].jasminePriceLocked,true);
      const baseline=structuredClone(updated.days);
      updated.days[5].jasmineQty=1000;updated.days[5].pinkQty=100;
      updated.days=pricing.withDailyPrices(updated.days,baseline,updated.weekStart,prices);
      // An older client may omit the price-lock markers; server history still wins.
      delete updated.days[5].jasminePriceLocked;delete updated.days[5].pinkPriceLocked;
      response=await e.bill('POST',updated);assert.equal(response.status,200);
      updated=(await response.json()).bill;
      assert.equal(updated.days[5].jasmineRate,540);
      assert.equal(updated.days[5].pinkRate,600);
      assert.equal(payments.billBalance(updated).flowerTotal,187.50);
      assert.equal(payments.billBalance(updated).pending,237.50);
    } finally {e.close();}
  });
}

test('server: competing devices cannot replace a fixed daily price; zero prices are valid',async()=>{
  const e=await engine('server');
  try {
    const responses=await Promise.all([e.price('POST',{date:'2026-09-11',jasmineRate:800,pinkRate:600}),e.price('POST',{date:'2026-09-11',jasmineRate:1000,pinkRate:700})]);
    assert.deepEqual(responses.map(r=>r.status).sort(),[201,409]);
    assert.equal((await e.price('POST',{date:'2026-09-12',jasmineRate:0,pinkRate:0})).status,201);
    const free=makeBill('Zero price');free.days[6].jasmineQty=600;
    const response=await e.bill('POST',free);assert.equal(response.status,200);
    assert.equal(payments.billBalance((await response.json()).bill).flowerTotal,0);
    assert.equal((await e.price('GET',undefined,'2026-09-31','2026-10-01')).status,400);
  } finally {e.close();}
});
