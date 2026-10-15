import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User, Transaction, SavingsGoal, Obligation, SpendingInsight, SavingsStreak, SafeToSpend, CategoryBudget, BudgetBucket } from '../types';
import { DEFAULT_CATEGORIES } from '../types';
import { generateId, daysUntil } from '../utils';
import { apiPut, clearSession, login as apiLogin, register as apiRegister } from '../services/api';
import { mergeLedger, pullLedger, pushLedger } from '../services/sync';

export interface SuggestedAdjustment {
  id: string;
  category: string;
  currentInKobo: number;
  suggestedInKobo: number;
  changeInKobo: number;
  applied: boolean;
}

export interface PlanUpdate {
  triggered: boolean;
  message: string;
  expenseAmountInKobo: number;
  expenseCategory: string;
  adjustments: SuggestedAdjustment[];
}

export interface CalendarEvent {
  id: string;
  title: string;
  date: string;
  type: 'income' | 'obligation' | 'goal' | 'group' | 'recurring';
  amountInKobo?: number;
  isCompleted: boolean;
}

export interface Group {
  id: string;
  name: string;
  type: string;
  members: { name: string; contributedInKobo: number; expectedInKobo: number }[];
  targetInKobo: number;
  deadline: string;
}

export interface SessionProfile {
  id: string;
  name: string;
  email: string;
  university?: string | null;
  phoneNumber?: string | null;
  incomeFrequency?: User['incomeFrequency'];
  typicalIncomeInKobo?: number;
  nextIncomeDate?: string | null;
}

interface AppState {
  user: User | null;
  isAuthenticated: boolean;
  isDemoMode: boolean;
  transactions: Transaction[];
  savingsGoals: SavingsGoal[];
  obligations: Obligation[];
  categoryBudgets: CategoryBudget[];
  insights: SpendingInsight[];
  streak: SavingsStreak;
  planUpdate: PlanUpdate | null;
  calendarEvents: CalendarEvent[];
  groups: Group[];
  textScale: 'normal' | 'large';
  inflationRate: number;
  literacyCompleted: string[];
  authPending: boolean;
  authError: string | null;
  profileSyncError: string | null;
  deletedTransactionIds: string[];
  deletedGoalIds: string[];
  syncState: 'idle' | 'syncing' | 'error';
  syncError: string | null;
  lastSyncedAt: string | null;

  syncNow: () => Promise<void>;
  setUser: (user: User) => void;
  logout: () => void;
  login: (email: string, password: string, remember: boolean) => Promise<boolean>;
  register: (payload: { name: string; email: string; password: string; university?: string; phoneNumber?: string }) => Promise<boolean>;
  applySession: (profile: SessionProfile) => void;
  setAuthError: (message: string | null) => void;
  completeSetup: (plan: SetupPlan) => Promise<void>;
  setDemoMode: (enabled: boolean) => void;
  addTransaction: (tx: Omit<Transaction, 'id' | 'syncStatus' | 'createdAt'>) => void;
  deleteTransaction: (id: string) => void;
  addSavingsGoal: (goal: Omit<SavingsGoal, 'id' | 'progress' | 'createdAt'>) => void;
  updateSavingsGoal: (id: string, updates: Partial<SavingsGoal>) => void;
  deleteSavingsGoal: (id: string) => void;
  addToSavingsGoal: (id: string, amountInKobo: number) => void;
  addObligation: (obs: Omit<Obligation, 'id'>) => void;
  deleteObligation: (id: string) => void;
  applyAdjustment: (id: string) => void;
  applyAllAdjustments: () => void;
  dismissPlanUpdate: () => void;
  addCalendarEvent: (e: Omit<CalendarEvent, 'id'>) => void;
  toggleCalendarEvent: (id: string) => void;
  addGroup: (g: Omit<Group, 'id'>) => void;
  contributeToGroup: (groupId: string, memberName: string, amountInKobo: number) => void;
  getSafeToSpend: () => SafeToSpend;
  getTotalBalance: () => number;
  getMonthlyAllowance: () => number;
  getStreak: () => StreakView;
  setTextScale: (scale: 'normal' | 'large') => void;
  setInflationRate: (rate: number) => void;
  toggleLiteracyCompleted: (lessonId: string) => void;
  markInsightRead: (id: string) => void;
  resetAll: () => void;
}

export const DEFAULT_INFLATION = 15;

const BUCKET_ORDER = ['enjoyment', 'future_you', 'essentials'] as const;

const CYCLE_DAYS: Record<User['incomeFrequency'], number> = { daily: 1, weekly: 7, monthly: 30, irregular: 30 };

