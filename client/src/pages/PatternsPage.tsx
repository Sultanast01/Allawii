import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../context/store';
import Header from '../components/Header';
import { formatNaira, getCategoryIcon } from '../utils';
import { DEFAULT_CATEGORIES } from '../types';
import { BarChart3, CalendarClock, Compass, Fingerprint, Layers, Timer } from 'lucide-react';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const TIME_SLOTS = [
  { id: 'early', label: 'Early', range: '5am – 11am', from: 5, to: 11 },
  { id: 'midday', label: 'Midday', range: '11am – 3pm', from: 11, to: 15 },
  { id: 'afternoon', label: 'Afternoon', range: '3pm – 7pm', from: 15, to: 19 },
  { id: 'evening', label: 'Evening', range: '7pm – 11pm', from: 19, to: 23 },
  { id: 'night', label: 'Night', range: '11pm – 5am', from: 23, to: 29 },
];

const BUCKET_LABEL: Record<string, string> = {
  obligations: 'Obligations',
  essentials: 'Essentials',
  future_you: 'Future you',
  enjoyment: 'Enjoyment',
};

const median = (xs: number[]) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
};

const catName = (id: string) => DEFAULT_CATEGORIES.find(c => c.id === id)?.name || id.replace('_', ' ');

function Bar({ pct, tone = 'primary' }: { pct: number; tone?: 'primary' | 'amber' | 'emerald' | 'navy' }) {
  const fill = { primary: 'bg-primary-500', amber: 'bg-amber-400', emerald: 'bg-emerald-500', navy: 'bg-navy-800' }[tone];
  return (
    <div className="h-2 bg-surface-100 rounded-full overflow-hidden">
      <div className={`h-full rounded-full transition-all duration-500 ${fill}`} style={{ width: pct > 0 ? `${Math.max(pct, 1.5)}%` : '0%' }} />
    </div>
  );
}

