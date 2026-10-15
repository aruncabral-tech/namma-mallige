import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFile, readdir } from 'node:fs/promises';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const load=async entry=>{
  const result=await build({absWorkingDir:root,entryPoints:[entry],tsconfig:root+'tsconfig.json',bundle:true,write:false,platform:'node',format:'esm',plugins:[{name:'account-database',setup(b){
    b.onResolve({filter:/^cloudflare:workers$/},()=>({path:"env",namespace:"payment-env"}));
    b.onLoad({filter:/.*/,namespace:"payment-env"},()=>({contents:"export const env = {SUBSCRIPTIONS_ENABLED: 'false'};"}));
    b.onResolve({filter:/^@\/db\/billing$/},()=>({path:'db',namespace:'test'}));
    b.onResolve({filter:/^@\/lib\/legacy-owner$/},()=>({path:'legacy',namespace:'test'}));
    b.onLoad({filter:/.*/,namespace:'test'},args=>({contents:args.path==='db'?'export const billingDb=()=>globalThis.__accountDb;':'export const legacyOwnerPhone=()=>"+918861695722";export const isLegacyOwner=async()=>globalThis.__legacyVerified===true;'}));
  }}]});
  return import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].text).toString('base64'));
};
const [auth,profile,passwordApi,bills,prices]=await Promise.all(['app/api/account/auth/route.ts','app/api/account/route.ts','app/api/account/password/route.ts','app/api/bills/route.ts','app/api/daily-prices/route.ts'].map(load));
const migrations=await Promise.all((await readdir(root+'drizzle')).filter(f=>f.endsWith('.sql')).sort().map(f=>readFile(root+'drizzle/'+f,'utf8')));
const pass='jasmine petals in the morning';
const blank=()=>({jasmineQty:0,jasmineUnit:'buds',jasmineRate:0,pinkQty:0,pinkUnit:'buds',pinkRate:0});
const bill=()=>({id:crypto.randomUUID(),version:0,customer:'Customer One',phone:'',billNo:'TEST-1',weekStart:'2026-09-13',days:Array.from({length:7},blank),openingBalance:20,amountPaid:10});
const date='2026-09-16';
function engine(){
  const db=new DatabaseSync(':memory:');
  migrations.forEach(sql=>db.exec(sql));
  globalThis.__legacyVerified=false;
  globalThis.__accountDb={prepare(sql){const statement=db.prepare(sql);let values=[];return {bind(...args){values=args;return this;},first:()=>statement.get(...values)??null,all:()=>({results:statement.all(...values)}),run:()=>statement.run(...values)};},batch:async statements=>statements.map(s=>s.run())};
  const req=(path,method='GET',body,session,headers={})=>new Request('https://billing.test'+path,{method,headers:{'Origin':'https://billing.test','X-ACS-Request':'1','Content-Type':'application/json',...(session?{'Cookie':session.cookie,'X-ACS-Owner':session.owner.id}:{}),...headers},...(body===undefined?{}:{body:JSON.stringify(body)})});
  const authenticate=async(action,phone='9876543210',extra={})=>{
    const response=await auth.POST(req('/api/account/auth','POST',{action,phone,password:pass,ownerName:'Flower Owner',...extra}));
    const data=await response.json();
    return {status:response.status,...data,cookie:response.headers.get('Set-Cookie')?.split(';')[0],cookieHeader:response.headers.get('Set-Cookie')};
  };
  return {db,req,authenticate};
}

