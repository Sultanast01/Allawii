// End-to-end check of the Supabase-backed server + Telegram bot contract.
// Against a running dev server; prints PASS/FAIL per step.
import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
dotenv.config({ path: fileURLToPath(new URL('./.env', import.meta.url)) });

const BASE = process.env.BASE || 'http://localhost:3001/api';
const BOT_KEY = process.env.BOT_API_KEY;
if (!BOT_KEY) throw new Error('BOT_API_KEY required');

const results = [];
const check = (name, ok, detail) => {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
};

const post = async (path, body, token) => {
  const res = await fetch(BASE + path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
    },
    body: JSON.stringify(body || {}),
  });
  return { status: res.status, json: await res.json().catch(() => ({})) };
};
const get = async (path, token) => {
  const res = await fetch(BASE + path, { headers: token ? { Authorization: 'Bearer ' + token } : {} });
  return { status: res.status, json: await res.json().catch(() => ({})) };
};
const put = async (path, body, token) => {
  const res = await fetch(BASE + path, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
    body: JSON.stringify(body),
  });
  return { status: res.status, json: await res.json().catch(() => ({})) };
};

const stamp = Date.now();
const emailA = `e2e-a-${stamp}@allowii.test`;
const emailB = `e2e-b-${stamp}@allowii.test`;
const password = 'e2e-pass-1234';

// 1. Register (Supabase admin createUser + profile row)
const regA = await post('/auth/register', { name: 'E2e A', email: emailA, password, university: 'Test Uni' });
check('register returns session bundle',
  regA.status === 200 || regA.status === 201,
  `${regA.status} ${JSON.stringify(regA.json).slice(0, 120)}`);
const tokenA = regA.json.token;
const refreshA = regA.json.refreshToken;
check('bundle carries token + refresh + user.id',
  Boolean(tokenA && refreshA && regA.json.user?.id),
  `user ${regA.json.user?.id}`);

// 2. Login again with the same credentials
const loginA = await post('/auth/login', { email: emailA, password });
check('login issues a fresh session', Boolean(loginA.json.token), `${loginA.status}`);
const tokenA2 = loginA.json.token || tokenA;

// 3. Refresh
const refreshed = await post('/auth/refresh', { refreshToken: refreshA });
check('refresh exchanges the refresh token', Boolean(refreshed.json.token), `${refreshed.status}`);

// 4. Write a transaction through the API
const txDate = new Date().toISOString().slice(0, 10);
const tx = await post('/transactions', {
  type: 'expense', amountInKobo: 850000, category: 'data_airtime',
  description: 'MTN data', merchant: 'MTN', date: txDate, source: 'manual',
}, tokenA2);
check('transaction insert persisted with an id',
  Boolean((tx.json.id || tx.json.transaction?.id)),
  `${tx.status} ${JSON.stringify(tx.json).slice(0, 120)}`);
const txId = tx.json.id || tx.json.transaction?.id;

// 5. Sync round trip (device state -> server -> device state)
const goal = {
  id: `goal-${stamp}`, name: 'New Laptop', targetAmountInKobo: 800000000,
  currentAmountInKobo: 120000000, progress: 15, contributionFrequency: 'monthly',
  contributionPerCycleInKobo: 25000000, isPaused: false, targetDate: txDate,
  createdAt: new Date().toISOString(),
  streak: { currentStreak: 1, longestStreak: 1, contributionDates: [txDate] },
};
const syncPut = await put('/sync/state', {
  transactions: [], savingsGoals: [goal],
  categoryBudgets: [
    { id: 'food', category: 'food', name: 'Food', bucket: 'essentials', allocatedInKobo: 40000000 },
    { id: 'transport', category: 'transport', name: 'Transport', bucket: 'essentials', allocatedInKobo: 20000000 },
  ],
  streakDates: [txDate],
  deletedTransactionIds: [], deletedGoalIds: [],
}, tokenA2);
check('sync PUT accepts budgets + streak dates', syncPut.status === 200, `${syncPut.status} ${JSON.stringify(syncPut.json).slice(0, 140)}`);

const syncGet = await get('/sync/state', tokenA2);
const pulledGoals = syncGet.json.savingsGoals || [];
const pulledBudgets = syncGet.json.categoryBudgets || [];
check('sync GET returns the goal', pulledGoals.some(g => g.id === goal.id), `${pulledGoals.length} goals`);
check('sync GET returns the budget plan', pulledBudgets.some(b => b.category === 'food'), `${pulledBudgets.length} budgets`);
check('sync GET returns streak dates', Array.isArray(syncGet.json.streakDates) && syncGet.json.streakDates.includes(txDate),
  JSON.stringify(syncGet.json.streakDates));

