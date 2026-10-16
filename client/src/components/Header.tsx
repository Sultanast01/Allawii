import { useLocation, useNavigate } from 'react-router-dom';
import { Bell, ChevronLeft } from 'lucide-react';
import { useStore } from '../context/store';
import { countUnreadAlerts } from '../utils/alerts';

/** Routes that sit on the bottom tab bar — they are top-level, so they show the brand mark instead of a back chevron. */
const TAB_PATHS = new Set(['/', '/spend', '/statistics', '/savings', '/profile']);

export default function Header({ title }: { title: string }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const state = useStore();
  const unread = countUnreadAlerts(state);
  const isTab = TAB_PATHS.has(pathname);

  return (
    <div className="sticky top-0 z-40 bg-surface-50/90 backdrop-blur-md border-b border-surface-100">
      <div className="flex items-center justify-between px-5 h-14 lg:px-8">
        <div className="flex items-center gap-2.5">
          {isTab ? (
            <button
              onClick={() => navigate('/')}
              aria-label="Allawii home"
              className="w-10 h-10 rounded-xl overflow-hidden active:scale-95 transition-transform"
            >
              <img src="/brand/allawii-mark.png" alt="" className="w-full h-full object-cover" />
            </button>
          ) : (
            <button
              onClick={() => (window.history.state?.idx > 0 ? navigate(-1) : navigate('/'))}
              aria-label="Go back"
              className="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-surface-100 active:scale-95 transition-transform"
            >
              <ChevronLeft size={22} className="text-navy-900" />
            </button>
          )}
          <span className="font-bold text-navy-900 truncate max-w-[180px]">{title}</span>
        </div>
        <button
          onClick={() => navigate('/notifications')}
          aria-label={unread > 0 ? `View alerts, ${unread} unread` : 'View alerts'}
          className="relative w-10 h-10 flex items-center justify-center hover:bg-surface-100 rounded-xl transition-colors"
        >
          <Bell size={19} className="text-navy-700" strokeWidth={2} />
          {unread > 0 && (
            <span className="absolute top-1 right-1 min-w-[17px] h-[17px] px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </button>
      </div>
    </div>
  );
}
