import { useLocation, useNavigate } from 'react-router-dom';
import { Home, ArrowLeftRight, BarChart3, Cloud, User } from 'lucide-react';

const navItems = [
  { path: '/', icon: Home, label: 'Home' },
  { path: '/spend', icon: ArrowLeftRight, label: 'Activity' },
  { path: '/statistics', icon: BarChart3, label: 'Insights' },
  { path: '/savings', icon: Cloud, label: 'Savings' },
  { path: '/profile', icon: User, label: 'Profile' },
];

export default function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-white border-t border-surface-100 safe-bottom z-50 lg:hidden">
      <div className="flex items-center justify-around px-1 py-1.5">
        {navItems.map(({ path, icon: Icon, label }) => {
          const isActive = location.pathname === path;
          return (
            <button key={path} onClick={() => navigate(path)} className={`nav-item ${isActive ? 'active' : ''}`}>
              <Icon size={21} strokeWidth={isActive ? 2.4 : 1.8} />
              <span className="text-[11px] font-medium">{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