// 6. Telegram assistant contract
const statusRes = await get('/bot/user/status', tokenA2);
check('assistant status reports whether it is live',
  typeof statusRes.json.botRunning === 'boolean' && Boolean(statusRes.json.botUsername),
  `${statusRes.status} running=${statusRes.json.botRunning} @${statusRes.json.botUsername}`);
if (process.env.TELEGRAM_BOT_TOKEN) {
  check('assistant polls Telegram inside this server process',
    statusRes.json.botRunning === true,
    `botRunning=${statusRes.json.botRunning}`);
}

const linkCodeRes = await post('/bot/user/link-code', {}, tokenA2);
const code = linkCodeRes.json.code;
check('link code minted', /^\d{6}$/.test(String(code || '')), `${linkCodeRes.status} ${JSON.stringify(linkCodeRes.json).slice(0, 120)}`);

const botH = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + BOT_KEY };
const botCall = async (method, path, body) => {
  const res = await fetch(BASE + '/bot' + path, { method, headers: botH, body: body ? JSON.stringify(body) : undefined });
  return { status: res.status, json: await res.json().catch(() => ({})) };
};
const chatId = '9' + String(stamp).slice(-8);
const linked = await botCall('POST', '/link', { code, chatId });
check('bot links the chat to the user', linked.status === 200, `${linked.status} ${JSON.stringify(linked.json).slice(0, 140)}`);

const summary = await botCall('GET', `/users/${regA.json.user.id}/summary`);
check('summary returns balance/budgets/goals',
  summary.status === 200 && summary.json.budgets && Array.isArray(summary.json.goals),
  `balance ${summary.json.balance}, budgets ${Object.keys(summary.json.budgets || {}).length}, goals ${(summary.json.goals || []).length}, streak ${summary.json.streak}`);

const logged = await botCall('POST', `/users/${regA.json.user.id}/expenses`, { amount: 500, category: 'transport', description: 'kepe' });
check('bot logs an expense', logged.status === 200 || logged.status === 201, `${logged.status} ${JSON.stringify(logged.json).slice(0, 140)}`);

const contributed = await botCall('POST', `/users/${regA.json.user.id}/goals/${goal.id}/contribute`, { amount: 1000 });
check('bot contributes to a goal', contributed.status === 200, `${contributed.status} ${JSON.stringify(contributed.json).slice(0, 140)}`);

const transfer = await botCall('POST', `/users/${regA.json.user.id}/budgets/transfer`, { from: 'food', to: 'transport', amount: 200 });
check('bot moves budget', transfer.status === 200, `${transfer.status} ${JSON.stringify(transfer.json).slice(0, 140)}`);
const transferGuard = await botCall('POST', `/users/${regA.json.user.id}/budgets/transfer`, { from: 'food', to: 'shopping', amount: 200 });
check('transfer into an unbudgeted category is refused', transferGuard.status === 404, `${transferGuard.status}`);

const reuse = await botCall('POST', '/link', { code, chatId });
check('link code is single-use', reuse.status === 404 || reuse.status === 410, `${reuse.status} ${JSON.stringify(reuse.json).slice(0, 60)}`);

const badKey = await fetch(BASE + '/bot/link', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer wrong' }, body: '{}' });
check('wrong bot key rejected', badKey.status === 401, `${badKey.status}`);

// 7. Cross-user isolation
const regB = await post('/auth/register', { name: 'E2e B', email: emailB, password });
const tokenB = regB.json.token;
const peek = await get(`/transactions/${txId}`, tokenB);
const peekRows = peek.json.transaction || peek.json.data || peek.json;
check("user B cannot read user A's transaction", peek.status === 404 || !peekRows?.id, `${peek.status} ${JSON.stringify(peekRows).slice(0, 80)}`);
const bSummary = await botCall('GET', `/users/${regB.json.user.id}/summary`);
check("user B's summary is empty", bSummary.status === 200 && (bSummary.json.goals || []).length === 0, `goals ${(bSummary.json.goals || []).length}, balance ${bSummary.json.balance}`);

// 8. Unauthenticated access is refused
const noAuth = await get('/sync/state');
check('sync state requires a session', noAuth.status === 401, `${noAuth.status}`);

const failed = results.filter(r => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
process.exitCode = failed.length ? 1 : 0;