export const SPLIT_PRESETS = {
  balanced: { label: 'Balanced', hint: 'Steady on the essentials, room for fun', essentials: 0.60, future_you: 0.20, enjoyment: 0.20 },
  saver: { label: 'Future you', hint: 'Save hard now, tighten the present', essentials: 0.50, future_you: 0.33, enjoyment: 0.17 },
  social: { label: 'Social life', hint: 'Protect your going-out budget', essentials: 0.55, future_you: 0.12, enjoyment: 0.33 },
} as const;

export type SplitPreset = keyof typeof SPLIT_PRESETS;

export const STREAK_MILESTONES = [
  { days: 3, label: 'First steps', note: 'You saved on three separate days.' },
  { days: 7, label: 'Full week', note: 'Seven days in a row without skipping.' },
  { days: 14, label: 'Fortnight', note: 'Two weeks — the habit is settling in.' },
  { days: 30, label: 'One month', note: 'Thirty days of showing up.' },
  { days: 60, label: 'Two months', note: 'Most people stop before this point.' },
  { days: 90, label: 'A quarter', note: 'Ninety days. That is a habit, not a streak.' },
] as const;

function dayKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function shiftDay(key: string, delta: number) {
  const [y, m, d] = key.split('-').map(Number);
  return dayKey(new Date(y, m - 1, d + delta));
}

function dayGap(from: string, to: string) {
  return Math.round((Date.parse(`${to}T00:00:00`) - Date.parse(`${from}T00:00:00`)) / 86400000);
}

export interface StreakView {
  current: number;
  longest: number;
  dates: string[];
  activeToday: boolean;
  daysSinceLast: number | null;
  reached: { days: number; label: string; note: string }[];
  next: { days: number; label: string; note: string; remaining: number } | null;
}

function readStreak(dates: string[], storedLongest: number): StreakView {
  const unique = [...new Set(dates.map(d => d.slice(0, 10)))].sort();
  const seen = new Set(unique);
  const today = dayKey(new Date());

  let cursor = seen.has(today) ? today : shiftDay(today, -1);
  let current = 0;
  while (seen.has(cursor)) { current += 1; cursor = shiftDay(cursor, -1); }

  let run = 0;
  let computed = 0;
  unique.forEach((d, i) => {
    run = i > 0 && dayGap(unique[i - 1], d) === 1 ? run + 1 : 1;
    computed = Math.max(computed, run);
  });

  const longest = Math.max(current, computed, storedLongest);
  const reached = STREAK_MILESTONES.filter(m => longest >= m.days);
  const upcoming = STREAK_MILESTONES.find(m => longest < m.days);
  const last = unique[unique.length - 1];

  return {
    current,
    longest,
    dates: unique,
    activeToday: seen.has(today),
    daysSinceLast: last ? dayGap(last, today) : null,
    reached,
    next: upcoming ? { ...upcoming, remaining: upcoming.days - longest } : null,
  };
}

export interface SetupObligation {
  name: string;
  amountInKobo: number;
  frequency: Obligation['frequency'];
  category: string;
  nextDueDate?: string;
}

export interface SetupPlan {
  incomeFrequency: User['incomeFrequency'];
  typicalIncomeInKobo: number;
  nextIncomeDate?: string;
  university?: string;
  preset: SplitPreset;
  obligations: SetupObligation[];
}

const BUCKET_WEIGHTS: Record<Exclude<BudgetBucket, 'obligations'>, number[]> = {
  essentials: [0.42, 0.25, 0.18, 0.15],
  future_you: [0.5, 0.5],
  enjoyment: [0.4, 0.35, 0.25],
};

const BUCKET_CATEGORIES: Record<Exclude<BudgetBucket, 'obligations'>, string[]> = {
  essentials: ['food', 'transport', 'data_airtime', 'academics'],
  future_you: ['emergency', 'savings'],
  enjoyment: ['entertainment', 'eating_out', 'shopping'],
};

function toCycleAmount(amountInKobo: number, frequency: Obligation['frequency'], cycleDays: number): number {
  if (frequency === 'monthly') return amountInKobo * (cycleDays / 30);
  if (frequency === 'weekly') return amountInKobo * (cycleDays / 7);
  if (frequency === 'daily') return amountInKobo * cycleDays;
  return amountInKobo;
}

function nameOf(categoryId: string): string {
  return DEFAULT_CATEGORIES.find(c => c.id === categoryId)?.name || categoryId;
}

