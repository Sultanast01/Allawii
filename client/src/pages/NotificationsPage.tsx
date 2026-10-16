import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { BellOff, Check, X } from 'lucide-react';
import Header from '../components/Header';
import { useStore } from '../context/store';
import { buildAlerts } from '../utils/alerts';

const TINT = {
  high: 'bg-red-50 text-red-600',
  medium: 'bg-amber-50 text-amber-600',
  low: 'bg-surface-100 text-surface-600',
};

export default function NotificationsPage() {
  const navigate = useNavigate();
  const state = useStore();
  const { dismissAlert, markInsightRead } = state;
  const alerts = useMemo(() => buildAlerts(state), [state]);
  const unread = alerts.filter(a => !a.read);
  const settled = alerts.filter(a => a.read);

  const dismiss = (id: string) => (id.startsWith('insight:') ? markInsightRead(id.slice('insight:'.length)) : dismissAlert(id));

  return (
    <div>
      <Header title="Alerts" />

      <div className="px-5 pt-5 pb-8 space-y-4 lg:px-10 lg:pt-8 lg:max-w-3xl">
        <p className="text-xs text-surface-500">
          {unread.length ? `${unread.length} thing${unread.length === 1 ? '' : 's'} that needs your attention` : 'Nothing urgent. Your plan is holding.'}
        </p>

        {unread.length === 0 && (
          <div className="card p-6 flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center shrink-0">
              <Check size={18} className="text-emerald-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-navy-900">All clear</p>
              <p className="text-xs text-surface-500">Alerts appear here when a budget breaks, an obligation is due, your streak is at risk or your payday has passed.</p>
            </div>
          </div>
        )}

        {unread.map(alert => (
          <div key={alert.id} className="card p-5">
            <div className="flex items-start gap-3">
              <span className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${TINT[alert.severity]}`}>
                <span className="w-2 h-2 rounded-full bg-current" />
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-navy-900 mb-0.5">{alert.title}</p>
                <p className="text-xs text-surface-600 mb-3">{alert.message}</p>
                <div className="flex gap-2">
                  <button onClick={() => navigate(alert.to)} className="btn-primary text-xs px-3 py-2">
                    {alert.actionLabel}
                  </button>
                  <button onClick={() => dismiss(alert.id)} className="btn-ghost text-xs px-3 py-2 flex items-center gap-1">
                    <X size={13} /> Ignore
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}

        {settled.length > 0 && (
          <div className="pt-2">
            <p className="text-[11px] font-semibold tracking-wider text-surface-500 uppercase mb-2 flex items-center gap-1.5">
              <BellOff size={13} /> Ignored
            </p>
            <div className="card divide-y divide-surface-100">
              {settled.map(alert => (
                <div key={alert.id} className="p-4 flex items-start gap-3">
                  <span className="w-2 h-2 rounded-full bg-surface-300 mt-1.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-surface-600">{alert.title}</p>
                    <p className="text-xs text-surface-500">{alert.message}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
