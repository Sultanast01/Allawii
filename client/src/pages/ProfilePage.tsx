import { useStore } from '../context/store';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import { formatNaira } from '../utils';
import { LogOut, ChevronRight, MessageCircle, ShieldAlert, Users, Wallet, CalendarDays, Tag, BookOpen, Download, Trash2, Type, ListChecks, HelpCircle } from 'lucide-react';

export default function ProfilePage() {
  const navigate = useNavigate();
  const { user, isDemoMode, logout, resetAll, textScale, setTextScale, savingsGoals, transactions, whatsapp, setWhatsapp } = useStore();

  const totalSaved = savingsGoals.reduce((s, g) => s + g.currentAmountInKobo, 0);

  const menu = [
    // A real account can rebuild its plan; the demo persona's figures are pinned.
    ...(isDemoMode ? [] : [{ label: 'Plan setup', desc: 'Update income and rebuild your split', icon: ListChecks, path: '/setup', tint: 'bg-teal-50 text-teal-600' }]),
    { label: 'B Moni wallet', desc: 'Sandbox linked wallet', icon: Wallet, path: '/bmoni', tint: 'bg-navy-50 text-navy-700' },
    { label: 'Financial calendar', desc: 'Deadlines & income', icon: CalendarDays, path: '/calendar', tint: 'bg-sky-50 text-sky-600' },
    { label: 'Group contributions', desc: 'Roommates & projects', icon: Users, path: '/groups', tint: 'bg-purple-50 text-purple-600' },
    { label: 'Scam safety check', desc: 'Verify a message', icon: ShieldAlert, path: '/scam', tint: 'bg-amber-50 text-amber-600' },
    { label: 'Student deals', desc: 'Save on essentials', icon: Tag, path: '/offers', tint: 'bg-pink-50 text-pink-600' },
    { label: 'Money skills', desc: 'Guides & playbooks', icon: BookOpen, path: '/literacy', tint: 'bg-indigo-50 text-indigo-600' },
    { label: 'Help & support', desc: 'FAQs & feedback', icon: HelpCircle, path: '/help', tint: 'bg-surface-100 text-surface-600' },
  ];

  const toggles: { key: keyof typeof whatsapp; label: string }[] = [
    { key: 'budgetReminders', label: 'Budget reminders' },
    { key: 'savingsUpdates', label: 'Savings updates' },
    { key: 'weeklyDigest', label: 'Weekly digest' },
    { key: 'lowBalanceAlerts', label: 'Low-balance alerts' },
  ];

  const exportData = () => {
    const blob = new Blob([JSON.stringify({ user, transactions, savingsGoals }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'allowii-data.json'; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <Header title="Profile" showBack />

      <div className="px-5 pt-5 space-y-5 lg:px-10 lg:pt-10 lg:grid lg:grid-cols-2 lg:gap-8 lg:space-y-0">
        {/* Identity */}
        <div className="card p-5 flex items-center gap-4 lg:col-span-2 lg:p-6">
          <div className="w-14 h-14 bg-gradient-to-br from-navy-700 to-navy-900 rounded-2xl flex items-center justify-center text-white text-xl font-bold">
            {user?.name?.charAt(0).toUpperCase() || 'A'}
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-bold text-navy-900">{user?.name}</h2>
            <p className="text-sm text-surface-500">{user?.email}</p>
            {user?.university && <p className="text-xs text-surface-500">{user.university}</p>}
          </div>
          {isDemoMode && <span className="badge badge-info">DEMO</span>}
        </div>

        <div className="space-y-5 lg:space-y-6 lg:col-start-1 lg:row-start-2">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="card p-3 text-center"><p className="text-lg font-bold text-navy-900">{transactions.length}</p><p className="text-[10px] text-surface-500">Transactions</p></div>
          <div className="card p-3 text-center"><p className="text-lg font-bold text-navy-900">{savingsGoals.length}</p><p className="text-[10px] text-surface-500">Goals</p></div>
          <div className="card p-3 text-center"><p className="text-lg font-bold text-emerald-700">{formatNaira(totalSaved).replace('₦', '₦')}</p><p className="text-[10px] text-surface-500">Saved</p></div>
        </div>

        {/* Accessibility */}
        <div className="card p-4">
          <div className="flex items-center gap-3 mb-3">
            <Type size={18} className="text-surface-500" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-navy-900">Text size</p>
              <p className="text-[11px] text-surface-500">Scales every screen on this device</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2" role="group" aria-label="Text size">
            {([
              { value: 'normal', label: 'Standard' },
              { value: 'large', label: 'Larger text' },
            ] as const).map(option => (
              <button
                key={option.value}
                onClick={() => setTextScale(option.value)}
                aria-pressed={textScale === option.value}
                className={`py-2.5 rounded-xl text-sm font-semibold border transition-colors ${
                  textScale === option.value
                    ? 'bg-navy-900 text-white border-navy-900'
                    : 'bg-white text-surface-600 border-surface-200'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {/* WhatsApp assistant */}
        <div className="card p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center"><MessageCircle size={18} className="text-emerald-700" /></div>
            <div className="flex-1">
              <p className="font-bold text-navy-900 text-sm">WhatsApp assistant</p>
              <p className="text-xs text-surface-500">Reminders & guidance via WhatsApp</p>
            </div>
            <button onClick={() => setWhatsapp({ enabled: !whatsapp.enabled })} role="switch" aria-checked={whatsapp.enabled} aria-label="WhatsApp assistant" className={`p-2.5 -m-2.5 cursor-pointer`}><span className={`block w-12 h-7 rounded-full transition-colors relative ${whatsapp.enabled ? 'bg-emerald-500' : 'bg-surface-200'}`}>
              <span className={`w-6 h-6 bg-white rounded-full absolute top-0.5 shadow transition-transform ${whatsapp.enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </span></button>
          </div>
          {whatsapp.enabled && (
            <div className="space-y-2.5 pt-2 border-t border-surface-100 animate-fade-in">
              {toggles.map(t => (
                <div key={t.key} className="flex items-center justify-between">
                  <span className="text-sm text-surface-600">{t.label}</span>
                  <button onClick={() => setWhatsapp({ [t.key]: !whatsapp[t.key] })} role="switch" aria-checked={whatsapp[t.key]} aria-label={t.label} className="p-2.5 -m-2.5 cursor-pointer"><span className={`block w-10 h-6 rounded-full transition-colors relative ${whatsapp[t.key] ? 'bg-primary-600' : 'bg-surface-200'}`}>
                    <span className={`w-5 h-5 bg-white rounded-full absolute top-0.5 shadow transition-transform ${whatsapp[t.key] ? 'translate-x-4' : 'translate-x-0.5'}`} />
                  </span></button>
                </div>
              ))}
            </div>
          )}
        </div>

        </div>

        <div className="space-y-5 lg:space-y-6 lg:col-start-2 lg:row-start-2">
        {/* Menu */}
        <div className="card divide-y divide-surface-100">
          {menu.map(({ label, desc, icon: Icon, path, tint }) => (
            <button key={label} onClick={() => navigate(path)} className="flex items-center gap-3 p-4 w-full text-left hover:bg-surface-50 transition-colors">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${tint}`}><Icon size={18} /></div>
              <div className="flex-1"><p className="text-sm font-semibold text-navy-900">{label}</p><p className="text-xs text-surface-500">{desc}</p></div>
              <ChevronRight size={16} className="text-surface-500" />
            </button>
          ))}
        </div>

        {/* Data */}
        <div className="card divide-y divide-surface-100">
          <button onClick={exportData} className="flex items-center gap-3 p-4 w-full text-left hover:bg-surface-50">
            <Download size={18} className="text-surface-500" /><span className="text-sm font-semibold text-navy-900">Export my data</span>
          </button>
          <button onClick={() => { if (confirm('Delete all Allawii data on this device?')) { resetAll(); navigate('/'); } }} className="flex items-center gap-3 p-4 w-full text-left hover:bg-red-50">
            <Trash2 size={18} className="text-red-500" /><span className="text-sm font-semibold text-red-600">Delete my data</span>
          </button>
        </div>
        </div>

        <div className="lg:col-span-2">
          <button onClick={() => { logout(); navigate('/'); }} className="w-full flex items-center justify-center gap-2 text-red-600 font-semibold py-3 hover:bg-red-50 rounded-xl transition-colors">
            <LogOut size={16} /> Sign out
          </button>
          <p className="text-center text-xs text-surface-500 pb-2">Allawii v1.0 · Student Finance Companion</p>
        </div>
      </div>
    </div>
  );
}