function buildBucket(bucket: Exclude<BudgetBucket, 'obligations'>, totalInKobo: number): CategoryBudget[] {
  const ids = BUCKET_CATEGORIES[bucket];
  const weights = BUCKET_WEIGHTS[bucket];
  const parts = ids.slice(0, -1).map((id, i) => Math.round((totalInKobo * weights[i]) / 5000) * 5000);
  parts.push(Math.max(0, totalInKobo - parts.reduce((s, p) => s + p, 0)));
  return ids.map((id, i) => ({
    id,
    name: nameOf(id),
    allocatedInKobo: parts[i],
    spentInKobo: 0,
    bucket,
  }));
}

export function buildStarterPlan(plan: SetupPlan) {
  const cycleDays = CYCLE_DAYS[plan.incomeFrequency];
  const allowanceInKobo = Math.max(0, Math.round(plan.typicalIncomeInKobo));
  const ratios = SPLIT_PRESETS[plan.preset];

  const rawObligations = plan.obligations.map(o => ({
    ...o,
    cycleAmountInKobo: Math.min(toCycleAmount(o.amountInKobo, o.frequency, cycleDays), allowanceInKobo),
  }));
  const obligationTotal = rawObligations.reduce((s, o) => s + o.cycleAmountInKobo, 0);

  const ceiling = allowanceInKobo * 0.85;
  const scale = obligationTotal > ceiling ? ceiling / obligationTotal : 1;
  const obligationBudgets: CategoryBudget[] = rawObligations.map(o => ({
    id: `ob-${generateId()}`,
    name: o.name,
    allocatedInKobo: Math.round((o.cycleAmountInKobo * scale) / 5000) * 5000,
    spentInKobo: 0,
    bucket: 'obligations',
  }));

  const remaining = Math.max(0, allowanceInKobo - obligationBudgets.reduce((s, b) => s + b.allocatedInKobo, 0));
  const bucketTotals: Record<Exclude<BudgetBucket, 'obligations'>, number> = {
    essentials: Math.round(remaining * ratios.essentials),
    future_you: Math.round(remaining * ratios.future_you),
    enjoyment: Math.round(remaining * ratios.enjoyment),
  };

  const categoryBudgets = [
    ...obligationBudgets,
    ...buildBucket('essentials', bucketTotals.essentials),
    ...buildBucket('future_you', bucketTotals.future_you),
    ...buildBucket('enjoyment', bucketTotals.enjoyment),
  ];

  const obligations: Obligation[] = plan.obligations.map((o, i) => ({
    id: generateId(),
    userId: 'self',
    name: o.name,
    amountInKobo: o.amountInKobo,
    frequency: o.frequency,
    nextDueDate: o.nextDueDate || new Date(Date.now() + 14 * 86400000).toISOString(),
    category: o.category,
    isRecurring: o.frequency !== 'once',
  }));

  const calendarEvents: CalendarEvent[] = [
    ...obligations.map(o => ({
      id: generateId(),
      title: o.name,
      date: o.nextDueDate,
      type: 'obligation' as const,
      amountInKobo: o.amountInKobo,
      isCompleted: false,
    })),
    ...(plan.nextIncomeDate ? [{
      id: generateId(),
      title: 'Allowance / income expected',
      date: new Date(plan.nextIncomeDate).toISOString(),
      type: 'income' as const,
      amountInKobo: allowanceInKobo,
      isCompleted: false,
    }] : []),
  ];

  return {
    categoryBudgets,
    obligations,
    calendarEvents,
    overCommitted: obligationTotal > ceiling,
    bucketTotals: {
      obligations: obligationBudgets.reduce((s, b) => s + b.allocatedInKobo, 0),
      ...bucketTotals,
    },
  };
}

function buildPlanUpdate(state: AppState, tx: Transaction): PlanUpdate | null {
  if (tx.type !== 'expense') return null;
  const income = state.transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amountInKobo, 0);
  const allowance = income || state.user?.typicalIncomeInKobo || 0;
  if (!allowance || state.categoryBudgets.length === 0) return null;
  const spent = state.transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amountInKobo, 0);
  const reserved = state.savingsGoals.filter(g => !g.isPaused).reduce((s, g) => s + g.contributionPerCycleInKobo, 0);
  const over = spent + reserved - allowance;
  if (over <= 0) return null;

  let leftToCover = over;
  const adjustments: SuggestedAdjustment[] = [];
  for (const bucket of BUCKET_ORDER) {
    for (const cb of state.categoryBudgets.filter(c => c.bucket === bucket)) {
      if (leftToCover <= 0) break;
      const room = Math.floor((cb.allocatedInKobo * 0.4) / 10000) * 10000;
      if (room <= 0) continue;
      const cut = Math.min(room, Math.ceil(leftToCover / 10000) * 10000);
      adjustments.push({ id: generateId(), category: cb.name, currentInKobo: cb.allocatedInKobo, suggestedInKobo: cb.allocatedInKobo - cut, changeInKobo: -cut, applied: false });
      leftToCover -= cut;
    }
    if (leftToCover <= 0) break;
  }
  if (adjustments.length === 0) return null;

  const label = tx.description?.trim() || tx.category || 'expense';
  const nairaAmt = (kobo: number) => (kobo / 100).toLocaleString('en-NG');
  return {
    triggered: true,
    message: `A ₦${nairaAmt(tx.amountInKobo)} ${label.toLowerCase()} puts this cycle ₦${nairaAmt(over)} over plan. Here is one transparent way to rebalance — nothing changes until you apply it.`,
    expenseAmountInKobo: tx.amountInKobo,
    expenseCategory: tx.category,
    adjustments,
  };
}