test('accounts isolate bills, prices and settings; sessions and CSRF protect all writes',async()=>{
  const e=engine();
  try{
    assert.equal((await bills.GET(e.req('/api/bills'))).status,401);
    assert.equal((await prices.GET(e.req('/api/daily-prices?from='+date))).status,401);
    assert.equal((await e.authenticate('register','8861695722')).status,409,'existing phone cannot be claimed publicly');
    const a=await e.authenticate('register'); const b=await e.authenticate('register','9876543211');
    assert.equal(a.status,200);assert.equal(b.status,200);assert.notEqual(a.owner.id,b.owner.id);
    assert.match(a.cookieHeader,/HttpOnly; Secure; SameSite=Lax/);
    assert.equal(a.recoveryCode.length,64);
    const stored=e.db.prepare('SELECT password_hash,recovery_hash FROM owners WHERE id=?').get(a.owner.id);
    assert.match(stored.password_hash,/^scrypt:32768:8:3:/);assert.notEqual(stored.recovery_hash,a.recoveryCode);assert.equal(JSON.stringify(stored).includes(pass),false);
    assert.equal((await e.authenticate('login','9876543210',{password:'wrong-password'})).status,401);
    assert.equal((await e.authenticate('login','+91 98765 43210')).status,200);
    assert.equal((await e.authenticate('register')).status,409);
    for(const [session,rate] of [[a,800],[b,1000]]){
      const res=await prices.POST(e.req('/api/daily-prices','POST',{date,jasmineRate:rate,pinkRate:60},session));assert.equal(res.status,201);
    }
    const getPrices=async session=>(await (await prices.GET(e.req('/api/daily-prices?from='+date,'GET',undefined,session))).json()).prices;
    assert.equal((await getPrices(a))[0].jasmineRate,800);assert.equal((await getPrices(b))[0].jasmineRate,1000);
    const entry=bill();entry.days[3]={...blank(),jasmineQty:600,jasmineRate:800};
    const response=await bills.POST(e.req('/api/bills','POST',entry,a));assert.equal(response.status,200);const saved=(await response.json()).bill;
    assert.equal((await (await bills.GET(e.req('/api/bills','GET',undefined,a))).json()).bills.length,1);
    assert.equal((await (await bills.GET(e.req('/api/bills','GET',undefined,b))).json()).bills.length,0);
    assert.equal((await bills.POST(e.req('/api/bills','POST',{...saved,customer:'Stolen'},b))).status,409);
    assert.equal((await bills.DELETE(e.req('/api/bills','DELETE',{id:saved.id,version:1,confirmed:true},b))).status,409);
    assert.equal((await bills.POST(e.req('/api/bills','POST',entry,a,{'X-ACS-Request':''}))).status,403);
    assert.equal((await bills.DELETE(e.req('/api/bills','DELETE',{id:saved.id,version:1,confirmed:true},a,{'Origin':'https://evil.test'}))).status,403);
    assert.equal((await prices.POST(e.req('/api/daily-prices','POST',{date,jasmineRate:1,pinkRate:60},a))).status,409);
    assert.equal((await bills.GET(e.req('/api/bills','GET',undefined,b,{'X-ACS-Owner':a.owner.id}))).status,409,'stale tab cannot act on another signed-in book');
    assert.equal((await bills.GET(e.req('/api/bills','GET',undefined,a,{'X-ACS-Owner':''}))).status,409);
    assert.equal((await profile.PATCH(e.req('/api/account','PATCH',{ownerName:'Alice',companyName:'Shirva Flower Katte',location:'Shirva'},a))).status,200);
    assert.equal((await (await profile.GET(e.req('/api/account','GET',undefined,b))).json()).owner.companyName,'');
    assert.equal((await bills.DELETE(e.req('/api/bills','DELETE',{id:saved.id,version:1,confirmed:false},a))).status,400);
    assert.equal((await bills.DELETE(e.req('/api/bills','DELETE',{id:saved.id,version:1,confirmed:true},a))).status,200);
    await auth.POST(e.req('/api/account/auth','POST',{action:'logout'},a));
    assert.equal((await bills.GET(e.req('/api/bills','GET',undefined,a))).status,401);
  }finally{e.db.close();}
});

test('existing book requires verified site owner and preserves original bills and fixed prices',async()=>{
  const e=engine();
  try{
    const original={...bill(),version:3}; original.days[3]={...blank(),jasmineQty:600,jasmineRate:800};
    const {id,version,...payload}=original;
    e.db.prepare('INSERT INTO bills(id,payload,version,updated_at) VALUES(?,?,?,?)').run(id,JSON.stringify(payload),version,'2026-09-16');
    e.db.prepare('INSERT INTO daily_prices VALUES(?,?,?,?)').run(date,800,60,'2026-09-16');
    assert.equal((await e.authenticate('setup','8861695722')).status,403);
    globalThis.__legacyVerified=true;
    const owner=await e.authenticate('setup','8861695722');assert.equal(owner.status,200);assert.equal(owner.owner.id,'existing-book');
    const result=(await (await bills.GET(e.req('/api/bills','GET',undefined,owner))).json()).bills;
    assert.deepEqual(result,[original]);
    assert.equal((await e.authenticate('setup','8861695722')).status,409);
    const outsider=await e.authenticate('register');
    assert.equal((await (await bills.GET(e.req('/api/bills','GET',undefined,outsider))).json()).bills.length,0);
    assert.deepEqual((await (await prices.GET(e.req('/api/daily-prices?from='+date,'GET',undefined,outsider))).json()).prices,[]);
    assert.equal((await prices.POST(e.req('/api/daily-prices','POST',{date,jasmineRate:1000,pinkRate:60},owner))).status,409);
    assert.equal(e.db.prepare('SELECT payload FROM bills WHERE id=?').get(id).payload,JSON.stringify(payload));
  }finally{e.db.close();}
});

