import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { createHash, randomBytes } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { build } from 'esbuild';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
async function load(entry) {
  const result = await build({ absWorkingDir: root, entryPoints: [entry], tsconfig: root + 'tsconfig.json', bundle: true, write: false, platform: 'node', format: 'esm', plugins: [{ name: 'test-db', setup(bundler) {
    bundler.onResolve({filter:/^cloudflare:workers$/},()=>({path:"env",namespace:"payment-env"}));
    bundler.onLoad({filter:/.*/,namespace:"payment-env"},()=>({contents:"export const env = {SUBSCRIPTIONS_ENABLED: 'false'};"}));
    bundler.onResolve({ filter: /^@\/db\/billing$/ }, () => ({ path: 'db', namespace: 'test' }));
    bundler.onLoad({ filter: /.*/, namespace: 'test' }, () => ({ contents: 'export const billingDb = () => globalThis.__customerTestDb;' }));
  } }] });
  return import('data:text/javascript;base64,' + Buffer.from(result.outputFiles[0].text).toString('base64'));
}
const [access, customer, reviews] = await Promise.all(['app/api/customer-access/route.ts', 'app/api/customer-bill/route.ts', 'app/api/customer-requests/route.ts'].map(load));
const hash = value => createHash('sha256').update(value).digest('hex');
const now = () => new Date().toISOString();
function fixture() {
  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys=ON');
  for (const file of readdirSync(root + 'drizzle').filter(f => f.endsWith('.sql')).sort()) db.exec(readFileSync(root + 'drizzle/' + file, 'utf8'));
  db.exec('PRAGMA optimize');
  let beforeInsert;
  globalThis.__customerTestDb = { prepare(sql) {
    const statement = db.prepare(sql); let values = [];
    return { bind(...args) { values = args; return this; }, first() { if (sql.startsWith('INSERT INTO bill_corrections') && beforeInsert) { const hook = beforeInsert; beforeInsert = null; hook(); } return statement.get(...values) ?? null; }, all: () => ({ results: statement.all(...values) }), run: () => statement.run(...values) };
  } };
  let ownerIndex = 0;
  const owner = (type = 'business') => {
    const id = crypto.randomUUID(), token = randomBytes(32).toString('hex');
    db.prepare('INSERT INTO owners (id,owner_name,phone,account_type,company_name,location,password_hash,recovery_hash,created_at) VALUES (?,?,?,?,?,?,?,?,?)').run(id, 'Owner PRIVATE', '+91900000000' + ownerIndex++, type, 'Shirva Katte', 'Shirva', 'PASSWORD_PRIVATE', 'RECOVERY_PRIVATE', now());
    db.prepare('INSERT INTO owner_sessions VALUES(?,?,1,?)').run(hash(token), id, Date.now() + 3600000);
    return { id, token };
  };
  const a = owner(), b = owner(), personal = owner('personal');
  const bill = (account, name = 'Customer One') => {
    const id = crypto.randomUUID();
    const payload = { customer: name, phone: 'PHONE_PRIVATE', billNo: 'NMM-T1', weekStart: '2026-09-20', days: Array.from({ length: 7 }, (_, i) => ({ jasmineQty: [600,300,100,1000][i] ?? 0, jasmineUnit: 'buds', jasmineRate: [800,1000,60,800][i] ?? 800, pinkQty: 0, pinkUnit: 'buds', pinkRate: 60 })), openingBalance: 50, amountPaid: 100, paymentHistory: [{ id: crypto.randomUUID(), amount: 100, date: '2026-09-26', method: 'Cash', note: 'NOTE_PRIVATE' }], internal: 'INTERNAL_PRIVATE' };
    db.prepare('INSERT INTO bills (id,owner_id,payload,version,updated_at) VALUES (?,?,?,1,?)').run(id, account.id, JSON.stringify(payload), now());
    return { id, payload, version: 1 };
  };
  const one = bill(a), two = bill(b, 'UNRELATED_PRIVATE'), diary = bill(personal, 'DIARY_PRIVATE');
  const req = (path, method = 'GET', body, account, token, headers = {}) => new Request('https://billing.test' + path, { method, headers: { Origin: 'https://billing.test', 'Content-Type': 'application/json', 'X-ACS-Request': '1', ...(account ? { Cookie: `__Host-acs-session=${account.token}`, 'X-ACS-Owner': account.id } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const issue = async (target = one, account = a) => { const response = await access.POST(req('/api/customer-access', 'POST', { billId: target.id, version: target.version, confirmed: true }, account)); assert.equal(response.status, 201, await response.clone().text()); const data = await response.json(); return { ...data, token: data.path.split('#')[1] }; };
  const view = token => customer.POST(req('/api/customer-bill', 'POST', { action: 'view' }, null, token));
  const requestBody = (overrides = {}) => ({ action: 'request', id: crypto.randomUUID(), version: 1, dayIndex: 1, category: 'Flower quantity', message: 'Please check my Tuesday quantity.', ...overrides });
  return { db, a, b, personal, one, two, diary, req, issue, view, requestBody, beforeInsert: hook => { beforeInsert = hook; } };
}

test('owner sessions protect link management; customer view is scoped and preserves flower calculations', async () => {
  const e = fixture();
  try {
    const body = { billId: e.one.id, version: 1, confirmed: true };
    assert.equal((await access.GET(e.req('/api/customer-access?billId=' + e.one.id))).status, 401);
    assert.equal((await access.POST(e.req('/api/customer-access', 'POST', body, e.b))).status, 404);
    assert.equal((await access.GET(e.req('/api/customer-access?billId=' + e.one.id, 'GET', null, e.a, null, { 'X-ACS-Owner': e.b.id }))).status, 409);
    assert.equal((await access.POST(e.req('/api/customer-access', 'POST', body, e.a, null, { Origin: 'https://evil.test' }))).status, 403);
    assert.equal((await access.POST(e.req('/api/customer-access', 'POST', { ...body, billId: e.diary.id }, e.personal))).status, 403);
    assert.equal((await access.POST(e.req('/api/customer-access', 'POST', { ...body, version: 2 }, e.a))).status, 409);
    const link = await e.issue();
    assert.match(link.token, /^[a-f0-9]{64}$/);
    assert.equal(e.db.prepare('SELECT token_hash FROM bill_access').get().token_hash, hash(link.token));
    assert.equal((await e.view('f'.repeat(64))).status, 404);
    assert.equal((await customer.POST(e.req('/api/customer-bill', 'POST', { action: 'view', billId: e.two.id }, null, link.token))).status, 400);
    const response = await e.view(link.token);
    assert.equal(response.status, 200); assert.match(response.headers.get('Cache-Control'), /no-store/);
    assert.match(response.headers.get('X-Robots-Tag'), /noindex/);
    const result = await response.json();
    assert.deepEqual(result.bill.days.slice(0, 4).map(day => day.total), [150, 93.75, 1.85, 250]);
    assert.equal(result.bill.balance.flowerTotal, 495.6); assert.equal(result.bill.balance.pending, 445.6);
    assert.equal(result.bill.days.length, 7); assert.equal(result.bill.payments.length, 1);
    assert.doesNotMatch(JSON.stringify(result), /PRIVATE|token_hash|owner_id|bill_id|payload|recovery|password|mpin|googleSheet/i);
    const status = await (await access.GET(e.req('/api/customer-access?billId=' + e.one.id, 'GET', null, e.a))).json();
    assert.equal(status.access.active, true); assert.equal(JSON.stringify(status).includes(link.token), false);
    const plan = e.db.prepare('EXPLAIN QUERY PLAN SELECT * FROM bill_access WHERE token_hash = ?').all(hash(link.token));
    assert.match(plan.map(row => row.detail).join(' '), /USING INDEX bill_access_token_hash_unique/);
  } finally { e.db.close(); }
});

test('correction flow is idempotent, private, owner-reviewed, and never mutates bills', async () => {
  const e = fixture();
  try {
    const link = await e.issue(), otherLink = await e.issue(e.two, e.b);
    const original = e.db.prepare('SELECT * FROM bills WHERE id=?').get(e.one.id);
    const body = e.requestBody();
    const submit = (value, token = link.token) => customer.POST(e.req('/api/customer-bill', 'POST', value, null, token));
    assert.equal((await submit({ ...body, dayIndex: 7 })).status, 400);
    assert.equal((await submit({ ...body, version: 3 })).status, 409);
    assert.equal((await submit(body)).status, 200);
    assert.equal((await submit(body)).status, 200);
    assert.equal(e.db.prepare('SELECT COUNT(*) AS n FROM bill_corrections').get().n, 1);
    assert.equal((await (await e.view(otherLink.token)).json()).bill.requests.length, 0);
    const inbox = async account => (await (await reviews.GET(e.req('/api/customer-requests', 'GET', null, account))).json());
    assert.equal((await inbox(e.a)).pendingCount, 1); assert.equal((await inbox(e.b)).requests.length, 0);
    assert.equal((await reviews.GET(e.req('/api/customer-requests', 'GET', null, e.personal))).status, 403);
    const review = { id: body.id, status: 'resolved', reply: 'Checked the delivery. The saved quantity is correct.' };
    assert.equal((await reviews.POST(e.req('/api/customer-requests', 'POST', review, e.b))).status, 409);
    assert.equal((await reviews.POST(e.req('/api/customer-requests', 'POST', review, e.a))).status, 200);
    assert.equal((await reviews.POST(e.req('/api/customer-requests', 'POST', review, e.a))).status, 409);
    const updated = (await (await e.view(link.token)).json()).bill.requests[0];
    assert.equal(updated.status, 'resolved'); assert.equal(updated.reply, review.reply);
    assert.equal((await inbox(e.a)).pendingCount, 0);
    assert.deepEqual(e.db.prepare('SELECT * FROM bills WHERE id=?').get(e.one.id), original);
    const replacement = await e.issue();
    assert.equal((await e.view(link.token)).status, 404);
    assert.equal((await (await e.view(replacement.token)).json()).bill.requests.length, 0);
    assert.equal((await (await reviews.GET(e.req('/api/customer-requests?status=reviewed', 'GET', null, e.a))).json()).requests.length, 1);
  } finally { e.db.close(); }
});

test('revoked, expired, renamed, deleted and personal bills cannot be read; erasure cascades', async () => {
  const e = fixture();
  try {
    let link = await e.issue();
    const revoke = account => access.DELETE(e.req('/api/customer-access', 'DELETE', { billId: e.one.id, confirmed: true }, account));
    assert.equal((await revoke(e.b)).status, 404);
    assert.equal((await revoke(e.a)).status, 200); assert.equal((await e.view(link.token)).status, 404);
    link = await e.issue(); e.db.prepare('UPDATE bill_access SET expires_at=0 WHERE bill_id=?').run(e.one.id);
    assert.equal((await e.view(link.token)).status, 404);
    link = await e.issue(); e.db.prepare("UPDATE bills SET payload=json_set(payload,'$.customer','Different customer') WHERE id=?").run(e.one.id);
    assert.equal((await e.view(link.token)).status, 404);
    const state = (await (await access.GET(e.req('/api/customer-access?billId=' + e.one.id, 'GET', null, e.a))).json()).access;
    assert.equal(state.reason, 'recipient_changed');
    link = await e.issue(); e.db.prepare("UPDATE owners SET account_type='personal' WHERE id=?").run(e.a.id);
    assert.equal((await e.view(link.token)).status, 404);
    e.db.prepare("UPDATE owners SET account_type='business' WHERE id=?").run(e.a.id);
    await customer.POST(e.req('/api/customer-bill', 'POST', e.requestBody(), null, link.token));
    e.db.prepare("UPDATE bills SET payload=json_set(payload,'$.deletedAt',?) WHERE id=?").run(now(), e.one.id);
    assert.equal((await e.view(link.token)).status, 404);
    assert.equal((await (await reviews.GET(e.req('/api/customer-requests', 'GET', null, e.a))).json()).pendingCount, 0);
    e.db.prepare('DELETE FROM bills WHERE id=?').run(e.one.id);
    assert.equal(e.db.prepare('SELECT COUNT(*) AS n FROM bill_access').get().n, 0);
    assert.equal(e.db.prepare('SELECT COUNT(*) AS n FROM bill_corrections').get().n, 0);
  } finally { e.db.close(); }
});

test('correction limits and concurrent revocation prevent unwanted writes', async () => {
  const e = fixture();
  try {
    let link = await e.issue();
    const submit = () => customer.POST(e.req('/api/customer-bill', 'POST', e.requestBody(), null, link.token));
    for (let i = 0; i < 5; i++) assert.equal((await submit()).status, 200);
    assert.equal((await submit()).status, 409);
    assert.equal(e.db.prepare('SELECT COUNT(*) AS n FROM bill_corrections').get().n, 5);
    link = await e.issue();
    e.beforeInsert(() => e.db.prepare('UPDATE bill_access SET revoked_at=? WHERE bill_id=?').run(now(), e.one.id));
    assert.equal((await submit()).status, 409);
    assert.equal(e.db.prepare('SELECT COUNT(*) AS n FROM bill_corrections').get().n, 5);
    assert.equal((await e.view(link.token)).status, 404);
  } finally { e.db.close(); }
});
