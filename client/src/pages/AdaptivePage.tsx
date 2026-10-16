import { useNavigate } from 'react-router-dom';
import { useStore } from '../context/store';
import Header from '../components/Header';
import { formatNaira } from '../utils';
import { AlertCircle, Check, ChevronRight, RefreshCw, TrendingDown, TrendingUp } from 'lucide-react';

/**
 * The adaptive engine's own screen. Spending an unexpected amount used to bury
 * the rebalance suggestions inside the budget page; here the user sees what
 * broke, what Allawii proposes to move, and can accept or reject each change.
 */
export default function AdaptivePage() {
  const navigate = useNavigate();
  const { getSafeToSpend, categoryBudgets, planUpdate, applyAdjustment, applyAllAdjustments, dismissPlanUpdate } = useStore();

  const safe = getSafeToSpend();
  const over = categoryBudgets.filter(cb => cb.allocatedInKobo > 0 && cb.spentInKobo > cb.allocatedInKobo);
  const tight = categoryBudgets.filter(cb => {
    if (cb.allocatedInKobo <= 0 || cb.spentInKobo > cb.allocatedInKobo) return false;
    return cb.spentInKobo / cb.allocatedInKobo >= 0.8;
  });
  const adjustments = planUpdate?.adjustments || [];
  const pending = adjustments.filter(a => !a.applied);

  return (
    <div>
      <Header title="Adaptive Budgeting" />

      <div className="px-5 pt-5 space-y-5 pb-8 lg:px-10 lg:pt-8 lg:max-w-3xl">
        <div>
          <p className="text-[11px] font-semibold tracking-wider text-primary-600 uppercase mb-1">Plan recovery</p>
          <h1 className="text-2xl font-bold text-navy-900 lg:text-3xl">When the plan breaks, fix it without starting over</h1>
          <p className="text-sm text-surface-500 mt-1">
            Every time an expense pushes a category past its limit, Allawii works out which budgets still have room and proposes where the shortfall comes from.
          </p>
        </div>

        {/* Live position */}
        <div className="grid grid-cols-2 gap-3">
          <div className="card p-4">
            <p className="text-xs text-surface-500 mb-1">Still unallocated</p>
            <p className="text-lg font-bold text-emerald-700">{formatNaira(safe.unallocatedInKobo)}</p>
            <p className="text-[11px] text-surface-500 mt-1">{safe.daysUntilNextIncome} day(s) to your next money</p>
          </div>
          <div className="card p-4">
            <p className="text-xs text-surface-500 mb-1">Daily guide</p>
            <p className="text-lg font-bold text-navy-900">{formatNaira(safe.dailyLimitInKobo)}</p>
            <p className="text-[11px] text-surface-500 mt-1">Recomputed on every expense</p>
          </div>
        </div>

        {/* What triggered the update */}
        {planUpdate?.triggered ? (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-7 h-7 bg-amber-400 rounded-full flex items-center justify-center">
                <AlertCircle size={16} className="text-white" />
              </div>
              <p className="text-[11px] font-bold tracking-wider text-amber-700 uppercase">Latest change</p>
            </div>
            <h3 className="font-bold text-navy-900 text-lg mb-1">{formatNaira(planUpdate.expenseAmountInKobo)} on {planUpdate.expenseCategory}</h3>
            <p className="text-sm text-surface-600">{planUpdate.message}</p>
          </div>
        ) : (
          <div className="card p-5 flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center shrink-0">
              <Check size={18} className="text-emerald-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-navy-900">No rebalance needed right now</p>
              <p className="text-xs text-surface-500">Suggestions appear here the moment an expense pushes a category over its limit.</p>
            </div>
          </div>
        )}

        {/* Suggested adjustments */}
        {adjustments.length > 0 && (
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-navy-900">Suggested adjustments</h3>
              <span className={`badge ${pending.length ? 'badge-warning' : 'badge-success'}`}>
                {pending.length ? `${pending.length} pending` : 'Applied'}
              </span>
            </div>
            <div className="space-y-3">
              {adjustments.map(adj => {
                const Icon = adj.changeInKobo < 0 ? TrendingDown : TrendingUp;
                return (
                  <div key={adj.id} className="flex items-center justify-between py-2 border-b border-surface-100 last:border-0">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-surface-100 rounded-lg flex items-center justify-center">
                        <Icon size={15} className="text-surface-500" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-navy-900">{adj.category}</p>
                        <p className="text-xs text-surface-500">
                          <span className="line-through">{formatNaira(adj.currentInKobo)}</span> → <b className="text-navy-900">{formatNaira(adj.suggestedInKobo)}</b>
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`text-sm font-bold ${adj.changeInKobo < 0 ? 'text-red-500' : 'text-emerald-600'}`}>
                        {adj.changeInKobo < 0 ? '' : '+'}{formatNaira(adj.changeInKobo)}
                      </p>
                      {adj.applied ? (
                        <span className="text-[10px] text-emerald-700 font-medium flex items-center gap-0.5 justify-end"><Check size={11} /> Applied</span>
                      ) : (
                        <button onClick={() => applyAdjustment(adj.id)} className="min-h-[44px] px-3 -mx-3 text-[11px] font-semibold text-primary-600 cursor-pointer">Apply</button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            {pending.length > 0 && (
              <div className="flex gap-2 mt-4">
                <button onClick={applyAllAdjustments} className="btn-primary flex-1 text-sm py-2.5">Apply all</button>
                <button onClick={dismissPlanUpdate} className="btn-ghost text-sm">Dismiss</button>
              </div>
            )}
          </div>
        )}

        {/* Categories under pressure */}
        {(over.length > 0 || tight.length > 0) && (
          <div>
            <h3 className="font-bold text-navy-900 mb-3">Categories under pressure</h3>
            <div className="card divide-y divide-surface-100">
              {[...over, ...tight].map(cb => {
                const pct = Math.min(100, (cb.spentInKobo / cb.allocatedInKobo) * 100);
                return (
                  <div key={cb.id} className="p-4">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm font-semibold text-navy-900">{cb.name}</span>
                      <span className="text-xs text-surface-500">
                        <b className={over.includes(cb) ? 'text-red-500' : 'text-amber-600'}>{formatNaira(cb.spentInKobo)}</b> / {formatNaira(cb.allocatedInKobo)}
                      </span>
                    </div>
                    <div className="h-1.5 bg-surface-100 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${over.includes(cb) ? 'bg-red-500' : 'bg-amber-500'}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <button onClick={() => navigate('/budget')} className="card p-4 w-full flex items-center gap-3 text-left active:scale-[0.99] transition-transform">
          <div className="w-10 h-10 bg-primary-50 rounded-xl flex items-center justify-center"><RefreshCw size={17} className="text-primary-600" /></div>
          <div className="flex-1">
            <p className="font-semibold text-sm text-navy-900">Set the limits yourself</p>
            <p className="text-xs text-surface-500">Move amounts between categories in the budget planner</p>
          </div>
          <ChevronRight size={16} className="text-surface-500" />
        </button>
      </div>
    </div>
  );
}
