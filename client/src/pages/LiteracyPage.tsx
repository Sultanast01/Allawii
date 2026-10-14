import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, CheckCircle, Clock, ChevronRight, ArrowLeft } from 'lucide-react';
import Header from '../components/Header';

const LESSONS = [
  { id: '1', title: 'Budgeting 101', description: 'Build a budget that survives real student life', category: 'budgeting', duration: 5, content: 'A budget is simply a plan for your money. Start by tracking where it actually goes for one week. Then split your income into four buckets: Obligations (rent, fees, family support), Essentials (food, transport, data), Future You (savings and emergency fund), and Enjoyment (socialising, eating out).\n\nThe key is honesty. Budget for what you actually spend, not what you wish you spent. Once the plan exists, check it weekly and adjust when life changes — that is exactly what Moneva does for you.' },
  { id: '2', title: 'Needs vs wants', description: 'Decide in the moment without guilt', category: 'saving', duration: 3, content: 'A need is what you must have to function: food, transport to campus, data for assignments. A want is nice to have: eating out, new shoes, the latest drop.\n\nThe goal is not to kill every want — that plan fails by week two. Cover needs first, then spend deliberately on wants using unallocated money. Try the 24-hour rule: wait a day before any non-essential purchase above ₦5,000. Often the urge passes, and when it does not, you can afford it knowingly rather than impulsively.' },
  { id: '3', title: 'The power of small savings', description: 'How ₦500 a week becomes a real buffer', category: 'saving', duration: 4, content: 'Saving ₦500 a week is ₦2,000 a month and ₦24,000 a year — enough for textbooks, a laptop repair, or a month of emergencies.\n\nConsistency beats size. Move the money on the day your allowance arrives, before you can spend it. What you do not see, you do not spend. When a month is tight, save something anyway — even ₦100 keeps the habit and the streak alive.' },
  { id: '4', title: 'Understanding interest', description: 'How it works for you and against you', category: 'general', duration: 6, content: 'Interest is the price of using money. Borrow and you pay it; save and you may earn it.\n\nThe important idea is compounding: your earnings start earning too. Starting early matters more than starting big. On the borrowing side, short-term loan apps can charge extreme effective rates — a ₦10,000 loan that costs ₦2,000 for thirty days is over 20% a month. Avoid borrowing for consumption, and never take a new loan to repay an old one.' },
  { id: '5', title: 'Avoiding financial traps', description: 'Five mistakes that empty student accounts', category: 'general', duration: 5, content: '1. "I will pay you back tomorrow" lending. Set a fixed amount you are willing to support others with, and stop there.\n\n2. Lifestyle creep. Spending rises the moment your allowance does, so you never feel richer.\n\n3. Ignoring small costs. ₦200 here and ₦300 there is often your biggest category by month end.\n\n4. Not tracking. If you cannot see where money goes, you cannot change it.\n\n5. Emotional spending. Boredom and stress purchases feel good for minutes and cost for weeks. Notice the trigger, delay the decision.' },
  { id: '6', title: 'Building an emergency fund', description: 'The buffer that keeps your plan standing', category: 'saving', duration: 4, content: 'An emergency fund is money held for the unexpected: a broken phone, medical costs, a family need, a sudden transport fare.\n\nAim for one to three months of essential expenses. Start small — ₦5,000 already covers most minor emergencies. Keep it separate from spending money so it is not quietly absorbed, use it only for genuine emergencies, and top it back up after any withdrawal. In Moneva it lives as its own goal, protected inside your Safe to Spend calculation.' },
];

const categoryColors: Record<string, string> = {
  budgeting: 'bg-primary-50 text-primary-700',
  saving: 'bg-emerald-50 text-emerald-700',
  general: 'bg-amber-50 text-amber-700',
};

export default function LiteracyPage() {
  const navigate = useNavigate();
  const [selected, setSelected] = useState<string | null>(null);
  const [completed, setCompleted] = useState<string[]>([]);

  const lesson = LESSONS.find(l => l.id === selected);

  if (lesson) {
    return (
      <>
        <div className="sticky top-0 z-40 bg-surface-50/90 backdrop-blur-md border-b border-surface-100">
          <div className="flex items-center gap-2.5 px-5 h-14">
            <button onClick={() => setSelected(null)} className="w-9 h-9 flex items-center justify-center hover:bg-surface-100 rounded-xl">
              <ArrowLeft size={19} className="text-navy-800" />
            </button>
            <span className="font-bold text-navy-900 truncate">{lesson.title}</span>
            <span className="ml-auto flex items-center gap-1 text-[11px] text-surface-400">
              <Clock size={12} /> {lesson.duration} min
            </span>
          </div>
        </div>

        <div className="px-5 py-5 pb-8 space-y-4">
          <div className="card p-5">
            <span className={`badge mb-4 ${categoryColors[lesson.category]}`}>{lesson.category}</span>
            <p className="text-sm text-navy-800 leading-relaxed whitespace-pre-line">{lesson.content}</p>
          </div>

          <button
            onClick={() => { setCompleted(c => c.includes(lesson.id) ? c : [...c, lesson.id]); setSelected(null); }}
            className={`w-full py-3.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 ${
              completed.includes(lesson.id) ? 'bg-emerald-50 text-emerald-700' : 'btn-primary'
            }`}
          >
            {completed.includes(lesson.id) ? (<><CheckCircle size={16} /> Completed</>) : 'Mark as complete'}
          </button>

          <button onClick={() => navigate('/coach')} className="w-full btn-secondary text-sm py-3">
            Ask the coach about this
          </button>
        </div>
      </>
    );
  }

  const pct = Math.round((completed.length / LESSONS.length) * 100);

  return (
    <>
      <Header title="Literacy Hub" showBack />

      <div className="px-5 py-4 space-y-4 pb-8">
        <div className="card p-4 bg-navy-800 border-navy-800">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-medium text-primary-200">Your progress</span>
            <span className="text-[11px] font-bold text-white">{completed.length}/{LESSONS.length}</span>
          </div>
          <div className="h-2 bg-white/15 rounded-full overflow-hidden mb-2">
            <div className="h-full bg-primary-400 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
          </div>
          <p className="text-xs text-primary-200">Short lessons tied to what you are actually doing with your money.</p>
        </div>

        <div className="space-y-2.5">
          {LESSONS.map(l => (
            <button
              key={l.id}
              onClick={() => setSelected(l.id)}
              className="card p-4 flex items-center gap-3 w-full text-left hover:bg-surface-50 transition-colors"
            >
              <div className={`icon-tile ${completed.includes(l.id) ? 'bg-emerald-50' : 'bg-primary-50'}`}>
                {completed.includes(l.id)
                  ? <CheckCircle size={18} className="text-emerald-600" />
                  : <BookOpen size={18} className="text-primary-600" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <h3 className="font-semibold text-sm text-navy-900">{l.title}</h3>
                  <span className={`badge text-[10px] ${categoryColors[l.category]}`}>{l.category}</span>
                </div>
                <div className="flex items-center gap-2">
                  <p className="text-xs text-surface-400 truncate">{l.description}</p>
                  <span className="text-[10px] text-surface-300 shrink-0">{l.duration} min</span>
                </div>
              </div>
              <ChevronRight size={16} className="text-surface-300 shrink-0" />
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
