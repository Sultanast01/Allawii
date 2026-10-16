import { useEffect, useState } from 'react';
import { useStore } from '../context/store';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import { apiGet, apiPut, telegramBot } from '../services/api';
import { formatNaira } from '../utils';
import { LogOut, ChevronRight, ShieldAlert, Users, Wallet, CalendarDays, Tag, BookOpen, Trash2, Type, ListChecks, HelpCircle, RefreshCw, Send } from 'lucide-react';

interface BotStatus {
  botRunning: boolean;
  botUsername: string | null;
  linked: boolean;
  linkedChatId: string | null;
  activeCode: string | null;
  codeExpiresAt: string | null;
}

/** Codes live 15 minutes; renewing a minute early means the tap never carries a dying code. */
const RENEW_BEFORE_MS = 60_000;
const CODE_TTL_LABEL = '15 minutes';

const BOT_EXAMPLES = [
  { say: 'I spent 1500 on lunch', note: 'record an expense' },
  { say: 'save 2000', note: 'contribute to your goal' },
  { say: "What's my balance?", note: 'what you have left' },
  { say: 'What is my safe spend today?', note: "today's spending guide" },
  { say: 'How are my budgets?', note: 'spend vs limit by category' },
  { say: 'can I afford 6000?', note: 'check it against your safe amount' },
];

