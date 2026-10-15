import { useState } from 'react';
import { useStore } from '../context/store';
import { formatNaira, nairaToKobo } from '../utils';
import Header from '../components/Header';
import { RotateCcw, AlertTriangle, TrendingDown, Clock, PiggyBank, Zap } from 'lucide-react';

interface Simulation {
  description: string;
  amount: number;
  category: string;
}

export default function WhatIfPage() {
  const { getSafeToSpend } = useStore();
  const [customAmount, setCustomAmount] = useState('');
  const [simulation, setSimulation] = useState<null | {
    description: string;
    newBalance: number;
    newDailyLimitInKobo: number;
    impactOnSavings: string;
    riskLevel: 'low' | 'medium' | 'high';
    tradeoffs: string[];
    recommendation: string;
  }>(null);

  const safe = getSafeToSpend();

  const presets: Simulation[] = [
    { description: 'Spend ₦2,000 extra on food', amount: 200000, category: 'food' },
    { description: 'Buy headphones for ₦15,000', amount: 1500000, category: 'shopping' },
    { description: 'Unexpected transport cost of ₦3,000', amount: 300000, category: 'transport' },
    { description: 'Move ₦1,000 into savings this week', amount: -100000, category: 'savings' },
    { description: 'Pay an unexpected ₦5,000 bill', amount: 500000, category: 'obligations' },
    { description: 'My next income is delayed by 7 days', amount: 0, category: 'delay' },
  ];

  const runSimulation = (sim: Simulation) => {
    let newBalance = safe.unallocatedInKobo;
    let newDailyLimit = safe.dailyLimitInKobo;
    let riskLevel: 'low' | 'medium' | 'high' = 'low';
    const tradeoffs: string[] = [];
    let recommendation = '';
    let impactOnSavings = 'No effect on your savings contributions.';

    if (sim.category === 'delay') {
      const extendedDays = safe.daysUntilNextIncome + 7;
      newDailyLimit = safe.unallocatedInKobo / Math.max(1, extendedDays);
      riskLevel = 'high';
      tradeoffs.push(`Your guide drops from ${formatNaira(safe.dailyLimitInKobo)} to ${formatNaira(newDailyLimit)} per day.`);
      tradeoffs.push('Enjoyment spending is the first thing to cut here.');
      recommendation = `Stretch what you have across ${extendedDays} days. Focus on food, transport and data only, and tell your coach so it can re-plan your goals.`;
      impactOnSavings = 'Contributions should be paused until income lands.';
    } else if (sim.amount < 0) {
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
        recommendation = 'Not advisable this cycle. Wait for the next income or find a cheaper option.';
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
      newBalance: Math.max(0, newBalance),
      newDailyLimitInKobo: Math.max(0, newDailyLimit),
      impactOnSavings,
      riskLevel,
      tradeoffs,
      recommendation,
    });
  };

  const riskStyles = {
    low: 'border-l-emerald-500 text-emerald-700 bg-emerald-50',
    medium: 'border-l-amber-500 text-amber-700 bg-amber-50',
    high: 'border-l-red-500 text-red-700 bg-red-50',
  } as const;

  return (
    <>
      <Header title="What-If Simulator" showBack />

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
          <div className="flex gap-2">
            <div className="relative flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-300 font-semibold">₦</span>
              <input
                type="number"
                value={customAmount}
                onChange={(e) => setCustomAmount(e.target.value)}
                placeholder="Amount"
                className="input-field pl-8 text-sm py-2.5"
              />
            </div>
            <button
              onClick={() => Number(customAmount) > 0 && runSimulation({ description: `Spend ${formatNaira(Number(customAmount))}`, amount: nairaToKobo(Number(customAmount)), category: 'custom' })}
              disabled={!customAmount}
              className="btn-primary text-sm px-4 disabled:opacity-40"
            >
              Simulate
            </button>
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

              <div className="grid grid-cols-2 gap-3 mb-3">
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
