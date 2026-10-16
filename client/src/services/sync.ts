import { apiGet, apiPut } from './api';
import { DEFAULT_CATEGORIES, type BudgetBucket, type SavingsGoal, type Transaction } from '../types';

export interface SyncRow {
  id: string;
  updatedAt?: string;
}

const BUCKETS: BudgetBucket[] = ['obligations', 'essentials', 'future_you', 'enjoyment'];

function stampOf(row: SyncRow): number {
  const value = row.updatedAt ? Date.parse(row.updatedAt) : NaN;
  return Number.isNaN(value) ? 0 : value;
}

/**
 * The server holds rows the browser has never seen (a transaction typed into the Telegram bot),
 * so the pull side of the merge adopts by id and only replaces a local row when the server's copy
 * was genuinely touched later.
 */
export function mergeLedger<T extends SyncRow>(local: T[], remote: T[], tombstones: string[]): { rows: T[]; adopted: number } {
  const pending = new Map(remote.map(row => [row.id, row]));
  const tombstoned = new Set(tombstones);
  const rows: T[] = [];
  let adopted = 0;

  for (const row of local) {
    if (tombstoned.has(row.id)) continue;
    const theirs = pending.get(row.id);
    if (theirs && stampOf(theirs) > stampOf(row)) {
      rows.push(theirs);
      adopted += 1;
    } else {
      rows.push(row);
    }
    pending.delete(row.id);
  }

  for (const theirs of pending.values()) {
    if (tombstoned.has(theirs.id)) continue;
    rows.push(theirs);
    adopted += 1;
  }

  return { rows, adopted };
}

function bucketFor(category: unknown, type: unknown): BudgetBucket {
  if (type === 'income') return 'essentials';
  return DEFAULT_CATEGORIES.find(entry => entry.id === category)?.bucket || 'essentials';
}

export function normalizeTransaction(raw: Record<string, any>): Transaction {
  const bucket = BUCKETS.includes(raw.budgetBucket) ? raw.budgetBucket : bucketFor(raw.category, raw.type);
  return {
    ...raw,
    type: raw.type === 'income' ? 'income' : 'expense',
    amountInKobo: Number(raw.amountInKobo) || 0,
    category: String(raw.category || 'other_expense'),
    description: String(raw.description || ''),
    budgetBucket: bucket,
    source: raw.source || 'manual',
    syncStatus: 'synced',
  } as Transaction;
}

export function normalizeGoal(raw: Record<string, any>): SavingsGoal {
  return {
    ...raw,
    name: String(raw.name || 'Untitled goal'),
    targetAmountInKobo: Number(raw.targetAmountInKobo) || 0,
    currentAmountInKobo: Number(raw.currentAmountInKobo) || 0,
    contributionPerCycleInKobo: Number(raw.contributionPerCycleInKobo) || 0,
    contributionFrequency: ['daily', 'weekly', 'monthly'].includes(raw.contributionFrequency) ? raw.contributionFrequency : 'monthly',
    savingsType: ['emergency', 'target', 'flexible'].includes(raw.savingsType) ? raw.savingsType : undefined,
    withdrawalDate: raw.withdrawalDate || undefined,
    progress: Number(raw.progress) || 0,
    isPaused: Boolean(raw.isPaused),
    createdAt: raw.createdAt || new Date().toISOString(),
  } as SavingsGoal;
}

/**
 * A project whose savings_goals table has not gained `savings_type` and `withdrawal_date` yet
 * answers for those fields with nothing, and last-write-wins would then reset a pot the user has
 * just labelled. Keep the local answer wherever the server has none.
 */
export function keepGoalExtras(remote: SavingsGoal[], local: SavingsGoal[]): SavingsGoal[] {
  const localById = new Map(local.map(goal => [goal.id, goal]));
  return remote.map(goal => {
    const mine = localById.get(goal.id);
    if (!mine || (goal.savingsType && goal.withdrawalDate)) return goal;
    return { ...goal, savingsType: goal.savingsType || mine.savingsType, withdrawalDate: goal.withdrawalDate || mine.withdrawalDate };
  });
}

export interface RemoteState {
  transactions: Transaction[];
  savingsGoals: SavingsGoal[];
  categoryBudgets?: Record<string, any>[];
  streakDates?: string[];
  syncedAt: string;
}

export async function pullLedger(): Promise<RemoteState> {
  const data = await apiGet('/sync/state');
  return {
    transactions: (data.transactions || []).map(normalizeTransaction),
    savingsGoals: (data.savingsGoals || []).map(normalizeGoal),
    categoryBudgets: data.categoryBudgets || [],
    streakDates: Array.isArray(data.streakDates) ? data.streakDates : [],
    syncedAt: data.syncedAt,
  };
}

export interface PushResult extends RemoteState {
  applied: { transactions: number; goals: number; removed: number; conflicts: string[] };
}

export async function pushLedger(payload: {
  transactions: Transaction[];
  savingsGoals: SavingsGoal[];
  deletedTransactionIds: string[];
  deletedGoalIds: string[];
  categoryBudgets?: unknown[];
  streakDates?: string[];
}): Promise<PushResult> {
  const data = await apiPut('/sync/state', payload);
  return {
    transactions: (data.transactions || []).map(normalizeTransaction),
    savingsGoals: (data.savingsGoals || []).map(normalizeGoal),
    syncedAt: data.syncedAt,
    applied: data.applied,
  };
}