export default function ProfilePage() {
  const navigate = useNavigate();
  const { user, isDemoMode, logout, resetAll, textScale, setTextScale, savingsGoals, transactions, setUser } = useStore();
  const [botStatus, setBotStatus] = useState<BotStatus | null>(null);
  const [linkCode, setLinkCode] = useState<string | null>(null);
  const [codeExpiresAt, setCodeExpiresAt] = useState<string | null>(null);
  const [codePending, setCodePending] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [phoneDraft, setPhoneDraft] = useState('');
  const [phonePending, setPhonePending] = useState(false);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [phoneSaved, setPhoneSaved] = useState(false);

  const loadBotStatus = async (): Promise<BotStatus | null> => {
    try {
      const data = await apiGet('/bot/user/status');
      const status: BotStatus = {
        botRunning: Boolean(data.botRunning),
        botUsername: data.botUsername || null,
        linked: Boolean(data.linked),
        linkedChatId: data.linkedChatId || null,
        activeCode: data.activeCode || null,
        codeExpiresAt: data.codeExpiresAt || null,
      };
      setBotStatus(status);
      // The server owns whether a code is still live, so a redeemed or expired one stops showing here.
      if (!status.activeCode) {
        setLinkCode(null);
        setCodeExpiresAt(null);
      }
      return status;
    } catch {
      setBotStatus(null);
      return null;
    }
  };

  const generateCode = async () => {
    setCodePending(true);
    try {
      const data = await telegramBot.newLinkCode();
      setLinkCode(data.code);
      setCodeExpiresAt(data.expiresAt || null);
      await loadBotStatus();
    } catch {
      setLinkCode(null);
      setCodeExpiresAt(null);
    } finally {
      setCodePending(false);
    }
  };

  const activeCode = linkCode || botStatus?.activeCode || null;
  const codeExpiry = codeExpiresAt || botStatus?.codeExpiresAt || null;
  const minutesLeft = activeCode && codeExpiry
    ? Math.max(0, Math.round((Date.parse(codeExpiry) - now) / 60_000))
    : null;
  const telegramUrl = botStatus?.botUsername && activeCode
    ? `https://t.me/${botStatus.botUsername}?start=link_${activeCode}`
    : null;

  // A code that lapses while this screen is still open sends the user into Telegram with a dead link,
  // so the clock is kept here and the code is replaced before it expires.
  useEffect(() => {
    const ticker = setInterval(() => setNow(Date.now()), 10_000);
    return () => clearInterval(ticker);
  }, []);

  useEffect(() => {
    if (!botStatus?.botRunning || botStatus.linked || codePending) return;
    if (!activeCode) { void generateCode(); return; }
    if (minutesLeft !== null && minutesLeft * 60_000 < RENEW_BEFORE_MS) void generateCode();
  }, [now, botStatus, activeCode, minutesLeft, codePending]);

  // The link itself is minted by the freshness effect above once the status has loaded.
  useEffect(() => {
    void loadBotStatus();
    // Tapping the link leaves this tab for Telegram; coming back should show the new state.
    const onFocus = () => { void loadBotStatus(); };
    document.addEventListener('visibilitychange', onFocus);
    window.addEventListener('focus', onFocus);
    return () => {
      document.removeEventListener('visibilitychange', onFocus);
      window.removeEventListener('focus', onFocus);
    };
  }, []);

  const savePhone = async () => {
    setPhonePending(true);
    setPhoneError(null);
    setPhoneSaved(false);
    try {
      const result = await apiPut('/auth/profile', { phoneNumber: phoneDraft });
      if (user) setUser({ ...user, phoneNumber: result.phoneNumber });
      setPhoneDraft('');
      setPhoneSaved(true);
    } catch (error) {
      setPhoneError((error as Error).message);
    } finally {
      setPhonePending(false);
    }
  };

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

  return (
    <div>
      <Header title="Profile" />

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

        {/* Telegram assistant */}
        <div className="card p-5">
          <div className="flex items-start gap-3 mb-4">
            <div className="w-10 h-10 bg-sky-50 rounded-xl flex items-center justify-center shrink-0"><Send size={18} className="text-sky-600" /></div>
            <div className="flex-1">
              <p className="font-bold text-navy-900 text-sm">Telegram assistant</p>
              <p className="text-xs text-surface-500">Message the bot from Telegram to check balance, record spend, see goals and budgets.</p>
            </div>
            <button onClick={() => void loadBotStatus()} aria-label="Refresh Telegram assistant status" className="p-2 -m-2 text-surface-500 hover:text-navy-900 cursor-pointer"><RefreshCw size={15} /></button>
          </div>

          <div className="flex flex-wrap items-center gap-2 mb-4">
            {botStatus?.linked && botStatus?.botRunning ? (
              <span className="badge badge-success">Live</span>
            ) : (
              <span className="badge badge-info">Set up needed</span>
            )}
            {botStatus?.botUsername && (
              <p className="text-xs text-surface-600">
                Bot: <span className="font-semibold text-navy-900">@{botStatus.botUsername}</span>
              </p>
            )}
          </div>

          {botStatus && !botStatus.botRunning && (
            <p className="text-[11px] text-surface-500 bg-surface-50 rounded-xl p-3 mb-4">
              The Telegram assistant is offline — this server needs TELEGRAM_BOT_TOKEN.
            </p>
          )}

          {(activeCode || (botStatus && !botStatus.linked && botStatus.botRunning)) && (
            <div className="bg-sky-50 rounded-xl p-3 mb-3">
              {activeCode ? (
                <>
                  <p className="text-xs text-surface-600 mb-1">
                    Your personal link code
                    {minutesLeft !== null ? ` · valid for about ${minutesLeft} more min${minutesLeft === 1 ? '' : 's'}` : ` (expires in ${CODE_TTL_LABEL})`}
                    :
                  </p>
                  <p className="text-2xl font-bold tracking-widest text-navy-900 mb-2">{activeCode}</p>
                  {telegramUrl ? (
                    <a
                      href={telegramUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-sky-600 text-white text-sm font-semibold"
                    >
                      <Send size={15} /> Open @{botStatus?.botUsername} in Telegram
                    </a>
                  ) : (
                    <p className="text-[11px] text-surface-600">
                      Open Telegram and message @{botStatus?.botUsername || 'the Allawii bot'}, then send:
                      <code className="block mt-1 text-xs font-semibold text-navy-900 bg-white rounded-lg px-2 py-1">/link {activeCode}</code>
                    </p>
                  )}
                  <p className="text-[11px] text-surface-500 mt-2">
                    Tapping the button starts the chat with this code already attached, so the bot links your account as soon as it opens.
                    {codePending ? ' Getting a fresh code…' : ' This screen mints a new code before the old one can expire.'}
                  </p>
                </>
              ) : (
                <p className="text-[11px] text-surface-600">Link your Telegram once below — then just talk to the bot in plain English.</p>
              )}
            </div>
          )}

          <button
            onClick={() => void generateCode()}
            disabled={codePending || !botStatus?.botRunning}
            className="w-full mb-4 py-2.5 rounded-xl bg-navy-900 text-white text-sm font-semibold disabled:opacity-40 cursor-pointer"
          >
            {codePending ? 'Generating…' : botStatus?.linked ? 'Get a new link code' : 'Generate link code'}
          </button>

          {botStatus?.linked && (
            <p className="text-[11px] text-emerald-700 mb-4">Linked — ask the bot about your money any time.</p>
          )}

          <div className="space-y-2 mb-4">
            {BOT_EXAMPLES.map(({ say, note }) => (
              <div key={say} className="flex items-center gap-3">
                <code className="text-[11px] font-semibold text-sky-800 bg-sky-50 rounded-lg px-2 py-1 shrink-0">{say}</code>
                <span className="text-[11px] text-surface-500">{note}</span>
              </div>
            ))}
          </div>

          <div className="pt-4 border-t border-surface-100">
            <label htmlFor="profile-phone" className="block text-xs font-semibold text-navy-900 mb-1.5">
              Phone number on your account
            </label>
            <div className="flex gap-2">
              <input
                id="profile-phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                value={phoneDraft}
                onChange={e => { setPhoneDraft(e.target.value); setPhoneError(null); setPhoneSaved(false); }}
                placeholder={user?.phoneNumber || '08012345678'}
                className="flex-1 min-w-0 px-3 py-2.5 rounded-xl border border-surface-200 text-sm focus:border-navy-700 focus:outline-none"
              />
              <button
                onClick={() => void savePhone()}
                disabled={phonePending || !phoneDraft.trim()}
                className="px-4 py-2.5 rounded-xl bg-navy-900 text-white text-sm font-semibold disabled:opacity-40 cursor-pointer"
              >
                {phonePending ? 'Saving…' : 'Save'}
              </button>
            </div>
            <p className="text-[11px] text-surface-500 mt-2">
              Used for your B Moni sandbox wallet — not needed for the Telegram bot.
            </p>
            {phoneError && <p role="alert" className="text-[11px] text-red-600 mt-1.5">{phoneError}</p>}
            {phoneSaved && <p className="text-[11px] text-emerald-700 mt-1.5">Number saved.</p>}
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
