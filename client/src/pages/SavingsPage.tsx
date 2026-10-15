import { useMemo, useState, useEffect } from 'react';
import { useStore, STREAK_MILESTONES } from '../context/store';
import Header from '../components/Header';
import { formatNaira, formatDateShort, nairaToKobo } from '../utils';
import { Plus, Minus, Percent, Wifi, Cloud, Flame, Sparkles, Pause, Play, Trash2, ChevronRight, ArrowUpCircle, RefreshCw, Settings } from 'lucide-react';
import { roundUp } from '../services/api';

export default function SavingsPage() {
  const { savingsGoals, getStreak, inflationRate, setInflationRate, addSavingsGoal, addToSavingsGoal, updateSavingsGoal, deleteSavingsGoal } = useStore();
  const streakView = getStreak();
  const [showAdd, setShowAdd] = useState(false);
  const [contributeId, setContributeId] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [form, setForm] = useState({ name: '', targetAmount: '', contributionPerCycle: '', targetDate: '' });

  const [roundUpEnabled, setRoundUpEnabled] = useState(false);
  const [roundUpTo, setRoundUpTo] = useState(50);
  const [roundUpThreshold, setRoundUpThreshold] = useState(500);
  const [accrued, setAccrued] = useState(0);
  const [recentEntries, setRecentEntries] = useState<any[]>([]);
  const [calculating, setCalculating] = useState(false);
  const [sweeping, setSweeping] = useState(false);
  const [roundUpError, setRoundUpError] = useState<string | null>(null);

  useEffect(() => {
    roundUp.getStatus().then(data => {
      setRoundUpEnabled(data.settings?.enabled || false);
      setRoundUpTo(data.settings?.roundUpTo || 50);
      setRoundUpThreshold(data.settings?.threshold || 500);
      setAccrued(data.accrued || 0);
      setRecentEntries(data.recentEntries || []);
    }).catch(() => {});
  }, []);

  const totalSaved = savingsGoals.reduce((s, g) => s + g.currentAmountInKobo, 0);
  const totalTarget = savingsGoals.reduce((s, g) => s + g.targetAmountInKobo, 0);

  const last30 = useMemo(() => {
    const hit = new Set(streakView.dates);
    const today = new Date();
    return Array.from({ length: 30 }, (_, i) => {
      const back = 29 - i;
      const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - back);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      return { key, label: d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric' }), isHit: hit.has(key), isToday: back === 0 };
    });
  }, [streakView.dates]);

  const projectedCost = (goal: typeof savingsGoals[number]) => {
    if (!goal.targetDate) return null;
    const years = (new Date(goal.targetDate).getTime() - Date.now()) / (365 * 86400000);
    if (years < 0.1) return null;
    return goal.targetAmountInKobo * Math.pow(1 + inflationRate / 100, years);
  };

  const handleAdd = () => {
    if (!form.name || !form.targetAmount) return;
    addSavingsGoal({
      userId: 'user', name: form.name, targetAmountInKobo: nairaToKobo(Number(form.targetAmount)), currentAmountInKobo: 0,
      targetDate: form.targetDate || undefined, contributionPerCycleInKobo: nairaToKobo(Number(form.contributionPerCycle)) || 100000,
      contributionFrequency: 'monthly', isPaused: false,
    });
    setForm({ name: '', targetAmount: '', contributionPerCycle: '', targetDate: '' });
    setShowAdd(false);
  };

  const handleContribute = (id: string) => {
    const n = Number(amount);
    if (n > 0) { addToSavingsGoal(id, nairaToKobo(n)); setAmount(''); setContributeId(null); }
  };

  const handleToggleRoundUp = async (enabled: boolean) => {
    setRoundUpError(null);
    try {
      const data = await roundUp.updateSettings({ enabled });
      setRoundUpEnabled(data.enabled);
    } catch (e: any) {
      setRoundUpError(e.message || 'Could not update settings');
    }
  };

  const handleUpdateRoundUpSettings = async () => {
    setRoundUpError(null);
    try {
      const data = await roundUp.updateSettings({ roundUpTo, threshold: roundUpThreshold });
      setRoundUpTo(data.roundUpTo);
      setRoundUpThreshold(data.threshold);
    } catch (e: any) {
      setRoundUpError(e.message || 'Could not update settings');
    }
  };

  const handleCalculate = async () => {
    setRoundUpError(null);
    setCalculating(true);
    try {
      const data = await roundUp.calculate();
      setAccrued(prev => prev + data.totalSpareChange);
      const status = await roundUp.getStatus();
      setRecentEntries(status.recentEntries || []);
    } catch (e: any) {
      setRoundUpError(e.message || 'Could not calculate spare change');
    } finally {
      setCalculating(false);
    }
  };

  const handleSweep = async () => {
    setRoundUpError(null);
    setSweeping(true);
    try {
      await roundUp.sweep();
      const status = await roundUp.getStatus();
      setAccrued(status.accrued || 0);
      setRecentEntries(status.recentEntries || []);
    } catch (e: any) {
      setRoundUpError(e.message || 'Sweep failed');
    } finally {
      setSweeping(false);
    }
  };

  const goalIcon = (i: number) => i % 2 === 0 ? Wifi : Cloud;

  return (
    <div>
      <Header title="Savings Goals" showBack />

      <div className="px-5 pt-5 space-y-5 lg:px-10 lg:pt-10">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[11px] font-semibold tracking-wider text-primary-600 uppercase mb-1">Your goals</p>
            <h1 className="text-2xl font-bold text-navy-900 lg:text-3xl">Small steps still move you forward.</h1>
            <p className="text-sm text-surface-500 mt-1 lg:text-base">Adjust, pause, or skip anytime. Your progress stays yours.</p>
          </div>
          <button onClick={() => setShowAdd(!showAdd)} className="w-10 h-10 bg-gradient-to-br from-primary-500 to-primary-700 rounded-xl flex items-center justify-center shadow-lg active:scale-95 transition-transform shrink-0 hover:scale-105">
            <Plus size={18} className="text-white" />
          </button>
        </div>

        {/* Streak + total + inflation assumption */}
        <div className="grid gap-3 lg:grid-cols-3">
          <div className="grid grid-cols-2 gap-3 lg:col-span-2">
            <div className="card p-4">
              <p className="text-xs text-surface-500 mb-1">Total saved</p>
              <p className="text-lg font-bold text-navy-900">{formatNaira(totalSaved)}</p>
              <div className="h-1.5 bg-surface-100 rounded-full mt-2 overflow-hidden">
                <div className="h-full bg-primary-500 rounded-full" style={{ width: `${totalTarget ? (totalSaved / totalTarget) * 100 : 0}%` }} />
              </div>
            </div>
            <button onClick={() => document.getElementById('streak-card')?.scrollIntoView({ behavior: 'smooth', block: 'center' })} className="card p-4 flex items-center gap-3 text-left active:scale-[0.99] transition-transform">
              <span className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center shrink-0">
                <Flame size={19} className="text-amber-500" />
              </span>
              <span className="min-w-0">
                <span className="block text-lg font-bold text-navy-900 leading-tight">{streakView.current}</span>
                <span className="block text-xs text-surface-500">day streak<span className="hidden sm:inline"> · best {streakView.longest}</span></span>
              </span>
              <ChevronRight size={16} className="text-surface-300 ml-auto shrink-0" />
            </button>
          </div>

          <div className="card p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center shrink-0">
                <Percent size={16} className="text-amber-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-navy-900">Prices rise by</p>
                <p className="text-[11px] text-surface-500">Your own guess — not an official forecast.</p>
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
        </div>

        {/* Streak detail */}
        <div id="streak-card" className="card p-5">
          <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3 mb-4">
            <div className="flex-1 min-w-[190px]">
              <p className="text-[11px] font-semibold tracking-wider text-amber-600 uppercase mb-1">Saving streak</p>
              <h3 className="font-bold text-navy-900">
                {streakView.current > 0
                  ? `${streakView.current} day${streakView.current === 1 ? '' : 's'} in a row`
                  : 'No streak running'}
              </h3>
              <p className="text-xs text-surface-500 mt-0.5">
                {streakView.current > 0
                  ? (streakView.activeToday
                    ? 'Today is covered. Add to any goal tomorrow to keep it going.'
                    : 'Add something to a goal today before midnight to keep it alive.')
                  : streakView.dates.length
                    ? `Your last saving day was ${streakView.daysSinceLast} day${streakView.daysSinceLast === 1 ? '' : 's'} ago. Start again with any amount.`
                    : 'Save anything, any day, and the count starts.'}
              </p>
            </div>
            <div className="flex gap-5 shrink-0 text-right">
              {[
                { value: streakView.current, label: 'current' },
                { value: streakView.longest, label: 'longest' },
                { value: streakView.daysSinceLast ?? '—', label: 'days idle' },
              ].map(s => (
                <div key={s.label}>
                  <p className="text-xl font-bold text-navy-900">{s.value}</p>
                  <p className="text-[10px] text-surface-500 uppercase tracking-wider">{s.label}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_260px] lg:gap-8">
            <div className="mb-5">
              <p className="text-[10px] uppercase tracking-wider text-surface-500 mb-1.5">Last 30 days</p>
              <div className="grid grid-cols-10 gap-1.5 max-w-md">
                {last30.map(d => (
                  <span
                    key={d.key}
                    title={`${d.label}${d.isHit ? ' · saved' : ''}`}
                    aria-label={`${d.label}, ${d.isHit ? 'contribution recorded' : 'no contribution'}`}
                    className={`aspect-square rounded-md ${d.isHit ? 'bg-amber-400' : 'bg-surface-100'} ${d.isToday ? 'ring-2 ring-navy-800 ring-offset-1' : ''}`}
                  />
                ))}
              </div>
            </div>

            {streakView.next && (
              <div className="mb-4 lg:mb-0">
                <p className="text-[10px] uppercase tracking-wider text-surface-500 mb-1.5">Next milestone</p>
                <p className="text-sm font-semibold text-navy-900">{streakView.next.label} · {streakView.next.days} days</p>
                <div className="h-2 bg-surface-100 rounded-full overflow-hidden mt-2">
                  <div className="h-full bg-amber-400 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, Math.round((streakView.longest / streakView.next.days) * 100))}%` }} />
                </div>
                <p className="text-xs text-surface-500 mt-1.5">
                  {streakView.next.remaining} more {streakView.next.remaining === 1 ? 'day' : 'days'} to go. {streakView.next.note}
                </p>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between mb-1.5">
            <p className="text-[10px] uppercase tracking-wider text-surface-500">Milestones</p>
            <p className="text-[10px] text-surface-500">{streakView.reached.length} of {STREAK_MILESTONES.length} reached</p>
          </div>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            {STREAK_MILESTONES.map(m => {
              const earned = streakView.longest >= m.days;
              return (
                <div key={m.days} title={m.note} className={`rounded-xl border p-2.5 text-center ${earned ? 'border-amber-200 bg-amber-50' : 'border-surface-200 bg-surface-50'}`}>
                  <p className={`text-sm font-bold ${earned ? 'text-amber-600' : 'text-surface-500'}`}>{m.days}</p>
                  <p className="text-[10px] leading-tight mt-0.5 text-surface-500">{m.label}</p>
                </div>
              );
            })}
          </div>
          <p className="text-[11px] text-surface-500 mt-3">
            Streaks count days you added money to a goal — one step per day, whatever the size. They are progress markers, not prizes: nothing is paid out and no data leaves this device.
          </p>
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
        <div className="space-y-4 lg:grid lg:grid-cols-2 lg:gap-5 lg:items-start lg:space-y-0">
          {savingsGoals.map((goal, i) => {
            const Icon = goalIcon(i);
            const isTinted = i % 2 === 0;
            const projected = projectedCost(goal);
            const gapToTarget = (projected ?? goal.targetAmountInKobo) - goal.currentAmountInKobo;
            const cycleDays = { daily: 1, weekly: 7, monthly: 30.44 }[goal.contributionFrequency];
            const cycleName = goal.contributionFrequency;
            const cyclesLeft = goal.targetDate
              ? Math.max(1, Math.ceil((new Date(goal.targetDate).getTime() - Date.now()) / (cycleDays * 86400000)))
              : null;
            const neededPerCycle = cyclesLeft && gapToTarget > 0 ? Math.ceil(gapToTarget / cyclesLeft / 50) * 50 : null;
            const behindPlan = neededPerCycle !== null && neededPerCycle > goal.contributionPerCycleInKobo;
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
                  <b className="text-navy-900 text-base">{formatNaira(goal.currentAmountInKobo)}</b>
                  <span className="text-surface-500"> of {formatNaira(goal.targetAmountInKobo)}</span>
                </p>

                {/* Inflation-aware target */}
                {projected !== null && goal.targetDate && (
                  <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 mb-4">
                    <p className="text-xs text-amber-900">
                      At {inflationRate}%/yr this may cost <b>{formatNaira(Math.round(projected))}</b> by {formatDateShort(goal.targetDate)} —{' '}
                      {projected > goal.currentAmountInKobo
                        ? <>roughly <b>{formatNaira(Math.round(projected - goal.currentAmountInKobo))}</b> more than you have saved.</>
                        : 'you are covered even if prices rise.'}
                    </p>
                  </div>
                )}

                {/* Pace check, from this goal's own numbers */}
                {behindPlan && goal.targetDate && (
                  <div className="bg-primary-50 rounded-xl p-3 mb-4 flex gap-2">
                    <Sparkles size={15} className="text-primary-600 shrink-0 mt-0.5" />
                    <p className="text-xs text-primary-800">
                      Reaching this by {formatDateShort(goal.targetDate)} needs roughly{' '}
                      <b>{formatNaira(neededPerCycle!)}</b> per {cycleName} cycle for the {cyclesLeft} left{' '}
                      — <b>{formatNaira(neededPerCycle! - goal.contributionPerCycleInKobo)}</b> above your current {formatNaira(goal.contributionPerCycleInKobo)}.
                    </p>
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
                    <button onClick={() => updateSavingsGoal(goal.id, { contributionPerCycleInKobo: Math.max(0, goal.contributionPerCycleInKobo - 50000) })} className="btn-secondary flex-1 text-sm py-2.5">Adjust</button>
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

        {/* Round-Up Savings */}
        <div className="card p-5 lg:col-span-2">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-violet-50 rounded-xl flex items-center justify-center shrink-0">
                <ArrowUpCircle size={20} className="text-violet-600" />
              </div>
              <div>
                <h3 className="font-bold text-navy-900">Round-Up Savings</h3>
                <p className="text-xs text-surface-500 mt-0.5">Round up expenses, save the spare change automatically.</p>
              </div>
            </div>
            <button
              onClick={() => handleToggleRoundUp(!roundUpEnabled)}
              className={`relative w-12 h-7 rounded-full transition-colors ${roundUpEnabled ? 'bg-violet-600' : 'bg-surface-200'}`}
              aria-label={roundUpEnabled ? 'Disable round-up' : 'Enable round-up'}
            >
              <span className={`absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform ${roundUpEnabled ? 'translate-x-5' : ''}`} />
            </button>
          </div>

          {roundUpError && (
            <div className="bg-red-50 border border-red-100 rounded-xl p-3 mb-4">
              <p className="text-xs text-red-800">{roundUpError}</p>
            </div>
          )}

          {roundUpEnabled ? (
            <div className="space-y-4">
              <div className="bg-violet-50 rounded-xl p-4">
                <p className="text-xs text-violet-700 mb-1">Accrued spare change</p>
                <p className="text-2xl font-bold text-violet-900">{formatNaira(accrued)}</p>
                <p className="text-[11px] text-violet-600 mt-1">
                  Threshold: {formatNaira(roundUpThreshold)} · Sweeps when accrued reaches threshold
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-navy-900 mb-1.5 block">Round up to nearest</label>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setRoundUpTo(Math.max(10, roundUpTo - 10))} className="w-8 h-8 rounded-lg bg-surface-100 flex items-center justify-center active:scale-95 transition-transform">
                      <Minus size={14} className="text-navy-800" />
                    </button>
                    <span className="w-16 text-center text-sm font-bold text-navy-900">{formatNaira(roundUpTo)}</span>
                    <button onClick={() => setRoundUpTo(roundUpTo + 10)} className="w-8 h-8 rounded-lg bg-surface-100 flex items-center justify-center active:scale-95 transition-transform">
                      <Plus size={14} className="text-navy-800" />
                    </button>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-navy-900 mb-1.5 block">Sweep threshold</label>
                  <div className="flex items-center gap-2">
                    <button onClick={() => setRoundUpThreshold(Math.max(100, roundUpThreshold - 100))} className="w-8 h-8 rounded-lg bg-surface-100 flex items-center justify-center active:scale-95 transition-transform">
                      <Minus size={14} className="text-navy-800" />
                    </button>
                    <span className="w-16 text-center text-sm font-bold text-navy-900">{formatNaira(roundUpThreshold)}</span>
                    <button onClick={() => setRoundUpThreshold(roundUpThreshold + 100)} className="w-8 h-8 rounded-lg bg-surface-100 flex items-center justify-center active:scale-95 transition-transform">
                      <Plus size={14} className="text-navy-800" />
                    </button>
                  </div>
                </div>
              </div>

              <button onClick={handleUpdateRoundUpSettings} className="btn-secondary w-full text-sm py-2.5 flex items-center justify-center gap-2">
                <Settings size={14} /> Save settings
              </button>

              <div className="flex gap-2">
                <button onClick={handleCalculate} disabled={calculating} className="btn-secondary flex-1 text-sm py-2.5 flex items-center justify-center gap-2 disabled:opacity-50">
                  <RefreshCw size={14} className={calculating ? 'animate-spin' : ''} />
                  {calculating ? 'Calculating...' : 'Calculate spare change'}
                </button>
                <button
                  onClick={handleSweep}
                  disabled={sweeping || accrued < roundUpThreshold}
                  className="btn-primary flex-1 text-sm py-2.5 flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <ArrowUpCircle size={14} />
                  {sweeping ? 'Sweeping...' : 'Sweep to wallet'}
                </button>
              </div>

              {accrued < roundUpThreshold && (
                <p className="text-[11px] text-surface-500 text-center">
                  Need {formatNaira(roundUpThreshold - accrued)} more to sweep
                </p>
              )}

              {recentEntries.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-navy-900 mb-2">Recent round-ups</p>
                  <div className="space-y-1.5 max-h-40 overflow-y-auto">
                    {recentEntries.slice(0, 5).map(entry => (
                      <div key={entry.id} className="flex items-center justify-between text-xs py-1.5 border-b border-surface-100 last:border-0">
                        <span className="text-surface-600">{formatNaira(entry.originalAmount)} → {formatNaira(entry.roundedUp)}</span>
                        <span className="font-semibold text-violet-600">+{formatNaira(entry.spareChange)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="bg-surface-50 rounded-xl p-3 mt-4">
                <p className="text-[11px] text-surface-600 leading-relaxed">
                  <b>How it works:</b> Each expense is rounded up to the nearest increment. The spare change accrues until it reaches your threshold, then sweeps into your B Moni smart wallet via exchange + transfer. Requires a deployed smart wallet and B Moni identity.
                </p>
              </div>
            </div>
          ) : (
            <div className="text-center py-6">
              <p className="text-sm text-surface-500 mb-3">Enable round-up to start saving spare change from every expense.</p>
              <button onClick={() => handleToggleRoundUp(true)} className="btn-primary text-sm px-6">
                Enable Round-Up
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