test('recovery, password changes, session expiry and login throttling',async()=>{
  const e=engine();
  try{
    const a=await e.authenticate('register');
    const secondDevice=await e.authenticate('login');
    assert.equal((await e.authenticate('recover','9876543210',{recoveryCode:'f'.repeat(64)})).status,401);
    const newPass='a different flower account passphrase';
    const recovered=await e.authenticate('recover','9876543210',{recoveryCode:a.recoveryCode,password:newPass});assert.equal(recovered.status,200);
    assert.equal((await bills.GET(e.req('/api/bills','GET',undefined,a))).status,401);
    assert.equal((await bills.GET(e.req('/api/bills','GET',undefined,secondDevice))).status,401);
    assert.equal((await e.authenticate('recover','9876543210',{recoveryCode:a.recoveryCode,password:newPass})).status,401);
    const changed=await passwordApi.POST(e.req('/api/account/password','POST',{currentPassword:newPass,password:pass},recovered));assert.equal(changed.status,200);
    assert.equal((await bills.GET(e.req('/api/bills','GET',undefined,recovered))).status,401);
    const newSession=await e.authenticate('login');assert.equal(newSession.status,200);
    e.db.prepare('UPDATE owner_sessions SET expires_at=0').run();
    assert.equal((await bills.GET(e.req('/api/bills','GET',undefined,newSession))).status,401);
    const attacks=[];for(let i=0;i<13;i++)attacks.push((await e.authenticate('login','9876543299',{password:'wrong'})).status);
    assert.equal(attacks.at(-1),429);
  }finally{e.db.close();}
});


test('account migration preserves bills and rates created before accounts existed',()=>{
  const db=new DatabaseSync(':memory:');
  try {
    migrations.slice(0,2).forEach(sql=>db.exec(sql));
    const original=bill();
    const payload=JSON.stringify(original);
    db.prepare('INSERT INTO bills VALUES(?,?,?,?)').run(original.id,payload,7,'2026-09-01');
    db.prepare('INSERT INTO daily_prices VALUES(?,?,?,?)').run(date,800,60,'2026-09-16');
    migrations.slice(2).forEach(sql=>db.exec(sql));
    const saved=db.prepare('SELECT * FROM bills').get();
    assert.equal(saved.owner_id,'existing-book');assert.equal(saved.payload,payload);assert.equal(saved.version,7);
    assert.equal(db.prepare('SELECT jasmine_rate FROM daily_prices').get().jasmine_rate,800);
  } finally {db.close();}
});