const buildDemo = () => {
  const now = new Date();
  const nextIncome = new Date(now.getTime() + 12 * 86400000).toISOString();
  const contributionDates = Array.from({ length: 8 }, (_, i) => {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    return dayKey(d);
  });

  const transactions: Transaction[] = [
    { id: 'd1', userId: 'demo', type: 'income', amountInKobo: 6000000, category: 'allowance', description: 'Monthly allowance', date: new Date(now.getTime() - 18 * 86400000).toISOString(), budgetBucket: 'essentials', source: 'manual', syncStatus: 'synced' },
    { id: 'd2', userId: 'demo', type: 'expense', amountInKobo: 850000, category: 'food', description: 'Groceries & meals', date: new Date(now.getTime() - 15 * 86400000).toISOString(), merchant: 'Supermarket', budgetBucket: 'essentials', source: 'manual', syncStatus: 'synced' },
    { id: 'd3', userId: 'demo', type: 'expense', amountInKobo: 400000, category: 'transport', description: 'Fuel & taxi', date: new Date(now.getTime() - 10 * 86400000).toISOString(), budgetBucket: 'essentials', source: 'manual', syncStatus: 'synced' },
    { id: 'd4', userId: 'demo', type: 'expense', amountInKobo: 300000, category: 'data_airtime', description: 'Data subscription', date: new Date(now.getTime() - 6 * 86400000).toISOString(), merchant: 'MTN', budgetBucket: 'essentials', source: 'manual', syncStatus: 'synced' },
    { id: 'd5', userId: 'demo', type: 'expense', amountInKobo: 300000, category: 'entertainment', description: 'Streaming & games', date: new Date(now.getTime() - 3 * 86400000).toISOString(), budgetBucket: 'enjoyment', source: 'manual', syncStatus: 'synced' },
  ];

  const savingsGoals: SavingsGoal[] = [
    { id: 'sg1', userId: 'demo', name: 'New laptop', targetAmountInKobo: 15000000, currentAmountInKobo: 4500000, targetDate: new Date(now.getTime() + 45 * 86400000).toISOString(), contributionPerCycleInKobo: 500000, contributionFrequency: 'weekly', progress: 30, isPaused: false, createdAt: new Date(now.getTime() - 60 * 86400000).toISOString() },
    { id: 'sg2', userId: 'demo', name: 'Emergency fund', targetAmountInKobo: 3000000, currentAmountInKobo: 1800000, targetDate: undefined, contributionPerCycleInKobo: 400000, contributionFrequency: 'monthly', progress: 60, isPaused: false, createdAt: new Date(now.getTime() - 40 * 86400000).toISOString() },
  ];

  const categoryBudgets: CategoryBudget[] = [
    { id: 'cb1', name: 'Food', allocatedInKobo: 1500000, spentInKobo: 850000, bucket: 'essentials' },
    { id: 'cb2', name: 'Transport', allocatedInKobo: 800000, spentInKobo: 400000, bucket: 'essentials' },
    { id: 'cb3', name: 'Data & Airtime', allocatedInKobo: 500000, spentInKobo: 300000, bucket: 'essentials' },
    { id: 'cb4', name: 'Personal', allocatedInKobo: 700000, spentInKobo: 300000, bucket: 'enjoyment' },
    { id: 'cb5', name: 'Savings', allocatedInKobo: 500000, spentInKobo: 0, bucket: 'future_you' },
    { id: 'cb6', name: 'Entertainment', allocatedInKobo: 500000, spentInKobo: 300000, bucket: 'enjoyment' },
  ];

  const calendarEvents: CalendarEvent[] = [
    { id: 'ce1', title: 'Allowance from parents', date: nextIncome, type: 'income', amountInKobo: 6000000, isCompleted: false },
    { id: 'ce2', title: 'Departmental dues', date: new Date(now.getTime() + 5 * 86400000).toISOString(), type: 'obligation', amountInKobo: 300000, isCompleted: false },
    { id: 'ce3', title: 'Room rent', date: new Date(now.getTime() + 20 * 86400000).toISOString(), type: 'obligation', amountInKobo: 1500000, isCompleted: false },
    { id: 'ce4', title: 'Data subscription', date: new Date(now.getTime() + 8 * 86400000).toISOString(), type: 'recurring', amountInKobo: 300000, isCompleted: false },
    { id: 'ce5', title: 'Laptop goal check', date: new Date(now.getTime() + 30 * 86400000).toISOString(), type: 'goal', amountInKobo: 200000, isCompleted: false },
  ];

  const groups: Group[] = [
    { id: 'g1', name: 'Hostel Groceries', type: 'Shared groceries', members: [{ name: 'Ada', contributedInKobo: 500000, expectedInKobo: 800000 }, { name: 'Chidi', contributedInKobo: 800000, expectedInKobo: 800000 }, { name: 'Zainab', contributedInKobo: 300000, expectedInKobo: 800000 }], targetInKobo: 2400000, deadline: new Date(now.getTime() + 6 * 86400000).toISOString() },
    { id: 'g2', name: 'Class Project', type: 'Group assignment', members: [{ name: 'Ada', contributedInKobo: 200000, expectedInKobo: 500000 }, { name: 'Tunde', contributedInKobo: 500000, expectedInKobo: 500000 }], targetInKobo: 1000000, deadline: new Date(now.getTime() + 12 * 86400000).toISOString() },
  ];

  const planUpdate: PlanUpdate = {
    triggered: true,
    message: 'A ₦4,000 medical expense was recorded today. Here\u2019s a transparent way to keep your essentials covered.',
    expenseAmountInKobo: 400000,
    expenseCategory: 'medical',
    adjustments: [
      { id: 'sa1', category: 'Personal', currentInKobo: 700000, suggestedInKobo: 550000, changeInKobo: -150000, applied: false },
      { id: 'sa2', category: 'Savings', currentInKobo: 500000, suggestedInKobo: 350000, changeInKobo: -150000, applied: false },
      { id: 'sa3', category: 'Food', currentInKobo: 1500000, suggestedInKobo: 1400000, changeInKobo: -100000, applied: false },
    ],
  };

  const insights: SpendingInsight[] = [
    { id: 'i1', type: 'warning', title: 'Transport costs rising', message: 'Your transport spending is 30% higher than last week. Consider carpooling.', severity: 'medium', createdAt: new Date().toISOString(), isRead: false },
    { id: 'i2', type: 'tip', title: 'Data bundle savings', message: 'You could save ₦500/month by switching to a monthly data plan.', severity: 'low', createdAt: new Date().toISOString(), isRead: false },
  ];

  return { transactions, savingsGoals, categoryBudgets, calendarEvents, groups, planUpdate, insights, nextIncome, contributionDates };
};

