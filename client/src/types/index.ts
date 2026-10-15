export interface User {
  id: string;
  name: string;
  email: string;
  university?: string;
  phoneNumber?: string;
  incomeFrequency: 'daily' | 'weekly' | 'monthly' | 'irregular';
  typicalIncomeInKobo: number;
  nextIncomeDate?: string;
  createdAt: string;
}

export interface Budget {
  id: string;
  userId: string;
  period: 'daily' | 'weekly' | 'monthly' | 'custom';
  startDate: string;
  endDate: string;
  totalIncomeInKobo: number;
  obligationsInKobo: number;
  essentialsInKobo: number;
  futureYouInKobo: number;
  enjoymentInKobo: number;
  isAutoAdjusted: boolean;
}

export interface Transaction {
  id: string;
  userId: string;
  type: 'income' | 'expense' | 'transfer';
  amountInKobo: number;
  category: string;
  description: string;
  date: string;
  merchant?: string;
  paymentMethod?: string;
  budgetBucket: 'obligations' | 'essentials' | 'future_you' | 'enjoyment';
  notes?: string;
  source: 'manual' | 'csv' | 'receipt' | 'bmoni';
  syncStatus: 'synced' | 'pending' | 'failed';
  receiptUrl?: string;
  recurringId?: string;
}

export interface SavingsGoal {
  id: string;
  userId: string;
  name: string;
  targetAmountInKobo: number;
  currentAmountInKobo: number;
  targetDate?: string;
  contributionPerCycleInKobo: number;
  contributionFrequency: 'daily' | 'weekly' | 'monthly';
  progress: number;
  isPaused: boolean;
  createdAt: string;
}

export interface Obligation {
  id: string;
  userId: string;
  name: string;
  amountInKobo: number;
  frequency: 'daily' | 'weekly' | 'monthly' | 'once';
  nextDueDate: string;
  category: string;
  isRecurring: boolean;
}

export interface SpendingInsight {
  id: string;
  type: 'warning' | 'tip' | 'pattern' | 'achievement';
  title: string;
  message: string;
  severity: 'low' | 'medium' | 'high';
  createdAt: string;
  isRead: boolean;
}

export interface SavingsStreak {
  currentStreak: number;
  longestStreak: number;
  lastContributionDate?: string;
  /** Local calendar days ('YYYY-MM-DD') on which money was added to a goal. Source of truth for the streak. */
  contributionDates: string[];
}

export interface LiteracyLesson {
  id: string;
  title: string;
  description: string;
  category: 'budgeting' | 'saving' | 'investing' | 'debt' | 'general';
  duration: number;
  isCompleted: boolean;
  content: string;
}

export interface StudentOffer {
  id: string;
  title: string;
  description: string;
  category: 'food' | 'transport' | 'data' | 'academics' | 'entertainment' | 'shopping';
  discount: string;
  vendor: string;
  expiresAt?: string;
  isActive: boolean;
}

export interface WhatIfScenario {
  id: string;
  description: string;
  expenseAmountInKobo: number;
  category: string;
  impactOnBudgetInKobo: number;
  impactOnSavingsInKobo: number;
  newDailyLimitInKobo: number;
  isAffordable: boolean;
  tradeoffs: string[];
}

export interface SafeToSpend {
  totalAvailableInKobo: number;
  reservedObligationsInKobo: number;
  reservedSavingsInKobo: number;
  unallocatedInKobo: number;
  dailyLimitInKobo: number;
  daysUntilNextIncome: number;
  isEstimate: boolean;
}

export interface CategoryBudget {
  id: string;
  name: string;
  allocatedInKobo: number;
  spentInKobo: number;
  bucket: BudgetBucket;
}

export type BudgetBucket = 'obligations' | 'essentials' | 'future_you' | 'enjoyment';

export interface CategoryConfig {
  id: string;
  name: string;
  icon: string;
  bucket: BudgetBucket;
  color: string;
}

export const DEFAULT_CATEGORIES: CategoryConfig[] = [
  { id: 'rent', name: 'Rent', icon: 'Home', bucket: 'obligations', color: '#ef4444' },
  { id: 'school_fees', name: 'School Fees', icon: 'GraduationCap', bucket: 'obligations', color: '#f97316' },
  { id: 'debt', name: 'Debt Repayment', icon: 'CreditCard', bucket: 'obligations', color: '#dc2626' },
  { id: 'family', name: 'Family Support', icon: 'Heart', bucket: 'obligations', color: '#ec4899' },
  { id: 'dues', name: 'Dues & Contributions', icon: 'Users', bucket: 'obligations', color: '#8b5cf6' },
  { id: 'food', name: 'Food', icon: 'UtensilsCrossed', bucket: 'essentials', color: '#22c55e' },
  { id: 'transport', name: 'Transport', icon: 'Bus', bucket: 'essentials', color: '#3b82f6' },
  { id: 'data_airtime', name: 'Data & Airtime', icon: 'Wifi', bucket: 'essentials', color: '#06b6d4' },
  { id: 'academics', name: 'Academic Materials', icon: 'BookOpen', bucket: 'essentials', color: '#6366f1' },
  { id: 'utilities', name: 'Utilities', icon: 'Zap', bucket: 'essentials', color: '#eab308' },
  { id: 'emergency', name: 'Emergency Fund', icon: 'Shield', bucket: 'future_you', color: '#14b8a6' },
  { id: 'savings', name: 'Savings Goal', icon: 'PiggyBank', bucket: 'future_you', color: '#10b981' },
  { id: 'education', name: 'Education Plan', icon: 'Target', bucket: 'future_you', color: '#0ea5e9' },
  { id: 'entertainment', name: 'Entertainment', icon: 'Gamepad2', bucket: 'enjoyment', color: '#a855f7' },
  { id: 'social', name: 'Social Activities', icon: 'PartyPopper', bucket: 'enjoyment', color: '#f43f5e' },
  { id: 'eating_out', name: 'Eating Out', icon: 'Coffee', bucket: 'enjoyment', color: '#d946ef' },
  { id: 'shopping', name: 'Shopping', icon: 'ShoppingBag', bucket: 'enjoyment', color: '#f59e0b' },
];