test('verified original owner reset deletes only that book and rejects stale requests',async()=>{
 const reset=await load('app/api/account/owner-reset/route.ts');
 const {createHash}=await import('node:crypto');
 const e=engine();
 try {
  globalThis.__legacyVerified=true;
  const original=await e.authenticate('register','8861695722');
  const other=await e.authenticate('register','9876543212');
  for(const owner of [original,other]) {
   const b=bill();
   assert.equal((await bills.POST(e.req('/api/bills','POST',b,owner))).status,200);
   assert.equal((await prices.POST(e.req('/api/daily-prices','POST',{date,jasmineRate:800,pinkRate:60},owner))).status,201);
  }
  const hash=e.db.prepare('SELECT recovery_hash AS hash FROM owners WHERE id=?').get(original.owner.id).hash;
  const body={phone:'8861695722',confirmation:'DELETE MY BOOK',challenge:createHash('sha256').update('delete-book:'+hash).digest('hex')};
  globalThis.__legacyVerified=false;
  assert.equal((await reset.POST(e.req('/api/account/owner-reset','POST',body))).status,403);
  globalThis.__legacyVerified=true;
  assert.equal((await reset.POST(e.req('/api/account/owner-reset','POST',body,undefined,{'Origin':'https://evil.test'}))).status,403);
  assert.equal((await reset.POST(e.req('/api/account/owner-reset','POST',{...body,confirmation:'yes'}))).status,400);
  assert.equal((await reset.POST(e.req('/api/account/owner-reset','POST',{...body,phone:'9876543212'}))).status,400);
  assert.equal((await reset.POST(e.req('/api/account/owner-reset','POST',body))).status,200);
  assert.equal(e.db.prepare('SELECT count(*) AS n FROM bills WHERE owner_id=?').get(original.owner.id).n,0);
  assert.equal(e.db.prepare('SELECT count(*) AS n FROM book_daily_prices WHERE owner_id=?').get(original.owner.id).n,0);
  assert.equal((await profile.GET(e.req('/api/account','GET',undefined,original))).status,200);
  assert.equal((await (await profile.GET(e.req('/api/account','GET',undefined,original))).json()).owner,null);
  assert.equal((await (await bills.GET(e.req('/api/bills','GET',undefined,other))).json()).bills.length,1);
  assert.equal(e.db.prepare('SELECT count(*) AS n FROM book_daily_prices WHERE owner_id=?').get(other.owner.id).n,1);
  const fresh=await e.authenticate('register','8861695722'); assert.equal(fresh.status,200);
  assert.equal((await reset.POST(e.req('/api/account/owner-reset','POST',body))).status,409);
  assert.equal((await (await profile.GET(e.req('/api/account','GET',undefined,fresh))).json()).owner.phone,'+918861695722');
 } finally {e.db.close();}
});


test('payment history and full backups round-trip without overwriting or crossing owners',async()=>{
 const backupApi=await load('app/api/account/backup/route.ts');const e=engine();
 try{
  const a=await e.authenticate('register');const b=await e.authenticate('register','9876543213');
  const payment={id:crypto.randomUUID(),date,amount:5.25,method:'UPI',note:'Received'};
  const entry={...bill(),openingBalance:100,amountPaid:5.25,paymentHistory:[payment]};
  assert.equal((await bills.POST(e.req('/api/bills','POST',entry,a))).status,200);
  const backup=await (await backupApi.GET(e.req('/api/account/backup','GET',undefined,a))).json();
  assert.deepEqual(backup.bills[0].paymentHistory,[payment]);assert.equal(JSON.stringify(backup).includes('recovery_hash'),false);
  assert.equal((await backupApi.POST(e.req('/api/account/backup','POST',{backup,confirmed:true},b))).status,403);
  const malformed=structuredClone(backup);malformed.bills[0].amountPaid=1;
  assert.equal((await backupApi.POST(e.req('/api/account/backup','POST',{backup:malformed,confirmed:true},a))).status,400);
  assert.equal((await backupApi.POST(e.req('/api/account/backup','POST',{backup},a))).status,200);
  e.db.prepare('DELETE FROM bills WHERE id=?').run(entry.id);
  assert.equal((await backupApi.POST(e.req('/api/account/backup','POST',{backup,confirmed:true},a))).status,200);
  const restored=(await (await bills.GET(e.req('/api/bills','GET',undefined,a))).json()).bills[0];
  assert.deepEqual(restored.paymentHistory,[payment]);assert.equal(restored.amountPaid,5.25);
  const changed={...restored,customer:'Updated customer'};assert.equal((await bills.POST(e.req('/api/bills','POST',changed,a))).status,200);
  assert.equal((await backupApi.POST(e.req('/api/account/backup','POST',{backup,confirmed:true},a))).status,200);
  assert.equal((await (await bills.GET(e.req('/api/bills','GET',undefined,a))).json()).bills[0].customer,'Updated customer');
  const oldClient={...changed,version:2};delete oldClient.paymentHistory;
  assert.equal((await bills.POST(e.req('/api/bills','POST',oldClient,a))).status,200);
  assert.deepEqual((await (await bills.GET(e.req('/api/bills','GET',undefined,a))).json()).bills[0].paymentHistory,[payment]);
 }finally{e.db.close();}
});
