import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../context/store';
import { formatNaira } from '../utils';
import Header from '../components/Header';
import { CheckCircle, XCircle, AlertTriangle, Scale, ArrowRight } from 'lucide-react';

export default function AffordCalculator() {
  const navigate = useNavigate();
  const { getSafeToSpend, savingsGoals } = useStore();
  const [price, setPrice] = useState('');
  const [result, setResult] = useState<null | {
    affordable: boolean;
    message: string;
    impact: string;
    tradeoffs: string[];
    newDailyLimit: number;
    monthsToSave: number;
  }>(null);

  const safe = getSafeToSpend();

  const handleCalculate = () => {
    const amount = Number(price);
    if (!amount || amount <= 0) return;

    const affordable = amount <= safe.unallocated;
    const remaining = Math.max(0, safe.unallocated - amount);
    const newDailyLimit = safe.daysUntilNextIncome > 0 ? remaining / safe.daysUntilNextIncome : remaining;

    const tradeoffs: string[] = [];
    if (amount > safe.unallocated * 0.5) tradeoffs.push('This uses more than half of your unallocated money for the cycle.');
    if (newDailyLimit < safe.dailyLimit * 0.3) tradeoffs.push('Your daily spending guide drops significantly for the remaining days.');
    if (amount > safe.unallocated * 0.8) tradeoffs.push('Almost no buffer is left for surprises before your next income.');

    const activeGoals = savingsGoals.filter(g => !g.isPaused);
    if (activeGoals.length > 0 && amount > safe.unallocated * 0.3) {
      tradeoffs.push('You may need to pause a contribution to a goal to keep this comfortable.');
    }

    const monthlyCapacity = Math.max(0, safe.dailyLimit * 30);
    const monthsToSave = Math.ceil(amount / Math.max(1, monthlyCapacity));

    setResult({
      affordable,
      message: affordable
        ? `Yes — ${formatNaira(amount)} fits inside your current unallocated balance of ${formatNaira(safe.unallocated)}.`
        : `Not this cycle. ${formatNaira(amount)} is more than the ${formatNaira(safe.unallocated)} you have unallocated.`,
      impact: affordable
        ? `After buying it you'd have ${formatNaira(remaining)} left, which is ${formatNaira(newDailyLimit)} a day for ${safe.daysUntilNextIncome} days.`
        : `You're short by ${formatNaira(amount - safe.unallocated)}. Waiting for the next income or trimming essentials elsewhere would close the gap.`,
      tradeoffs,
      newDailyLimit,
      monthsToSave: affordable ? 0 : monthsToSave,
    });
  };

  return (
    <>
      <Header title="Can I Afford It?" showBack />

      <div className="px-5 py-4 space-y-4 pb-8">
        <div className="card p-4 bg-primary-50 border-primary-100">
          <p className="section-label mb-1">Unallocated right now</p>
          <p className="text-3xl font-bold text-primary-700">{formatNaira(safe.unallocated)}</p>
          <p className="text-xs text-primary-600 mt-1">
            {formatNaira(safe.dailyLimit)}/day guide · {safe.daysUntilNextIncome} days to next income
          </p>
        </div>

        <div>
          <label className="section-label mb-2 block">Price of the thing</label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-surface-300 text-2xl font-semibold">₦</span>
            <input
              type="number"
              value={price}
              onChange={(e) => { setPrice(e.target.value); setResult(null); }}
              placeholder="0"
              className="input-field pl-11 text-3xl font-bold py-5"
            />
          </div>
          <div className="flex gap-2 mt-2">
            {[2000, 5000, 15000, 45000].map(v => (
              <button key={v} onClick={() => { setPrice(String(v)); setResult(null); }}
                className="px-2.5 py-1 rounded-lg bg-surface-100 text-[11px] font-medium text-navy-700">
                ₦{v.toLocaleString()}
              </button>
            ))}
          </div>
          <button onClick={handleCalculate} disabled={!price} className="w-full btn-primary mt-3 disabled:opacity-40">
            Check affordability
          </button>
        </div>

        {result && (
          <div className="animate-slide-up space-y-3">
            <div className={`card p-5 border-l-4 ${result.affordable ? 'border-l-emerald-500' : 'border-l-red-500'}`}>
              <div className="flex items-center gap-3 mb-3">
                {result.affordable ? (
                  <CheckCircle size={26} className="text-emerald-600" />
                ) : (
                  <XCircle size={26} className="text-red-500" />
                )}
                <p className="font-bold text-lg text-navy-900">
                  {result.affordable ? 'You can afford this' : 'Not right now'}
                </p>
              </div>
              <p className="text-sm text-navy-800 mb-2">{result.message}</p>
              <p className="text-sm text-surface-400">{result.impact}</p>
            </div>

            {result.tradeoffs.length > 0 && (
              <div className="card p-4">
                <div className="flex items-center gap-2 mb-2">
                  <AlertTriangle size={16} className="text-amber-600" />
                  <p className="font-semibold text-sm text-navy-900">What this costs you</p>
                </div>
                <ul className="space-y-1.5">
                  {result.tradeoffs.map((t, i) => (
                    <li key={i} className="text-xs text-surface-500 flex items-start gap-2">
                      <span className="text-amber-500 mt-0.5">•</span>{t}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="card p-4">
                <div className="flex items-center gap-2 mb-1.5">
                  <Scale size={14} className="text-primary-600" />
                  <p className="text-[11px] font-medium text-surface-400">New daily guide</p>
                </div>
                <p className={`text-lg font-bold ${result.newDailyLimit < safe.dailyLimit * 0.5 ? 'text-amber-600' : 'text-navy-900'}`}>
                  {formatNaira(result.newDailyLimit)}
                </p>
              </div>
              <div className="card p-4">
                <p className="text-[11px] font-medium text-surface-400 mb-1.5">If you saved instead</p>
                <p className="text-lg font-bold text-navy-900">
                  {result.monthsToSave === 0 ? 'Now' : `${result.monthsToSave} month${result.monthsToSave > 1 ? 's' : ''}`}
                </p>
              </div>
            </div>

            <button onClick={() => window.location.assign('/what-if')} className="w-full btn-secondary text-sm py-3 flex items-center justify-center gap-2">
              Try more scenarios <ArrowRight size={14} />
            </button>
          </div>
        )}

        <p className="text-[11px] text-surface-400 text-center leading-relaxed">
          This uses your recorded transactions and reserved savings. Buying it does not
          automatically reduce your essential budgets — you stay in control.
        </p>
      </div>
    </>
  );
}
