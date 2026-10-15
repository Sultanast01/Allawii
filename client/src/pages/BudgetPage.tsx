import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../context/store';
import Header from '../components/Header';
import { formatNaira, daysUntil } from '../utils';
import { AlertCircle, Check, RefreshCw, ChevronRight, TrendingDown } from 'lucide-react';

export default function BudgetPage() {
  const navigate = useNavigate();
  const { user, getSafeToSpend, getMonthlyAllowance, transactions, categoryBudgets, planUpdate, applyAdjustment, applyAllAdjustments, dismissPlanUpdate } = useStore();
  const [showAll, setShowAll] = useState(false);

  const safe = getSafeToSpend();
  const allowance = getMonthlyAllowance();
  const spent = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amountInKobo, 0);
  const nextDate = user?.nextIncomeDate ? new Date(user.nextIncomeDate) : null;
  const cycleStart = nextDate ? new Date(nextDate.getTime() - 30 * 86400000) : new Date();
  const fmt = (d: Date) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

  const stats = [
    { label: 'Total allowance', value: formatNaira(allowance), color: 'text-navy-900' },
    { label: 'Total spent', value: formatNaira(spent), color: 'text-navy-900' },
    { label: 'Remaining', value: formatNaira(safe.unallocatedInKobo), color: 'text-emerald-700' },
    { label: 'Next allowance', value: nextDate ? fmt(nextDate) : '—', color: 'text-navy-900' },
  ];

  const pendingAdjustments = planUpdate?.adjustments.filter(a => !a.applied) || [];
  const allApplied = planUpdate && planUpdate.adjustments.every(a => a.applied);

  return (
    <div>
      <Header title="My Budget" showBack />

      <div className="px-5 pt-5 space-y-5 lg:px-10 lg:pt-10">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[11px] font-semibold tracking-wider text-primary-600 uppercase mb-1">
              Budget cycle · {fmt(cycleStart)}–{fmt(nextDate || new Date())}
            </p>
            <h1 className="text-2xl font-bold text-navy-900 lg:text-3xl">Your plan is still within reach</h1>
            <p className="text-sm text-surface-500 mt-1 lg:text-base">Review your categories and adjust without starting over.</p>
          </div>
          <button onClick={() => navigate('/setup')} title="Rebuild this plan from new income figures" aria-label="Rebuild this plan from new income figures" className="w-10 h-10 bg-gradient-to-br from-primary-500 to-primary-700 rounded-xl flex items-center justify-center shadow-lg active:scale-95 transition-transform shrink-0 hover:scale-105">
            <RefreshCw size={17} className="text-white" />
          </button>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {stats.map(s => (
            <div key={s.label} className="card p-4">
              <p className="text-xs text-surface-500 mb-1">{s.label}</p>
              <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Plan Update */}
        {planUpdate?.triggered && (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 bg-amber-400 rounded-full flex items-center justify-center">
                <AlertCircle size={16} className="text-white" />
              </div>
              <p className="text-[11px] font-bold tracking-wider text-amber-700 uppercase">Plan update</p>
            </div>
            <h3 className="font-bold text-navy-900 text-lg mb-1">An unexpected expense changed your budget</h3>
            <p className="text-sm text-surface-600 mb-4">{planUpdate.message}</p>
            {!showAll ? (
              <button onClick={() => setShowAll(true)} className="btn-navy text-sm py-2.5 px-5 flex items-center gap-1.5">
                Review suggestion <ChevronRight size={15} />
              </button>
            ) : (
              <button onClick={() => setShowAll(false)} className="btn-secondary text-sm py-2.5 px-5">
                Hide suggestions
              </button>
            )}
          </div>
        )}

        {/* Suggested adjustments */}
        {showAll && planUpdate && (
          <div className="card p-5 animate-slide-up">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-navy-900">Suggested adjustments</h3>
              <span className={`badge ${allApplied ? 'badge-success' : 'badge-warning'}`}>
                {allApplied ? 'Applied' : 'Not applied'}
              </span>
            </div>
            <div className="space-y-3">
              {planUpdate.adjustments.map(adj => (
                <div key={adj.id} className="flex items-center justify-between py-2 border-b border-surface-100 last:border-0">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-surface-100 rounded-lg flex items-center justify-center">
                      <TrendingDown size={15} className="text-surface-500" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-navy-900">{adj.category}</p>
                      <p className="text-xs text-surface-500">
                        <span className="line-through">{formatNaira(adj.currentInKobo)}</span> → <b className="text-navy-900">{formatNaira(adj.suggestedInKobo)}</b>
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-red-500">{formatNaira(adj.changeInKobo)}</p>
                    {adj.applied ? (
                      <span className="text-[10px] text-emerald-700 font-medium flex items-center gap-0.5 justify-end"><Check size={11} /> Applied</span>
                    ) : (
                      <button onClick={() => applyAdjustment(adj.id)} className="min-h-[44px] px-3 -mx-3 text-[11px] font-semibold text-primary-600 cursor-pointer">Apply</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            {!allApplied && (
              <div className="flex gap-2 mt-4">
                <button onClick={applyAllAdjustments} className="btn-primary flex-1 text-sm py-2.5">Apply all</button>
                <button onClick={dismissPlanUpdate} className="btn-ghost text-sm">Dismiss</button>
              </div>
            )}
          </div>
        )}

        {/* Category budgets */}
        <div>
          <h3 className="font-bold text-navy-900 mb-3">Your categories</h3>
          <div className="card lg:grid lg:grid-cols-2 lg:gap-x-8 lg:px-4 divide-y divide-surface-100 lg:divide-y-0">
            {categoryBudgets.map(cb => {
              const pct = cb.allocatedInKobo > 0 ? Math.min(100, (cb.spentInKobo / cb.allocatedInKobo) * 100) : 0;
              const over = cb.spentInKobo > cb.allocatedInKobo;
              return (
                <div key={cb.id} className="p-4">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm font-semibold text-navy-900">{cb.name}</span>
                    <span className="text-xs text-surface-500">
                      <b className={over ? 'text-red-500' : 'text-navy-900'}>{formatNaira(cb.spentInKobo)}</b> / {formatNaira(cb.allocatedInKobo)}
                    </span>
                  </div>
                  <div className="h-1.5 bg-surface-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all duration-500 ${over ? 'bg-red-500' : pct > 80 ? 'bg-amber-500' : 'bg-primary-500'}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Adaptive note */}
        <div className="card p-4 flex gap-3 bg-primary-50/50 border-primary-100">
          <RefreshCw size={18} className="text-primary-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-sm text-navy-900">Adaptive budgeting</p>
            <p className="text-xs text-surface-500 mt-0.5">
              When you overspend or face an unexpected cost, Allawii recalculates your plan and suggests adjustments to other categories — so you recover instead of abandoning your budget.
            </p>
          </div>
        </div>

        {/* What-if */}
        <button onClick={() => navigate('/what-if')} className="card p-4 w-full flex items-center gap-3 text-left active:scale-[0.99] transition-transform">
          <div className="w-10 h-10 bg-violet-50 rounded-xl flex items-center justify-center"><span className="text-lg">🔮</span></div>
          <div className="flex-1">
            <p className="font-semibold text-sm text-navy-900">Try a what-if scenario</p>
            <p className="text-xs text-surface-500">Test a decision before you commit</p>
          </div>
          <ChevronRight size={16} className="text-surface-500" />
        </button>
      </div>
    </div>
  );
}
