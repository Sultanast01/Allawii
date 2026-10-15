import { useNavigate } from 'react-router-dom';
import { useStore } from '../context/store';
import Header from '../components/Header';
import BMoniCard from '../components/BMoniCard';
import { formatNaira, formatNairaShort, daysUntil, getRelativeTime, getCategoryIcon } from '../utils';
import { Plus, ScanLine, ShoppingCart, Cloud, Sparkles, ChevronRight, Flame, Tag, BookOpen, CalendarDays, BarChart3, Fingerprint } from 'lucide-react';

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function longDate() {
  return new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }).toUpperCase();
}

export default function HomePage() {
  const navigate = useNavigate();
  const { user, getSafeToSpend, getMonthlyAllowance, getTotalBalance, transactions, savingsGoals, insights, getStreak, isDemoMode, markInsightRead } = useStore();

  const safe = getSafeToSpend();
  const streakView = getStreak();
  const allowance = getMonthlyAllowance();
  const balance = getTotalBalance();
  const spent = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amountInKobo, 0);
  const reserved = savingsGoals.filter(g => !g.isPaused).reduce((s, g) => s + g.contributionPerCycleInKobo, 0);
  const daysLeft = user?.nextIncomeDate ? daysUntil(user.nextIncomeDate) : 0;
  const nextIncomeLabel = user?.nextIncomeDate
    ? new Date(user.nextIncomeDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
    : '';
  const spentPct = allowance > 0 ? Math.min(100, (spent / allowance) * 100) : 0;
  const recent = transactions.slice(0, 6);
  const unread = insights.filter(i => !i.isRead);

  const cycleLabel = user?.incomeFrequency === 'weekly'
    ? 'Weekly cycle'
    : user?.incomeFrequency === 'daily'
      ? 'Daily cycle'
      : 'Monthly cycle';

  const quickActions = [
    { label: 'Add expense', icon: Plus, color: 'bg-primary-50 text-primary-600', path: '/add-expense' },
    { label: 'Scan receipt', icon: ScanLine, color: 'bg-purple-50 text-purple-600', path: '/receipt' },
    { label: 'Can I afford it?', icon: ShoppingCart, color: 'bg-teal-50 text-teal-600', path: '/afford' },
    { label: 'Create a goal', icon: Cloud, color: 'bg-emerald-50 text-emerald-700', path: '/savings' },
  ];

  return (
    <div>
      <Header title="Overview" />

      <div className="px-5 pt-5 lg:px-10 lg:pt-10">
        {/* Greeting */}
        <div className="flex items-start justify-between mb-6 lg:mb-8">
          <div>
            <p className="text-[11px] font-semibold tracking-wider text-primary-600 mb-1">{longDate()}</p>
            <h1 className="text-2xl font-bold text-navy-900 lg:text-3xl">{greeting()}, {user?.name}</h1>
            <p className="text-sm text-surface-500 mt-1 lg:text-base">Let's make your allowance work for you.</p>
          </div>
          <button onClick={() => navigate('/coach')} className="w-10 h-10 bg-gradient-to-br from-primary-500 to-primary-700 rounded-xl flex items-center justify-center shadow-lg active:scale-95 transition-transform shrink-0 hover:scale-105">
            <Sparkles size={18} className="text-white" />
          </button>
        </div>

        {/* Survival mode */}
        {daysLeft > 0 && (safe.unallocatedInKobo <= 0 || safe.dailyLimitInKobo < 50000) && (
          <div className="bg-red-50 border border-red-100 rounded-2xl p-4 animate-slide-up mb-5">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center shrink-0">
                <Flame size={18} className="text-red-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold text-red-800">Survival mode · {daysLeft} days to next income</p>
                <p className="text-xs text-red-700 mt-0.5">
                  {safe.unallocatedInKobo <= 0
                    ? 'Your plan has no room left this cycle. Pausing a goal or waiting for the next income are both valid — but that choice should be yours, not an accident.'
                    : `Only ${formatNaira(safe.dailyLimitInKobo)} a day covers what is left. Skipping one treat keeps your dues and data safe.`}
                </p>
                <button onClick={() => navigate('/budget')} className="mt-2 text-xs font-semibold text-red-700 underline underline-offset-2">
                  See what can be trimmed
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-5 pb-6 lg:grid lg:grid-cols-12 lg:gap-8 lg:space-y-0 lg:items-start">
          {/* Main column */}
          <div className="space-y-5 lg:col-span-8 lg:space-y-6">
            {/* Balance card */}
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-navy-700 via-navy-800 to-navy-950 p-6 text-white shadow-2xl lg:p-8">
              <div className="absolute -top-24 -right-16 w-64 h-64 rounded-full bg-primary-500/20 blur-3xl" aria-hidden="true" />
              <div className="absolute -bottom-28 -left-10 w-56 h-56 rounded-full bg-navy-400/25 blur-3xl" aria-hidden="true" />

              <div className="relative flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <span className="w-7 h-7 rounded-lg bg-white/15 flex items-center justify-center text-[13px] font-bold">A</span>
                  <span className="text-[13px] font-semibold tracking-wide">Allawii</span>
                </div>
                <p className="text-[10px] font-semibold tracking-wider text-navy-200 uppercase">{cycleLabel}</p>
              </div>

              <div className="relative flex items-start gap-4 mb-5">
                {/* Decorative chip — this is a plan card, so it carries no account or card number */}
                <div className="w-11 h-8 rounded-md bg-gradient-to-br from-amber-200 to-amber-400 shrink-0 relative overflow-hidden" aria-hidden="true">
                  <div className="absolute inset-x-1 top-1/2 h-px bg-amber-700/30" />
                  <div className="absolute inset-y-1 left-1/2 w-px bg-amber-700/30" />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold tracking-wider text-navy-200 uppercase">Remaining allowance</p>
                  <h2 className="text-[34px] lg:text-4xl font-bold tracking-tight leading-tight truncate">{formatNaira(safe.unallocatedInKobo)}</h2>
                  <p className="text-sm text-navy-200">
                    of {formatNaira(allowance)} · {daysLeft} day{daysLeft === 1 ? '' : 's'} to {nextIncomeLabel || 'next income'}
                  </p>
                </div>
              </div>

              <div className="relative h-2 bg-white/10 rounded-full overflow-hidden mb-3">
                <div className="h-full bg-primary-400 rounded-full transition-all duration-700" style={{ width: `${spentPct}%` }} />
              </div>

              <div className="relative flex items-center justify-between text-sm mb-5">
                <span className="flex items-center gap-1.5 text-navy-100">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary-400" /> Spent <b className="text-white">{formatNaira(spent)}</b>
                </span>
                <span className="flex items-center gap-1.5 text-navy-100">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Available <b className="text-white">{formatNaira(safe.unallocatedInKobo)}</b>
                </span>
              </div>

              <div className="relative flex items-end justify-between gap-4 pt-4 border-t border-white/10">
                <div className="min-w-0">
                  <p className="text-[11px] tracking-wider text-navy-300 uppercase mb-0.5">Plan holder</p>
                  <p className="text-[13px] font-semibold uppercase tracking-wide truncate">{user?.name || 'Allawii user'}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[11px] tracking-wider text-navy-300 uppercase mb-0.5">Balance on hand</p>
                  <p className="text-[13px] font-semibold">{formatNaira(balance)}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[11px] tracking-wider text-navy-300 uppercase mb-0.5">Reserved</p>
                  <p className="text-[13px] font-semibold">{formatNairaShort(reserved)}</p>
                </div>
              </div>
            </div>

            {/* B Moni Wallet Card */}
            <BMoniCard />

            {/* Safe to Spend Today */}
            <div className="bg-primary-50 rounded-2xl p-5 border border-primary-100">
              <div className="flex items-start justify-between mb-2">
                <p className="text-[11px] font-semibold tracking-wider text-primary-600 uppercase">Safe to Spend Today</p>
                <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center shadow-sm">
                  <Sparkles size={15} className="text-primary-600" />
                </div>
              </div>
              <h2 className="text-3xl font-bold text-navy-900 mb-1">{formatNaira(safe.dailyLimitInKobo)}</h2>
              <p className="text-sm text-surface-500 mb-2">Your daily guide to stay on track until {nextIncomeLabel || 'your next income'}.</p>
              <button onClick={() => navigate('/budget')} className="text-sm font-semibold text-primary-600 flex items-center gap-0.5">
                See how it's calculated <ChevronRight size={15} />
              </button>
            </div>

            {/* Quick actions */}
            <div>
              <h3 className="font-bold text-navy-900 mb-3">Quick actions</h3>
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                {quickActions.map(({ label, icon: Icon, color, path }) => (
                  <button key={label} onClick={() => navigate(path)} className="card p-4 flex flex-col gap-2.5 text-left active:scale-[0.98] transition-transform">
                    <div className={`icon-tile ${color}`}>
                      <Icon size={19} strokeWidth={2.2} />
                    </div>
                    <span className="text-sm font-semibold text-navy-900">{label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Recent activity */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-navy-900">Recent activity</h3>
                <button onClick={() => navigate('/spend')} className="text-xs font-semibold text-primary-600">See all</button>
              </div>
              <div className="card divide-y divide-surface-100">
                {recent.length === 0 && (
                  <p className="p-4 text-sm text-surface-500">Nothing recorded yet. Add an expense or scan a receipt and this fills up.</p>
                )}
                {recent.map(tx => (
                  <div key={tx.id} className="flex items-center gap-3 p-3.5">
                    <div className="w-9 h-9 bg-surface-100 rounded-lg flex items-center justify-center text-base">{getCategoryIcon(tx.category)}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-navy-900 truncate">{tx.description}</p>
                      <p className="text-xs text-surface-500">{getRelativeTime(tx.date)}</p>
                    </div>
                    <span className={`font-bold text-sm ${tx.type === 'income' ? 'text-emerald-700' : 'text-navy-900'}`}>
                      {tx.type === 'income' ? '+' : '−'}{formatNaira(tx.amountInKobo)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Side column */}
          <div className="space-y-5 lg:col-span-4 lg:sticky lg:top-8">
            {streakView.dates.length > 0 && (
              <button onClick={() => navigate('/savings')} className="card p-4 w-full flex items-center gap-3 text-left">
                <div className="w-11 h-11 bg-amber-50 rounded-xl flex items-center justify-center">
                  <Flame size={20} className={streakView.current > 0 ? 'text-amber-500' : 'text-surface-300'} />
                </div>
                <div className="flex-1">
                  <p className="font-bold text-navy-900 text-sm">
                    {streakView.current > 0 ? `${streakView.current}-day saving streak` : 'Saving streak paused'}
                  </p>
                  <p className="text-xs text-surface-500">
                    {streakView.current === 0
                      ? `Last saving day was ${streakView.daysSinceLast} day${streakView.daysSinceLast === 1 ? '' : 's'} ago`
                      : streakView.next
                        ? `${streakView.next.remaining} more ${streakView.next.remaining === 1 ? 'day' : 'days'} to ${streakView.next.label}`
                        : `Longest run: ${streakView.longest} days`}
                  </p>
                </div>
                <ChevronRight size={16} className="text-surface-500" />
              </button>
            )}

            {unread.length > 0 && (
              <div>
                <h3 className="font-bold text-navy-900 mb-3">Insights for you</h3>
                <div className="space-y-2">
                  {unread.slice(0, 3).map(ins => (
                    <button
                      key={ins.id}
                      onClick={() => markInsightRead(ins.id)}
                      className={`card p-4 flex gap-3 border-l-4 w-full text-left active:scale-[0.99] transition-transform ${
                        ins.type === 'warning' ? 'border-l-amber-400' : 'border-l-primary-400'
                      }`}
                    >
                      <div className="flex-1">
                        <p className="font-semibold text-sm text-navy-900">{ins.title}</p>
                        <p className="text-xs text-surface-500 mt-0.5">{ins.message}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <h3 className="font-bold text-navy-900 mb-3">Explore</h3>
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => navigate('/offers')} className="card p-4 text-left active:scale-[0.98] transition-transform">
                  <div className="w-10 h-10 bg-pink-50 rounded-xl flex items-center justify-center mb-2"><Tag size={18} className="text-pink-600" /></div>
                  <p className="font-semibold text-sm text-navy-900">Student deals</p>
                  <p className="text-xs text-surface-500">Save on essentials</p>
                </button>
                <button onClick={() => navigate('/literacy')} className="card p-4 text-left active:scale-[0.98] transition-transform">
                  <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center mb-2"><BookOpen size={18} className="text-indigo-600" /></div>
                  <p className="font-semibold text-sm text-navy-900">Money skills</p>
                  <p className="text-xs text-surface-500">Learn & grow</p>
                </button>
                <button onClick={() => navigate('/calendar')} className="card p-4 text-left active:scale-[0.98] transition-transform">
                  <div className="w-10 h-10 bg-sky-50 rounded-xl flex items-center justify-center mb-2"><CalendarDays size={18} className="text-sky-600" /></div>
                  <p className="font-semibold text-sm text-navy-900">Calendar</p>
                  <p className="text-xs text-surface-500">Deadlines & income</p>
                </button>
                <button onClick={() => navigate('/bmoni')} className="card p-4 text-left active:scale-[0.98] transition-transform">
                  <div className="w-10 h-10 bg-navy-50 rounded-xl flex items-center justify-center mb-2"><span className="text-navy-800 font-bold text-sm">₿</span></div>
                  <p className="font-semibold text-sm text-navy-900">B Moni wallet</p>
                  <p className="text-xs text-surface-500">Sandbox linked</p>
                </button>
                <button onClick={() => navigate('/statistics')} className="card p-4 text-left active:scale-[0.98] transition-transform">
                  <div className="w-10 h-10 bg-primary-50 rounded-xl flex items-center justify-center mb-2"><BarChart3 size={18} className="text-primary-600" /></div>
                  <p className="font-semibold text-sm text-navy-900">Statistics</p>
                  <p className="text-xs text-surface-500">Charted by day, month, year</p>
                </button>
                <button onClick={() => navigate('/patterns')} className="card p-4 text-left active:scale-[0.98] transition-transform">
                  <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center mb-2"><Fingerprint size={18} className="text-amber-600" /></div>
                  <p className="font-semibold text-sm text-navy-900">Your patterns</p>
                  <p className="text-xs text-surface-500">When and on what you spend</p>
                </button>
              </div>
            </div>

            {isDemoMode && (
              <p className="text-center text-[11px] text-surface-500">You're viewing demo data</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
