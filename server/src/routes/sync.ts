import { Router, Request, Response } from 'express';
import db from '../models/database.js';
import { authMiddleware } from './auth.js';
import { planLedgerMerge, prepareIncoming, type MergeRow } from '../services/sync.js';

const router = Router();

router.use(authMiddleware);

const MAX_ROWS = 5000;
const BUCKETS = new Set(['obligations', 'essentials', 'future_you', 'enjoyment']);
const FREQUENCIES = new Set(['daily', 'weekly', 'monthly', 'term']);

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
  return {
    id,
    userId,
    name,
    targetAmountInKobo: kobo(row.targetAmountInKobo),
    currentAmountInKobo: kobo(row.currentAmountInKobo),
    targetDate: isoDate(row.targetDate),
    contributionPerCycleInKobo: kobo(row.contributionPerCycleInKobo),
    contributionFrequency: frequency && FREQUENCIES.has(frequency) ? frequency : 'monthly',
    progress: percent(row.progress),
    isPaused: Boolean(row.isPaused),
    createdAt: isoDate(row.createdAt) || new Date().toISOString(),
    updatedAt: str(row.updatedAt, 40) || undefined,
  };
}

function rows(value: unknown, userId: string, clean: (raw: unknown, userId: string) => MergeRow | null): MergeRow[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, MAX_ROWS).map(raw => clean(raw, userId)).filter((row): row is MergeRow => Boolean(row));
}

function applyMerge(
  stored: MergeRow[],
  plan: ReturnType<typeof planLedgerMerge>,
  create: (row: any) => void,
  update: (id: string, row: any) => void,
  remove: (id: string) => void,
  userId: string,
) {
  const storedIds = new Set(stored.map(row => row.id));
  for (const row of plan.writes) {
    if (storedIds.has(row.id)) update(row.id, row);
    else create({ ...row, userId });
  }
  for (const id of plan.deletes) remove(id);
}

router.get('/state', (req: Request, res: Response) => {
  const userId = (req as any).userId;
  res.json({
    transactions: db.transactions.findByUser(userId),
    savingsGoals: db.savingsGoals.findByUser(userId),
    syncedAt: new Date().toISOString(),
  });
});

// The app keeps its ledger in the browser; the WhatsApp bot can only answer from this API,
// so both sides push and pull through here and the server row is the shared truth.
router.put('/state', (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const body = (req.body || {}) as Record<string, unknown>;
  const now = new Date().toISOString();

  const storedTransactions = db.transactions.findByUser(userId);
  const incomingTransactions = prepareIncoming(rows(body.transactions, userId, cleanTransaction), now);
  const transactionPlan = planLedgerMerge(storedTransactions, incomingTransactions, idList(body.deletedTransactionIds));
  applyMerge(
    storedTransactions,
    transactionPlan,
    row => db.transactions.create(row),
    (id, row) => db.transactions.update(id, userId, row),
    id => db.transactions.delete(id, userId),
    userId,
  );

  const storedGoals = db.savingsGoals.findByUser(userId);
  const incomingGoals = prepareIncoming(rows(body.savingsGoals, userId, cleanGoal), now);
  const goalPlan = planLedgerMerge(storedGoals, incomingGoals, idList(body.deletedGoalIds));
  applyMerge(
    storedGoals,
    goalPlan,
    row => db.savingsGoals.create(row),
    (id, row) => db.savingsGoals.update(id, userId, row),
    id => db.savingsGoals.delete(id, userId),
    userId,
  );

  res.json({
    transactions: db.transactions.findByUser(userId),
    savingsGoals: db.savingsGoals.findByUser(userId),
    applied: {
      transactions: transactionPlan.writes.length,
      goals: goalPlan.writes.length,
      removed: transactionPlan.deletes.length + goalPlan.deletes.length,
      conflicts: [...transactionPlan.conflicts, ...goalPlan.conflicts],
    },
    syncedAt: new Date().toISOString(),
  });
});

export default router;
