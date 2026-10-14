import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User, Transaction, SavingsGoal, Obligation, SpendingInsight, SavingsStreak, SafeToSpend, CategoryBudget } from '../types';
import { generateId, daysUntil } from '../utils';

export interface SuggestedAdjustment {
  id: string;
  category: string;
  current: number;
  suggested: number;
  change: number;
  applied: boolean;
}

export interface PlanUpdate {
  triggered: boolean;
  message: string;
  expenseAmount: number;
  expenseCategory: string;
  adjustments: SuggestedAdjustment[];
}

export interface CalendarEvent {
  id: string;
  title: string;
  date: string;
  type: 'income' | 'obligation' | 'goal' | 'group' | 'recurring';
  amount?: number;
  isCompleted: boolean;
}

export interface Group {
  id: string;
  name: string;
  type: string;
  members: { name: string; contributed: number; expected: number }[];
  target: number;
  deadline: string;
}

export interface WhatsAppSettings {
  enabled: boolean;
  budgetReminders: boolean;
  savingsUpdates: boolean;
  weeklyDigest: boolean;
  lowBalanceAlerts: boolean;
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
  whatsapp: WhatsAppSettings;
  textScale: 'normal' | 'large';
  inflationRate: number;

  setUser: (user: User) => void;
  logout: () => void;
  setDemoMode: (enabled: boolean) => void;
  addTransaction: (tx: Omit<Transaction, 'id' | 'syncStatus' | 'createdAt'>) => void;
  deleteTransaction: (id: string) => void;
  addSavingsGoal: (goal: Omit<SavingsGoal, 'id' | 'progress' | 'createdAt'>) => void;
  updateSavingsGoal: (id: string, updates: Partial<SavingsGoal>) => void;
  deleteSavingsGoal: (id: string) => void;
  addToSavingsGoal: (id: string, amount: number) => void;
  addObligation: (obs: Omit<Obligation, 'id'>) => void;
  deleteObligation: (id: string) => void;
  applyAdjustment: (id: string) => void;
  applyAllAdjustments: () => void;
  dismissPlanUpdate: () => void;
  addCalendarEvent: (e: Omit<CalendarEvent, 'id'>) => void;
  toggleCalendarEvent: (id: string) => void;
  addGroup: (g: Omit<Group, 'id'>) => void;
  contributeToGroup: (groupId: string, memberName: string, amount: number) => void;
  setWhatsapp: (updates: Partial<WhatsAppSettings>) => void;
  getSafeToSpend: () => SafeToSpend;
  getTotalBalance: () => number;
  getMonthlyAllowance: () => number;
  setTextScale: (scale: 'normal' | 'large') => void;
  setInflationRate: (rate: number) => void;
  resetAll: () => void;
}

const DEFAULT_WHATSAPP: WhatsAppSettings = {
  enabled: false, budgetReminders: true, savingsUpdates: true, weeklyDigest: false, lowBalanceAlerts: true,
};

// A user-adjustable assumption, never presented as an official price forecast.
export const DEFAULT_INFLATION = 15;

// Trim discretionary buckets first; essentials are the last resort and stay capped at 40%.
const BUCKET_ORDER = ['enjoyment', 'future_you', 'essentials'] as const;

function buildPlanUpdate(state: AppState, tx: Transaction): PlanUpdate | null {
  if (tx.type !== 'expense') return null;
  const income = state.transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const allowance = income || state.user?.typicalIncome || 0;
  if (!allowance || state.categoryBudgets.length === 0) return null;
  // state.transactions already contains tx — counting it again would double the deficit.
  const spent = state.transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const reserved = state.savingsGoals.filter(g => !g.isPaused).reduce((s, g) => s + g.contributionPerCycle, 0);
  const over = spent + reserved - allowance;
  if (over <= 0) return null;

  let leftToCover = over;
  const adjustments: SuggestedAdjustment[] = [];
  for (const bucket of BUCKET_ORDER) {
    for (const cb of state.categoryBudgets.filter(c => c.bucket === bucket)) {
      if (leftToCover <= 0) break;
      const room = Math.floor((cb.allocated * 0.4) / 100) * 100;
      if (room <= 0) continue;
      const cut = Math.min(room, Math.ceil(leftToCover / 100) * 100);
      adjustments.push({ id: generateId(), category: cb.name, current: cb.allocated, suggested: cb.allocated - cut, change: -cut, applied: false });
      leftToCover -= cut;
    }
    if (leftToCover <= 0) break;
  }
  if (adjustments.length === 0) return null;

  const label = tx.description?.trim() || tx.category || 'expense';
  return {
    triggered: true,
    message: `A ₦${tx.amount.toLocaleString('en-NG')} ${label.toLowerCase()} puts this cycle ₦${over.toLocaleString('en-NG')} over plan. Here is one transparent way to rebalance — nothing changes until you apply it.`,
    expenseAmount: tx.amount,
    expenseCategory: tx.category,
    adjustments,
  };
}

