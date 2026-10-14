import { useState } from 'react';
import { useStore } from '../context/store';
import Header from '../components/Header';
import { formatNaira, daysUntil } from '../utils';
import { Users, Plus, Check } from 'lucide-react';

export default function GroupsPage() {
  const { groups, contributeToGroup } = useStore();
  const [expanded, setExpanded] = useState<string | null>(groups[0]?.id || null);

  return (
    <div>
      <Header title="Group Contributions" showBack />

      <div className="px-5 pt-5 space-y-4">
        <div>
          <p className="text-[11px] font-semibold tracking-wider text-primary-600 uppercase mb-1">Shared money</p>
          <h1 className="text-2xl font-bold text-navy-900">Campus group ledger</h1>
          <p className="text-sm text-surface-500 mt-0.5">Track roommates, class projects and dues transparently.</p>
        </div>

        <div className="card p-4 flex gap-3 bg-primary-50/60 border-primary-100">
          <Users size={16} className="text-primary-600 shrink-0 mt-0.5" />
          <p className="text-xs text-primary-800">Simulated ledger for the hackathon — no real money moves. Members can’t edit each other’s records.</p>
        </div>

        <div className="space-y-3">
          {groups.map(g => {
            const total = g.members.reduce((s, m) => s + m.contributed, 0);
            const pct = g.target > 0 ? Math.min(100, (total / g.target) * 100) : 0;
            const open = expanded === g.id;
            return (
              <div key={g.id} className="card overflow-hidden">
                <button onClick={() => setExpanded(open ? null : g.id)} className="p-4 w-full text-left">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <h3 className="font-bold text-navy-900">{g.name}</h3>
                      <p className="text-xs text-surface-500">{g.type} · due in {daysUntil(g.deadline)} days</p>
                    </div>
                    <span className="text-sm font-bold text-navy-900">{formatNaira(total)}<span className="text-surface-400 font-normal text-xs">/{formatNaira(g.target)}</span></span>
                  </div>
                  <div className="h-2 bg-surface-100 rounded-full overflow-hidden">
                    <div className="h-full bg-primary-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                  </div>
                </button>
                {open && (
                  <div className="px-4 pb-4 space-y-2 border-t border-surface-100 pt-3 animate-fade-in">
                    {g.members.map(m => {
                      const done = m.contributed >= m.expected;
                      return (
                        <div key={m.name} className="flex items-center gap-3">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${done ? 'bg-emerald-100 text-emerald-700' : 'bg-surface-100 text-surface-500'}`}>
                            {m.name.charAt(0)}
                          </div>
                          <div className="flex-1">
                            <p className="text-sm font-medium text-navy-900">{m.name}</p>
                            <p className="text-xs text-surface-500">{formatNaira(m.contributed)} of {formatNaira(m.expected)}</p>
                          </div>
                          {done ? (
                            <span className="text-xs text-emerald-600 font-semibold flex items-center gap-1"><Check size={13} /> Paid</span>
                          ) : (
                            <button onClick={() => contributeToGroup(g.id, m.name, m.expected - m.contributed)} className="text-xs font-semibold text-primary-600 flex items-center gap-1"><Plus size={12} /> Settle</button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
