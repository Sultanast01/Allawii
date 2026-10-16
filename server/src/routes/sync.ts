import { Router, Request, Response } from 'express';
import db from '../models/database.js';
import { authMiddleware } from './auth.js';
import { planLedgerMerge, prepareIncoming, type MergeRow } from '../services/sync.js';

const router = Router();

router.use(authMiddleware);

const MAX_ROWS = 5000;
const BUCKETS = new Set(['obligations', 'essentials', 'future_you', 'enjoyment']);
const FREQUENCIES = new Set(['daily', 'weekly', 'monthly', 'term']);
const SAVINGS_TYPES = new Set(['emergency', 'target', 'flexible']);

function str(value: unknown, max: number): string | null {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  if (!text) return null;
  return text.slice(0, max);
}

function kobo(value: unknown): number {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0) return 0;
  return Math.min(Math.round(amount), 1_000_000_000_000);
}

function isoDate(value: unknown): string | null {
  const text = str(value, 40);
  if (!text) return null;
  const parsed = Date.parse(text);
  return Number.isNaN(parsed) ? null : new Date(parsed).toISOString();
}

function idList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map(entry => str(entry, 40)).filter((entry): entry is string => Boolean(entry)).slice(0, MAX_ROWS);
}

function cleanTransaction(raw: unknown, userId: string): MergeRow | null {
  const row = (raw || {}) as Record<string, unknown>;
  const id = str(row.id, 40);
  if (!id) return null;
  const type = row.type === 'income' ? 'income' : row.type === 'expense' ? 'expense' : null;
  if (!type) return null;
  const amountInKobo = kobo(row.amountInKobo);
  if (!amountInKobo) return null;
  const bucket = str(row.budgetBucket, 20);
  return {
    id,
    userId,
    type,
    amountInKobo,
    category: str(row.category, 40) || (type === 'income' ? 'allowance' : 'other_expense'),
    description: str(row.description, 200) || '',
    date: isoDate(row.date) || new Date().toISOString(),
    merchant: str(row.merchant, 80),
    paymentMethod: str(row.paymentMethod, 40),
    notes: str(row.notes, 500),
    budgetBucket: bucket && BUCKETS.has(bucket) ? bucket : null,
    source: str(row.source, 20) || 'manual',
    syncStatus: 'synced',
    updatedAt: str(row.updatedAt, 40) || undefined,
  };
}

function percent(value: unknown): number {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.min(100, Math.max(0, Math.round(number)));
}

function cleanGoal(raw: unknown, userId: string): MergeRow | null {
  const row = (raw || {}) as Record<string, unknown>;
  const id = str(row.id, 40);
  if (!id) return null;
  const name = str(row.name, 60);
  if (!name) return null;
  const frequency = str(row.contributionFrequency, 20);
  const savingsType = str(row.savingsType, 20);
  const streak = row.streak as { contributionDates?: unknown } | undefined;
  const contributionDates = Array.isArray(streak?.contributionDates)
    ? streak!.contributionDates!.map(value => str(value, 12)).filter((value): value is string => Boolean(value)).slice(0, 1000)
    : [];
  return {
    id,
    userId,
    name,
    targetAmountInKobo: kobo(row.targetAmountInKobo),
    currentAmountInKobo: kobo(row.currentAmountInKobo),
    targetDate: isoDate(row.targetDate),
    contributionPerCycleInKobo: kobo(row.contributionPerCycleInKobo),
    contributionFrequency: frequency && FREQUENCIES.has(frequency) ? frequency : 'monthly',
    savingsType: savingsType && SAVINGS_TYPES.has(savingsType) ? savingsType : 'target',
    withdrawalDate: isoDate(row.withdrawalDate),
    progress: percent(row.progress),
    isPaused: Boolean(row.isPaused),
    contributionDates,
    createdAt: isoDate(row.createdAt) || new Date().toISOString(),
    updatedAt: str(row.updatedAt, 40) || undefined,
  };
}

/** Droppable until the project has the goal extras columns; see db.savingsGoals.supportsExtras(). */
async function withGoalExtras(goals: MergeRow[]): Promise<MergeRow[]> {
  if (goals.length === 0) return goals;
  if (await db.savingsGoals.supportsExtras()) return goals;
  return goals.map(goal => {
    const withoutExtras: MergeRow = { ...goal };
    delete withoutExtras.savingsType;
    delete withoutExtras.withdrawalDate;
    return withoutExtras;
  });
}

