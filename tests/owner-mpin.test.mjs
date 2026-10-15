import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFile, readdir } from 'node:fs/promises';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const load = async entry => {
  const result = await build({ absWorkingDir: root, entryPoints: [entry], tsconfig: root + 'tsconfig.json', bundle: true, write: false, platform: 'node', format: 'esm', plugins: [{ name: 'bindings', setup(b) {
    b.onResolve({filter:/^cloudflare:workers$/},()=>({path:"env",namespace:"payment-env"}));
    b.onLoad({filter:/.*/,namespace:"payment-env"},()=>({contents:"export const env = {SUBSCRIPTIONS_ENABLED: 'false'};"}));
    b.onResolve({ filter: /^@\/db\/billing$/ }, () => ({ path: 'db', namespace: 'test' }));
    b.onResolve({ filter: /^@\/lib\/legacy-owner$/ }, () => ({ path: 'legacy', namespace: 'test' }));
    b.onLoad({ filter: /.*/, namespace: 'test' }, args => ({ contents: args.path === 'db' ? 'export const billingDb=()=>globalThis.__accountDb;' : 'export const legacyOwnerPhone=()=>"+918861695722";export const isLegacyOwner=async()=>false;' }));
  } }] });
  return import('data:text/javascript;base64,' + Buffer.from(result.outputFiles[0].text).toString('base64'));
};
const [auth, mpinApi, exportApi] = await Promise.all(['app/api/account/auth/route.ts', 'app/api/account/mpin/route.ts', 'app/api/google-sheets/export/route.ts'].map(load));
const migrations = await Promise.all((await readdir(root + 'drizzle')).filter(f => f.endsWith('.sql')).sort().map(f => readFile(root + 'drizzle/' + f, 'utf8')));
const blank = () => ({ jasmineQty: 0, jasmineUnit: 'buds', jasmineRate: 0, pinkQty: 0, pinkUnit: 'buds', pinkRate: 0 });

function engine() {
  const db = new DatabaseSync(':memory:'); migrations.forEach(sql => db.exec(sql));
  globalThis.__accountDb = { prepare(sql) { const statement = db.prepare(sql); let values = []; return { bind(...args) { values = args; return this; }, first: () => statement.get(...values) ?? null, all: () => ({ results: statement.all(...values) }), run: () => statement.run(...values) }; }, batch: async statements => statements.map(statement => statement.run()) };
  const req = (path, method = 'GET', body, session) => new Request('https://billing.test' + path, { method, headers: { Origin: 'https://billing.test', 'X-ACS-Request': '1', 'Content-Type': 'application/json', ...(session ? { Cookie: session.cookie, 'X-ACS-Owner': session.owner.id } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  return { db, req };
}

test('MPIN login, change, recovery and Sheets export work for an owner', async () => {
  const e = engine();
  try {
    const registration = await auth.POST(e.req('/api/account/auth', 'POST', { action: 'register', phone: '9876543210', ownerName: 'Namma Owner', accountType: 'business', companyName: 'Mallige Katte', location: 'Shirva', mpin: '1234' }));
    assert.equal(registration.status, 200);
    const created = await registration.json(); assert.equal(created.owner.mpinConfigured, true); assert.equal(created.owner.accountType, 'business'); assert.equal(created.recoveryCode.length, 64);
    const wrong = await auth.POST(e.req('/api/account/auth', 'POST', { action: 'login', phone: '9876543210', mpin: '9999' })); assert.equal(wrong.status, 401);
    const login = await auth.POST(e.req('/api/account/auth', 'POST', { action: 'login', phone: '9876543210', mpin: '1234' })); assert.equal(login.status, 200);
    const session = { owner: (await login.clone().json()).owner, cookie: login.headers.get('Set-Cookie').split(';')[0] };
    const changed = await mpinApi.POST(e.req('/api/account/mpin', 'POST', { currentMpin: '1234', mpin: '4321', confirmMpin: '4321' }, session)); assert.equal(changed.status, 200);
    const newCode = (await changed.json()).recoveryCode; assert.equal(newCode.length, 64);
    const stale = await exportApi.GET(e.req('/api/google-sheets/export', 'GET', undefined, session)); assert.equal(stale.status, 401);
    const newLogin = await auth.POST(e.req('/api/account/auth', 'POST', { action: 'login', phone: '9876543210', mpin: '4321' })); assert.equal(newLogin.status, 200);
    const fresh = { owner: (await newLogin.clone().json()).owner, cookie: newLogin.headers.get('Set-Cookie').split(';')[0] };
    e.db.prepare('INSERT INTO bills(id,payload,version,updated_at,owner_id) VALUES(?,?,?,?,?)').run(crypto.randomUUID(), JSON.stringify({ billNo: 'NMM-1', customer: 'Customer', phone: '', weekStart: '2026-09-13', days: Array.from({ length: 7 }, blank), openingBalance: 0, amountPaid: 0 }), 1, '2026-09-16T00:00:00.000Z', fresh.owner.id);
    const exported = await exportApi.GET(e.req('/api/google-sheets/export', 'GET', undefined, fresh)); assert.equal(exported.status, 200); assert.match(await exported.text(), /Namma Mallige/); assert.match((exported.headers.get('Content-Disposition') || ''), /Namma-Mallige-google-sheets\.csv/);
  } finally { e.db.close(); }
});
