import { useId, useState } from 'react';
import type { ReactNode } from 'react';
import { Eye, EyeOff } from 'lucide-react';

export function TextField({ label, value, onChange, type = 'text', placeholder, error, autoComplete, trailing, onBlur }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
  error?: string;
  autoComplete?: string;
  trailing?: ReactNode;
  onBlur?: () => void;
}) {
  const id = useId();
  return (
    <div className="mb-4">
      <div className="flex items-baseline justify-between mb-1.5">
        <label htmlFor={id} className="text-[13px] font-medium text-navy-800">{label}</label>
        {trailing}
      </div>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        onBlur={onBlur}
        aria-invalid={!!error}
        className={`w-full px-4 py-3.5 rounded-2xl border bg-white text-sm text-navy-900 placeholder:text-surface-400 outline-none transition-all focus:border-leaf-500 focus:ring-2 focus:ring-leaf-500/15 ${
          error ? 'border-red-300' : 'border-surface-200 hover:border-surface-300'
        }`}
      />
      {error && <p className="text-xs text-red-600 mt-1.5">{error}</p>}
    </div>
  );
}

export function PasswordField({ label, value, onChange, placeholder, error, autoComplete, trailing, onBlur }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  error?: string;
  autoComplete?: string;
  trailing?: ReactNode;
  onBlur?: () => void;
}) {
  const id = useId();
  const [visible, setVisible] = useState(false);
  return (
    <div className="mb-4">
      <div className="flex items-baseline justify-between mb-1.5">
        <label htmlFor={id} className="text-[13px] font-medium text-navy-800">{label}</label>
        {trailing}
      </div>
      <div className="relative">
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
          onBlur={onBlur}
          aria-invalid={!!error}
          className={`w-full px-4 py-3.5 pr-11 rounded-2xl border bg-white text-sm text-navy-900 placeholder:text-surface-400 outline-none transition-all focus:border-leaf-500 focus:ring-2 focus:ring-leaf-500/15 ${
            error ? 'border-red-300' : 'border-surface-200 hover:border-surface-300'
          }`}
        />
        <button
          type="button"
          onClick={() => setVisible(!visible)}
          aria-label={visible ? 'Hide password' : 'Show password'}
          className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-surface-500 hover:text-navy-700"
        >
          {visible ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
      {error && <p className="text-xs text-red-600 mt-1.5">{error}</p>}
    </div>
  );
}

export function Checkbox({ checked, onChange, children }: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  children: ReactNode;
}) {
  return (
    <label className="flex items-center gap-2 cursor-pointer select-none">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="w-4 h-4 rounded border-surface-300 text-leaf-600 accent-leaf-600"
      />
      <span className="text-[13px] text-surface-600">{children}</span>
    </label>
  );
}

export function Notice({ tone = 'info', children }: { tone?: 'info' | 'error'; children: ReactNode }) {
  return (
    <p className={`text-xs rounded-2xl px-4 py-3 animate-fade-in ${
      tone === 'error' ? 'bg-red-50 text-red-700 border border-red-100' : 'bg-primary-50 text-primary-800 border border-primary-100'
    }`}>
      {children}
    </p>
  );
}
