import { useState } from 'react';
import { useStore } from '../context/store';
import Header from '../components/Header';
import { formatNaira, formatDateShort } from '../utils';
import { Plus, Minus, Percent, Wifi, Cloud, Sparkles, Pause, Play, Trash2 } from 'lucide-react';

export default function SavingsPage() {
  const { savingsGoals, streak, inflationRate, setInflationRate, addSavingsGoal, addToSavingsGoal, updateSavingsGoal, deleteSavingsGoal } = useStore();
  const [showAdd, setShowAdd] = useState(false);
  const [contributeId, setContributeId] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [form, setForm] = useState({ name: '', targetAmount: '', contributionPerCycle: '', targetDate: '' });

  const totalSaved = savingsGoals.reduce((s, g) => s + g.currentAmount, 0);
  const totalTarget = savingsGoals.reduce((s, g) => s + g.targetAmount, 0);

  const projectedCost = (goal: typeof savingsGoals[number]) => {
    if (!goal.targetDate) return null;
    const years = (new Date(goal.targetDate).getTime() - Date.now()) / (365 * 86400000);
    if (years < 0.1) return null;
    return goal.targetAmount * Math.pow(1 + inflationRate / 100, years);
  };

  const handleAdd = () => {
    if (!form.name || !form.targetAmount) return;
    addSavingsGoal({
      userId: 'user', name: form.name, targetAmount: Number(form.targetAmount), currentAmount: 0,
      targetDate: form.targetDate || undefined, contributionPerCycle: Number(form.contributionPerCycle) || 1000,
      contributionFrequency: 'monthly', isPaused: false,
    });
    setForm({ name: '', targetAmount: '', contributionPerCycle: '', targetDate: '' });
    setShowAdd(false);
  };

  const handleContribute = (id: string) => {
    const n = Number(amount);
    if (n > 0) { addToSavingsGoal(id, n); setAmount(''); setContributeId(null); }
  };

  const goalIcon = (i: number) => i % 2 === 0 ? Wifi : Cloud;

  return (
    <div>
      <Header title="Savings Goals" />

      <div className="px-5 pt-5 space-y-5">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[11px] font-semibold tracking-wider text-primary-600 uppercase mb-1">Your goals</p>
            <h1 className="text-2xl font-bold text-navy-900">Small steps still move you forward.</h1>
            <p className="text-sm text-surface-500 mt-0.5">Adjust, pause, or skip anytime. Your progress stays yours.</p>
          </div>
          <button onClick={() => setShowAdd(!showAdd)} className="w-10 h-10 bg-primary-600 rounded-xl flex items-center justify-center shadow-card active:scale-95 transition-transform shrink-0">
            <Plus size={18} className="text-white" />
          </button>
        </div>

        {/* Streak + total */}
        <div className="grid grid-cols-2 gap-3">
          <div className="card p-4">
            <p className="text-xs text-surface-500 mb-1">Total saved</p>
            <p className="text-lg font-bold text-navy-900">{formatNaira(totalSaved)}</p>
            <div className="h-1.5 bg-surface-100 rounded-full mt-2 overflow-hidden">
              <div className="h-full bg-primary-500 rounded-full" style={{ width: `${totalTarget ? (totalSaved / totalTarget) * 100 : 0}%` }} />
            </div>
          </div>
          <div className="card p-4 flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center">
              <span className="text-lg">🔥</span>
            </div>
            <div>
              <p className="text-lg font-bold text-navy-900">{streak.currentStreak}</p>
              <p className="text-xs text-surface-500">day streak</p>
            </div>
          </div>
        </div>

        {/* Inflation assumption */}
        <div className="card p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center shrink-0">
              <Percent size={16} className="text-amber-600" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-navy-900">Prices rise by</p>
              <p className="text-[11px] text-surface-500">Your own guess about the things you save for — not an official forecast.</p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button onClick={() => setInflationRate(inflationRate - 1)} aria-label="Lower price-rise assumption" className="w-8 h-8 rounded-lg bg-surface-100 flex items-center justify-center active:scale-95 transition-transform">
                <Minus size={14} className="text-navy-800" />
              </button>
              <span className="w-12 text-center text-sm font-bold text-navy-900">{inflationRate}%/yr</span>
              <button onClick={() => setInflationRate(inflationRate + 1)} aria-label="Raise price-rise assumption" className="w-8 h-8 rounded-lg bg-surface-100 flex items-center justify-center active:scale-95 transition-transform">
                <Plus size={14} className="text-navy-800" />
              </button>
            </div>
          </div>
        </div>

        {/* Add form */}
        {showAdd && (
          <div className="card p-4 space-y-3 animate-slide-up">
            <h3 className="font-bold text-navy-900">New savings goal</h3>
            <input type="text" placeholder="Goal name (e.g. New phone)" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input-field text-sm" />
            <div className="grid grid-cols-2 gap-3">
              <input type="number" placeholder="Target (₦)" value={form.targetAmount} onChange={(e) => setForm({ ...form, targetAmount: e.target.value })} className="input-field text-sm" />
              <input type="number" placeholder="Per cycle (₦)" value={form.contributionPerCycle} onChange={(e) => setForm({ ...form, contributionPerCycle: e.target.value })} className="input-field text-sm" />
            </div>
            <input type="date" value={form.targetDate} onChange={(e) => setForm({ ...form, targetDate: e.target.value })} className="input-field text-sm" />
            <div className="flex gap-2">
              <button onClick={handleAdd} className="btn-primary flex-1 text-sm py-2.5">Create goal</button>
              <button onClick={() => setShowAdd(false)} className="btn-ghost text-sm">Cancel</button>
            </div>
          </div>
        )}

        {/* Goals */}
        <div className="space-y-4">
          {savingsGoals.map((goal, i) => {
            const Icon = goalIcon(i);
            const isTinted = i % 2 === 0;
            const projected = projectedCost(goal);
            return (
              <div key={goal.id} className="card p-5">
                <div className={`h-20 rounded-xl mb-4 flex items-center justify-center ${isTinted ? 'bg-primary-50' : 'bg-emerald-50'}`}>
                  <Icon size={26} className={isTinted ? 'text-primary-400' : 'text-emerald-400'} />
                </div>
                <div className="flex items-start justify-between mb-1">
                  <h3 className="font-bold text-navy-900">{goal.name}</h3>
                  <span className="font-bold text-primary-600">{Math.round(goal.progress)}%</span>
                </div>
                <p className="text-xs text-surface-500 mb-3">Target · {goal.targetDate ? formatDateShort(goal.targetDate) : 'Flexible'}</p>
                <div className="h-2 bg-surface-100 rounded-full overflow-hidden mb-2">
                  <div className="h-full bg-emerald-500 rounded-full transition-all duration-500" style={{ width: `${goal.progress}%` }} />
                </div>
                <p className="text-sm mb-4">
                  <b className="text-navy-900 text-base">{formatNaira(goal.currentAmount)}</b>
                  <span className="text-surface-500"> of {formatNaira(goal.targetAmount)}</span>
                </p>

                {/* Inflation-aware target */}
                {projected !== null && goal.targetDate && (
                  <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 mb-4">
                    <p className="text-xs text-amber-900">
                      At {inflationRate}%/yr this may cost <b>{formatNaira(Math.round(projected))}</b> by {formatDateShort(goal.targetDate)} —{' '}
                      {projected > goal.currentAmount
                        ? <>roughly <b>{formatNaira(Math.round(projected - goal.currentAmount))}</b> more than you have saved.</>
                        : 'you are covered even if prices rise.'}
                    </p>
                  </div>
                )}

                {/* Adaptive insight */}
                {goal.name.toLowerCase().includes('laptop') && (
                  <div className="bg-primary-50 rounded-xl p-3 mb-4 flex gap-2">
                    <Sparkles size={15} className="text-primary-600 shrink-0 mt-0.5" />
                    <p className="text-xs text-primary-800">Your expenses increased. Save ₦1,000 instead of ₦2,000 this week and stay on track for December.</p>
                  </div>
                )}

                {contributeId === goal.id ? (
                  <div className="flex gap-2 mb-1">
                    <input type="number" placeholder="Amount" value={amount} onChange={(e) => setAmount(e.target.value)} className="input-field text-sm py-2" autoFocus />
                    <button onClick={() => handleContribute(goal.id)} className="btn-primary text-sm px-4">Add</button>
                    <button onClick={() => setContributeId(null)} className="btn-ghost text-sm">✕</button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <button onClick={() => updateSavingsGoal(goal.id, { contributionPerCycle: Math.max(0, goal.contributionPerCycle - 500) })} className="btn-secondary flex-1 text-sm py-2.5">Adjust</button>
                    <button onClick={() => setContributeId(goal.id)} className="btn-primary flex-1 text-sm py-2.5">Add money</button>
                  </div>
                )}

                <div className="flex items-center gap-3 mt-3 pt-3 border-t border-surface-100">
                  <button onClick={() => updateSavingsGoal(goal.id, { isPaused: !goal.isPaused })} className="text-xs text-surface-500 flex items-center gap-1">
                    {goal.isPaused ? <Play size={12} /> : <Pause size={12} />} {goal.isPaused ? 'Resume' : 'Pause'}
                  </button>
                  <button onClick={() => deleteSavingsGoal(goal.id)} className="text-xs text-red-500 flex items-center gap-1 ml-auto">
                    <Trash2 size={12} /> Delete
                  </button>
                </div>
              </div>
            );
          })}

          {savingsGoals.length === 0 && !showAdd && (
            <div className="card p-10 text-center">
              <Cloud size={32} className="text-surface-300 mx-auto mb-3" />
              <p className="text-surface-500 text-sm">No goals yet. Create one to start saving.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
