import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { SPLIT_PRESETS, buildStarterPlan, useStore } from '../context/store';
import type { SetupObligation, SplitPreset } from '../context/store';
import { DEFAULT_CATEGORIES } from '../types';
import type { Obligation, User } from '../types';
import { formatNaira, koboToNaira, nairaToKobo } from '../utils';
import { ArrowLeft, ArrowRight, Check, Plus, X } from 'lucide-react';

const FREQUENCIES: { id: User['incomeFrequency']; label: string; hint: string }[] = [
  { id: 'monthly', label: 'Monthly', hint: 'Allowance or stipend once a month' },
  { id: 'weekly', label: 'Weekly', hint: 'Money arrives every week' },
  { id: 'daily', label: 'Daily', hint: 'Work or pay day by day' },
  { id: 'irregular', label: 'Irregular', hint: 'It comes when it comes' },
];

const OBLIGATION_CATEGORIES = DEFAULT_CATEGORIES.filter(c => c.bucket === 'obligations');

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

/** Cadence step used to work out the next money date from the one that already arrived. */
const CADENCE_DAYS: Record<User['incomeFrequency'], number | null> = { daily: 1, weekly: 7, monthly: 30, irregular: null };

function slugify(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

function addCycleDays(iso: string, frequency: User['incomeFrequency']): string {
  const days = CADENCE_DAYS[frequency];
  if (!days || !iso) return '';
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return '';
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function subtractCycleDays(iso: string, frequency: User['incomeFrequency']): string {
  const days = CADENCE_DAYS[frequency];
  if (!days || !iso) return '';
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return '';
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

function AddRow({ onAdd }: { onAdd: (o: SetupObligation) => void }) {
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [frequency, setFrequency] = useState<Obligation['frequency']>('monthly');
  const [category, setCategory] = useState(OBLIGATION_CATEGORIES[0].id);
  const [customCategory, setCustomCategory] = useState('');
  const [dueDate, setDueDate] = useState('');

  const value = Number(amount.replace(/[^\d.]/g, '')) || 0;
  const custom = customCategory.trim();
  const valid = name.trim().length > 1 && value > 0 && (category !== 'other' || custom.length > 1);

  return (
    <div className="bg-surface-50 border border-surface-200 rounded-2xl p-4">
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="What is it? e.g. Room rent"
        aria-label="Obligation name"
        className="w-full px-3.5 py-2.5 rounded-xl border border-surface-200 bg-white text-sm outline-none focus:border-primary-500 mb-2.5"
      />
      <div className="grid grid-cols-2 gap-2.5 mb-2.5">
        <input
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          inputMode="decimal"
          placeholder="₦ amount"
          aria-label="Obligation amount"
          className="px-3.5 py-2.5 rounded-xl border border-surface-200 bg-white text-sm outline-none focus:border-primary-500"
        />
        <select
          value={frequency}
          onChange={(e) => setFrequency(e.target.value as Obligation['frequency'])}
          aria-label="How often it is due"
          className="px-3 py-2.5 rounded-xl border border-surface-200 bg-white text-sm outline-none focus:border-primary-500"
        >
          <option value="monthly">Every month</option>
          <option value="weekly">Every week</option>
          <option value="daily">Every day</option>
          <option value="once">One time</option>
        </select>
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          aria-label="Which obligation bucket it belongs to"
          className="px-3 py-2.5 rounded-xl border border-surface-200 bg-white text-sm outline-none focus:border-primary-500"
        >
          {OBLIGATION_CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          <option value="other">Other — type your own</option>
        </select>
        <input
          type="date"
          value={dueDate}
          min={todayISO()}
          onChange={(e) => setDueDate(e.target.value)}
          aria-label="Next due date"
          className="px-3 py-2.5 rounded-xl border border-surface-200 bg-white text-sm outline-none focus:border-primary-500"
        />
      </div>
      {category === 'other' && (
        <input
          value={customCategory}
          onChange={(e) => setCustomCategory(e.target.value)}
          placeholder="Name the type, e.g. Church dues"
          aria-label="Custom obligation type"
          className="mt-2.5 w-full px-3.5 py-2.5 rounded-xl border border-surface-200 bg-white text-sm outline-none focus:border-primary-500"
        />
      )}
      <button
        type="button"
        disabled={!valid}
        onClick={() => {
          onAdd({
            name: name.trim(),
            amountInKobo: nairaToKobo(value),
            frequency,
            category: category === 'other' ? slugify(custom) : category,
            nextDueDate: dueDate ? new Date(dueDate).toISOString() : undefined,
          });
          setName(''); setAmount(''); setDueDate(''); setCustomCategory('');
        }}
        className="mt-3 w-full py-2.5 rounded-xl bg-navy-900 text-white text-sm font-semibold disabled:opacity-40 flex items-center justify-center gap-1.5"
      >
        <Plus size={15} /> Add to my plan
      </button>
    </div>
  );
}

export default function SetupPage() {
  const navigate = useNavigate();
  const { user, completeSetup, profileSyncError, obligations: existingObligations, categoryBudgets } = useStore();

  const [step, setStep] = useState(0);
  const [frequency, setFrequency] = useState<User['incomeFrequency']>(user?.incomeFrequency || 'monthly');
  const [income, setIncome] = useState(user?.typicalIncomeInKobo ? String(koboToNaira(user.typicalIncomeInKobo)) : '');
  const [lastDate, setLastDate] = useState(() => user?.nextIncomeDate
    ? subtractCycleDays(user.nextIncomeDate.slice(0, 10), user.incomeFrequency || 'monthly')
    : '');
  const [nextDate, setNextDate] = useState(user?.nextIncomeDate ? user.nextIncomeDate.slice(0, 10) : '');
  const [preset, setPreset] = useState<SplitPreset>('balanced');
  const [obligations, setObligations] = useState<SetupObligation[]>(() => existingObligations.map(o => ({
    name: o.name, amountInKobo: o.amountInKobo, frequency: o.frequency, category: o.category, nextDueDate: o.nextDueDate,
  })));
  const [saving, setSaving] = useState(false);

  const incomeValue = Number(income.replace(/[^\d.]/g, '')) || 0;
  const incomeError = income !== '' && incomeValue <= 0 ? 'Enter an amount above zero' : undefined;
  const canLeaveStep0 = incomeValue > 0 && !incomeError;

  // The cadence decides the next money date; the field below still stays editable.
  useEffect(() => {
    if (!lastDate) return;
    const derived = addCycleDays(lastDate, frequency);
    if (derived) setNextDate(derived);
  }, [lastDate, frequency]);

  const plan = useMemo(
    () => buildStarterPlan({
      incomeFrequency: frequency,
      typicalIncomeInKobo: nairaToKobo(incomeValue),
      nextIncomeDate: nextDate ? new Date(nextDate).toISOString() : undefined,
      university: user?.university,
      preset,
      obligations,
    }),
    [frequency, incomeValue, nextDate, preset, obligations, user?.university]
  );

  const confirm = async () => {
    setSaving(true);
    await completeSetup({
      incomeFrequency: frequency,
      typicalIncomeInKobo: nairaToKobo(incomeValue),
      nextIncomeDate: nextDate ? new Date(nextDate).toISOString() : undefined,
      university: user?.university,
      preset,
      obligations,
    });
    setSaving(false);
    // Stay put if the server rejected the profile so the user sees the real reason.
    if (!useStore.getState().profileSyncError) navigate('/');
  };

  const steps = ['Your income', 'What you must pay', 'Your starting split'];

  return (
    <div className="min-h-screen bg-surface-100 lg:flex lg:items-center lg:justify-center lg:p-6">
      <div className="lg:w-full lg:max-w-2xl lg:bg-white lg:rounded-[28px] lg:shadow-card-lg lg:p-10">
        <div className="px-6 py-8 sm:px-10 lg:px-0 lg:py-0">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2.5">
              <img src="/brand/allawii-mark.png" alt="Allawii mark" className="w-9 h-9 rounded-xl" />
              <div>
                <p className="text-sm font-bold text-navy-900 leading-tight">Set up Allawii</p>
                <p className="text-[11px] text-surface-500">Step {step + 1} of 3 · {steps[step]}</p>
              </div>
            </div>
            <Link to="/" className="text-[12px] font-medium text-surface-500 hover:text-navy-800">Skip for now</Link>
          </div>

          <div className="flex gap-1.5 mb-8">
            {[0, 1, 2].map(i => (
              <span key={i} className={`h-1.5 flex-1 rounded-full transition-colors ${i <= step ? 'bg-navy-900' : 'bg-surface-200'}`} />
            ))}
          </div>

          {step === 0 && (
            <div className="animate-fade-in">
              <h1 className="text-2xl font-bold text-navy-900 mb-1.5">How does money reach you?</h1>
              <p className="text-sm text-surface-500 mb-6">
                This is the figure your whole plan is built from. You can change it any time.
              </p>

              <div className="grid grid-cols-2 gap-2.5 mb-6">
                {FREQUENCIES.map(f => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setFrequency(f.id)}
                    aria-pressed={frequency === f.id}
                    className={`text-left p-3.5 rounded-2xl border transition-all ${
                      frequency === f.id ? 'border-navy-900 bg-navy-900 text-white' : 'border-surface-200 bg-white text-navy-900 hover:border-surface-300'
                    }`}
                  >
                    <p className="text-sm font-semibold">{f.label}</p>
                    <p className={`text-[11px] mt-0.5 ${frequency === f.id ? 'text-navy-200' : 'text-surface-500'}`}>{f.hint}</p>
                  </button>
                ))}
              </div>

              <label className="block text-[13px] font-medium text-navy-800 mb-1.5" htmlFor="setup-income">
                Typical amount per {frequency === 'daily' ? 'day' : frequency === 'weekly' ? 'week' : 'month'}
              </label>
              <div className="relative mb-2">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-semibold text-surface-500">₦</span>
                <input
                  id="setup-income"
                  value={income}
                  onChange={(e) => setIncome(e.target.value)}
                  inputMode="decimal"
                  placeholder="60000"
                  className="w-full pl-8 pr-3.5 py-3 rounded-xl border border-surface-200 bg-white text-sm outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/10"
                />
              </div>
              {incomeError && <p className="text-xs text-red-600 mb-3">{incomeError}</p>}
              {incomeValue > 0 && frequency !== 'monthly' && (
                <p className="text-[11px] text-surface-500 mb-3">
                  Plan runs on a {frequency === 'weekly' ? 'weekly' : frequency === 'daily' ? 'daily' : 'monthly'} cycle of {formatNaira(nairaToKobo(incomeValue))}.
                </p>
              )}

              <label className="block text-[13px] font-medium text-navy-800 mb-1.5 mt-4" htmlFor="setup-last-date">
                When did money last reach you? <span className="text-surface-500 font-normal">(optional)</span>
              </label>
              <input
                id="setup-last-date"
                type="date"
                value={lastDate}
                max={todayISO()}
                onChange={(e) => setLastDate(e.target.value)}
                className="w-full px-3.5 py-3 rounded-xl border border-surface-200 bg-white text-sm outline-none focus:border-primary-500"
              />

              <label className="block text-[13px] font-medium text-navy-800 mb-1.5 mt-4" htmlFor="setup-date">
                Next money date {lastDate && CADENCE_DAYS[frequency]
                  ? <span className="text-surface-500 font-normal">(worked out from your {frequency} cadence)</span>
                  : <span className="text-surface-500 font-normal">(optional)</span>}
              </label>
              <input
                id="setup-date"
                type="date"
                value={nextDate}
                min={todayISO()}
                onChange={(e) => setNextDate(e.target.value)}
                className="w-full px-3.5 py-3 rounded-xl border border-surface-200 bg-white text-sm outline-none focus:border-primary-500"
              />
              <p className="text-[11px] text-surface-500 mt-2">
                {frequency === 'irregular'
                  ? 'Irregular income has no fixed step, so set the next date yourself and update it when money lands.'
                  : 'With a date, daily safe-to-spend is exact and every later payment lands one cycle after the last. Without it, Allawii estimates the cycle and marks the number as an estimate.'}
              </p>

              <button
                type="button"
                disabled={!canLeaveStep0}
                onClick={() => setStep(1)}
                className="mt-7 w-full bg-navy-900 text-white font-semibold py-3.5 rounded-xl text-sm disabled:opacity-40 flex items-center justify-center gap-2"
              >
                Continue <ArrowRight size={16} />
              </button>
            </div>
          )}

          {step === 1 && (
            <div className="animate-fade-in">
              <h1 className="text-2xl font-bold text-navy-900 mb-1.5">What must be paid no matter what?</h1>
              <p className="text-sm text-surface-500 mb-6">
                Rent, dues, family support, debt. These come off the top before anything discretionary.
              </p>

              {obligations.length > 0 && (
                <div className="card divide-y divide-surface-100 mb-4">
                  {obligations.map((o, i) => (
                    <div key={`${o.name}-${i}`} className="p-3.5 flex items-center gap-3">
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-navy-900">{o.name}</p>
                        <p className="text-[11px] text-surface-500">
                          {formatNaira(o.amountInKobo)} · {o.frequency === 'once' ? 'one time' : `every ${o.frequency.replace('ly', '')}`}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setObligations(list => list.filter((_, idx) => idx !== i))}
                        aria-label={`Remove ${o.name}`}
                        className="w-8 h-8 rounded-lg flex items-center justify-center text-surface-500 hover:text-red-500 hover:bg-red-50"
                      >
                        <X size={15} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <AddRow onAdd={(o) => setObligations(list => [...list, o])} />

              <div className="flex gap-2.5 mt-7">
                <button type="button" onClick={() => setStep(0)} className="btn-ghost px-4 py-3.5 rounded-xl text-sm flex items-center gap-1.5">
                  <ArrowLeft size={15} /> Back
                </button>
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="flex-1 bg-navy-900 text-white font-semibold py-3.5 rounded-xl text-sm flex items-center justify-center gap-2"
                >
                  {obligations.length === 0 ? 'Nothing fixed — continue' : 'Continue'} <ArrowRight size={16} />
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="animate-fade-in">
              <h1 className="text-2xl font-bold text-navy-900 mb-1.5">Pick a starting split</h1>
              <p className="text-sm text-surface-500 mb-6">
                {formatNaira(nairaToKobo(incomeValue))} per cycle, after {formatNaira(plan.bucketTotals.obligations)} of obligations. Nothing is locked in — the plan adapts as you use it.
              </p>

              {categoryBudgets.length > 0 && (
                <p className="text-xs rounded-xl px-3.5 py-2.5 bg-primary-50 text-primary-800 border border-primary-100 mb-5">
                  Rebuilding replaces your {categoryBudgets.length} current category limits. Your recorded transactions stay untouched.
                </p>
              )}

              {plan.overCommitted && (
                <p className="text-xs rounded-xl px-3.5 py-2.5 bg-amber-50 text-amber-800 border border-amber-100 mb-5">
                  Your listed obligations use more than 85% of this income, so Allawii has capped them in the preview. That is a real squeeze, not a rounding error — the what-if simulator can test ways around it.
                </p>
              )}

              <div className="space-y-2.5 mb-6">
                {(Object.keys(SPLIT_PRESETS) as SplitPreset[]).map(key => {
                  const p = SPLIT_PRESETS[key];
                  const active = preset === key;
                  const preview = buildStarterPlan({
                    incomeFrequency: frequency,
                    typicalIncomeInKobo: nairaToKobo(incomeValue),
                    university: user?.university,
                    preset: key,
                    obligations,
                  });
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setPreset(key)}
                      aria-pressed={active}
                      className={`w-full text-left p-4 rounded-2xl border transition-all ${
                        active ? 'border-navy-900 bg-white shadow-card' : 'border-surface-200 bg-white hover:border-surface-300'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-sm font-semibold text-navy-900">{p.label}</p>
                        {active && <Check size={16} className="text-primary-600" />}
                      </div>
                      <p className="text-[11px] text-surface-500 mb-3">{p.hint}</p>
                      <div className="flex gap-1.5 mb-2.5">
                        {(['obligations', 'essentials', 'future_you', 'enjoyment'] as const).map(b => {
                          const total = nairaToKobo(incomeValue) || 1;
                          const width = Math.max(2, (preview.bucketTotals[b] / total) * 100);
                          const colors: Record<string, string> = { obligations: 'bg-red-400', essentials: 'bg-emerald-400', future_you: 'bg-primary-500', enjoyment: 'bg-purple-400' };
                          return <span key={b} className={`h-1.5 rounded-full ${colors[b]}`} style={{ width: `${width}%` }} />;
                        })}
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-[11px]">
                        <span className="text-surface-500">Essentials <b className="text-navy-900 block text-xs">{formatNaira(preview.bucketTotals.essentials)}</b></span>
                        <span className="text-surface-500">Future you <b className="text-navy-900 block text-xs">{formatNaira(preview.bucketTotals.future_you)}</b></span>
                        <span className="text-surface-500">Enjoyment <b className="text-navy-900 block text-xs">{formatNaira(preview.bucketTotals.enjoyment)}</b></span>
                      </div>
                    </button>
                  );
                })}
              </div>

              {profileSyncError && (
                <p className="text-xs rounded-xl px-3.5 py-2.5 bg-red-50 text-red-700 border border-red-100 mb-4">
                  Your plan is saved on this device, but the server did not accept the profile update: {profileSyncError}. You can continue — sign in again once the backend is reachable to sync it.
                </p>
              )}

              <div className="flex gap-2.5">
                <button type="button" onClick={() => setStep(1)} className="btn-ghost px-4 py-3.5 rounded-xl text-sm flex items-center gap-1.5">
                  <ArrowLeft size={15} /> Back
                </button>
                <button
                  type="button"
                  disabled={saving || incomeValue <= 0}
                  onClick={confirm}
                  className="flex-1 bg-navy-900 text-white font-semibold py-3.5 rounded-xl text-sm disabled:opacity-40 flex items-center justify-center gap-2"
                >
                  {saving ? 'Building your plan…' : 'Start my plan'} {!saving && <ArrowRight size={16} />}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
