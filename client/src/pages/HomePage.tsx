import { useNavigate } from 'react-router-dom';
import { useStore } from '../context/store';
import Header from '../components/Header';
import { formatNaira, formatNairaShort, daysUntil, getRelativeTime, getCategoryIcon } from '../utils';
import { Plus, ScanLine, ShoppingCart, Cloud, Sparkles, ChevronRight, Flame, Tag, BookOpen, CalendarDays } from 'lucide-react';

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
  const { user, getSafeToSpend, getMonthlyAllowance, transactions, savingsGoals, insights, streak, isDemoMode } = useStore();

  const safe = getSafeToSpend();
  const allowance = getMonthlyAllowance();
  const spent = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
  const daysLeft = user?.nextIncomeDate ? daysUntil(user.nextIncomeDate) : 0;
  const nextIncomeLabel = user?.nextIncomeDate
    ? new Date(user.nextIncomeDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
    : '';
  const spentPct = allowance > 0 ? Math.min(100, (spent / allowance) * 100) : 0;
  const recent = transactions.slice(0, 4);
  const unread = insights.filter(i => !i.isRead);

  const quickActions = [
    { label: 'Add expense', icon: Plus, color: 'bg-primary-50 text-primary-600', path: '/add-expense' },
    { label: 'Scan receipt', icon: ScanLine, color: 'bg-purple-50 text-purple-600', path: '/receipt' },
    { label: 'Can I afford it?', icon: ShoppingCart, color: 'bg-teal-50 text-teal-600', path: '/afford' },
    { label: 'Create a goal', icon: Cloud, color: 'bg-emerald-50 text-emerald-600', path: '/savings' },
  ];

  return (
    <div>
      <Header title="Overview" />

      <div className="px-5 pt-5 space-y-5">
        {/* Greeting */}
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[11px] font-semibold tracking-wider text-primary-600 mb-1">{longDate()}</p>
            <h1 className="text-2xl font-bold text-navy-900">{greeting()}, {user?.name}</h1>
            <p className="text-sm text-surface-500 mt-0.5">Let’s make your allowance work for you.</p>
          </div>
          <button onClick={() => navigate('/coach')} className="w-10 h-10 bg-primary-600 rounded-xl flex items-center justify-center shadow-card active:scale-95 transition-transform shrink-0">
            <Sparkles size={18} className="text-white" />
          </button>
        </div>

        {/* Survival mode */}
        {daysLeft > 0 && (safe.unallocated <= 0 || safe.dailyLimit < 500) && (
          <div className="bg-red-50 border border-red-100 rounded-2xl p-4 animate-slide-up">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center shrink-0">
                <Flame size={18} className="text-red-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold text-red-800">Survival mode · {daysLeft} days to next income</p>
                <p className="text-xs text-red-700 mt-0.5">
                  {safe.unallocated <= 0
                    ? 'Your plan has no room left this cycle. Pausing a goal or waiting for the next income are both valid — but that choice should be yours, not an accident.'
                    : `Only ${formatNaira(safe.dailyLimit)} a day covers what is left. Skipping one treat keeps your dues and data safe.`}
                </p>
                <button onClick={() => navigate('/budget')} className="mt-2 text-xs font-semibold text-red-700 underline underline-offset-2">
                  See what can be trimmed
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Remaining Allowance — navy card */}
        <div className="bg-navy-800 rounded-2xl p-5 text-white shadow-card-lg">
          <div className="flex items-start justify-between mb-3">
            <p className="text-[11px] font-semibold tracking-wider text-navy-200 uppercase">Remaining Allowance</p>
            <div className="bg-white/10 rounded-xl px-3 py-1.5 text-center">
              <p className="text-lg font-bold leading-none">{daysLeft}</p>
              <p className="text-[10px] text-navy-200">days left</p>
            </div>
          </div>
          <h2 className="text-4xl font-bold tracking-tight mb-1">{formatNaira(safe.unallocated)}</h2>
          <p className="text-sm text-navy-200 mb-4">of {formatNaira(allowance)} monthly allowance</p>
          <div className="h-2 bg-white/10 rounded-full overflow-hidden mb-3">
            <div className="h-full bg-primary-400 rounded-full transition-all duration-700" style={{ width: `${spentPct}%` }} />
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-1.5 text-navy-100">
              <span className="w-1.5 h-1.5 rounded-full bg-primary-400" /> Spent <b className="text-white">{formatNaira(spent)}</b>
            </span>
            <span className="flex items-center gap-1.5 text-navy-100">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> Available <b className="text-white">{formatNaira(safe.unallocated)}</b>
            </span>
          </div>
        </div>

        {/* Safe to Spend Today — light blue card */}
        <div className="bg-primary-50 rounded-2xl p-5 border border-primary-100">
          <div className="flex items-start justify-between mb-2">
            <p className="text-[11px] font-semibold tracking-wider text-primary-600 uppercase">Safe to Spend Today</p>
            <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center shadow-sm">
              <Sparkles size={15} className="text-primary-600" />
            </div>
          </div>
          <h2 className="text-3xl font-bold text-navy-900 mb-1">{formatNaira(safe.dailyLimit)}</h2>
          <p className="text-sm text-surface-500 mb-2">Your daily guide to stay on track until {nextIncomeLabel}.</p>
          <button onClick={() => navigate('/budget')} className="text-sm font-semibold text-primary-600 flex items-center gap-0.5">
            See how it’s calculated <ChevronRight size={15} />
          </button>
        </div>

        {/* Quick actions */}
        <div>
          <h3 className="font-bold text-navy-900 mb-3">Quick actions</h3>
          <div className="grid grid-cols-2 gap-3">
            {quickActions.map(({ label, icon: Icon, color, path }) => (
              <button key={label} onClick={() => navigate(path)} className="card p-4 flex items-center gap-3 text-left active:scale-[0.98] transition-transform">
                <div className={`icon-tile ${color}`}>
                  <Icon size={19} strokeWidth={2.2} />
                </div>
                <span className="text-sm font-semibold text-navy-900">{label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Streak */}
        {streak.currentStreak > 0 && (
          <button onClick={() => navigate('/savings')} className="card p-4 w-full flex items-center gap-3 text-left">
            <div className="w-11 h-11 bg-amber-50 rounded-xl flex items-center justify-center">
              <Flame size={20} className="text-amber-500" />
            </div>
            <div className="flex-1">
              <p className="font-bold text-navy-900 text-sm">{streak.currentStreak}-day saving streak</p>
              <p className="text-xs text-surface-500">Next milestone at {streak.milestones.find(m => m > streak.currentStreak) || '∞'} days</p>
            </div>
            <ChevronRight size={16} className="text-surface-400" />
          </button>
        )}

        {/* Recent activity */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-navy-900">Recent activity</h3>
            <button onClick={() => navigate('/spend')} className="text-xs font-semibold text-primary-600">See all</button>
          </div>
          <div className="card divide-y divide-surface-100">
            {recent.map(tx => (
              <div key={tx.id} className="flex items-center gap-3 p-3.5">
                <div className="w-9 h-9 bg-surface-100 rounded-lg flex items-center justify-center text-base">{getCategoryIcon(tx.category)}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-navy-900 truncate">{tx.description}</p>
                  <p className="text-xs text-surface-400">{getRelativeTime(tx.date)}</p>
                </div>
                <span className={`font-bold text-sm ${tx.type === 'income' ? 'text-emerald-600' : 'text-navy-900'}`}>
                  {tx.type === 'income' ? '+' : '−'}{formatNaira(tx.amount)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Insights */}
        {unread.length > 0 && (
          <div>
            <h3 className="font-bold text-navy-900 mb-3">Insights for you</h3>
            <div className="space-y-2">
              {unread.slice(0, 2).map(ins => (
                <div key={ins.id} className={`card p-4 flex gap-3 border-l-4 ${
                  ins.type === 'warning' ? 'border-l-amber-400' : 'border-l-primary-400'
                }`}>
                  <div>
                    <p className="font-semibold text-sm text-navy-900">{ins.title}</p>
                    <p className="text-xs text-surface-500 mt-0.5">{ins.message}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Explore grid */}
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
          </div>
        </div>

        {isDemoMode && (
          <p className="text-center text-[11px] text-surface-400 pb-2">You’re viewing demo data</p>
        )}
      </div>
    </div>
  );
}
