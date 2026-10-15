import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useStore } from '../context/store';
import AuthLayout from '../components/AuthLayout';
import { Checkbox, Notice, PasswordField, TextField } from '../components/AuthFields';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const STRENGTH_LABELS = ['Too short', 'Weak', 'Fair', 'Good', 'Strong'];
const STRENGTH_COLORS = ['bg-surface-200', 'bg-red-400', 'bg-amber-400', 'bg-primary-400', 'bg-emerald-500'];

/** Local (0801…), national (234801…) or E.164 input → +234… or null. */
export function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/[^\d+]/g, '');
  if (!digits) return null;
  let e164 = digits;
  if (!e164.startsWith('+')) {
    if (e164.startsWith('234')) e164 = `+${e164}`;
    else if (e164.length === 11 && e164.startsWith('0')) e164 = `+234${e164.slice(1)}`;
    else if (e164.length === 10) e164 = `+234${e164}`;
    else return null;
  }
  return /^\+[1-9]\d{7,14}$/.test(e164) ? e164 : null;
}

function scorePassword(password: string): number {
  if (password.length < 8) return 0;
  let score = 1;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score++;
  if (/\d/.test(password) || /[^\w\s]/.test(password)) score++;
  return Math.min(4, score);
}

export default function SignUpPage() {
  const navigate = useNavigate();
  const { register, authPending, authError, setAuthError } = useStore();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [university, setUniversity] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [touched, setTouched] = useState({ name: false, email: false, phone: false, password: false, agreed: false });

  const score = useMemo(() => scorePassword(password), [password]);
  const nameError = touched.name && name.trim().length < 2 ? 'Tell us what to call you' : undefined;
  const emailError = touched.email && !EMAIL_RE.test(email.trim()) ? 'Enter a valid email address' : undefined;
  const phoneError = touched.phone && !normalizePhone(phone) ? 'Enter a valid Nigerian number, e.g. 0801 234 5678' : undefined;
  const passwordError = touched.password && score < 1 ? 'Use at least 8 characters' : undefined;
  const agreedError = touched.agreed && !agreed ? 'Please accept the terms to continue' : undefined;
  const canSubmit = name.trim().length >= 2 && EMAIL_RE.test(email.trim()) && !!normalizePhone(phone) && score >= 1 && agreed && !authPending;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched({ name: true, email: true, phone: true, password: true, agreed: true });
    if (name.trim().length < 2 || !EMAIL_RE.test(email.trim()) || !normalizePhone(phone) || score < 1 || !agreed) return;
    if (await register({ name: name.trim(), email: email.trim(), password, university: university.trim() || undefined, phoneNumber: normalizePhone(phone) || undefined })) {
      navigate('/setup');
    }
  };

  return (
    <AuthLayout
      eyebrow="Sign up"
      title="Get Started Now"
      subtitle="These details open your B Moni wallet too. No BVN, no card details, no bank password."
      footer={
        <div className="space-y-2">
          <p className="text-surface-500">
            Have an account?{' '}
            <Link to="/login" className="font-semibold text-primary-600 hover:text-primary-700 transition-colors">Sign in</Link>
          </p>
          <p className="text-[13px] text-surface-500">
            Not ready yet?{' '}
            <Link to="/" className="font-medium text-navy-700 hover:text-navy-900 transition-colors">Explore the demo</Link> instead.
          </p>
        </div>
      }
    >
      <form onSubmit={submit} noValidate>
        <TextField
          label="Full name"
          value={name}
          onChange={(v) => { setName(v); setAuthError(null); }}
          onBlur={() => setTouched(t => ({ ...t, name: true }))}
          placeholder="Ada Okonkwo"
          error={nameError}
          autoComplete="name"
        />
        <TextField
          label="Email address"
          type="email"
          value={email}
          onChange={(v) => { setEmail(v); setAuthError(null); }}
          onBlur={() => setTouched(t => ({ ...t, email: true }))}
          placeholder="you@student.edu.ng"
          error={emailError}
          autoComplete="email"
        />
        <TextField
          label="University"
          value={university}
          onChange={setUniversity}
          placeholder="Optional — used for student deals only"
          autoComplete="organization"
        />
        <TextField
          label="Phone number"
          type="tel"
          value={phone}
          onChange={(v) => { setPhone(v); setAuthError(null); }}
          onBlur={() => setTouched(t => ({ ...t, phone: true }))}
          placeholder="0801 234 5678"
          error={phoneError}
          autoComplete="tel"
        />
        <p className="text-[11px] text-surface-500 -mt-3 mb-4">
          Creates your B Moni savings wallet — the account you'll transfer money into.
        </p>
        <PasswordField
          label="Password"
          value={password}
          onChange={(v) => { setPassword(v); setAuthError(null); }}
          onBlur={() => setTouched(t => ({ ...t, password: true }))}
          placeholder="At least 8 characters"
          error={passwordError}
          autoComplete="new-password"
        />

        {password.length > 0 && (
          <div className="-mt-1.5 mb-4">
            <div className="flex gap-1.5">
              {[1, 2, 3, 4].map((step) => (
                <span key={step} className={`h-1 flex-1 rounded-full transition-colors ${score >= step ? STRENGTH_COLORS[score] : 'bg-surface-200'}`} />
              ))}
            </div>
            <p className="text-[11px] text-surface-500 mt-1.5">
              {STRENGTH_LABELS[score]}
              {score < 4 ? ' · add length, a capital letter and a number' : ' · stored hashed, never in plain text'}
            </p>
          </div>
        )}

        <div className="mb-5">
          <Checkbox checked={agreed} onChange={(v) => { setAgreed(v); setTouched(t => ({ ...t, agreed: true })); }}>
            I agree to the terms of use and privacy policy.
          </Checkbox>
          {agreedError && <p className="text-xs text-red-600 mt-1.5">{agreedError}</p>}
        </div>

        {authError && <div className="mb-4"><Notice tone="error">{authError}</Notice></div>}

        <button
          type="submit"
          disabled={!canSubmit}
          className="w-full bg-leaf-600 text-white font-semibold py-3.5 rounded-2xl text-sm hover:bg-leaf-700 active:scale-[0.99] transition-all disabled:opacity-40 disabled:active:scale-100 flex items-center justify-center gap-2"
        >
          {authPending ? (
            <span className="flex items-center gap-2">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Creating your account…
            </span>
          ) : (
            'Sign up'
          )}
        </button>

        <p className="text-[11px] text-surface-500 mt-5 leading-relaxed">
          Next you answer three questions about your money. That takes about a minute and produces your first budget — nothing is charged or transferred anywhere.
        </p>
      </form>
    </AuthLayout>
  );
}
