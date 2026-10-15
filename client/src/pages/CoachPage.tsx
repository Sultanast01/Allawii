import { useState, useRef, useEffect } from 'react';
import { useStore } from '../context/store';
import Header from '../components/Header';
import { formatNaira } from '../utils';
import { Send, Sparkles } from 'lucide-react';

interface Message { id: string; role: 'user' | 'assistant'; content: string; sub?: string; }

const generateResponse = (q: string): { content: string; sub?: string } => {
  const store = useStore.getState();
  const safe = store.getSafeToSpend();
  const name = store.user?.name || 'there';
  const lower = q.toLowerCase();

  if (lower.includes('last') || lower.includes('allowance')) {
    return { content: `Based on your ${formatNaira(safe.unallocatedInKobo)} remaining and ${safe.daysUntilNextIncome} days to your next allowance, you’re on track if you keep daily spending near ${formatNaira(safe.dailyLimitInKobo)}.`, sub: `If you spend more than ${formatNaira(safe.dailyLimitInKobo)} most days, you could run short around ${safe.daysUntilNextIncome > 5 ? 'the end of the cycle' : 'in a few days'}. Want me to suggest a plan?` };
  }
  if (lower.includes('spending most') || lower.includes('where am i') || lower.includes('where is my money')) {
    const byCat: Record<string, number> = {};
    store.transactions.filter(t => t.type === 'expense').forEach(t => { byCat[t.category] = (byCat[t.category] || 0) + t.amountInKobo; });
    const sorted = Object.entries(byCat).sort((a, b) => b[1] - a[1]).slice(0, 3);
    return { content: sorted.length ? `Your biggest spending areas: ${sorted.map(([c, a]) => `${c.replace('_', ' ')} (${formatNaira(a)})`).join(', ')}.` : 'You haven’t recorded many expenses yet — that’s a clean slate!', sub: 'Want tips to bring any of these down?' };
  }
  if (lower.includes('afford') || lower.includes('can i')) {
    const m = q.match(/[\d,]+/); const amt = m ? Number(m[0].replace(',', '')) : 0;
    if (amt > 0) {
      return amt <= safe.unallocatedInKobo
        ? { content: `Yes — ${formatNaira(amt)} fits within your ${formatNaira(safe.unallocatedInKobo)} safe-to-spend.`, sub: `After it, your daily limit drops to about ${formatNaira(Math.max(0, (safe.unallocatedInKobo - amt) / Math.max(1, safe.daysUntilNextIncome)))}/day.` }
        : { content: `Not yet. ${formatNaira(amt)} is more than your ${formatNaira(safe.unallocatedInKobo)} safe-to-spend.`, sub: 'You could wait, trim another category, or pause a savings contribution. Try the what-if simulator to see the trade-offs.' };
    }
    return { content: 'Tell me the price and I’ll check it against your budget — for example, “Can I afford ₦8,000?”' };
  }
  if (lower.includes('save') || lower.includes('goal')) {
    const g = store.savingsGoals;
    return { content: g.length ? `You have ${g.length} goal${g.length > 1 ? 's' : ''}: ${g.map(x => `${x.name} (${Math.round(x.progress)}%)`).join(', ')}.` : 'You don’t have a savings goal yet.', sub: `Even ${formatNaira(Math.max(500, Math.round(safe.dailyLimitInKobo * 0.2 / 100) * 100))}/week builds a real buffer. Want help setting one up?` };
  }
  if (lower.includes('hello') || lower.includes('hi') || lower.includes('hey')) {
    return { content: `Hi ${name}. What would you like to figure out today?`, sub: 'I can check if your allowance will last, explain where your money goes, or test a purchase.' };
  }
  return { content: `Here’s where you stand: ${formatNaira(safe.unallocatedInKobo)} safe to spend, ${formatNaira(safe.dailyLimitInKobo)}/day for ${safe.daysUntilNextIncome} days.`, sub: 'Ask me about affording something, saving more, or what happens if your allowance is late.' };
};

export default function CoachPage() {
  const { user, getSafeToSpend } = useStore();
  const safe = getSafeToSpend();
  const [messages, setMessages] = useState<Message[]>([
    { id: 'w', role: 'assistant', content: `Hi ${user?.name || 'there'}. What would you like to figure out today?`, sub: 'Suggestions use your recorded allowance, budget, and transactions.' },
  ]);
  const [input, setInput] = useState('');
  const [typing, setTyping] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, typing]);

  const send = (text: string) => {
    if (!text.trim()) return;
    setMessages(prev => [...prev, { id: Date.now().toString(), role: 'user', content: text }]);
    setInput(''); setTyping(true);
    setTimeout(() => {
      const r = generateResponse(text);
      setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), role: 'assistant', ...r }]);
      setTyping(false);
    }, 700 + Math.random() * 900);
  };

  const chips = ['Will my allowance last?', 'Where am I spending most?', 'Help me save more', 'Can I afford ₦8,000?'];

  return (
    <div className="flex flex-col h-dvh">
      <Header title="AI Money Coach" showBack />

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
