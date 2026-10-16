import { useState } from 'react';
import { useStore, cycleWindowOf } from '../context/store';
import { formatNaira, formatDateShort, nairaToKobo } from '../utils';
import Header from '../components/Header';
import { RotateCcw, AlertTriangle, TrendingDown, Clock, PiggyBank, Zap, Lightbulb } from 'lucide-react';

interface Simulation {
  description: string;
  amount: number;
  category: string;
}

interface Alternative {
  title: string;
  note: string;
}

type Kind = 'spend' | 'save' | 'delay';

export default function WhatIfPage() {
  const { getSafeToSpend, categoryBudgets, user } = useStore();
  const [customName, setCustomName] = useState('');
  const [customAmount, setCustomAmount] = useState('');
  const [simulation, setSimulation] = useState<null | {
    description: string;
    amountInKobo: number;
    newBalance: number;
    newDailyLimitInKobo: number;
    impactOnSavings: string;
    riskLevel: 'low' | 'medium' | 'high';
    tradeoffs: string[];
    alternatives: Alternative[];
    recommendation: string;
  }>(null);

  const safe = getSafeToSpend();
  const nextIncome = cycleWindowOf(user).nextIncome;
  const nextIncomeLabel = nextIncome ? formatDateShort(nextIncome.toISOString()) : 'your next income';

  const presets: Simulation[] = [
    { description: 'Spend ₦2,000 extra on food', amount: 200000, category: 'food' },
    { description: 'Buy headphones for ₦15,000', amount: 1500000, category: 'shopping' },
    { description: 'Unexpected transport cost of ₦3,000', amount: 300000, category: 'transport' },
    { description: 'Move ₦1,000 into savings this week', amount: -100000, category: 'savings' },
    { description: 'Pay an unexpected ₦5,000 bill', amount: 500000, category: 'obligations' },
    { description: 'My next income is delayed by 7 days', amount: 0, category: 'delay' },
  ];

  /** Concrete ways to still make the scenario work, built from this user's own numbers. */
  const buildAlternatives = (kind: Kind, amountInKobo: number): Alternative[] => {
    const alts: Alternative[] = [];
    if (kind === 'delay') {
      const perDay = safe.unallocatedInKobo / Math.max(1, safe.daysUntilNextIncome + 7);
      alts.push({ title: 'Cut the daily guide instead of the plan', note: `${formatNaira(Math.floor(perDay))} a day keeps every category alive for the longer wait.` });
      const enjoyment = categoryBudgets.filter(cb => cb.bucket === 'enjoyment').reduce((s, cb) => s + Math.max(0, cb.allocatedInKobo - cb.spentInKobo), 0);
      if (enjoyment > 0) alts.push({ title: 'Hold enjoyment back', note: `${formatNaira(enjoyment)} is still unspent in the fun categories — release it only when the money lands.` });
      if (safe.reservedSavingsInKobo > 0) alts.push({ title: 'Pause this cycle\u2019s contributions', note: `That frees ${formatNaira(safe.reservedSavingsInKobo)} for the days you have to cover.` });
      return alts.slice(0, 3);
    }

    const wanted = Math.abs(amountInKobo);
    const donors = categoryBudgets
      .map(cb => ({ ...cb, roomInKobo: cb.allocatedInKobo - cb.spentInKobo }))
      .filter(cb => cb.roomInKobo > 0)
      .sort((a, b) => b.roomInKobo - a.roomInKobo);
    const full = donors.find(cb => cb.roomInKobo >= wanted);
    const donor = full || donors[0];
    if (donor) {
      alts.push({
        title: `Take it from ${donor.name}`,
        note: full
          ? `${formatNaira(donor.roomInKobo)} is still unspent there, so this fits without touching savings.`
          : `${formatNaira(donor.roomInKobo)} is unspent there — ${Math.round((donor.roomInKobo / wanted) * 100)}% of what you need, the rest has to come from your daily guide.`,
      });
    }
    const days = safe.dailyLimitInKobo > 0 ? Math.ceil(wanted / safe.dailyLimitInKobo) : 0;
    if (days > 1 && days <= safe.daysUntilNextIncome) {
      alts.push({ title: `Spread it over ${days} days`, note: `${formatNaira(Math.ceil(wanted / days))} a day for ${days} days instead of one hit today.` });
    }
    if (safe.reservedSavingsInKobo >= wanted) {
      alts.push({ title: 'Borrow from one contribution', note: `Your goals are set aside ${formatNaira(safe.reservedSavingsInKobo)} this cycle — skipping the smallest one covers it, then make it up after ${nextIncomeLabel}.` });
    } else if (safe.reservedSavingsInKobo > 0) {
      alts.push({ title: 'Reduce every contribution', note: `${formatNaira(safe.reservedSavingsInKobo)} is earmarked for goals this cycle — trimming it leaves ${formatNaira(Math.max(0, wanted - safe.reservedSavingsInKobo))} to find elsewhere.` });
    }
    if (wanted > safe.unallocatedInKobo && safe.daysUntilNextIncome > 0) {
      alts.push({ title: 'Split it across cycles', note: `Pay ${formatNaira(Math.floor(safe.unallocatedInKobo / 2) * 2)} now and the rest after ${nextIncomeLabel}.` });
    }
    return alts.slice(0, 3);
  };

  const runSimulation = (sim: Simulation) => {
    const kind: Kind = sim.category === 'delay' ? 'delay' : sim.amount < 0 ? 'save' : 'spend';
    let newBalance = safe.unallocatedInKobo;
    let newDailyLimit = safe.dailyLimitInKobo;
    let riskLevel: 'low' | 'medium' | 'high' = 'low';
    const tradeoffs: string[] = [];
    let recommendation = '';
    let impactOnSavings = 'No effect on your savings contributions.';

    if (kind === 'delay') {
      const extendedDays = safe.daysUntilNextIncome + 7;
      newDailyLimit = safe.unallocatedInKobo / Math.max(1, extendedDays);
      riskLevel = 'high';
      tradeoffs.push(`Your guide drops from ${formatNaira(safe.dailyLimitInKobo)} to ${formatNaira(newDailyLimit)} per day.`);
      tradeoffs.push('Enjoyment spending is the first thing to cut here.');
      recommendation = `Stretch what you have across ${extendedDays} days. Focus on food, transport and data only, and tell your coach so it can re-plan your goals.`;
      impactOnSavings = 'Contributions should be paused until income lands.';
    } else if (kind === 'save') {
      newBalance = safe.unallocatedInKobo + Math.abs(sim.amount);
      newDailyLimit = newBalance / Math.max(1, safe.daysUntilNextIncome);
      riskLevel = 'low';
      recommendation = `You'd still keep a ${formatNaira(newDailyLimit)} daily guide after setting ${formatNaira(Math.abs(sim.amount))} aside.`;
      impactOnSavings = `Your goals get ${formatNaira(Math.abs(sim.amount))} closer this cycle.`;
    } else {
      newBalance = safe.unallocatedInKobo - sim.amount;
      newDailyLimit = Math.max(0, newBalance / Math.max(1, safe.daysUntilNextIncome));

      if (newBalance < 0) {
        riskLevel = 'high';
        tradeoffs.push(`You'd be short by ${formatNaira(Math.abs(newBalance))}.`);
        tradeoffs.push('Covering it means dipping into reserved savings or obligations.');
        recommendation = 'Not advisable this cycle as it stands — the options below are the ways to still make it happen.';
      } else if (newBalance < safe.unallocatedInKobo * 0.2) {
        riskLevel = 'medium';
        tradeoffs.push('Very little buffer is left for the rest of the period.');
        recommendation = `Possible but tight — only ${formatNaira(newBalance)} would remain across ${safe.daysUntilNextIncome} days.`;
      } else {
        riskLevel = 'low';
        recommendation = `This fits. You'd still have ${formatNaira(newBalance)} unallocated.`;
      }
      impactOnSavings = newBalance < safe.unallocatedInKobo * 0.3 ? 'You may need to skip one goal contribution.' : 'Savings contributions stay intact.';
    }

    setSimulation({
      description: sim.description,
      amountInKobo: Math.abs(sim.amount),
      newBalance: Math.max(0, newBalance),
      newDailyLimitInKobo: Math.max(0, newDailyLimit),
      impactOnSavings,
      riskLevel,
      tradeoffs,
      alternatives: buildAlternatives(kind, sim.amount),
      recommendation,
    });
  };

  const runCustom = () => {
    const amountInKobo = nairaToKobo(Number(customAmount) || 0);
    if (amountInKobo <= 0) return;
    const label = customName.trim();
    runSimulation({
      description: label ? `${label} — ${formatNaira(amountInKobo)}` : `Spend ${formatNaira(amountInKobo)}`,
      amount: amountInKobo,
      category: 'custom',
    });
  };

  const riskStyles = {
    low: 'border-l-emerald-500 text-emerald-700 bg-emerald-50',
    medium: 'border-l-amber-500 text-amber-700 bg-amber-50',
    high: 'border-l-red-500 text-red-700 bg-red-50',
  } as const;

  return (
    <>
      <Header title="What-If Simulator" />

      <div className="px-5 py-4 space-y-4 pb-8 lg:px-10 lg:grid lg:grid-cols-2 lg:gap-8 lg:space-y-0 lg:items-start">
        <div className="card p-4 bg-navy-800 border-navy-800 lg:col-span-2">
          <p className="text-[11px] font-medium text-primary-200 mb-1">Current unallocated money</p>
          <p className="text-2xl font-bold text-white">{formatNaira(safe.unallocatedInKobo)}</p>
          <p className="text-xs text-primary-200">{formatNaira(safe.dailyLimitInKobo)}/day · {safe.daysUntilNextIncome} days until next income</p>
        </div>

        <div className="lg:col-start-1 lg:row-start-2">
          <h3 className="font-semibold text-sm text-navy-900 mb-2">Try a scenario</h3>
          <div className="space-y-2">
            {presets.map((preset, i) => (
              <button
                key={i}
                onClick={() => runSimulation(preset)}
                className="card p-3 w-full text-left flex items-center gap-3 hover:bg-surface-50 transition-colors active:scale-[0.99]"
              >
                <div className="icon-tile bg-primary-50">
                  {preset.category === 'delay'
                    ? <Clock size={17} className="text-primary-600" />
                    : preset.amount < 0
                      ? <PiggyBank size={17} className="text-primary-600" />
                      : <TrendingDown size={17} className="text-primary-600" />}
                </div>
                <span className="text-sm font-medium text-navy-900 flex-1">{preset.description}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="card p-4 lg:col-start-1 lg:row-start-3">
          <h3 className="font-semibold text-sm text-navy-900 mb-2">Your own scenario</h3>
          <div className="space-y-2">
            <input
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              placeholder="What is it? e.g. Weekend trip to Abeokuta"
              aria-label="Name this scenario"
              className="input-field text-sm py-2.5 w-full"
            />
            <div className="flex gap-2">
              <div className="relative flex-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-300 font-semibold">₦</span>
                <input
                  type="number"
                  inputMode="decimal"
                  value={customAmount}
                  onChange={(e) => setCustomAmount(e.target.value)}
                  placeholder="Amount"
                  aria-label="Scenario amount in naira"
                  className="input-field pl-8 text-sm py-2.5 w-full"
                />
              </div>
              <button
                onClick={runCustom}
                disabled={!Number(customAmount)}
                className="btn-primary text-sm px-4 disabled:opacity-40"
              >
                Simulate
              </button>
            </div>
            {Number(customAmount) > 0 && (
              <p className="text-[11px] text-surface-500">
                Simulating {formatNaira(nairaToKobo(Number(customAmount)))} · {Math.round((nairaToKobo(Number(customAmount)) / Math.max(1, safe.dailyLimitInKobo)) * 10) / 10} days of your current guide
              </p>
            )}
          </div>
        </div>

        {simulation ? (
          <div className="animate-slide-up space-y-3 lg:col-start-2 lg:row-start-2 lg:row-span-2 lg:sticky lg:top-20">
            <div className={`card p-4 border-l-4 ${riskStyles[simulation.riskLevel].split(' ')[0]}`}>
              <div className="flex items-center gap-2 mb-2">
                <span className={`badge ${riskStyles[simulation.riskLevel].split(' ').slice(1).join(' ')}`}>
                  {simulation.riskLevel} risk
                </span>
                <span className="text-[11px] text-surface-500">Simulation only — nothing is changed</span>
              </div>
              <p className="text-sm font-semibold text-navy-900 mb-3">{simulation.description}</p>

              <div className="grid grid-cols-3 gap-2 mb-3">
                <div className="bg-surface-50 rounded-xl p-3">
                  <p className="text-[10px] text-surface-500">Scenario cost</p>
                  <p className="font-bold text-navy-900">{formatNaira(simulation.amountInKobo)}</p>
                </div>
                <div className="bg-surface-50 rounded-xl p-3">
                  <p className="text-[10px] text-surface-500">Unallocated left</p>
                  <p className="font-bold text-navy-900">{formatNaira(simulation.newBalance)}</p>
                </div>
                <div className="bg-surface-50 rounded-xl p-3">
                  <p className="text-[10px] text-surface-500">New daily guide</p>
                  <p className="font-bold text-navy-900">{formatNaira(simulation.newDailyLimitInKobo)}</p>
                </div>
              </div>

              <p className="text-xs text-surface-500 mb-2">{simulation.impactOnSavings}</p>

              {simulation.tradeoffs.length > 0 && (
                <ul className="space-y-1 mb-3">
                  {simulation.tradeoffs.map((t, i) => (
                    <li key={i} className="text-xs text-navy-800 flex items-start gap-1.5">
                      <AlertTriangle size={12} className="text-amber-600 mt-0.5 shrink-0" />{t}
                    </li>
                  ))}
                </ul>
              )}

              {simulation.alternatives.length > 0 && (
                <div className="mb-3">
                  <div className="flex items-center gap-1.5 mb-2">
                    <Lightbulb size={12} className="text-navy-700" />
                    <p className="text-[11px] font-semibold text-navy-800 uppercase tracking-wider">Ways to make it work</p>
                  </div>
                  <div className="space-y-2">
                    {simulation.alternatives.map((alt, i) => (
                      <div key={i} className="bg-surface-50 rounded-xl p-3">
                        <p className="text-xs font-semibold text-navy-900">{alt.title}</p>
                        <p className="text-[11px] text-surface-600 mt-0.5 leading-relaxed">{alt.note}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="bg-primary-50 rounded-xl p-3">
                <div className="flex items-center gap-1.5 mb-1">
                  <Zap size={12} className="text-primary-600" />
                  <p className="text-[11px] font-semibold text-primary-700">Recommendation</p>
                </div>
                <p className="text-xs text-primary-700 leading-relaxed">{simulation.recommendation}</p>
              </div>
            </div>

            <button onClick={() => setSimulation(null)} className="w-full btn-secondary text-sm py-2.5 flex items-center justify-center gap-2">
              <RotateCcw size={14} /> Reset simulator
            </button>
          </div>
        ) : (
          <div className="hidden lg:block card p-5 lg:col-start-2 lg:row-start-2 lg:row-span-2">
            <p className="text-sm font-bold text-navy-900 mb-2">Nothing has been changed</p>
            <p className="text-xs text-surface-500 leading-relaxed mb-4">
              Choose a scenario and this panel shows the new unallocated balance, the daily
              spending guide, the effect on your savings contributions and a recommendation.
            </p>
            <ul className="space-y-2">
              {[
                'Safe-to-spend maths uses your current cycle figures.',
                'Income delay spreads the same money over more days.',
                'A savings move reduces spending room but advances your goals.',
                'Every answer comes with ways to still make it work.',
              ].map(line => (
                <li key={line} className="text-xs text-surface-600 flex gap-2">
                  <span className="w-1.5 h-1.5 bg-primary-400 rounded-full mt-1.5 shrink-0" />{line}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </>
  );
}