const buildDemo = () => {
  const now = new Date();
  const nextIncome = new Date(now.getTime() + 12 * 86400000).toISOString();

  const transactions: Transaction[] = [
    { id: 'd1', userId: 'demo', type: 'income', amount: 60000, category: 'allowance', description: 'Monthly allowance', date: new Date(now.getTime() - 18 * 86400000).toISOString(), budgetBucket: 'essentials', source: 'manual', syncStatus: 'synced' },
    { id: 'd2', userId: 'demo', type: 'expense', amount: 8500, category: 'food', description: 'Groceries & meals', date: new Date(now.getTime() - 15 * 86400000).toISOString(), merchant: 'Supermarket', budgetBucket: 'essentials', source: 'manual', syncStatus: 'synced' },
    { id: 'd3', userId: 'demo', type: 'expense', amount: 4000, category: 'transport', description: 'Fuel & taxi', date: new Date(now.getTime() - 10 * 86400000).toISOString(), budgetBucket: 'essentials', source: 'manual', syncStatus: 'synced' },
    { id: 'd4', userId: 'demo', type: 'expense', amount: 3000, category: 'data_airtime', description: 'Data subscription', date: new Date(now.getTime() - 6 * 86400000).toISOString(), merchant: 'MTN', budgetBucket: 'essentials', source: 'manual', syncStatus: 'synced' },
    { id: 'd5', userId: 'demo', type: 'expense', amount: 3000, category: 'entertainment', description: 'Streaming & games', date: new Date(now.getTime() - 3 * 86400000).toISOString(), budgetBucket: 'enjoyment', source: 'manual', syncStatus: 'synced' },
  ];

  const savingsGoals: SavingsGoal[] = [
    { id: 'sg1', userId: 'demo', name: 'New laptop', targetAmount: 150000, currentAmount: 45000, targetDate: new Date(now.getTime() + 45 * 86400000).toISOString(), contributionPerCycle: 5000, contributionFrequency: 'weekly', progress: 30, isPaused: false, createdAt: new Date(now.getTime() - 60 * 86400000).toISOString() },
    { id: 'sg2', userId: 'demo', name: 'Emergency fund', targetAmount: 30000, currentAmount: 18000, contributionPerCycle: 4000, contributionFrequency: 'monthly', progress: 60, isPaused: false, createdAt: new Date(now.getTime() - 40 * 86400000).toISOString() },
  ];

  const categoryBudgets: CategoryBudget[] = [
    { id: 'cb1', name: 'Food', allocated: 15000, spent: 8500, bucket: 'essentials' },
    { id: 'cb2', name: 'Transport', allocated: 8000, spent: 4000, bucket: 'essentials' },
    { id: 'cb3', name: 'Data & Airtime', allocated: 5000, spent: 3000, bucket: 'essentials' },
    { id: 'cb4', name: 'Personal', allocated: 7000, spent: 3000, bucket: 'enjoyment' },
    { id: 'cb5', name: 'Savings', allocated: 5000, spent: 0, bucket: 'future_you' },
    { id: 'cb6', name: 'Entertainment', allocated: 5000, spent: 3000, bucket: 'enjoyment' },
  ];

  const calendarEvents: CalendarEvent[] = [
    { id: 'ce1', title: 'Allowance from parents', date: nextIncome, type: 'income', amount: 60000, isCompleted: false },
    { id: 'ce2', title: 'Departmental dues', date: new Date(now.getTime() + 5 * 86400000).toISOString(), type: 'obligation', amount: 3000, isCompleted: false },
    { id: 'ce3', title: 'Room rent', date: new Date(now.getTime() + 20 * 86400000).toISOString(), type: 'obligation', amount: 15000, isCompleted: false },
    { id: 'ce4', title: 'Data subscription', date: new Date(now.getTime() + 8 * 86400000).toISOString(), type: 'recurring', amount: 3000, isCompleted: false },
    { id: 'ce5', title: 'Laptop goal check', date: new Date(now.getTime() + 30 * 86400000).toISOString(), type: 'goal', amount: 2000, isCompleted: false },
  ];

  const groups: Group[] = [
    { id: 'g1', name: 'Hostel Groceries', type: 'Shared groceries', members: [{ name: 'Ada', contributed: 5000, expected: 8000 }, { name: 'Chidi', contributed: 8000, expected: 8000 }, { name: 'Zainab', contributed: 3000, expected: 8000 }], target: 24000, deadline: new Date(now.getTime() + 6 * 86400000).toISOString() },
    { id: 'g2', name: 'Class Project', type: 'Group assignment', members: [{ name: 'Ada', contributed: 2000, expected: 5000 }, { name: 'Tunde', contributed: 5000, expected: 5000 }], target: 10000, deadline: new Date(now.getTime() + 12 * 86400000).toISOString() },
  ];

  const planUpdate: PlanUpdate = {
    triggered: true,
    message: 'A ₦4,000 medical expense was recorded today. Here’s a transparent way to keep your essentials covered.',
    expenseAmount: 4000,
    expenseCategory: 'medical',
    adjustments: [
      { id: 'sa1', category: 'Personal', current: 7000, suggested: 5500, change: -1500, applied: false },
      { id: 'sa2', category: 'Savings', current: 5000, suggested: 3500, change: -1500, applied: false },
      { id: 'sa3', category: 'Food', current: 15000, suggested: 14000, change: -1000, applied: false },
    ],
  };

  const insights: SpendingInsight[] = [
    { id: 'i1', type: 'warning', title: 'Transport costs rising', message: 'Your transport spending is 30% higher than last week. Consider carpooling.', severity: 'medium', createdAt: new Date().toISOString(), isRead: false },
    { id: 'i2', type: 'tip', title: 'Data bundle savings', message: 'You could save ₦500/month by switching to a monthly data plan.', severity: 'low', createdAt: new Date().toISOString(), isRead: false },
  ];

  return { transactions, savingsGoals, categoryBudgets, calendarEvents, groups, planUpdate, insights, nextIncome };
};

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
      streak: { currentStreak: 0, longestStreak: 0, milestones: [7, 14, 30, 60, 90] },
      planUpdate: null,
      calendarEvents: [],
      groups: [],
      whatsapp: { ...DEFAULT_WHATSAPP },
      textScale: 'normal',
      inflationRate: DEFAULT_INFLATION,

      setUser: (user) => set({ user, isAuthenticated: true }),
      logout: () => set({ user: null, isAuthenticated: false, isDemoMode: false }),

      setDemoMode: (enabled) => {
        if (enabled) {
          const d = buildDemo();
          set({
            isDemoMode: true,
            isAuthenticated: true,
            user: {
              id: 'demo', name: 'Ada', email: 'ada@moneva.app', university: 'University of Lagos',
              incomeFrequency: 'monthly', typicalIncome: 60000, nextIncomeDate: d.nextIncome,
              createdAt: new Date().toISOString(),
            },
            transactions: d.transactions, savingsGoals: d.savingsGoals, categoryBudgets: d.categoryBudgets,
            calendarEvents: d.calendarEvents, groups: d.groups, planUpdate: d.planUpdate, insights: d.insights,
            streak: { currentStreak: 8, longestStreak: 21, lastContributionDate: new Date().toISOString(), milestones: [7, 14, 30, 60, 90] },
            obligations: [
              { id: 'o1', userId: 'demo', name: 'Room Rent', amount: 15000, frequency: 'monthly', nextDueDate: new Date(Date.now() + 20 * 86400000).toISOString(), category: 'rent', isRecurring: true },
              { id: 'o2', userId: 'demo', name: 'Departmental Dues', amount: 3000, frequency: 'once', nextDueDate: new Date(Date.now() + 5 * 86400000).toISOString(), category: 'dues', isRecurring: false },
            ],
          });
        } else {
          set({ isDemoMode: false });
        }
      },

      addTransaction: (tx) => set((state) => {
        const newTx: Transaction = { ...tx, id: generateId(), syncStatus: 'pending' } as Transaction;
        const transactions = [newTx, ...state.transactions];
        const planUpdate = buildPlanUpdate({ ...state, transactions }, newTx);
        return planUpdate ? { transactions, planUpdate } : { transactions };
      }),

      deleteTransaction: (id) => set((state) => ({ transactions: state.transactions.filter(t => t.id !== id) })),

      addSavingsGoal: (goal) => set((state) => ({
        savingsGoals: [...state.savingsGoals, { ...goal, id: generateId(), progress: 0, createdAt: new Date().toISOString() }],
      })),

      updateSavingsGoal: (id, updates) => set((state) => ({
        savingsGoals: state.savingsGoals.map(g => g.id === id ? { ...g, ...updates } : g),
      })),

      deleteSavingsGoal: (id) => set((state) => ({ savingsGoals: state.savingsGoals.filter(g => g.id !== id) })),

      addToSavingsGoal: (id, amount) => set((state) => ({
        savingsGoals: state.savingsGoals.map(g => {
          if (g.id !== id) return g;
          const newAmount = g.currentAmount + amount;
          return { ...g, currentAmount: newAmount, progress: Math.min(100, (newAmount / g.targetAmount) * 100) };
        }),
        streak: { ...state.streak, currentStreak: state.streak.currentStreak + 1, longestStreak: Math.max(state.streak.longestStreak, state.streak.currentStreak + 1), lastContributionDate: new Date().toISOString() },
      })),

      addObligation: (obs) => set((state) => ({ obligations: [...state.obligations, { ...obs, id: generateId() }] })),
      deleteObligation: (id) => set((state) => ({ obligations: state.obligations.filter(o => o.id !== id) })),

      applyAdjustment: (id) => set((state) => {
        if (!state.planUpdate) return {};
        const adj = state.planUpdate.adjustments.find(a => a.id === id);
        if (!adj || adj.applied) return {};
        const newBudgets = state.categoryBudgets.map(cb =>
          cb.name === adj.category ? { ...cb, allocated: adj.suggested } : cb
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
      contributeToGroup: (groupId, memberName, amount) => set((state) => ({
        groups: state.groups.map(g => g.id !== groupId ? g : {
          ...g, members: g.members.map(m => m.name === memberName ? { ...m, contributed: m.contributed + amount } : m),
        }),
      })),

      setWhatsapp: (updates) => set((state) => ({ whatsapp: { ...state.whatsapp, ...updates } })),

      getSafeToSpend: () => {
        const state = get();
        const allowance = state.getMonthlyAllowance();
        const spent = state.transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
        const reservedSavings = state.savingsGoals.filter(g => !g.isPaused).reduce((s, g) => s + g.contributionPerCycle, 0);
        const remaining = Math.max(0, allowance - spent - reservedSavings);
        const daysLeft = state.user?.nextIncomeDate ? daysUntil(state.user.nextIncomeDate) : 30;
        const dailyLimit = daysLeft > 0 ? remaining / daysLeft : remaining;
        return {
          totalAvailable: remaining, reservedObligations: 0, reservedSavings,
          unallocated: remaining, dailyLimit, daysUntilNextIncome: daysLeft, isEstimate: !state.user?.nextIncomeDate,
        };
      },

      getTotalBalance: () => {
        const state = get();
        const income = state.transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
        const expenses = state.transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
        return income - expenses;
      },

      getMonthlyAllowance: () => {
        const state = get();
        const income = state.transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
        return income || state.user?.typicalIncome || 0;
      },

      setTextScale: (textScale) => set({ textScale }),
      setInflationRate: (inflationRate) => set({ inflationRate: Math.min(60, Math.max(0, Math.round(inflationRate))) }),

      resetAll: () => set({
        user: null, isAuthenticated: false, isDemoMode: false, transactions: [], savingsGoals: [],
        obligations: [], categoryBudgets: [], insights: [], planUpdate: null,
        calendarEvents: [], groups: [], whatsapp: { ...DEFAULT_WHATSAPP },
        inflationRate: DEFAULT_INFLATION,
        streak: { currentStreak: 0, longestStreak: 0, milestones: [7, 14, 30, 60, 90] },
      }),
    }),
    { name: 'moneva-storage-v2' }
  )
);
