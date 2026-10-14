import { useState } from 'react';
import Header from '../components/Header';
import { ShieldCheck, AlertTriangle, Loader2 } from 'lucide-react';

const RED_FLAGS = [
  { test: /urgent|immediately|hurry|right now|act fast/i, label: 'Creates artificial urgency' },
  { test: /won|prize|lottery|congratulat|selected|claim/i, label: 'Claims you won something you didn’t enter' },
  { test: /click (this|the) link|http:|www\.|bit\.ly|tinyurl/i, label: 'Pushes you to click a link' },
  { test: /\bbvn\b|pin\b|password|otp|cvv|card detail|account number/i, label: 'Asks for a PIN, password, OTP, BVN or card details' },
  { test: /transfer|send money|deposit|pay first|top.?up|invest.*double|guarantee/i, label: 'Asks you to send money or promises guaranteed returns' },
  { test: /confidential|don.?t tell|secret|private between/i, label: 'Tells you to keep it secret' },
];

type RiskLevel = 'low' | 'medium' | 'high' | 'severe';

function analyze(text: string): { flags: string[]; level: RiskLevel } {
  const flags = RED_FLAGS.filter(f => f.test.test(text)).map(f => f.label);
  const score = Math.min(4, flags.length);
  const level: RiskLevel = score === 0 ? 'low' : score <= 1 ? 'medium' : score === 2 ? 'high' : 'severe';
  return { flags, level };
}

export default function ScamPage() {
  const [text, setText] = useState('');
  const [result, setResult] = useState<ReturnType<typeof analyze> | null>(null);
  const [loading, setLoading] = useState(false);

  const check = () => {
    if (!text.trim()) return;
    setLoading(true);
    setTimeout(() => { setResult(analyze(text)); setLoading(false); }, 900);
  };

  const levelStyles = {
    low: { badge: 'bg-emerald-50 text-emerald-700 border-emerald-200', title: 'Looks low-risk', icon: 'text-emerald-600', bg: 'bg-emerald-50' },
    medium: { badge: 'bg-amber-50 text-amber-700 border-amber-200', title: 'Some warning signs', icon: 'text-amber-600', bg: 'bg-amber-50' },
    high: { badge: 'bg-orange-50 text-orange-700 border-orange-200', title: 'Many warning signs', icon: 'text-orange-600', bg: 'bg-orange-50' },
    severe: { badge: 'bg-red-50 text-red-700 border-red-200', title: 'High risk — be very careful', icon: 'text-red-600', bg: 'bg-red-50' },
  } as const;

  return (
    <div>
      <Header title="Scam Safety Check" showBack />

      <div className="px-5 pt-5 space-y-4">
        <div>
          <p className="text-[11px] font-semibold tracking-wider text-primary-600 uppercase mb-1">Financial safety</p>
          <h1 className="text-2xl font-bold text-navy-900">Is this message safe?</h1>
          <p className="text-sm text-surface-500 mt-0.5">Paste a suspicious message and get a plain-language read.</p>
        </div>

        <div className="card p-4">
          <textarea value={text} onChange={(e) => { setText(e.target.value); setResult(null); }} rows={5} placeholder="e.g. “Congratulations! You’ve won ₦500,000. Click this link and send ₦5,000 processing fee immediately. Don’t tell anyone.”" className="w-full text-sm text-navy-900 placeholder-surface-400 bg-transparent outline-none resize-none" />
          <button onClick={check} disabled={!text.trim() || loading} className="btn-primary w-full text-sm py-2.5 mt-2 flex items-center justify-center gap-2 disabled:opacity-50">
            {loading ? <><Loader2 size={16} className="animate-spin" /> Checking…</> : <><ShieldCheck size={16} /> Check message</>}
          </button>
        </div>

        {result && (
          <div className="animate-slide-up space-y-3">
            <div className={`card p-5 border ${levelStyles[result.level].badge}`}>
              <div className="flex items-center gap-3 mb-2">
                <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${levelStyles[result.level].bg}`}>
                  {result.level === 'low' ? <ShieldCheck size={22} className={levelStyles[result.level].icon} /> : <AlertTriangle size={22} className={levelStyles[result.level].icon} />}
                </div>
                <div>
                  <p className="font-bold text-navy-900">{levelStyles[result.level].title}</p>
                  <p className="text-xs text-surface-500">{result.flags.length} warning sign{result.flags.length !== 1 ? 's' : ''} found</p>
                </div>
              </div>
            </div>

            {result.flags.length > 0 && (
              <div className="card p-5">
                <p className="text-sm font-bold text-navy-900 mb-3">Why this looks suspicious</p>
                <div className="space-y-2.5">
                  {result.flags.map((f, i) => (
                    <div key={i} className="flex gap-2.5">
                      <AlertTriangle size={15} className="text-amber-500 shrink-0 mt-0.5" />
                      <p className="text-sm text-surface-600">{f}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="card p-4 bg-primary-50/60 border-primary-100">
              <p className="text-xs text-primary-800 font-medium mb-1">What to do</p>
              <p className="text-xs text-primary-700 leading-relaxed">
                Never share a PIN, password, OTP, BVN or card details. Verify through the official app or a number you already have — not a link in the message. Moneva can’t guarantee a message is safe; when in doubt, don’t send money.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
