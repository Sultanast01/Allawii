import { useMemo, useRef, useState, useEffect } from 'react';
import { useStore, spentInCycleInKobo, cycleDaysOf, cycleWindowOf } from '../context/store';
import Header from '../components/Header';
import { formatNaira } from '../utils';
import { answerCoach, coachChips, type CoachData } from '../utils/coach';
import { Send, Sparkles } from 'lucide-react';

interface Message { id: string; role: 'user' | 'assistant'; content: string; sub?: string; }

const BUDGET_BUCKETS = ['obligations', 'essentials'];

/** Every answer is built from what the app already knows, so the guidance stays personal. */
function coachDataFrom(state: ReturnType<typeof useStore.getState>): CoachData {
  const safe = state.getSafeToSpend();
  const frequency = state.user?.incomeFrequency || 'monthly';
  const cycleDays = cycleDaysOf(state.user);
  const { startMs } = cycleWindowOf(state.user);
  const byCategory = new Map<string, number>();
  for (const tx of state.transactions) {
    if (tx.type !== 'expense') continue;
    const at = Date.parse(tx.date);
    if (!Number.isNaN(at) && at < startMs) continue;
    byCategory.set(tx.category, (byCategory.get(tx.category) || 0) + tx.amountInKobo);
  }
  const plannedBasics = state.categoryBudgets
    .filter(cb => BUDGET_BUCKETS.includes(cb.bucket))
    .reduce((sum, cb) => sum + cb.allocatedInKobo, 0);

  return {
    name: state.user?.name || 'there',
    cycleLabel: frequency === 'daily' ? 'day' : frequency === 'weekly' ? 'week' : 'month',
    allowanceInKobo: state.getMonthlyAllowance(),
    safeToSpendInKobo: safe.unallocatedInKobo,
    dailyLimitInKobo: safe.dailyLimitInKobo,
    daysLeft: safe.daysUntilNextIncome,
    spentInKobo: spentInCycleInKobo(state.transactions, state.user),
    essentialsInKobo: Math.round(plannedBasics * (30.4 / cycleDays)),
    goalCount: state.savingsGoals.length,
    goalGapInKobo: state.savingsGoals.reduce((sum, g) => sum + Math.max(0, g.targetAmountInKobo - g.currentAmountInKobo), 0),
    topCategories: [...byCategory.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5),
    hasDebtSpending: state.transactions.some(t => t.category === 'debt' || /loan|owe|borrow|debt|advance/i.test(t.description)),
    entryCount: state.transactions.length,
  };
}

export default function CoachPage() {
  const state = useStore();
  const safe = state.getSafeToSpend();
  const data = useMemo(() => coachDataFrom(useStore.getState()), [state.transactions, state.savingsGoals, state.categoryBudgets, state.user]);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'w',
      role: 'assistant',
      content: `Hi ${data.name}. I am your money coach — ask me anything about budgeting, not just your numbers.`,
      sub: 'Emergency funds, the 50/30/20 rule, which debt to clear first, food and transport costs, saving faster, school fees, group contributions, or what to do when your money arrives late.',
    },
  ]);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, typing]);

  const send = (text: string) => {
    const question = text.trim();
    if (!question) return;
    setMessages(prev => [...prev, { id: Date.now().toString(), role: 'user', content: question }]);
    setInput(''); setTyping(true);
    setTimeout(() => {
      const answer = answerCoach(question, coachDataFrom(useStore.getState()));
      setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), role: 'assistant', ...answer }]);
      setTyping(false);
    }, 500 + Math.random() * 700);
  };

  const asked = new Set(messages.filter(m => m.role === 'user').map(m => m.content));
  const chips = coachChips(data, asked);

  return (
    <div className="flex flex-col h-dvh">
      <Header title="AI Money Coach" />

      <div className="flex-1 overflow-y-auto px-5 pt-5 pb-4 lg:px-10">
        <div className="mx-auto w-full max-w-md lg:max-w-[1120px]">
        {/* Coach card */}
        <div className="card p-4 mb-5 lg:flex lg:items-center lg:gap-8 lg:p-5">
          <div className="flex items-center gap-3 lg:shrink-0">
            <div className="w-11 h-11 bg-navy-800 rounded-xl flex items-center justify-center">
              <Sparkles size={20} className="text-white" />
            </div>
            <div>
              <p className="font-bold text-navy-900">Allawii Coach</p>
              <p className="text-xs text-emerald-700 flex items-center gap-1"><span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" /> Ready to help</p>
            </div>
          </div>
          <dl className="hidden lg:flex lg:ml-auto lg:gap-8">
            {[
              { label: 'Safe to spend', value: formatNaira(safe.unallocatedInKobo) },
              { label: 'Daily limit', value: `${formatNaira(safe.dailyLimitInKobo)}/day` },
              { label: 'Cycle ends in', value: `${safe.daysUntilNextIncome} days` },
            ].map(item => (
              <div key={item.label}>
                <dt className="text-[10px] uppercase tracking-wider text-surface-500">{item.label}</dt>
                <dd className="text-sm font-bold text-navy-900">{item.value}</dd>
              </div>
            ))}
          </dl>
        </div>

        {/* Messages */}
        <div className="space-y-4 lg:max-w-3xl lg:mx-auto lg:space-y-5">
          {messages.map(m => (
            <div key={m.id} className={m.role === 'user' ? 'flex justify-end' : ''}>
              <div className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                m.role === 'user' ? 'bg-primary-600 text-white rounded-br-md' : 'bg-white border border-surface-100 rounded-bl-md'
              }`}>
                <p className={`text-sm leading-relaxed ${m.role === 'user' ? 'text-white' : 'text-navy-900 font-medium'}`}>{m.content}</p>
                {m.sub && <p className={`text-xs mt-1.5 leading-relaxed ${m.role === 'user' ? 'text-primary-100' : 'text-surface-500'}`}>{m.sub}</p>}
              </div>
            </div>
          ))}
          {typing && (
            <div className="flex">
              <div className="bg-white border border-surface-100 rounded-2xl rounded-bl-md px-4 py-3">
                <div className="flex gap-1">
                  <span className="w-1.5 h-1.5 bg-surface-300 rounded-full animate-bounce" />
                  <span className="w-1.5 h-1.5 bg-surface-300 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 bg-surface-300 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>
        </div>
      </div>

      {/* Suggestion chips */}
      <div className="px-5 pb-2 lg:px-10">
        <div className="mx-auto w-full max-w-md lg:max-w-3xl">
          <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-2">
            {chips.map(c => (
              <button key={c} onClick={() => send(c)} className="px-3.5 py-2 bg-white border border-surface-200 rounded-full text-xs font-medium text-navy-700 whitespace-nowrap active:bg-surface-50 transition-colors">
                {c}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Input */}
      <div className="px-5 pb-3 lg:px-10">
        <div className="mx-auto w-full max-w-md lg:max-w-3xl">
          <div className="flex items-center gap-2">
            <input type="text" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send(input)} placeholder="Ask about your spending or savings..." className="input-field flex-1 py-3 text-sm" />
            <button onClick={() => send(input)} disabled={!input.trim()} aria-label="Send message" className="w-11 h-11 bg-primary-600 rounded-xl flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 transition-all shrink-0">
              <Send size={17} className="text-white" />
            </button>
          </div>
          <p className="text-[11px] text-surface-500 text-center mt-2">Guidance is based on your recorded data and is not professional financial advice.</p>
        </div>
      </div>
    </div>
  );
}
