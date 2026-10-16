import db from '../models/database.js';
import { generateId } from '../utils/helpers.js';

/**
 * Single implementation of everything the Telegram assistant can do, shared by
 * the in-process bot (src/bot) and the optional HTTP surface (routes/bot.ts).
 * Money crosses this boundary in naira — the unit a student says out loud —
 * and is converted to kobo here, once.
 */

export class BotError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
  }
}

const BOT_CATEGORY_TO_APP: Record<string, { category: string; bucket: string }> = {
  food: { category: 'food', bucket: 'essentials' },
  transport: { category: 'transport', bucket: 'essentials' },
  data: { category: 'data_airtime', bucket: 'essentials' },
  entertainment: { category: 'entertainment', bucket: 'enjoyment' },
  other: { category: 'other_expense', bucket: 'essentials' },
};

const CYCLE_DAYS: Record<string, number> = { daily: 1, weekly: 7, monthly: 30, irregular: 30, term: 120 };
const MAX_KOBO = 1_000_000_000_000;
const naira = (kobo: number) => Math.round((Number(kobo) || 0) / 100);
const toKobo = (amount: number) => Math.round(Math.max(0, Number(amount) || 0) * 100);

function localDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Calendar-day streak with the same one-day grace the app uses. */
export function currentStreak(dates: string[]): number {
  const set = new Set(dates);
  const cursor = new Date();
  if (!set.has(localDateKey(cursor))) cursor.setDate(cursor.getDate() - 1);
  let streak = 0;
  while (set.has(localDateKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

function daysUntilIncome(nextIncomeDate: string | null | undefined): number {
  if (!nextIncomeDate) return 30;
  const diff = new Date(nextIncomeDate).getTime() - Date.now();
  return Math.max(1, Math.ceil(diff / (24 * 3600 * 1000)));
}

/**
 * The window the current allowance covers, computed exactly the way the app does it:
 * it ends on the next income date, and falls back to the calendar month when no date is set.
 */
function cycleStartMs(nextIncomeDate: string | null | undefined, cycleDays: number): number {
  const next = nextIncomeDate ? Date.parse(nextIncomeDate) : NaN;
  if (!Number.isNaN(next)) return next - cycleDays * 24 * 3600 * 1000;
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).getTime();
}

export interface BotBudget {
  limit: number;
  spent: number;
  /** What the user called this row, so the assistant never replies with a raw category id. */
  label: string;
}

export interface BotSummary {
  /** The name on the account, so the assistant greets a person instead of a chat id. */
  name: string;
  /** Money still uncommitted for this cycle — the same figure the app calls safe to spend. */
  balance: number;
  daysLeft: number;
  safeToSpendToday: number;
  streak: number;
  budgets: Record<string, BotBudget>;
  goals: { id: string; name: string; saved: number; target: number }[];
}

/** `data_airtime` reads as "Data & Airtime"; an internal row id has no business in a chat reply. */
export function budgetLabel(name: unknown, category: string): string {
  const clean = String(name || '').trim();
  if (clean) return clean;
  if (/^ob-/.test(category)) return 'Fixed commitment';
  const words = category.replace(/[_-]+/g, ' ').trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export async function getSummary(userId: string): Promise<BotSummary> {
  const [profile, summary, goalsRaw, plansRaw, transactions] = (await Promise.all([
    db.users.findById(userId),
    db.transactions.summary(userId),
    db.savingsGoals.findByUser(userId),
    db.budgetPlans.findByUser(userId),
    db.transactions.findByUser(userId),
  ])) as [any, any, any[], any[], any[]];

  const daysLeft = daysUntilIncome(profile?.nextIncomeDate);
  const cycleDays = CYCLE_DAYS[profile?.incomeFrequency] || 30;
  const cycleStart = cycleStartMs(profile?.nextIncomeDate, cycleDays);

  const spentByCategory: Record<string, number> = {};
  let spentInCycleInKobo = 0;
  (transactions as any[]).forEach(tx => {
    if (tx.type !== 'expense') return;
    if (Date.parse(tx.date) < cycleStart) return;
    const amount = Number(tx.amountInKobo) || 0;
    spentInCycleInKobo += amount;
    spentByCategory[tx.category] = (spentByCategory[tx.category] || 0) + amount;
  });

  const budgets: BotSummary['budgets'] = {};
  plansRaw.forEach((plan: any) => {
    budgets[plan.category] = {
      limit: naira(plan.allocatedInKobo),
      spent: naira(spentByCategory[plan.category] || 0),
      label: budgetLabel(plan.name, plan.category),
    };
    delete spentByCategory[plan.category];
  });
  Object.entries(spentByCategory).forEach(([category, spent]) => {
    budgets[category] = { limit: 0, spent: naira(spent), label: budgetLabel('', category) };
  });

  const goals = goalsRaw
    .filter((goal: any) => !goal.isPaused)
    .map((goal: any) => ({
      id: goal.id,
      name: goal.name,
      saved: naira(goal.currentAmountInKobo),
      target: naira(goal.targetAmountInKobo),
    }));

  // Savings promised for this cycle are not spendable money, so the guide removes them first.
  const reservedSavingsInKobo = goalsRaw
    .filter((goal: any) => !goal.isPaused)
    .reduce((total: number, goal: any) => total + (Number(goal.contributionPerCycleInKobo) || 0), 0);
  const allowanceInKobo = Number(profile?.typicalIncomeInKobo) || Number(summary?.totalIncomeInKobo) || 0;
  const safeToSpendInKobo = Math.max(0, allowanceInKobo - spentInCycleInKobo - reservedSavingsInKobo);

  const streakDates = new Set<string>((profile?.streakDates || []).filter(Boolean));
  goalsRaw.forEach((goal: any) => (goal.contributionDates || []).forEach((d: string) => streakDates.add(d)));

  return {
    name: String(profile?.name || '').trim(),
    balance: naira(safeToSpendInKobo),
    daysLeft,
    safeToSpendToday: naira(Math.floor(safeToSpendInKobo / daysLeft)),
    streak: currentStreak([...streakDates]),
    budgets,
    goals,
  };
}

/** Redeem a one-time code from the app and attach this Telegram chat to the account. */
export async function linkAccount(code: string, chatId: string | number): Promise<{ userId: string }> {
  const cleanCode = String(code || '').trim();
  const cleanChat = String(chatId ?? '').trim();
  if (!/^\d{4,8}$/.test(cleanCode) || !cleanChat) throw new BotError(400, 'code and chatId are required');

  const profile = await db.users.findByBotLinkCode(cleanCode) as any;
  if (!profile) throw new BotError(404, 'Invalid link code');
  if (profile.botLinkExpiresAt && Date.parse(profile.botLinkExpiresAt) < Date.now()) {
    await db.users.update(profile.id, { botLinkCode: null, botLinkExpiresAt: null });
    throw new BotError(410, 'Link code expired — get a new one in the app');
  }

  await db.botLinks.link(cleanChat, profile.id);
  await db.users.update(profile.id, { botLinkCode: null, botLinkExpiresAt: null });
  return { userId: profile.id };
}

/** The ledger category behind a word the user typed, so lookups match the plan rows. */
export function appCategory(rawCategory: string): string {
  const clean = String(rawCategory || '').toLowerCase();
  return BOT_CATEGORY_TO_APP[clean]?.category || clean || 'other_expense';
}

export async function logExpense(
  userId: string,
  input: { amount: number; category?: string; description?: string },
): Promise<BotSummary> {
  const amount = toKobo(Number(input.amount));
  if (!amount) throw new BotError(400, 'amount must be a positive number');

  const rawCategory = String(input.category || 'other').toLowerCase();
  const mapped = BOT_CATEGORY_TO_APP[rawCategory] || { category: rawCategory || 'other_expense', bucket: 'essentials' };
  const link = await db.botLinks.findByUserId(userId);
  if (!link) throw new BotError(404, 'Account is not linked');

  await db.transactions.create({
    id: generateId(),
    userId,
    type: 'expense',
    amountInKobo: amount,
    category: mapped.category,
    description: String(input.description || `Logged via Telegram: ${rawCategory}`).slice(0, 200),
    date: new Date().toISOString(),
    merchant: null,
    paymentMethod: null,
    budgetBucket: mapped.bucket,
    notes: null,
    source: 'telegram',
    syncStatus: 'synced',
    updatedAt: new Date().toISOString(),
  });
  return getSummary(userId);
}

/** Save toward a goal, then mirror the day into the profile streak the app reads. */
export async function addToGoal(userId: string, goalId: string, amountNaira: number): Promise<BotSummary['goals']> {
  const amount = toKobo(Number(amountNaira));
  if (!amount) throw new BotError(400, 'amount must be a positive number');

  const goal = await db.savingsGoals.findById(goalId, userId) as any;
  if (!goal) throw new BotError(404, 'Goal not found');

  const saved = Number(goal.currentAmountInKobo) || 0;
  const target = Number(goal.targetAmountInKobo) || 0;
  const room = target > 0 ? Math.max(0, target - saved) : amount;
  if (room <= 0) throw new BotError(409, 'that goal is already funded — raise its target in the app first');
  const contributed = Math.min(amount, room);
  const current = saved + contributed;
  const contributionDates = Array.from(new Set([...(goal.contributionDates || []), localDateKey(new Date())]));

  await db.savingsGoals.update(goalId, userId, {
    currentAmountInKobo: Math.min(current, MAX_KOBO),
    progress: target > 0 ? Math.min(100, Math.round((current / target) * 100)) : goal.progress,
    contributionDates,
    updatedAt: new Date().toISOString(),
  });

  const contributor = await db.users.findById(userId) as any;
  const profileDates = Array.from(new Set([...(contributor?.streakDates || []), localDateKey(new Date())]));
  await db.users.update(userId, { streakDates: profileDates.slice(-1000) });

  return (await getSummary(userId)).goals;
}

export async function transferBudget(userId: string, from: string, to: string, amountNaira: number): Promise<BotSummary> {
  const source = String(from || '').toLowerCase();
  const target = String(to || '').toLowerCase();
  const amount = toKobo(Number(amountNaira));
  if (!source || !target || !amount) throw new BotError(400, 'from, to and amount are required');

  const plans = await db.budgetPlans.findByUser(userId) as any[];
  const fromPlan = plans.find(p => p.category === source);
  const toPlan = plans.find(p => p.category === target);
  if (!fromPlan || !toPlan) throw new BotError(404, 'No budget plan found for those categories');

  fromPlan.allocatedInKobo = Math.max(0, (Number(fromPlan.allocatedInKobo) || 0) - amount);
  toPlan.allocatedInKobo = Math.min(MAX_KOBO, (Number(toPlan.allocatedInKobo) || 0) + amount);
  await db.budgetPlans.replaceForUser(userId, plans.map(p => ({ ...p, userId: undefined })));

  return getSummary(userId);
}

/** Codes the app mints for the assistant, kept on the profile until redeemed. */
export async function issueLinkCode(userId: string): Promise<{ code: string; expiresAt: string }> {
  const code = String(Math.floor(100000 + Math.random() * 900000));
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();
  await db.users.update(userId, { botLinkCode: code, botLinkExpiresAt: expiresAt });
  return { code, expiresAt };
}