export default function PatternsPage() {
  const navigate = useNavigate();
  const { transactions } = useStore();

  const p = useMemo(() => {
    const expenses = transactions.filter(t => t.type === 'expense' && t.amountInKobo > 0);
    const total = expenses.reduce((s, t) => s + t.amountInKobo, 0);
    const stamps = expenses.map(t => new Date(t.date)).filter(d => !isNaN(d.getTime()));
    const first = stamps.length ? new Date(Math.min(...stamps.map(d => d.getTime()))) : null;
    const last = stamps.length ? new Date(Math.max(...stamps.map(d => d.getTime()))) : null;
    const spanDays = first && last ? Math.max(1, Math.round((last.getTime() - first.getTime()) / 86400000) + 1) : 0;

    const weekday = WEEKDAYS.map((label, i) => {
      const hits = expenses.filter(t => (new Date(t.date).getDay() + 6) % 7 === i);
      const daysSeen = new Set(stamps.filter(d => (d.getDay() + 6) % 7 === i).map(d => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`)).size;
      return { label, total: hits.reduce((s, t) => s + t.amountInKobo, 0), count: hits.length, daysSeen };
    });
    const weekdayPeak = Math.max(1, ...weekday.map(d => d.total));
    const busiestWeekday = [...weekday].sort((a, b) => b.total - a.total)[0];

    const slots = TIME_SLOTS.map(s => {
      const hits = expenses.filter(t => { const h = new Date(t.date).getHours(); return s.from > 23 ? h >= 23 || h < 4 : h >= s.from && h < s.to; });
      return { ...s, total: hits.reduce((sum, t) => sum + t.amountInKobo, 0), count: hits.length };
    });
    const slotPeak = Math.max(1, ...slots.map(s => s.total));

    const byCat = Object.entries(expenses.reduce((m, t) => {
      m[t.category] = (m[t.category] || 0) + t.amountInKobo;
      return m;
    }, {} as Record<string, number>)).map(([id, amount]) => ({
      id,
      amount,
      count: expenses.filter(t => t.category === id).length,
      typical: median(expenses.filter(t => t.category === id).map(t => t.amountInKobo)),
      share: total ? (amount / total) * 100 : 0,
    })).sort((a, b) => b.amount - a.amount);

    const byBucket = Object.entries(expenses.reduce((m, t) => {
      m[t.budgetBucket] = (m[t.budgetBucket] || 0) + t.amountInKobo;
      return m;
    }, {} as Record<string, number>)).map(([id, amount]) => ({ id, amount, share: total ? (amount / total) * 100 : 0 }))
      .sort((a, b) => b.amount - a.amount);

    const merchants = Object.entries(expenses.filter(t => t.merchant).reduce((m, t) => {
      const k = t.merchant as string;
      m[k] = (m[k] || 0) + t.amountInKobo;
      return m;
    }, {} as Record<string, number>)).map(([name, amount]) => ({
      name, amount, count: expenses.filter(t => t.merchant === name).length,
    })).sort((a, b) => b.amount - a.amount);

    const sortedStamps = [...stamps].sort((a, b) => a.getTime() - b.getTime());
    const moneyDays = [...new Set(sortedStamps.map(d => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()))];
    const spendGaps = moneyDays.slice(1).map((t, i) => Math.round((t - moneyDays[i]) / 86400000));
    const avgGap = spendGaps.length ? (spendGaps.reduce((s, g) => s + g, 0) / spendGaps.length) : 0;

    const biggest = expenses.length ? [...expenses].sort((a, b) => b.amountInKobo - a.amountInKobo)[0] : null;
    const typical = median(expenses.map(t => t.amountInKobo));
    const weekendShare = (() => {
      const wk = weekday.filter(d => d.label === 'Sat' || d.label === 'Sun').reduce((s, d) => s + d.total, 0);
      return total ? (wk / total) * 100 : 0;
    })();

    return {
      expenses, total, first, last, spanDays, weekday, weekdayPeak, busiestWeekday,
      slots, slotPeak, byCat, byBucket, merchants, biggest, typical, avgGap, weekendShare,
      distinctDays: moneyDays.length,
    };
  }, [transactions]);

  const thin = p.expenses.length < 12;

  const findings = [
    p.expenses.length >= 2 && p.avgGap > 0 && {
      icon: Timer,
      text: `You spent money on ${p.distinctDays} of the ${p.spanDays} days covered, roughly every ${p.avgGap % 1 === 0 ? p.avgGap : p.avgGap.toFixed(1)} days.`,
    },
    p.busiestWeekday && p.busiestWeekday.total > 0 && {
      icon: CalendarClock,
      text: `${p.busiestWeekday.label} carries ${Math.round((p.busiestWeekday.total / p.total) * 100)}% of everything you spent — ${formatNaira(p.busiestWeekday.total)} across ${p.busiestWeekday.count} record${p.busiestWeekday.count === 1 ? '' : 's'}.`,
    },
    p.byCat[0] && p.byCat.length > 1 && {
      icon: Layers,
      text: `${catName(p.byCat[0].id)} is your largest category at ${Math.round(p.byCat[0].share)}% of spend, ahead of ${catName(p.byCat[1].id)} at ${Math.round(p.byCat[1].share)}%.`,
    },
    p.typical > 0 && {
      icon: Fingerprint,
      text: `Half of your expenses are ${formatNaira(p.typical)} or less. The largest single one was ${formatNaira(p.biggest!.amountInKobo)} for ${p.biggest!.description.toLowerCase()}.`,
    },
    p.weekendShare > 0 && {
      icon: Compass,
      text: `Weekends account for ${Math.round(p.weekendShare)}% of your spending, on two of the seven days.`,
    },
  ].filter(Boolean) as { icon: typeof Timer; text: string }[];

  return (
    <div>
      <Header title="Spending Patterns" showBack />

      <div className="px-5 pt-5 space-y-5 lg:px-10 lg:pt-10 lg:grid lg:grid-cols-2 lg:gap-8 lg:items-start">
        {/* Header spans both columns */}
        <div className="lg:col-span-2">
          <p className="text-[11px] font-semibold tracking-wider text-primary-600 uppercase mb-1">Personal patterns</p>
          <h1 className="text-2xl font-bold text-navy-900">The shape of your spending.</h1>
          <p className="text-sm text-surface-500 mt-0.5">
            Everything here is calculated from the {p.expenses.length} expense record{p.expenses.length === 1 ? '' : 's'} you have. Nothing is estimated.
          </p>
        </div>

        {/* Coverage */}
        <div className="lg:col-span-2 card p-4 flex flex-wrap items-center gap-x-6 gap-y-3">
          {[
            { label: 'Records read', value: String(p.expenses.length) },
            { label: 'Days covered', value: p.spanDays ? String(p.spanDays) : '—' },
            { label: 'Days with spend', value: String(p.distinctDays) },
            { label: 'Total out', value: formatNaira(p.total) },
          ].map(s => (
            <div key={s.label}>
              <p className="text-lg font-bold text-navy-900 leading-tight">{s.value}</p>
              <p className="text-[11px] text-surface-500">{s.label}</p>
            </div>
          ))}
          <div className={`ml-auto text-[11px] font-semibold px-2.5 py-1 rounded-full ${thin ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>
            {thin ? 'Thin data — a sketch, not a pattern' : 'Enough records to read a shape'}
          </div>
        </div>

        {/* Weekday rhythm */}
        <div className="card p-5">
          <h3 className="font-bold text-navy-900 mb-1">Which day you spend on</h3>
          <p className="text-xs text-surface-500 mb-4">Total spend per weekday across the period, and how many of that day you actually have records for.</p>
          <div className="space-y-2.5">
            {p.weekday.map(d => (
              <div key={d.label} className="flex items-center gap-3">
                <span className="w-9 text-xs font-semibold text-surface-500">{d.label}</span>
                <div className="flex-1"><Bar pct={(d.total / p.weekdayPeak) * 100} tone={d.total > 0 && d.label === p.busiestWeekday.label ? 'amber' : 'primary'} /></div>
                <span className="w-24 text-right text-xs text-navy-900">
                  <b>{d.total > 0 ? formatNaira(d.total) : '—'}</b>
                  <span className="text-surface-500"> · {d.count} rec</span>
                </span>
              </div>
            ))}
          </div>
          {p.expenses.length > 0 && p.weekday.filter(d => d.count > 0).length < 4 && (
            <p className="text-[11px] text-surface-500 mt-4">
              Your records fall on only {p.weekday.filter(d => d.count > 0).length} different weekdays, so the other bars are gaps in the data rather than days you spent nothing.
            </p>
          )}
        </div>

        {/* Time of day */}
        <div className="card p-5">
          <h3 className="font-bold text-navy-900 mb-1">When in the day</h3>
          <p className="text-xs text-surface-500 mb-4">Uses the clock time stored on each record — the moment you paid or logged it.</p>
          <div className="space-y-3">
            {p.slots.map(s => (
              <div key={s.id}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-surface-600">{s.label} <span className="text-surface-500">· {s.range}</span></span>
                  <b className="text-navy-900">{s.total > 0 ? formatNaira(s.total) : 'nothing yet'}</b>
                </div>
                <Bar pct={(s.total / p.slotPeak) * 100} tone="navy" />
              </div>
            ))}
          </div>
          <p className="text-[11px] text-surface-500 mt-4">
            {p.slots.filter(s => s.count > 0).length === 1
              ? 'All your records sit in one slot right now. This view only becomes useful once spending is logged across different hours.'
              : `${p.slots.filter(s => s.count > 0).length} of the 5 slots hold records.`}
          </p>
        </div>

        {/* Category mix */}
        <div className="card p-5">
          <h3 className="font-bold text-navy-900 mb-1">Category mix</h3>
          <p className="text-xs text-surface-500 mb-4">Share of spend, how often the category appears, and the typical size of one entry.</p>
          {p.byCat.length === 0 ? (
            <p className="text-xs text-surface-500">No expenses recorded yet.</p>
          ) : (
            <div className="space-y-4">
              {p.byCat.map(c => (
                <div key={c.id}>
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="text-surface-600">{getCategoryIcon(c.id)} {catName(c.id)}</span>
                    <span className="font-bold text-navy-900">{Math.round(c.share)}%</span>
                  </div>
                  <Bar pct={c.share} />
                  <p className="text-[11px] text-surface-500 mt-1">
                    {formatNaira(c.amount)} · {c.count} record{c.count === 1 ? '' : 's'} · typical entry {formatNaira(c.typical)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Bucket mix + merchants */}
        <div className="space-y-5">
          <div className="card p-5">
            <h3 className="font-bold text-navy-900 mb-1">Committed vs discretionary</h3>
            <p className="text-xs text-surface-500 mb-4">The same four buckets your budget is built from.</p>
            <div className="flex h-3 rounded-full overflow-hidden bg-surface-100 mb-4">
              {p.byBucket.map((b, i) => (
                <div key={b.id} style={{ width: `${b.share}%` }} className={['bg-red-400', 'bg-primary-500', 'bg-emerald-500', 'bg-violet-400'][i % 4]} />
              ))}
            </div>
            <div className="space-y-2">
              {p.byBucket.map((b, i) => (
                <div key={b.id} className="flex items-center gap-2 text-xs">
                  <span className={['w-2.5 h-2.5 rounded-full bg-red-400', 'w-2.5 h-2.5 rounded-full bg-primary-500', 'w-2.5 h-2.5 rounded-full bg-emerald-500', 'w-2.5 h-2.5 rounded-full bg-violet-400'][i % 4]} />
                  <span className="text-surface-600">{BUCKET_LABEL[b.id] || b.id}</span>
                  <span className="ml-auto font-bold text-navy-900">{formatNaira(b.amount)}</span>
                  <span className="text-surface-500 w-10 text-right">{Math.round(b.share)}%</span>
                </div>
              ))}
            </div>
          </div>

          <div className="card p-5">
            <h3 className="font-bold text-navy-900 mb-1">Repeats</h3>
            <p className="text-xs text-surface-500 mb-3">Merchants or payees that appear more than once.</p>
            {p.merchants.length === 0 ? (
              <p className="text-xs text-surface-500">None of your records carry a merchant name yet. Adding one when you log an expense makes this list worth reading.</p>
            ) : (
              <div className="space-y-2.5">
                {p.merchants.map(m => (
                  <div key={m.name} className="flex items-center gap-3 text-xs">
                    <span className="font-semibold text-navy-900 capitalize">{m.name}</span>
                    <span className="text-surface-500">{m.count} record{m.count === 1 ? '' : 's'}</span>
                    <span className="ml-auto font-bold text-navy-900">{formatNaira(m.amount)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Findings */}
        <div className="lg:col-span-2 card p-5">
          <h3 className="font-bold text-navy-900 mb-1">What stands out</h3>
          <p className="text-xs text-surface-500 mb-4">Each line is a calculation on your own records, not advice generated about you.</p>
          {findings.length === 0 ? (
            <p className="text-sm text-surface-500">Log a few more expenses and this section fills itself in.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {findings.map((f, i) => (
                <div key={i} className="flex gap-3 rounded-xl bg-surface-50 border border-surface-100 p-3.5">
                  <f.icon size={16} className="text-primary-600 shrink-0 mt-0.5" />
                  <p className="text-xs text-surface-700 leading-relaxed">{f.text}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Honesty + links */}
        <div className="lg:col-span-2 grid gap-3 lg:grid-cols-2">
          <div className="card p-4">
            <p className="text-xs text-surface-600 leading-relaxed">
              Patterns describe the past; they do not predict your future spending and they do not change your budget. Your safe-to-spend figure comes from your own income, obligations and savings, and is calculated separately on the Budget page.
            </p>
          </div>
          <div className="card p-4 flex items-center gap-3">
            <BarChart3 size={16} className="text-primary-600 shrink-0" />
            <p className="text-xs text-surface-600 flex-1">Want the raw timeline instead of the shape of it?</p>
            <button onClick={() => navigate('/statistics')} className="btn-secondary text-xs py-2 px-3.5">Open statistics</button>
          </div>
        </div>
      </div>
    </div>
  );
}
