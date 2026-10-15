import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../context/store';
import Header from '../components/Header';
import { formatNaira, formatNairaShort, getCategoryIcon } from '../utils';
import { DEFAULT_CATEGORIES } from '../types';
import type { Transaction } from '../types';
import {
  ResponsiveContainer, BarChart, Bar, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts';
import { ChevronLeft, ChevronRight, TrendingDown, TrendingUp, CalendarDays } from 'lucide-react';
import { chartTheme } from '../config/chartTheme';

type Stream = 'income' | 'expense';
type Period = 'week' | 'month' | 'year';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

function mondayOf(d: Date) {
  const out = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  out.setDate(out.getDate() - ((out.getDay() + 6) % 7));
  return out;
}

interface Bucket { key: string; label: string; full: string; value: number; count: number; }

function rangeFor(period: Period, anchor: Date) {
  if (period === 'week') {
    const start = mondayOf(anchor);
    const end = new Date(start);
    end.setDate(start.getDate() + 7);
    return { start, end };
  }
  if (period === 'month') {
    return { start: new Date(anchor.getFullYear(), anchor.getMonth(), 1), end: new Date(anchor.getFullYear(), anchor.getMonth() + 1, 1) };
  }
  return { start: new Date(anchor.getFullYear(), 0, 1), end: new Date(anchor.getFullYear() + 1, 0, 1) };
}

function buildBuckets(period: Period, anchor: Date): Bucket[] {
  if (period === 'week') {
    const start = mondayOf(anchor);
    return WEEKDAYS.map((label, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return { key: dayKey(d), label, full: d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' }), value: 0, count: 0 };
    });
  }
  if (period === 'month') {
    const days = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0).getDate();
    return Array.from({ length: days }, (_, i) => {
      const d = new Date(anchor.getFullYear(), anchor.getMonth(), i + 1);
      return { key: dayKey(d), label: String(i + 1), full: d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' }), value: 0, count: 0 };
    });
  }
  return MONTHS.map((label, m) => ({
    key: `${anchor.getFullYear()}-${m}`,
    label,
    full: `${label} ${anchor.getFullYear()}`,
    value: 0,
    count: 0,
  }));
}

function fillBuckets(buckets: Bucket[], txs: Transaction[]) {
  const index = new Map(buckets.map((b, i) => [b.key, i]));
  txs.forEach(t => {
    const key = dayKey(new Date(t.date));
    const i = index.get(key);
    if (i !== undefined) { buckets[i].value += t.amountInKobo; buckets[i].count += 1; }
  });
  return buckets;
}

const categoryName = (id: string) => DEFAULT_CATEGORIES.find(c => c.id === id)?.name ?? id.replace('_', ' ');

function ChartTip({ active, payload, stream }: { active?: boolean; payload?: { payload: Bucket }[]; stream: Stream }) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  return (
    <div className="rounded-xl bg-navy-900 px-3 py-2 shadow-card-lg">
      <p className="text-[10px] uppercase tracking-wider text-navy-300">{point.full}</p>
      <p className="text-sm font-bold text-white">{formatNaira(point.value)}</p>
      <p className="text-[10px] text-navy-200">{point.count} {point.count === 1 ? 'record' : 'records'} · {stream === 'income' ? 'money in' : 'money out'}</p>
    </div>
  );
}

export default function StatisticsPage() {
  const navigate = useNavigate();
  const { transactions } = useStore();
  const [stream, setStream] = useState<Stream>('expense');
  const [period, setPeriod] = useState<Period>('month');
  const [anchor, setAnchor] = useState(() => new Date());

  const stats = useMemo(() => {
    const wanted = transactions.filter(t => t.type === stream);
    const { start, end } = rangeFor(period, anchor);
    const inRange = wanted.filter(t => { const d = new Date(t.date); return d >= start && d < end; });
    const buckets = fillBuckets(buildBuckets(period, anchor), inRange);
    const total = buckets.reduce((s, b) => s + b.value, 0);
    const peak = buckets.reduce((best, b) => (b.value > best.value ? b : best), buckets[0]);
    const byCat = new Map<string, number>();
    inRange.forEach(t => byCat.set(t.category, (byCat.get(t.category) || 0) + t.amountInKobo));
    const categories = [...byCat.entries()].map(([id, value]) => ({ id, name: categoryName(id), value }))
      .sort((a, b) => b.value - a.value);
    return { buckets, total, peak, count: inRange.length, categories, start, end };
  }, [transactions, stream, period, anchor]);

  const shift = (dir: 1 | -1) => {
    const d = new Date(anchor);
    if (period === 'week') d.setDate(d.getDate() + dir * 7);
    else if (period === 'month') d.setMonth(d.getMonth() + dir);
    else d.setFullYear(d.getFullYear() + dir);
    setAnchor(d);
  };

  const periodLabel = period === 'week'
    ? `${stats.start.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} – ${(new Date(stats.end.getTime() - 86400000)).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`
    : period === 'month'
      ? `${stats.start.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}`
      : `${stats.start.getFullYear()}`;

  const spanDays = Math.round((stats.end.getTime() - stats.start.getTime()) / 86400000);
  const average = spanDays > 0 ? Math.round(stats.total / spanDays) : stats.total;
  const isBar = period === 'week';
  const color = stream === 'income' ? chartTheme.income : chartTheme.expense;

  const incomeTotal = transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amountInKobo, 0);
  const expenseTotal = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amountInKobo, 0);

  return (
    <div>
      <Header title="Statistics" showBack />

      <div className="px-5 pt-5 pb-8 space-y-5 lg:px-10 lg:pt-10">
        <div>
          <p className="text-[11px] font-semibold tracking-wider text-primary-600 uppercase mb-1">Statistics · {periodLabel}</p>
          <h1 className="text-2xl font-bold text-navy-900 lg:text-3xl">Where your money actually moved</h1>
          <p className="text-sm text-surface-500 mt-1 lg:text-base">Built from the transactions you recorded. Nothing here is estimated.</p>
        </div>

        {/* Balance summary */}
        <div className="grid grid-cols-3 gap-3">
          <div className="card p-4">
            <p className="text-xs text-surface-500 mb-1">Money in</p>
            <p className="text-lg font-bold text-emerald-700">{formatNaira(incomeTotal)}</p>
          </div>
          <div className="card p-4">
            <p className="text-xs text-surface-500 mb-1">Money out</p>
            <p className="text-lg font-bold text-navy-900">{formatNaira(expenseTotal)}</p>
          </div>
          <div className="card p-4">
            <p className="text-xs text-surface-500 mb-1">Balance</p>
            <p className={`text-lg font-bold ${incomeTotal - expenseTotal >= 0 ? 'text-emerald-700' : 'text-red-500'}`}>
              {formatNaira(incomeTotal - expenseTotal)}
            </p>
          </div>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex gap-1 bg-surface-100 p-1 rounded-xl">
            {([['expense', 'Spend'], ['income', 'Income']] as [Stream, string][]).map(([value, label]) => (
              <button key={value} onClick={() => setStream(value)} aria-pressed={stream === value}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${stream === value ? 'bg-white text-navy-900 shadow-card' : 'text-surface-500'}`}>
                {label}
              </button>
            ))}
          </div>
          <div className="flex gap-1 bg-surface-100 p-1 rounded-xl" role="group" aria-label="Chart period">
            {(['week', 'month', 'year'] as Period[]).map(p => (
              <button key={p} onClick={() => setPeriod(p)} aria-pressed={period === p}
                className={`px-3.5 py-2 rounded-lg text-sm font-semibold capitalize transition-all ${period === p ? 'bg-navy-800 text-white' : 'text-surface-500'}`}>
                {p}
              </button>
            ))}
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button onClick={() => shift(-1)} aria-label="Previous period" className="w-9 h-9 rounded-xl bg-white border border-surface-200 flex items-center justify-center active:scale-95 transition-transform">
              <ChevronLeft size={16} className="text-navy-800" />
            </button>
            <label className="relative flex items-center gap-2 px-3 h-9 rounded-xl bg-white border border-surface-200">
              <CalendarDays size={14} className="text-surface-500" />
              <span className="text-xs font-semibold text-navy-800">{periodLabel}</span>
              <input
                type="date"
                value={`${anchor.getFullYear()}-${String(anchor.getMonth() + 1).padStart(2, '0')}-${String(anchor.getDate()).padStart(2, '0')}`}
                onChange={(e) => { if (e.target.value) setAnchor(new Date(`${e.target.value}T12:00:00`)); }}
                aria-label="Pick date"
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
            </label>
            <button onClick={() => shift(1)} aria-label="Next period" className="w-9 h-9 rounded-xl bg-white border border-surface-200 flex items-center justify-center active:scale-95 transition-transform">
              <ChevronRight size={16} className="text-navy-800" />
            </button>
          </div>
        </div>

        {/* Chart + breakdown */}
        <div className="grid gap-5 lg:grid-cols-3">
          <div className="card p-5 lg:col-span-2">
            <div className="flex items-start justify-between mb-4">
              <div>
                <p className="text-[11px] font-semibold tracking-wider text-primary-600 uppercase">On {period}</p>
                <h3 className="font-bold text-navy-900">{stream === 'income' ? 'Money in' : 'Money out'} · {formatNaira(stats.total)}</h3>
              </div>
              <div className="text-right">
                <p className="text-[11px] text-surface-500">Busiest {period === 'year' ? 'month' : 'day'}</p>
                <p className="text-sm font-bold text-navy-900">{stats.peak.value > 0 ? stats.peak.full : '—'}</p>
                {stats.peak.value > 0 && <p className="text-[11px] text-surface-500">{formatNaira(stats.peak.value)}</p>}
              </div>
            </div>

            {stats.total > 0 ? (
              <div className="h-60 lg:h-72 -ml-2">
                <ResponsiveContainer width="100%" height="100%">
                  {isBar ? (
                    <BarChart data={stats.buckets} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                      <CartesianGrid stroke={chartTheme.grid} vertical={false} />
                      <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: chartTheme.tick }} />
                      <YAxis tickFormatter={(v: number) => formatNairaShort(v)} tickLine={false} axisLine={false} width={52} tick={{ fontSize: 10, fill: chartTheme.tick }} />
                      <Tooltip content={<ChartTip stream={stream} />} cursor={{ fill: chartTheme.tooltipCursor }} />
                      <Bar dataKey="value" fill={color} radius={[6, 6, 0, 0]} maxBarSize={38} />
                    </BarChart>
                  ) : (
                    <AreaChart data={stats.buckets} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                      <defs>
                        <linearGradient id="statArea" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={color} stopOpacity={0.28} />
                          <stop offset="100%" stopColor={color} stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke={chartTheme.grid} vertical={false} />
                      <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: chartTheme.tick }} interval={period === 'month' ? 4 : 0} />
                      <YAxis tickFormatter={(v: number) => formatNairaShort(v)} tickLine={false} axisLine={false} width={52} tick={{ fontSize: 10, fill: chartTheme.tick }} />
                      <Tooltip content={<ChartTip stream={stream} />} />
                      <Area type="monotone" dataKey="value" stroke={color} strokeWidth={2.5} fill="url(#statArea)" />
                    </AreaChart>
                  )}
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-60 lg:h-72 flex flex-col items-center justify-center text-center border border-dashed border-surface-200 rounded-2xl px-6">
                <p className="text-sm font-semibold text-navy-900 mb-1">Nothing recorded in this {period}</p>
                <p className="text-xs text-surface-500 max-w-xs leading-relaxed">
                  Add a transaction or move to another {period} — this chart only shows what you have actually recorded.
                </p>
              </div>
            )}

            <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-surface-100">
              <div>
                <p className="text-[11px] text-surface-500">Average per day</p>
                <p className="text-sm font-bold text-navy-900">{formatNaira(average)}</p>
              </div>
              <div>
                <p className="text-[11px] text-surface-500">Records</p>
                <p className="text-sm font-bold text-navy-900">{stats.count}</p>
              </div>
              <div>
                <p className="text-[11px] text-surface-500">{stream === 'income' ? 'Sources' : 'Categories'}</p>
                <p className="text-sm font-bold text-navy-900">{stats.categories.length}</p>
              </div>
            </div>
          </div>

          {/* Breakdown */}
          <div className="card p-5">
            <h3 className="font-bold text-navy-900 mb-1">{stream === 'income' ? 'Where it came from' : 'Where it went'}</h3>
            <p className="text-xs text-surface-500 mb-4">Share of {formatNaira(stats.total)} in this {period}.</p>
            {stats.categories.length === 0 ? (
              <p className="text-xs text-surface-500 py-6 text-center">No {stream === 'income' ? 'income' : 'spending'} recorded for these dates yet.</p>
            ) : (
              <div className="space-y-3.5">
                {stats.categories.slice(0, 7).map(c => {
                  const pct = stats.total ? Math.round((c.value / stats.total) * 100) : 0;
                  return (
                    <div key={c.id}>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs font-semibold text-navy-900 flex items-center gap-1.5">
                          <span aria-hidden>{getCategoryIcon(c.id)}</span>{c.name}
                        </span>
                        <span className="text-xs font-bold text-navy-900">{formatNaira(c.value)}</span>
                      </div>
                      <div className="h-1.5 bg-surface-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
                      </div>
                      <p className="text-[10px] text-surface-500 mt-1">{pct}% of this {period}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          <div className="card p-4 flex gap-3">
            <TrendingUp size={16} className="text-emerald-700 shrink-0 mt-0.5" />
            <p className="text-xs text-surface-600 leading-relaxed">
              {stream === 'income'
                ? 'Income is whatever you record as money in — allowance, side work or a refund. It sets your cycle allowance and safe-to-spend.'
                : `Across all recorded history you have spent ${formatNaira(expenseTotal)} against ${formatNaira(incomeTotal)} received.`}
            </p>
          </div>
          <div className="card p-4 flex gap-3">
            <TrendingDown size={16} className="text-primary-600 shrink-0 mt-0.5" />
            <p className="text-xs text-surface-600 leading-relaxed flex-1">
              Charts read the same records as your budget, so a number here always matches your Spend list.
              Import a bank statement from the Spend screen to fill in gaps.
            </p>
            <button onClick={() => navigate('/patterns')} className="btn-secondary text-xs py-2 px-3.5 h-fit shrink-0">Patterns</button>
          </div>
        </div>
      </div>
    </div>
  );
}
