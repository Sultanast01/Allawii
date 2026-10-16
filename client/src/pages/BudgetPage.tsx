import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore, spentInCycleInKobo, cycleWindowOf, cycleDaysOf } from '../context/store';
import Header from '../components/Header';
import { formatNaira, koboToNaira, nairaToKobo } from '../utils';
import { AlertCircle, Pencil, RefreshCw, ChevronRight } from 'lucide-react';

export default function BudgetPage() {
  const navigate = useNavigate();
  const { user, getSafeToSpend, getMonthlyAllowance, setMonthlyAllowance, transactions, categoryBudgets, planUpdate } = useStore();
  const [editingAllowance, setEditingAllowance] = useState(false);
  const [allowanceDraft, setAllowanceDraft] = useState('');

  const safe = getSafeToSpend();
  const allowance = getMonthlyAllowance();
  const spent = spentInCycleInKobo(transactions, user);
  const { nextIncome } = cycleWindowOf(user);
  const cycleStart = nextIncome
    ? new Date(nextIncome.getTime() - cycleDaysOf(user) * 86400000)
    : new Date();
  const fmt = (d: Date) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

  const startAllowanceEdit = () => {
    setAllowanceDraft(String(koboToNaira(allowance)));
    setEditingAllowance(true);
  };

  const saveAllowance = async () => {
    await setMonthlyAllowance(nairaToKobo(Number(allowanceDraft) || 0));
    setEditingAllowance(false);
  };

  const stats = [
    { label: 'Spent this cycle', value: formatNaira(spent), color: 'text-navy-900' },
    { label: 'Remaining', value: formatNaira(safe.unallocatedInKobo), color: 'text-emerald-700' },
    { label: 'Next allowance', value: nextIncome ? fmt(nextIncome) : '—', color: 'text-navy-900' },
  ];

  return (
    <div>
      <Header title="My Budget" />

      <div className="px-5 pt-5 space-y-5 lg:px-10 lg:pt-10">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[11px] font-semibold tracking-wider text-primary-600 uppercase mb-1">
              Budget cycle · {fmt(cycleStart)}–{fmt(nextIncome || new Date())}
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
          <div className="card p-4">
            <p className="text-xs text-surface-500 mb-1">Total allowance</p>
            {editingAllowance ? (
              <div className="space-y-1.5">
                <div className="flex items-center gap-1">
                  <span className="text-sm font-bold text-surface-500">₦</span>
                  <input
                    autoFocus
                    inputMode="decimal"
                    aria-label="Total allowance in naira"
                    value={allowanceDraft}
                    onChange={e => setAllowanceDraft(e.target.value.replace(/[^0-9.]/g, ''))}
                    onKeyDown={e => {
                      if (e.key === 'Enter') void saveAllowance();
                      if (e.key === 'Escape') setEditingAllowance(false);
                    }}
                    className="w-full min-w-0 bg-transparent text-lg font-bold text-navy-900 outline-none"
                  />
                </div>
                <div className="flex gap-2">
                  <button onClick={() => void saveAllowance()} className="text-[11px] font-semibold text-primary-600">Save</button>
                  <button onClick={() => setEditingAllowance(false)} className="text-[11px] font-semibold text-surface-500">Cancel</button>
                </div>
              </div>
            ) : (
              <button onClick={startAllowanceEdit} className="flex items-center gap-1.5 text-left group">
                <p className="text-lg font-bold text-navy-900">{formatNaira(allowance)}</p>
                <Pencil size={12} className="text-surface-400 group-hover:text-primary-600" />
              </button>
            )}
          </div>
          {stats.map(s => (
            <div key={s.label} className="card p-4">
              <p className="text-xs text-surface-500 mb-1">{s.label}</p>
              <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Plan Update */}
        {planUpdate?.triggered && (
          <button onClick={() => navigate('/adaptive')} className="w-full text-left bg-amber-50 border border-amber-200 rounded-2xl p-5 flex items-center gap-3">
            <div className="w-7 h-7 bg-amber-400 rounded-full flex items-center justify-center shrink-0">
              <AlertCircle size={16} className="text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-bold tracking-wider text-amber-700 uppercase">Plan update</p>
              <p className="font-bold text-navy-900 text-sm mt-0.5 truncate">An unexpected expense changed your budget</p>
            </div>
            <ChevronRight size={16} className="text-amber-700 shrink-0" />
          </button>
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

        {/* Adaptive budgeting */}
        <button onClick={() => navigate('/adaptive')} className="card p-4 w-full flex items-center gap-3 text-left active:scale-[0.99] transition-transform">
          <div className="w-10 h-10 bg-primary-50 rounded-xl flex items-center justify-center shrink-0"><RefreshCw size={17} className="text-primary-600" /></div>
          <div className="flex-1">
            <p className="font-semibold text-sm text-navy-900">Adaptive budgeting</p>
            <p className="text-xs text-surface-500">Recover from an unexpected expense without starting over</p>
          </div>
          <ChevronRight size={16} className="text-surface-500" />
        </button>

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
