import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../context/store';
import { formatNaira, nairaToKobo } from '../utils';
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
    newDailyLimitInKobo: number;
    monthsToSave: number;
  }>(null);

  const safe = getSafeToSpend();

  const handleCalculate = () => {
    const amountInKobo = nairaToKobo(Number(price));
    if (!amountInKobo || amountInKobo <= 0) return;

    const affordable = amountInKobo <= safe.unallocatedInKobo;
    const remaining = Math.max(0, safe.unallocatedInKobo - amountInKobo);
    const newDailyLimitInKobo = safe.daysUntilNextIncome > 0 ? remaining / safe.daysUntilNextIncome : remaining;

    const tradeoffs: string[] = [];
    if (amountInKobo > safe.unallocatedInKobo * 0.5) tradeoffs.push('This uses more than half of your unallocated money for the cycle.');
    if (newDailyLimitInKobo < safe.dailyLimitInKobo * 0.3) tradeoffs.push('Your daily spending guide drops significantly for the remaining days.');
    if (amountInKobo > safe.unallocatedInKobo * 0.8) tradeoffs.push('Almost no buffer is left for surprises before your next income.');

    const activeGoals = savingsGoals.filter(g => !g.isPaused);
    if (activeGoals.length > 0 && amountInKobo > safe.unallocatedInKobo * 0.3) {
      tradeoffs.push('You may need to pause a contribution to a goal to keep this comfortable.');
    }

    const monthlyCapacity = Math.max(0, safe.dailyLimitInKobo * 30);
    const monthsToSave = Math.ceil(amountInKobo / Math.max(1, monthlyCapacity));

    setResult({
      affordable,
      message: affordable
        ? `Yes — ${formatNaira(amountInKobo)} fits inside your current unallocated balance of ${formatNaira(safe.unallocatedInKobo)}.`
        : `Not this cycle. ${formatNaira(amountInKobo)} is more than the ${formatNaira(safe.unallocatedInKobo)} you have unallocated.`,
      impact: affordable
        ? `After buying it you'd have ${formatNaira(remaining)} left, which is ${formatNaira(newDailyLimitInKobo)} a day for ${safe.daysUntilNextIncome} days.`
        : `You're short by ${formatNaira(amountInKobo - safe.unallocatedInKobo)}. Waiting for the next income or trimming essentials elsewhere would close the gap.`,
      tradeoffs,
      newDailyLimitInKobo,
      monthsToSave: affordable ? 0 : monthsToSave,
    });
  };

  return (
    <>
      <Header title="Can I Afford It?" showBack />

      <div className="px-5 py-4 space-y-4 pb-8 lg:px-10 lg:grid lg:grid-cols-2 lg:gap-8 lg:space-y-0 lg:items-start">
        <div className="card p-4 bg-primary-50 border-primary-100 lg:col-span-2">
          <p className="section-label mb-1">Unallocated right now</p>
          <p className="text-3xl font-bold text-primary-700">{formatNaira(safe.unallocatedInKobo)}</p>
          <p className="text-xs text-primary-600 mt-1">
            {formatNaira(safe.dailyLimitInKobo)}/day guide · {safe.daysUntilNextIncome} days to next income
          </p>
        </div>

        <div className="lg:col-start-1 lg:row-start-2">
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

        {result ? (
          <div className="animate-slide-up space-y-3 lg:col-start-2 lg:row-start-2 lg:row-span-2">
            <div className={`card p-5 border-l-4 ${result.affordable ? 'border-l-emerald-500' : 'border-l-red-500'}`}>
              <div className="flex items-center gap-3 mb-3">
                {result.affordable ? (
                  <CheckCircle size={26} className="text-emerald-700" />
                ) : (
                  <XCircle size={26} className="text-red-500" />
                )}
                <p className="font-bold text-lg text-navy-900">
                  {result.affordable ? 'You can afford this' : 'Not right now'}
                </p>
              </div>
              <p className="text-sm text-navy-800 mb-2">{result.message}</p>
              <p className="text-sm text-surface-500">{result.impact}</p>
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
                  <p className="text-[11px] font-medium text-surface-500">New daily guide</p>
                </div>
                <p className={`text-lg font-bold ${result.newDailyLimitInKobo < safe.dailyLimitInKobo * 0.5 ? 'text-amber-600' : 'text-navy-900'}`}>
                  {formatNaira(result.newDailyLimitInKobo)}
                </p>
              </div>
              <div className="card p-4">
                <p className="text-[11px] font-medium text-surface-500 mb-1.5">If you saved instead</p>
                <p className="text-lg font-bold text-navy-900">
                  {result.monthsToSave === 0 ? 'Now' : `${result.monthsToSave} month${result.monthsToSave > 1 ? 's' : ''}`}
                </p>
              </div>
            </div>

            <button onClick={() => navigate('/what-if')} className="w-full btn-secondary text-sm py-3 flex items-center justify-center gap-2">
              Try more scenarios <ArrowRight size={14} />
            </button>
          </div>
        ) : (
          <div className="hidden lg:block card p-5 lg:col-start-2 lg:row-start-2 lg:row-span-2">
            <p className="text-sm font-bold text-navy-900 mb-2">How this is worked out</p>
            <ul className="space-y-2.5">
              {[
                `Unallocated money after your recorded spending and reserved savings: ${formatNaira(safe.unallocatedInKobo)}.`,
                `Your daily guide for the remaining ${safe.daysUntilNextIncome} days: ${formatNaira(safe.dailyLimitInKobo)}.`,
                'A purchase only counts as affordable if it leaves that guide above zero.',
                'Trade-off warnings appear when a purchase uses more than 30–80% of what is unallocated.',
              ].map(line => (
                <li key={line} className="text-xs text-surface-600 flex gap-2">
                  <span className="w-1.5 h-1.5 bg-primary-400 rounded-full mt-1.5 shrink-0" />{line}
                </li>
              ))}
            </ul>
          </div>
        )}

        <p className="text-[11px] text-surface-500 text-center leading-relaxed">
          This uses your recorded transactions and reserved savings. Buying it does not
          automatically reduce your essential budgets — you stay in control.
        </p>
      </div>
    </>
  );
}