let ledgerSyncInFlight = false;
let lastSyncedSignature = '';

// Identity + last-edit time only: a new array reference that carries the same rows must not
// look like an edit and send the whole ledger back to the server.
function ledgerSignature(state: AppState): string {
  const tx = state.transactions.map(t => `${t.id}@${t.updatedAt || t.date || ''}`).join('|');
  const goals = state.savingsGoals.map(g => `${g.id}@${g.updatedAt || g.createdAt || ''}`).join('|');
  return `${tx}#${goals}#${state.deletedTransactionIds.length}:${state.deletedGoalIds.length}`;
}

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      isDemoMode: false,
      transactions: [],
      savingsGoals: [],
      obligations: [],
      categoryBudgets: [],
      insights: [],
      streak: { currentStreak: 0, longestStreak: 0, contributionDates: [] },
      planUpdate: null,
      calendarEvents: [],
      groups: [],
      textScale: 'normal',
      inflationRate: DEFAULT_INFLATION,
      literacyCompleted: [],
      authPending: false,
      authError: null,
      profileSyncError: null,
      deletedTransactionIds: [],
      deletedGoalIds: [],
      syncState: 'idle',
      syncError: null,
      lastSyncedAt: null,

      setUser: (user) => set({ user, isAuthenticated: true }),
      logout: () => { clearSession(); set({ user: null, isAuthenticated: false, isDemoMode: false }); },

      login: async (email, password, remember) => {
        set({ authPending: true, authError: null });
        try {
          const profile = await apiLogin(email, password, remember);
          get().applySession(profile);
          set({ authPending: false });
          return true;
        } catch (error) {
          set({ authPending: false, authError: (error as Error).message });
          return false;
        }
      },

      register: async (payload) => {
        set({ authPending: true, authError: null });
        try {
          const profile = await apiRegister(payload);
          get().applySession(profile);
          set({ authPending: false });
          return true;
        } catch (error) {
          set({ authPending: false, authError: (error as Error).message });
          return false;
        }
      },

      applySession: (profile) => set((state) => ({
        isAuthenticated: true,
        isDemoMode: false,
        user: {
          id: profile.id, name: profile.name, email: profile.email,
          university: profile.university || undefined,
          phoneNumber: profile.phoneNumber || undefined,
          incomeFrequency: profile.incomeFrequency || 'monthly',
          typicalIncomeInKobo: profile.typicalIncomeInKobo || 0,
          nextIncomeDate: profile.nextIncomeDate || undefined,
          createdAt: new Date().toISOString(),
        },
        ...(state.isDemoMode || !state.user ? {
          transactions: [], savingsGoals: [], obligations: [], categoryBudgets: [], insights: [],
          planUpdate: null, calendarEvents: [], groups: [],
          streak: { currentStreak: 0, longestStreak: 0, contributionDates: [] },
        } : {}),
      })),

      setAuthError: (authError) => set({ authError }),

      syncNow: async () => {
        if (ledgerSyncInFlight || !get().isAuthenticated) return;
        ledgerSyncInFlight = true;
        set({ syncState: 'syncing' });
        const before = get();
        try {
          const remote = await pullLedger();
          const mergedTx = mergeLedger(before.transactions, remote.transactions, before.deletedTransactionIds);
          const mergedGoals = mergeLedger(before.savingsGoals, remote.savingsGoals, before.deletedGoalIds);
          const pushed = await pushLedger({
            transactions: mergedTx.rows,
            savingsGoals: mergedGoals.rows,
            deletedTransactionIds: before.deletedTransactionIds,
            deletedGoalIds: before.deletedGoalIds,
          });
          // Merge the server's answer back into whatever the user typed while the request was in flight.
          const live = get();
          const adoptedTx = mergeLedger(live.transactions, pushed.transactions, []);
          const adoptedGoals = mergeLedger(live.savingsGoals, pushed.savingsGoals, []);
          set({
            transactions: adoptedTx.rows,
            savingsGoals: adoptedGoals.rows,
            deletedTransactionIds: live.deletedTransactionIds.filter(id => !pushed.transactions.some(t => t.id === id)),
            deletedGoalIds: live.deletedGoalIds.filter(id => !pushed.savingsGoals.some(g => g.id === id)),
            syncState: 'idle',
            syncError: null,
            lastSyncedAt: pushed.syncedAt,
          });
          lastSyncedSignature = ledgerSignature(get());
        } catch (error) {
          set({ syncState: 'error', syncError: (error as Error).message });
        } finally {
          ledgerSyncInFlight = false;
        }
      },

      completeSetup: async (plan) => {
        const built = buildStarterPlan(plan);
        const nextIncomeDate = plan.nextIncomeDate || undefined;
        set((state) => ({
          user: state.user ? {
            ...state.user,
            incomeFrequency: plan.incomeFrequency,
            typicalIncomeInKobo: Math.max(0, Math.round(plan.typicalIncomeInKobo)),
            university: plan.university || state.user.university,
            nextIncomeDate,
          } : state.user,
          categoryBudgets: built.categoryBudgets,
          obligations: built.obligations,
          calendarEvents: [
            ...state.calendarEvents.filter(e => e.type !== 'obligation' && e.title !== 'Allowance / income expected'),
            ...built.calendarEvents,
          ],
          profileSyncError: null,
        }));
        try {
          await apiPut('/auth/profile', {
            incomeFrequency: plan.incomeFrequency,
            typicalIncomeInKobo: plan.typicalIncomeInKobo,
            nextIncomeDate,
            university: plan.university || null,
          });
        } catch (error) {
          set({ profileSyncError: (error as Error).message });
        }
      },

      setDemoMode: (enabled) => {
        if (enabled) {
          const d = buildDemo();
          set({
            isDemoMode: true,
            isAuthenticated: true,
            user: {
              id: 'demo', name: 'Ada', email: 'ada@allowii.app', university: 'University of Lagos',
              incomeFrequency: 'monthly', typicalIncomeInKobo: 6000000, nextIncomeDate: d.nextIncome,
              createdAt: new Date().toISOString(),
            },
            transactions: d.transactions, savingsGoals: d.savingsGoals, categoryBudgets: d.categoryBudgets,
            calendarEvents: d.calendarEvents, groups: d.groups, planUpdate: d.planUpdate, insights: d.insights,
            streak: { currentStreak: 8, longestStreak: 21, lastContributionDate: new Date().toISOString(), contributionDates: d.contributionDates },
            obligations: [
              { id: 'o1', userId: 'demo', name: 'Room Rent', amountInKobo: 1500000, frequency: 'monthly', nextDueDate: new Date(Date.now() + 20 * 86400000).toISOString(), category: 'rent', isRecurring: true },
              { id: 'o2', userId: 'demo', name: 'Departmental Dues', amountInKobo: 300000, frequency: 'once', nextDueDate: new Date(Date.now() + 5 * 86400000).toISOString(), category: 'dues', isRecurring: false },
            ],
          });
        } else {
          set({ isDemoMode: false });
        }
      },

      addTransaction: (tx) => set((state) => {
        const newTx: Transaction = {
          ...tx, id: generateId(), syncStatus: 'pending', updatedAt: new Date().toISOString(),
        } as Transaction;
        const transactions = [newTx, ...state.transactions];
        const planUpdate = buildPlanUpdate({ ...state, transactions }, newTx);
        return planUpdate ? { transactions, planUpdate } : { transactions };
      }),

      deleteTransaction: (id) => set((state) => ({
        transactions: state.transactions.filter(t => t.id !== id),
        deletedTransactionIds: state.deletedTransactionIds.includes(id)
          ? state.deletedTransactionIds
          : [...state.deletedTransactionIds, id],
      })),

      addSavingsGoal: (goal) => set((state) => ({
        savingsGoals: [...state.savingsGoals, {
          ...goal, id: generateId(), progress: 0, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
        }],
      })),

      updateSavingsGoal: (id, updates) => set((state) => ({
        savingsGoals: state.savingsGoals.map(g => g.id === id ? { ...g, ...updates, updatedAt: new Date().toISOString() } : g),
      })),

      deleteSavingsGoal: (id) => set((state) => ({
        savingsGoals: state.savingsGoals.filter(g => g.id !== id),
        deletedGoalIds: state.deletedGoalIds.includes(id) ? state.deletedGoalIds : [...state.deletedGoalIds, id],
      })),

      addToSavingsGoal: (id, amountInKobo) => set((state) => {
        const today = dayKey(new Date());
        const dates = state.streak.contributionDates ?? [];
        const view = readStreak(dates.includes(today) ? dates : [...dates, today], state.streak.longestStreak);
        return {
          savingsGoals: state.savingsGoals.map(g => {
            if (g.id !== id) return g;
            const newAmount = g.currentAmountInKobo + amountInKobo;
            return {
              ...g,
              currentAmountInKobo: newAmount,
              progress: Math.min(100, (newAmount / g.targetAmountInKobo) * 100),
              updatedAt: new Date().toISOString(),
            };
          }),
          streak: {
            currentStreak: view.current,
            longestStreak: view.longest,
            lastContributionDate: new Date().toISOString(),
            contributionDates: view.dates,
          },
        };
      }),

      addObligation: (obs) => set((state) => ({ obligations: [...state.obligations, { ...obs, id: generateId() }] })),
      deleteObligation: (id) => set((state) => ({ obligations: state.obligations.filter(o => o.id !== id) })),

      applyAdjustment: (id) => set((state) => {
        if (!state.planUpdate) return {};
        const adj = state.planUpdate.adjustments.find(a => a.id === id);
        if (!adj || adj.applied) return {};
        const newBudgets = state.categoryBudgets.map(cb =>
          cb.name === adj.category ? { ...cb, allocatedInKobo: adj.suggestedInKobo } : cb
        );
        return {
          categoryBudgets: newBudgets,
          planUpdate: { ...state.planUpdate, adjustments: state.planUpdate.adjustments.map(a => a.id === id ? { ...a, applied: true } : a) },
        };
      }),

      applyAllAdjustments: () => {
        const state = get();
        state.planUpdate?.adjustments.filter(a => !a.applied).forEach(a => get().applyAdjustment(a.id));
      },

      dismissPlanUpdate: () => set((state) => ({
        planUpdate: state.planUpdate ? { ...state.planUpdate, triggered: false } : null,
      })),

      addCalendarEvent: (e) => set((state) => ({ calendarEvents: [...state.calendarEvents, { ...e, id: generateId() }] })),
      toggleCalendarEvent: (id) => set((state) => ({
        calendarEvents: state.calendarEvents.map(e => e.id === id ? { ...e, isCompleted: !e.isCompleted } : e),
      })),

      addGroup: (g) => set((state) => ({ groups: [...state.groups, { ...g, id: generateId() }] })),
      contributeToGroup: (groupId, memberName, amountInKobo) => set((state) => ({
        groups: state.groups.map(g => g.id !== groupId ? g : {
          ...g, members: g.members.map(m => m.name === memberName ? { ...m, contributedInKobo: m.contributedInKobo + amountInKobo } : m),
        }),
      })),

      getSafeToSpend: () => {
        const state = get();
        const allowance = state.getMonthlyAllowance();
        const spent = state.transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amountInKobo, 0);
        const reservedSavings = state.savingsGoals.filter(g => !g.isPaused).reduce((s, g) => s + g.contributionPerCycleInKobo, 0);
        const remaining = Math.max(0, allowance - spent - reservedSavings);
        const daysLeft = state.user?.nextIncomeDate ? daysUntil(state.user.nextIncomeDate) : 30;
        const dailyLimit = daysLeft > 0 ? Math.floor(remaining / daysLeft) : remaining;
        return {
          totalAvailableInKobo: remaining, reservedObligationsInKobo: 0, reservedSavingsInKobo: reservedSavings,
          unallocatedInKobo: remaining, dailyLimitInKobo: dailyLimit, daysUntilNextIncome: daysLeft, isEstimate: !state.user?.nextIncomeDate,
        };
      },

      getStreak: () => readStreak(get().streak.contributionDates ?? [], get().streak.longestStreak),

      getTotalBalance: () => {
        const state = get();
        const income = state.transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amountInKobo, 0);
        const expenses = state.transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amountInKobo, 0);
        return income - expenses;
      },

      getMonthlyAllowance: () => {
        const state = get();
        const income = state.transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amountInKobo, 0);
        return income || state.user?.typicalIncomeInKobo || 0;
      },

      setTextScale: (textScale) => set({ textScale }),
      setInflationRate: (inflationRate) => set({ inflationRate: Math.min(60, Math.max(0, Math.round(inflationRate))) }),

      toggleLiteracyCompleted: (lessonId) => set((state) => {
        const completed = state.literacyCompleted.includes(lessonId)
          ? state.literacyCompleted.filter(id => id !== lessonId)
          : [...state.literacyCompleted, lessonId];
        return { literacyCompleted: completed };
      }),

      markInsightRead: (id) => set((state) => ({
        insights: state.insights.map(i => i.id === id ? { ...i, isRead: true } : i),
      })),

      resetAll: () => set({
        user: null, isAuthenticated: false, isDemoMode: false, transactions: [], savingsGoals: [],
        obligations: [], categoryBudgets: [], insights: [], planUpdate: null,
        calendarEvents: [], groups: [],
        inflationRate: DEFAULT_INFLATION, literacyCompleted: [],
        deletedTransactionIds: [], deletedGoalIds: [], syncError: null, lastSyncedAt: null,
        streak: { currentStreak: 0, longestStreak: 0, contributionDates: [] },
      }),
    }),
    { name: 'allowii-storage-v3' }
  )
);

