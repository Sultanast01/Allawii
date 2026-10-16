import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { HelpCircle, MessageCircle, Send, ChevronRight, ExternalLink } from 'lucide-react';
import Header from '../components/Header';

const FAQS = [
  {
    id: '1',
    question: 'How does the safe-to-spend calculation work?',
    answer: 'We take your remaining allowance, subtract upcoming obligations and savings goals, then divide by days until your next income. This gives you a daily spending guide that keeps you on track.',
  },
  {
    id: '2',
    question: 'What happens if I overspend one day?',
    answer: 'The adaptive budgeting engine recalculates your remaining days and adjusts your daily guide automatically. You can also manually adjust category budgets in the Budget Planner.',
  },
  {
    id: '3',
    question: 'Is my financial data secure?',
    answer: 'Yes. All data is stored locally on your device (or in your account if you create one). We never share your financial information with third parties. The B Moni integration uses sandbox mode only.',
  },
  {
    id: '5',
    question: 'How do streaks work?',
    answer: 'A streak counts consecutive days you contribute to a savings goal. Missing a day breaks the streak, but you can start again anytime. Milestones are awarded at 3, 7, 14, 30, 60, and 90 days.',
  },
  {
    id: '6',
    question: 'What is the AI Money Coach?',
    answer: 'The coach is a rule-based engine that analyzes your actual transactions and budget to provide personalized tips. It does not use external AI services, so your data never leaves your device.',
  },
  {
    id: '7',
    question: 'Can I use this without creating an account?',
    answer: 'Yes. Click "Explore demo" to try all features with synthetic data. Your progress is saved locally. Create an account to sync across devices.',
  },
  {
    id: '8',
    question: 'How do I delete my data?',
    answer: 'Go to Profile > Delete my data. This removes all transactions, goals, and settings from your device. This action cannot be undone.',
  },
];

export default function HelpPage() {
  const navigate = useNavigate();
  const [expandedFaq, setExpandedFaq] = useState<string | null>(null);
  const [feedback, setFeedback] = useState('');

  const handleSendFeedback = () => {
    if (!feedback.trim()) return;
    const subject = encodeURIComponent('Allawii feedback');
    const body = encodeURIComponent(`${feedback}\n\n— Sent from Allawii (demo build)`);
    window.location.href = `mailto:hello@allowii.app?subject=${subject}&body=${body}`;
    setFeedback('');
  };

  return (
    <>
      <Header title="Help & Support" />

      <div className="px-5 py-4 space-y-4 pb-8 lg:px-10 lg:max-w-3xl">
        {/* Contact support */}
        <div className="card p-5 bg-navy-800 border-navy-800">
          <div className="flex items-start gap-3">
            <div className="icon-tile bg-white/10">
              <MessageCircle size={20} className="text-white" />
            </div>
            <div className="flex-1">
              <h3 className="font-bold text-white mb-1">Need help?</h3>
              <p className="text-xs text-primary-200 leading-relaxed mb-3">
                Send us feedback, report a bug, or ask a question. We read every message.
              </p>
              <textarea
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="Type your message here..."
                className="w-full bg-white/10 text-white placeholder-white/50 rounded-xl p-3 text-sm resize-none h-24 focus:outline-none focus:ring-2 focus:ring-primary-400"
              />
              <button
                onClick={handleSendFeedback}
                disabled={!feedback.trim()}
                className="mt-2 btn-primary w-full text-sm py-2.5 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Send size={14} />
                Send message
              </button>
              <p className="text-[11px] text-primary-200 mt-2">
                Opens your email app — this demo build has no feedback backend yet.
              </p>
            </div>
          </div>
        </div>

        {/* FAQs */}
        <div>
          <h3 className="font-bold text-navy-900 mb-3 flex items-center gap-2">
            <HelpCircle size={18} className="text-primary-600" />
            Frequently asked questions
          </h3>
          <div className="space-y-2">
            {FAQS.map(faq => (
              <div key={faq.id} className="card overflow-hidden">
                <button
                  onClick={() => setExpandedFaq(expandedFaq === faq.id ? null : faq.id)}
                  className="w-full p-4 flex items-center justify-between text-left hover:bg-surface-50 transition-colors"
                >
                  <span className="font-semibold text-sm text-navy-900 pr-4">{faq.question}</span>
                  <ChevronRight
                    size={18}
                    className={`text-surface-500 shrink-0 transition-transform ${
                      expandedFaq === faq.id ? 'rotate-90' : ''
                    }`}
                  />
                </button>
                {expandedFaq === faq.id && (
                  <div className="px-4 pb-4 pt-0">
                    <p className="text-sm text-surface-600 leading-relaxed">{faq.answer}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Resources */}
        <div>
          <h3 className="font-bold text-navy-900 mb-3">Resources</h3>
          <div className="space-y-2">
            <button
              onClick={() => navigate('/literacy')}
              className="card p-4 flex items-center gap-3 w-full text-left hover:bg-surface-50 transition-colors"
            >
              <div className="icon-tile bg-primary-50">
                <HelpCircle size={18} className="text-primary-600" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-sm text-navy-900">Financial Literacy Hub</p>
                <p className="text-xs text-surface-500">Short lessons on budgeting, saving, and smart spending</p>
              </div>
              <ChevronRight size={16} className="text-surface-300" />
            </button>

            <button
              onClick={() => navigate('/coach')}
              className="card p-4 flex items-center gap-3 w-full text-left hover:bg-surface-50 transition-colors"
            >
              <div className="icon-tile bg-emerald-50">
                <MessageCircle size={18} className="text-emerald-700" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-sm text-navy-900">Ask the AI Coach</p>
                <p className="text-xs text-surface-500">Get personalized advice based on your spending</p>
              </div>
              <ChevronRight size={16} className="text-surface-300" />
            </button>
          </div>
        </div>

        {/* About */}
        <div className="card p-4 bg-surface-50">
          <p className="text-xs text-surface-600 leading-relaxed">
            <b>Allawii</b> is a student-focused financial companion built for the B Moni × TINC26 hackathon. 
            It helps you plan your allowance, track spending, and build healthy money habits.
          </p>
          <p className="text-xs text-surface-500 mt-2">
            Version 1.0.0 · Built with React + TypeScript
          </p>
        </div>
      </div>
    </>
  );
}
