import { useLocation, useNavigate } from 'react-router-dom';
import { useStore } from '../context/store';
import {
  Home, ArrowLeftRight, BarChart3, Cloud, User, Plus, ScanLine, ShoppingCart,
  TrendingUp, CalendarDays, Users, Tag, BookOpen, ShieldAlert, Wallet2, LogOut, Settings, Fingerprint, Bell, RefreshCw, SlidersHorizontal,
} from 'lucide-react';
import { formatNaira } from '../utils';
import { countUnreadAlerts } from '../utils/alerts';

const primary = [
  { path: '/', icon: Home, label: 'Home' },
  { path: '/spend', icon: ArrowLeftRight, label: 'Activity' },
  { path: '/statistics', icon: BarChart3, label: 'Insights' },
  { path: '/budget', icon: SlidersHorizontal, label: 'My budget' },
  { path: '/savings', icon: Cloud, label: 'Savings' },
  { path: '/profile', icon: User, label: 'Profile' },
];

const tools = [
  { path: '/add-expense', icon: Plus, label: 'Add expense' },
  { path: '/receipt', icon: ScanLine, label: 'Scan receipt' },
  { path: '/afford', icon: ShoppingCart, label: 'Can I afford it?' },
  { path: '/what-if', icon: TrendingUp, label: 'What-if simulator' },
  { path: '/adaptive', icon: RefreshCw, label: 'Adaptive budgeting' },
  { path: '/statistics', icon: BarChart3, label: 'Statistics' },
  { path: '/patterns', icon: Fingerprint, label: 'Spending patterns' },
];

const more = [
  { path: '/notifications', icon: Bell, label: 'Notifications' },
  { path: '/calendar', icon: CalendarDays, label: 'Calendar' },
  { path: '/groups', icon: Users, label: 'Groups' },
  { path: '/offers', icon: Tag, label: 'Student deals' },
  { path: '/literacy', icon: BookOpen, label: 'Money skills' },
  { path: '/scam', icon: ShieldAlert, label: 'Scam check' },
  { path: '/bmoni', icon: Wallet2, label: 'B Moni wallet' },
];

function Group({ title, items }: { title?: string; items: typeof primary }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  return (
    <div className="mb-7">
      {title && <p className="text-[10px] font-semibold tracking-wider text-navy-400 uppercase px-3 mb-2.5">{title}</p>}
      <div className="space-y-0.5">
        {items.map(({ path, icon: Icon, label }) => {
          const active = pathname === path;
          return (
            <button
              key={path}
              onClick={() => navigate(path)}
              aria-current={active ? 'page' : undefined}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all ${
                active ? 'bg-white/15 text-white font-semibold shadow-lg backdrop-blur-sm' : 'text-navy-200 hover:bg-white/8 hover:text-white'
              }`}
            >
              <Icon size={17} strokeWidth={active ? 2.3 : 1.8} />
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function Sidebar() {
  const navigate = useNavigate();
  const state = useStore();
  const { user, isDemoMode, logout, getSafeToSpend } = state;
  const safe = getSafeToSpend();
  const unread = countUnreadAlerts(state);

  return (
    <aside className="hidden lg:flex lg:w-72 lg:shrink-0 lg:h-screen lg:sticky lg:top-0 lg:flex-col bg-gradient-to-b from-navy-900 via-navy-900 to-navy-950 text-white px-5 py-7 border-r border-white/5">
      <button onClick={() => navigate('/')} className="flex items-center gap-3 px-3 mb-8 text-left group">
        <img src="/brand/allawii-mark.png" alt="Allawii mark" className="w-10 h-10 rounded-xl shadow-lg group-hover:scale-105 transition-transform" />
        <span>
          <span className="block text-base font-bold leading-tight">Allawii</span>
          <span className="block text-[11px] text-navy-300">Student finance companion</span>
        </span>
      </button>

      <div className="px-4 py-4 rounded-2xl bg-gradient-to-br from-white/[0.08] to-white/[0.03] border border-white/10 mb-8 backdrop-blur-sm">
        <p className="text-[10px] text-navy-300 uppercase tracking-wider font-semibold">Safe to spend today</p>
        <p className="text-2xl font-bold mt-1 bg-gradient-to-r from-white to-navy-200 bg-clip-text text-transparent">{formatNaira(safe.dailyLimitInKobo)}</p>
        <div className="flex items-center gap-2 mt-2 pt-2 border-t border-white/5">
          <div className="flex-1">
            <p className="text-[11px] text-navy-200">
              {safe.daysUntilNextIncome} day{safe.daysUntilNextIncome === 1 ? '' : 's'} to income
            </p>
          </div>
          {safe.isEstimate && (
            <span className="text-[9px] text-navy-400 bg-white/5 px-1.5 py-0.5 rounded">est.</span>
          )}
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto scrollbar-hide">
        <Group items={primary} />
        <Group title="Quick tools" items={tools} />
        <Group title="More" items={more} />
      </nav>

      <button
        onClick={() => navigate('/profile')}
        className="flex items-center gap-3 px-4 py-3.5 rounded-2xl bg-gradient-to-br from-white/[0.08] to-white/[0.03] border border-white/10 hover:from-white/[0.12] hover:to-white/[0.05] transition-all text-left group"
      >
        <span className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center font-bold text-sm shadow-lg group-hover:scale-105 transition-transform">
          {user?.name?.charAt(0).toUpperCase() || 'A'}
        </span>
        <span className="flex-1 min-w-0">
          <span className="block text-sm font-semibold truncate">{user?.name}</span>
          <span className="block text-[11px] text-navy-300">{isDemoMode ? 'Demo data' : user?.email}</span>
        </span>
        {unread > 0 && <span className="text-[10px] font-bold bg-primary-500 text-white px-2 py-0.5 rounded-full shadow-lg">{unread}</span>}
      </button>

      <div className="flex items-center gap-2 mt-3">
        <button onClick={() => navigate('/profile')} className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-[13px] text-navy-200 hover:bg-white/5 transition-colors">
          <Settings size={15} /> Settings
        </button>
        <button
          onClick={() => { logout(); navigate('/'); }}
          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-[13px] text-red-300 hover:bg-red-500/10 transition-colors"
        >
          <LogOut size={15} /> Sign out
        </button>
      </div>
    </aside>
  );
}