const SYNC_DEBOUNCE_MS = 1200;
const SYNC_POLL_MS = 60000;

let syncTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleLedgerSync() {
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(() => {
    syncTimer = null;
    void useStore.getState().syncNow();
  }, SYNC_DEBOUNCE_MS);
}

useStore.subscribe((state, prev) => {
  if (state.isAuthenticated !== prev.isAuthenticated) {
    lastSyncedSignature = '';
    if (state.isAuthenticated) void state.syncNow();
    return;
  }
  if (!state.isAuthenticated) return;
  if (ledgerSignature(state) !== lastSyncedSignature) scheduleLedgerSync();
});

// A transaction typed into the WhatsApp bot cannot wake this tab, so an idle tab pulls on a timer.
setInterval(() => {
  const state = useStore.getState();
  if (!state.isAuthenticated || state.syncState === 'syncing') return;
  if (typeof document !== 'undefined' && document.hidden) return;
  if (ledgerSignature(state) !== lastSyncedSignature) return; // a local edit already owns the debounced path
  void state.syncNow();
}, SYNC_POLL_MS);

document.addEventListener('visibilitychange', () => {
  if (document.hidden) return;
  void useStore.getState().syncNow();
});

// The persisted session rehydrates before this module subscribes, so a returning user needs one pull
// to see anything the bot recorded while the tab was closed.
if (useStore.getState().isAuthenticated) void useStore.getState().syncNow();
