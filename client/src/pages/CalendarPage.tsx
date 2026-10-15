import { useState } from 'react';
import { useStore } from '../context/store';
import Header from '../components/Header';
import { formatNaira, daysUntil, nairaToKobo } from '../utils';
import { Plus, Check, Wallet, Target, Users, Repeat, ArrowUpCircle, X } from 'lucide-react';

const typeIcon: Record<string, any> = { income: ArrowUpCircle, obligation: Wallet, goal: Target, group: Users, recurring: Repeat };
const typeColor: Record<string, string> = { income: 'text-emerald-700 bg-emerald-50', obligation: 'text-red-600 bg-red-50', goal: 'text-primary-600 bg-primary-50', group: 'text-purple-600 bg-purple-50', recurring: 'text-sky-600 bg-sky-50' };

export default function CalendarPage() {
  const { calendarEvents, addCalendarEvent, toggleCalendarEvent } = useStore();
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ title: '', date: '', amount: '', type: 'obligation' as any });

  const sorted = [...calendarEvents].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const handleAdd = () => {
    if (!form.title || !form.date) return;
    addCalendarEvent({ title: form.title, date: new Date(form.date).toISOString(), type: form.type, amountInKobo: form.amount ? nairaToKobo(Number(form.amount)) : undefined, isCompleted: false });
    setForm({ title: '', date: '', amount: '', type: 'obligation' });
    setShowAdd(false);
  };

  return (
    <div>
      <Header title="Financial Calendar" showBack />

      <div className="px-5 pt-5 space-y-4 pb-8 lg:px-10 lg:grid lg:grid-cols-3 lg:gap-8 lg:space-y-0 lg:content-start">
        <div className="flex items-start justify-between lg:col-span-2">
          <div>
            <p className="text-[11px] font-semibold tracking-wider text-primary-600 uppercase mb-1">Timeline</p>
            <h1 className="text-2xl font-bold text-navy-900">Everything on one page</h1>
            <p className="text-sm text-surface-500 mt-0.5">Income, deadlines and goals in one timeline.</p>
          </div>
          <button onClick={() => setShowAdd(!showAdd)} className="w-10 h-10 bg-primary-600 rounded-xl flex items-center justify-center shadow-card active:scale-95 transition-transform shrink-0">
            <Plus size={18} className="text-white" />
          </button>
        </div>

        {showAdd && (
          <div className="card p-4 space-y-3 animate-slide-up lg:col-start-3 lg:row-start-1 lg:self-start">
            <input type="text" placeholder="Event title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="input-field text-sm" />
            <div className="grid grid-cols-2 gap-3">
              <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className="input-field text-sm" />
              <input type="number" placeholder="Amount (₦)" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} className="input-field text-sm" />
            </div>
            <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="input-field text-sm">
              <option value="obligation">Obligation</option>
              <option value="income">Expected income</option>
              <option value="goal">Savings milestone</option>
              <option value="group">Group contribution</option>
              <option value="recurring">Recurring expense</option>
            </select>
            <button onClick={handleAdd} className="btn-primary w-full text-sm py-2.5">Add event</button>
          </div>
        )}

        <div className="space-y-2.5 lg:col-span-3 lg:grid lg:grid-cols-3 lg:gap-3 lg:space-y-0 lg:content-start">
          {sorted.map(e => {
            const Icon = typeIcon[e.type] || Wallet;
            const dl = daysUntil(e.date);
            return (
              <div key={e.id} className={`card p-4 flex items-center gap-3 ${e.isCompleted ? 'opacity-50' : ''}`}>
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${typeColor[e.type]}`}>
                  <Icon size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-semibold text-navy-900 truncate ${e.isCompleted ? 'line-through' : ''}`}>{e.title}</p>
                  <p className="text-xs text-surface-500">
                    {new Date(e.date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
                    {dl > 0 && !e.isCompleted && <span className={dl <= 3 ? ' text-red-500 font-medium' : ''}> · in {dl} days</span>}
                  </p>
                </div>
                {e.amountInKobo && <span className="text-sm font-bold text-navy-900">{formatNaira(e.amountInKobo)}</span>}
                <button onClick={() => toggleCalendarEvent(e.id)} className={`w-7 h-7 rounded-full border flex items-center justify-center shrink-0 transition-colors ${e.isCompleted ? 'bg-emerald-500 border-emerald-500' : 'border-surface-300'}`}>
                  {e.isCompleted ? <Check size={14} className="text-white" /> : <X size={13} className="text-surface-500" />}
                </button>
              </div>
            );
          })}
          {sorted.length === 0 && <p className="text-center text-sm text-surface-500 py-8">No events yet. Add deadlines and expected income.</p>}
        </div>
      </div>
    </div>
  );
}