function rows(value: unknown, userId: string, clean: (raw: unknown, userId: string) => MergeRow | null): MergeRow[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, MAX_ROWS).map(raw => clean(raw, userId)).filter((row): row is MergeRow => Boolean(row));
}

function cleanBudgetPlan(raw: unknown) {
  const row = (raw || {}) as Record<string, unknown>;
  const category = str(row.id, 40) || str(row.category, 40);
  if (!category) return null;
  const bucket = str(row.bucket, 20);
  return {
    category,
    name: str(row.name, 60) || category,
    bucket: bucket && BUCKETS.has(bucket) ? bucket : 'essentials',
    allocatedInKobo: kobo(row.allocatedInKobo),
    updatedAt: new Date().toISOString(),
  };
}

router.get('/state', async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const [profile, transactions, savingsGoals, budgetPlans] = await Promise.all([
    db.users.findById(userId) as any,
    db.transactions.findByUser(userId),
    db.savingsGoals.findByUser(userId),
    db.budgetPlans.findByUser(userId),
  ]);
  res.json({
    transactions,
    savingsGoals,
    categoryBudgets: budgetPlans.map(plan => ({ id: (plan as any).category, ...plan })),
    streakDates: (profile as any)?.streakDates || [],
    syncedAt: new Date().toISOString(),
  });
});

// The app keeps its ledger in the browser; the Telegram bot can only answer from this API,
// so both sides push and pull through here and the server row is the shared truth.
router.put('/state', async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const body = (req.body || {}) as Record<string, unknown>;
  const now = new Date().toISOString();

  const storedTransactions = await db.transactions.findByUser(userId);
  const incomingTransactions = prepareIncoming(rows(body.transactions, userId, cleanTransaction), now);
  const transactionPlan = planLedgerMerge(storedTransactions, incomingTransactions, idList(body.deletedTransactionIds));

  const storedGoals = await db.savingsGoals.findByUser(userId);
  const incomingGoals = prepareIncoming(await withGoalExtras(rows(body.savingsGoals, userId, cleanGoal)), now);
  const goalPlan = planLedgerMerge(storedGoals, incomingGoals, idList(body.deletedGoalIds));

  const applyLedger = async (
    plan: ReturnType<typeof planLedgerMerge>,
    stored: (MergeRow | null)[],
    create: (row: any) => Promise<unknown>,
    update: (id: string, row: any) => Promise<unknown>,
    remove: (id: string) => Promise<unknown>,
  ) => {
    const storedIds = new Set(stored.map(row => row?.id));
    for (const row of plan.writes) {
      if (storedIds.has(row.id)) await update(row.id, row);
      else await create({ ...row, userId });
    }
    for (const id of plan.deletes) await remove(id);
  };

  await applyLedger(
    transactionPlan,
    storedTransactions,
    row => db.transactions.create(row),
    (id, row) => db.transactions.update(id, userId, row),
    id => db.transactions.delete(id, userId),
  );
  await applyLedger(
    goalPlan,
    storedGoals,
    row => db.savingsGoals.create(row),
    (id, row) => db.savingsGoals.update(id, userId, row),
    id => db.savingsGoals.delete(id, userId),
  );

  if (Array.isArray(body.categoryBudgets)) {
    const plans = body.categoryBudgets.slice(0, MAX_ROWS).map(cleanBudgetPlan).filter(Boolean);
    await db.budgetPlans.replaceForUser(userId, plans as any[]);
  }

  if (Array.isArray(body.streakDates)) {
    const dates = body.streakDates.map(value => str(value, 12)).filter((value): value is string => Boolean(value)).slice(0, 1000);
    await db.users.update(userId, { streakDates: dates });
  }

  const [transactions, savingsGoals] = await Promise.all([
    db.transactions.findByUser(userId),
    db.savingsGoals.findByUser(userId),
  ]);

  res.json({
    transactions,
    savingsGoals,
    applied: {
      transactions: transactionPlan.writes.length,
      goals: goalPlan.writes.length,
      removed: transactionPlan.deletes.length + goalPlan.deletes.length,
      conflicts: [...transactionPlan.conflicts, ...goalPlan.conflicts],
    },
    syncedAt: now,
  });
});

export default router;
