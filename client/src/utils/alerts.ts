import type { CategoryBudget, Obligation, SafeToSpend, SpendingInsight, User } from '../types';
import type { PlanUpdate, StreakView } from '../context/store';
import { formatNaira } from './index';

/**
 * One place that turns live state into "things worth interrupting the user for".
 * Every id is stable and day-scoped, so dismissing an alert keeps it dismissed
 * for that day and a fresh occurrence of the same problem still surfaces.
 */

export interface AlertItem {
  id: string;
  title: string;
  message: string;
  severity: 'high' | 'medium' | 'low';
  to: string;
  actionLabel: string;
  read: boolean;
}

export interface AlertState {
  user: Pick<User, 'nextIncomeDate'> | null;
  insights: SpendingInsight[];
  obligations: Obligation[];
  categoryBudgets: CategoryBudget[];
  planUpdate: PlanUpdate | null;
  dismissedAlerts: string[];
  getStreak: () => StreakView;
  getSafeToSpend: () => SafeToSpend;
}

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function daysUntilDay(dateString: string): number {
  const target = Date.parse(`${dateString.slice(0, 10)}T00:00:00`);
  const today = Date.parse(`${todayKey()}T00:00:00`);
  return Math.round((target - today) / 86400000);
}

export function buildAlerts(state: AlertState): AlertItem[] {
  const today = todayKey();
  const dismissed = new Set(state.dismissedAlerts);
  const alerts: AlertItem[] = [];

  for (const obligation of state.obligations) {
    if (!obligation.nextDueDate) continue;
    const left = daysUntilDay(obligation.nextDueDate);
    if (left < 0 || left > 7) continue;
    const id = `due:${obligation.id}:${obligation.nextDueDate}`;
    alerts.push({
      id,
      title: left <= 0 ? `${obligation.name} is due today` : `${obligation.name} is due in ${left} day${left === 1 ? '' : 's'}`,
      message: `${formatNaira(obligation.amountInKobo)} you cannot skip. Move it out of your spending budget before you spend it.`,
      severity: left <= 1 ? 'high' : 'medium',
      to: '/calendar',
      actionLabel: 'Open calendar',
      read: dismissed.has(id),
    });
  }

  for (const budget of state.categoryBudgets) {
    if (budget.allocatedInKobo <= 0 || budget.spentInKobo < budget.allocatedInKobo) continue;
    const id = `budget:${budget.id}:${today}`;
    alerts.push({
      id,
      title: `${budget.name} has passed its limit`,
      message: `${formatNaira(budget.spentInKobo)} spent against ${formatNaira(budget.allocatedInKobo)} set aside. Every extra naira here comes from another part of your plan.`,
      severity: 'high',
      to: '/budget',
      actionLabel: 'Adjust budget',
      read: dismissed.has(id),
    });
  }

  const pendingAdjustments = (state.planUpdate?.adjustments || []).filter(a => !a.applied);
  if (state.planUpdate?.triggered && pendingAdjustments.length) {
    const id = `rebalance:${today}`;
    alerts.push({
      id,
      title: 'Your plan needs rebalancing',
      message: `${state.planUpdate.message} ${pendingAdjustments.length} suggested change${pendingAdjustments.length === 1 ? '' : 's'} is waiting.`,
      severity: 'medium',
      to: '/adaptive',
      actionLabel: 'Review changes',
      read: dismissed.has(id),
    });
  }

  const streak = state.getStreak();
  if (streak.current > 0 && !streak.activeToday) {
    const id = `streak:${today}`;
    alerts.push({
      id,
      title: `${streak.current}-day streak ends tonight`,
      message: 'Add any amount to a goal before midnight to keep the run going.',
      severity: 'medium',
      to: '/savings',
      actionLabel: 'Save something',
      read: dismissed.has(id),
    });
  }

  if (state.user?.nextIncomeDate) {
    const overdue = daysUntilDay(state.user.nextIncomeDate);
    if (overdue < 0) {
      const id = `payday:${state.user.nextIncomeDate.slice(0, 10)}`;
      alerts.push({
        id,
        title: 'Your payday has passed',
        message: `Allawii is still counting down to ${state.user.nextIncomeDate.slice(0, 10)}, so your daily guide is not tracking this cycle. Update when money actually reached you.`,
        severity: 'high',
        to: '/setup',
        actionLabel: 'Update payday',
        read: dismissed.has(id),
      });
    }
  }

  for (const insight of state.insights) {
    if (insight.isRead) continue;
    alerts.push({
      id: `insight:${insight.id}`,
      title: insight.title,
      message: insight.message,
      severity: insight.severity === 'low' ? 'low' : insight.severity,
      to: '/',
      actionLabel: 'View',
      read: false,
    });
  }

  const rank = { high: 0, medium: 1, low: 2 };
  return alerts.sort((a, b) => rank[a.severity] - rank[b.severity]);
}

export function countUnreadAlerts(state: AlertState): number {
  return buildAlerts(state).filter(alert => !alert.read).length;
}
