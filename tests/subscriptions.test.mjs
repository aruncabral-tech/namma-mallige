import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { createHmac,createHash } from 'node:crypto';
import { readFile,readdir } from 'node:fs/promises';
import { build } from 'esbuild';
const db=new DatabaseSync(':memory:');
for(const file of (await readdir('drizzle')).filter(f=>f.endsWith('.sql')).sort())db.exec(await readFile('drizzle/'+file,'utf8'));
globalThis.__subscriptionEnv={SUBSCRIPTIONS_ENABLED:'true',};
globalThis.__subscriptionDb={prepare(sql){const stmt=db.prepare(sql);let values=[];return {bind(...v){values=v;return this;},async run(){return stmt.run(...values);},async first(){return stmt.get(...values)??null;},async all(){return {results:stmt.all(...values)};}};}};
const result=await build({stdin:{contents:'export * from "./lib/subscriptions"; export {requireOwner,requireBookOwner} from "./lib/account-auth";',resolveDir:process.cwd(),loader:'ts'},bundle:true,write:false,platform:'node',format:'esm',plugins:[{name:'test-runtime',setup(b){b.onResolve({filter:/^cloudflare:workers$/},()=>({path:'env',namespace:'mock'}));b.onResolve({filter:/^@\/db\/billing$/},()=>({path:'db',namespace:'mock'}));b.onLoad({filter:/.*/,namespace:'mock'},args=>({contents:args.path==='env'?'export const env=globalThis.__subscriptionEnv;':'export function billingDb(){return globalThis.__subscriptionDb;}'}));}}]});
const lib=await import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].text).toString('base64'));
const plansBuild=await build({entryPoints:['lib/subscription-plans.ts'],bundle:true,write:false,platform:'node',format:'esm'});
const plans=await import('data:text/javascript;base64,'+Buffer.from(plansBuild.outputFiles[0].text).toString('base64'));
const owner={id:'test-owner',phone:'+919876543210',accountType:'business'};
const seed=(id,amount=150,mode='manual')=>db.prepare('INSERT INTO subscription_orders(id,owner_id,identity,account_type,months,amount,mode,created_at) VALUES(?,?,?,?,?,?,?,?)').run(id,owner.id,lib.subscriptionIdentity(owner.phone),'business',1,amount,mode,Date.now());
const adminBuild=await build({entryPoints:['app/api/subscription/admin/route.ts'],bundle:true,write:false,platform:'node',format:'esm',plugins:[{name:'admin-mock',setup(b){
b.onResolve({filter:/^cloudflare:workers$/},()=>({path:'env',namespace:'mock'}));b.onResolve({filter:/^@\/db\/billing$/},()=>({path:'db',namespace:'mock'}));b.onResolve({filter:/^@\/lib\/legacy-owner$/},()=>({path:'admin',namespace:'mock'}));b.onLoad({filter:/.*/,namespace:'mock'},a=>({contents:a.path==='env'?'export const env=globalThis.__subscriptionEnv;':a.path==='db'?'export const billingDb=()=>globalThis.__subscriptionDb;':'export const isLegacyOwner=async()=>globalThis.__isAdmin===true;'}));}}]});
const admin=await import('data:text/javascript;base64,'+Buffer.from(adminBuild.outputFiles[0].text).toString('base64'));
const ownerBuild=await build({entryPoints:['app/api/owner/route.ts'],bundle:true,write:false,platform:'node',format:'esm',plugins:[{name:'admin-mock',setup(b){
b.onResolve({filter:/^cloudflare:workers$/},()=>({path:'env',namespace:'mock'}));b.onResolve({filter:/^@\/db\/billing$/},()=>({path:'db',namespace:'mock'}));b.onResolve({filter:/^@\/lib\/legacy-owner$/},()=>({path:'admin',namespace:'mock'}));b.onLoad({filter:/.*/,namespace:'mock'},a=>({contents:a.path==='env'?'export const env=globalThis.__subscriptionEnv;':a.path==='db'?'export const billingDb=()=>globalThis.__subscriptionDb;':'export const isLegacyOwner=async()=>globalThis.__isAdmin===true;'}));}}]});
const ownerApi=await import('data:text/javascript;base64,'+Buffer.from(ownerBuild.outputFiles[0].text).toString('base64'));
const originalFetch=globalThis.fetch;
let response={order_id:'order-1',order_currency:'INR',order_amount:150,order_status:'PAID'};
globalThis.fetch=async()=>Response.json(response);
test('confirmed prices and calendar month boundaries',()=>{
 assert.deepEqual(plans.PLANS,{business:{monthly:150,yearly:1800},personal:{monthly:50,yearly:500}});
 assert.equal(new Date(plans.addMonths(Date.UTC(2028,0,31),1)).toISOString(),'2028-02-29T00:00:00.000Z');
 assert.equal(new Date(plans.addMonths(Date.UTC(2028,1,29),12)).toISOString(),'2029-02-28T00:00:00.000Z');
});
test('trial is five days and cannot restart with recreated owner ID or account type',async()=>{
 const s=await lib.subscriptionStatus(owner);assert.equal(s.active,true);assert.ok(Math.abs(s.expiresAt-Date.now()-plans.TRIAL_MS)<2000);
 const recreated=await lib.subscriptionStatus({...owner,id:'recreated',accountType:'personal'});assert.equal(recreated.expiresAt,s.expiresAt);
 db.prepare('UPDATE subscriptions SET trial_ends_at=?').run(Date.now()-1000);
 await assert.rejects(lib.ensureSubscription(owner),e=>e.status===402);
});
test('expired sessions cannot read or write books but can access renewal authentication',async()=>{
 const token='a'.repeat(64);
 db.prepare('INSERT INTO owners(id,owner_name,phone,account_type,password_hash,recovery_hash,created_at) VALUES(?,?,?,?,?,?,?)').run(owner.id,'Test owner',owner.phone,'business','unused','unused',new Date().toISOString());
 db.prepare('INSERT INTO owner_sessions VALUES(?,?,1,?)').run(createHash('sha256').update(token).digest('hex'),owner.id,Date.now()+60000);
 for(const method of ['GET','POST']) {
  const request=new Request('https://nammamallige.store/api/bills',{method,headers:{Cookie:`__Host-acs-session=${token}`,'X-ACS-Owner':owner.id,'X-ACS-Request':'1','Content-Type':'application/json',Origin:'https://nammamallige.store'}});
  await assert.rejects(lib.requireBookOwner(request),e=>e.status===402);
  assert.equal((await lib.requireOwner(request)).id,owner.id);
 }
});
test('pending requests cannot activate access; only approval grants access once',async()=>{
 seed('order-1');assert.equal((await lib.subscriptionStatus(owner)).active,false);
 await Promise.all([lib.reviewPayment('order-1',true),lib.reviewPayment('order-1',true)]);
 const first=await lib.subscriptionStatus(owner);assert.equal(first.active,true);assert.equal(first.trial,false);
 await lib.reviewPayment('order-1',true);assert.equal((await lib.subscriptionStatus(owner)).expiresAt,first.expiresAt);
 assert.equal((await lib.subscriptionStatus({...owner,accountType:'personal'})).active,false);
 seed('order-2');await lib.reviewPayment('order-2',true);
 assert.equal((await lib.subscriptionStatus(owner)).expiresAt,plans.addMonths(first.expiresAt,1));
});
test('rejection cannot grant time and duplicate UTR cannot be reused',async()=>{
 const before=await lib.subscriptionStatus(owner);seed('order-3');await lib.reviewPayment('order-3',false);await lib.reviewPayment('order-3',true);
 assert.equal((await lib.subscriptionStatus(owner)).expiresAt,before.expiresAt);
 db.prepare("UPDATE subscription_orders SET reference='123456789012' WHERE id='order-1'").run();
 assert.throws(()=>db.prepare("UPDATE subscription_orders SET reference='123456789012' WHERE id='order-2'").run());
});
test('approval endpoints reject non-admin users and cross-site writes',async()=>{
 globalThis.__isAdmin=false;
 assert.equal((await admin.GET(new Request('https://nammamallige.store/api/subscription/admin'))).status,403);
 const request=(origin)=>new Request('https://nammamallige.store/api/subscription/admin',{method:'POST',headers:{'Content-Type':'application/json','X-ACS-Request':'1',Origin:origin},body:JSON.stringify({id:'nm_00000000-0000-0000-0000-000000000001',approve:true})});
 assert.equal((await admin.POST(request('https://nammamallige.store'))).status,403);
 globalThis.__isAdmin=true;
 assert.equal((await admin.POST(request('https://evil.example'))).status,403);
 assert.equal((await admin.GET(new Request('https://nammamallige.store/api/subscription/admin'))).status,200);
});
test('owner controls require authorization; suspension and extension affect server access',async()=>{
 const req=body=>new Request('https://nammamallige.store/api/owner',{method:'POST',headers:{'Content-Type':'application/json','X-ACS-Request':'1',Origin:'https://nammamallige.store'},body:JSON.stringify(body)});
 globalThis.__isAdmin=false;assert.equal((await ownerApi.POST(req({action:'access',id:owner.id,suspended:true}))).status,403);
 globalThis.__isAdmin=true;
 const before=(await lib.subscriptionStatus(owner)).expiresAt;
 assert.equal((await ownerApi.POST(req({action:'access',id:owner.id,days:7}))).status,200);
 assert.equal((await lib.subscriptionStatus(owner)).expiresAt,before+7*86400000);
 assert.equal((await ownerApi.POST(req({action:'access',id:owner.id,suspended:true}))).status,200);
 await assert.rejects(lib.ensureSubscription(owner),e=>e.status===402);
 await ownerApi.POST(req({action:'access',id:owner.id,suspended:false}));assert.equal((await lib.subscriptionStatus(owner)).active,true);
 assert.equal((await ownerApi.POST(req({action:'settings',settings:{headline:'New headline',announcement:'Hello',marketMode:'manual',priceDate:'2026-10-03',jasminePrice:250,pinkJasminePrice:80}}))).status,200);
 const settings=JSON.parse(db.prepare("SELECT value FROM site_settings WHERE key='main'").get().value);assert.equal(settings.jasminePrice,250);
});
test('paid renewal preserves days added by the owner',async()=>{
 const before=await lib.subscriptionStatus(owner);
 seed('renewal-after-owner-extension');await lib.reviewPayment('renewal-after-owner-extension',true);
 const after=await lib.subscriptionStatus(owner);
 assert.equal(after.expiresAt,plans.addMonths(before.expiresAt,1));
 await lib.reviewPayment('renewal-after-owner-extension',true);
 assert.equal((await lib.subscriptionStatus(owner)).expiresAt,after.expiresAt);
});
test.after(()=>{db.close();globalThis.fetch=originalFetch;});
