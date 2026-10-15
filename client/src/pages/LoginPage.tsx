import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useStore } from '../context/store';
import AuthLayout from '../components/AuthLayout';
import { Checkbox, Notice, PasswordField, TextField } from '../components/AuthFields';
import { Sparkles } from 'lucide-react';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LoginPage() {
  const navigate = useNavigate();
  const { login, authPending, authError, setAuthError, setDemoMode } = useStore();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [touched, setTouched] = useState({ email: false, password: false });
  const [notice, setNotice] = useState<string | null>(null);

  const emailError = touched.email && !EMAIL_RE.test(email.trim()) ? 'Enter a valid email address' : undefined;
  const passwordError = touched.password && !password ? 'Password is required' : undefined;
  const canSubmit = EMAIL_RE.test(email.trim()) && password.length > 0 && !authPending;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched({ email: true, password: true });
    setNotice(null);
    if (!EMAIL_RE.test(email.trim()) || !password) return;
    if (await login(email.trim(), password, remember)) {
      const st = useStore.getState();
      navigate(st.user?.typicalIncomeInKobo && st.categoryBudgets.length ? '/' : '/setup');
    }
  };

  const enterDemo = () => { setDemoMode(true); navigate('/'); };

  return (
    <AuthLayout
      eyebrow="Sign in"
      title="Welcome back!"
      subtitle="Enter your credentials to access your budget plan."
      footer={
        <div className="space-y-2">
          <p className="text-surface-500">
            Don't have an account?{' '}
            <Link to="/signup" className="font-semibold text-primary-600 hover:text-primary-700 transition-colors">Sign up</Link>
          </p>
          <p className="text-[13px] text-surface-500">
            Or <Link to="/" className="font-medium text-navy-700 hover:text-navy-900 transition-colors">explore the demo</Link> without an account.
          </p>
        </div>
      }
    >
      <form onSubmit={submit} noValidate>
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
        <PasswordField
          label="Password"
          value={password}
          onChange={(v) => { setPassword(v); setAuthError(null); }}
          onBlur={() => setTouched(t => ({ ...t, password: true }))}
          placeholder="Enter your password"
          error={passwordError}
          autoComplete="current-password"
          trailing={
            <button
              type="button"
              onClick={() => setNotice('Password reset requires an email service. If you\'re locked out, create a new account — your data stays on this device.')}
              className="min-h-[44px] px-1 -mx-1 text-[12px] font-medium text-primary-600 hover:text-primary-700 transition-colors cursor-pointer"
            >
              Forgot password?
            </button>
          }
        />

        <div className="flex items-center justify-between mb-6">
          <Checkbox checked={remember} onChange={setRemember}>Remember me for 30 days</Checkbox>
        </div>

        {authError && <div className="mb-4"><Notice tone="error">{authError}</Notice></div>}
        {notice && <div className="mb-4"><Notice>{notice}</Notice></div>}

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
              Signing in…
            </span>
          ) : (
            'Login'
          )}
        </button>

        <div className="mt-4">
          <button
            type="button"
            onClick={enterDemo}
            className="w-full py-3 rounded-xl border border-dashed border-surface-300 text-[13px] font-medium text-surface-600 hover:border-leaf-400 hover:text-leaf-700 active:scale-[0.99] transition-all flex items-center justify-center gap-2"
          >
            <Sparkles size={14} className="text-leaf-600" />
            Try demo mode instead
          </button>
        </div>
      </form>
    </AuthLayout>
  );
}
