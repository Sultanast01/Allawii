import { useEffect, useState } from 'react';
import { useStore } from '../context/store';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import { apiGet, apiPut } from '../services/api';
import { formatNaira } from '../utils';
import { LogOut, ChevronRight, MessageCircle, ShieldAlert, Users, Wallet, CalendarDays, Tag, BookOpen, Download, Trash2, Type, ListChecks, HelpCircle, RefreshCw } from 'lucide-react';

interface BotStatus {
  webhookConfigured: boolean;
  sendingConfigured: boolean;
  linkedPhone: string | null;
  ready: boolean;
}

const BOT_COMMANDS = [
  { command: 'balance', note: 'what you have left' },
  { command: 'spend 850 for data', note: 'record an expense' },
  { command: 'received 60000 allowance', note: 'record income' },
  { command: 'goals', note: 'savings goal progress' },
  { command: 'insights', note: 'where your money is going' },
  { command: 'undo', note: 'remove the last thing recorded' },
];

export default function ProfilePage() {
  const navigate = useNavigate();
  const { user, isDemoMode, logout, resetAll, textScale, setTextScale, savingsGoals, transactions, setUser } = useStore();
  const [botStatus, setBotStatus] = useState<BotStatus | null>(null);
  const [phoneDraft, setPhoneDraft] = useState('');
  const [phonePending, setPhonePending] = useState(false);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [phoneSaved, setPhoneSaved] = useState(false);

  const loadBotStatus = async () => {
    try {
      const data = await apiGet('/whatsapp/status');
      setBotStatus({
        webhookConfigured: Boolean(data.webhookConfigured),
        sendingConfigured: Boolean(data.sendingConfigured),
        linkedPhone: data.linkedPhone || null,
        ready: Boolean(data.ready),
      });
    } catch {
      setBotStatus(null);
    }
  };

  useEffect(() => { void loadBotStatus(); }, []);

  const savePhone = async () => {
    setPhonePending(true);
    setPhoneError(null);
    setPhoneSaved(false);
    try {
      const result = await apiPut('/auth/profile', { phoneNumber: phoneDraft });
      if (user) setUser({ ...user, phoneNumber: result.phoneNumber });
      setPhoneDraft('');
      setPhoneSaved(true);
      await loadBotStatus();
    } catch (error) {
      setPhoneError((error as Error).message);
    } finally {
      setPhonePending(false);
    }
  };

  const totalSaved = savingsGoals.reduce((s, g) => s + g.currentAmountInKobo, 0);

  const missing: string[] = [
    !botStatus?.linkedPhone && 'a linked WhatsApp number',
    !botStatus?.webhookConfigured && 'the webhook keys (WHATSAPP_APP_SECRET, WHATSAPP_VERIFY_TOKEN)',
    !botStatus?.sendingConfigured && 'the send keys (WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID)',
  ].filter(Boolean) as string[];

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
          <div className="flex items-start gap-3 mb-4">
            <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center shrink-0"><MessageCircle size={18} className="text-emerald-700" /></div>
            <div className="flex-1">
              <p className="font-bold text-navy-900 text-sm">WhatsApp assistant</p>
              <p className="text-xs text-surface-500">Text your number from WhatsApp to check balance, record spend, see goals and get insights.</p>
            </div>
            <button onClick={() => void loadBotStatus()} aria-label="Refresh WhatsApp assistant status" className="p-2 -m-2 text-surface-500 hover:text-navy-900 cursor-pointer"><RefreshCw size={15} /></button>
          </div>

          <div className="flex flex-wrap items-center gap-2 mb-4">
            {botStatus?.ready ? (
              <span className="badge badge-success">Live</span>
            ) : (
              <span className="badge badge-info">Set up needed</span>
            )}
            <p className="text-xs text-surface-600">
              Linked number: <span className="font-semibold text-navy-900">{botStatus?.linkedPhone || 'none'}</span>
            </p>
          </div>

          {!botStatus?.ready && (
            <p className="text-[11px] text-surface-500 bg-surface-50 rounded-xl p-3 mb-4">
              {botStatus
                ? `Not reachable from WhatsApp yet — this server is missing ${missing.join(' and ')}. Commands that do arrive are answered in the server console instead.`
                : 'Checking the connection…'}
            </p>
          )}

          <div className="space-y-2 mb-4">
            {BOT_COMMANDS.map(({ command, note }) => (
              <div key={command} className="flex items-center gap-3">
                <code className="text-[11px] font-semibold text-emerald-800 bg-emerald-50 rounded-lg px-2 py-1 shrink-0">{command}</code>
                <span className="text-[11px] text-surface-500">{note}</span>
              </div>
            ))}
          </div>

          <div className="pt-4 border-t border-surface-100">
            <label htmlFor="wa-phone" className="block text-xs font-semibold text-navy-900 mb-1.5">
              WhatsApp number on your account
            </label>
            <div className="flex gap-2">
              <input
                id="wa-phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                value={phoneDraft}
                onChange={e => { setPhoneDraft(e.target.value); setPhoneError(null); setPhoneSaved(false); }}
                placeholder={botStatus?.linkedPhone || '08012345678'}
                className="flex-1 min-w-0 px-3 py-2.5 rounded-xl border border-surface-200 text-sm focus:border-navy-700 focus:outline-none"
              />
              <button
                onClick={() => void savePhone()}
                disabled={phonePending || !phoneDraft.trim()}
                className="px-4 py-2.5 rounded-xl bg-navy-900 text-white text-sm font-semibold disabled:opacity-40 cursor-pointer"
              >
                {phonePending ? 'Saving…' : 'Link'}
              </button>
            </div>
            <p className="text-[11px] text-surface-500 mt-2">
              Use the same number you sign in with, so the assistant can find your ledger.
            </p>
            {phoneError && <p role="alert" className="text-[11px] text-red-600 mt-1.5">{phoneError}</p>}
            {phoneSaved && <p className="text-[11px] text-emerald-700 mt-1.5">Number linked.</p>}
          </div>
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
