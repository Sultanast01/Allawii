import { useNavigate } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { useStore } from '../context/store';

export default function Header({ title, showBack }: { title: string; showBack?: boolean }) {
  const navigate = useNavigate();
  const { insights } = useStore();
  const unread = insights.filter(i => !i.isRead).length;

  return (
    <div className="sticky top-0 z-40 bg-surface-50/90 backdrop-blur-md border-b border-surface-100">
      <div className="flex items-center justify-between px-5 h-14">
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => showBack ? navigate(-1) : navigate('/profile')}
            className="w-9 h-9 bg-navy-800 rounded-xl flex items-center justify-center text-white font-bold text-lg active:scale-95 transition-transform"
          >
            M
          </button>
          <span className="font-bold text-navy-900 truncate max-w-[180px]">{title}</span>
        </div>
        <button onClick={() => navigate('/profile')} className="relative w-9 h-9 flex items-center justify-center hover:bg-surface-100 rounded-xl transition-colors">
          <Bell size={19} className="text-navy-700" strokeWidth={2} />
          {unread > 0 && (
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full" />
          )}
        </button>
      </div>
    </div>
  );
}
