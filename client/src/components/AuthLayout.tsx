import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import authLeaves from '../assets/auth-leaves.webp';

export default function AuthLayout({ eyebrow, title, subtitle, children, footer }: {
  eyebrow: string;
  title: string;
  subtitle: string;
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <div className="relative min-h-screen lg:flex lg:items-center lg:justify-center lg:p-6 lg:bg-surface-100">
      {/* Faded leaf backdrop on mobile */}
      <div className="absolute inset-0 lg:hidden" aria-hidden="true">
        <img src={authLeaves} alt="" className="w-full h-full object-cover opacity-30" />
        <div className="absolute inset-0 bg-gradient-to-b from-white/75 via-white/60 to-white/85" />
      </div>

      <div className="relative lg:w-full lg:max-w-5xl lg:bg-white lg:rounded-[32px] lg:shadow-[0_8px_40px_rgba(20,32,58,0.10)] lg:overflow-hidden lg:grid lg:grid-cols-2">
        <div className="px-6 py-10 sm:px-10 lg:px-14 lg:py-16 flex flex-col min-h-screen lg:min-h-[640px]">
          <Link to="/" className="flex items-center gap-2.5 mb-10 w-fit">
            <img src="/brand/allawii-mark.png" alt="Allawii mark" className="w-9 h-9 rounded-xl" />
            <span className="text-lg font-bold text-navy-900 tracking-tight">Allawii</span>
          </Link>

          <div className="flex-1 flex flex-col justify-center w-full max-w-sm mx-auto lg:mx-0">
            <div className="mb-7">
              <p className="text-[11px] font-semibold tracking-wider text-leaf-600 uppercase mb-2">{eyebrow}</p>
              <h1 className="text-3xl font-bold text-navy-900 tracking-tight mb-1.5">{title}</h1>
              <p className="text-sm text-surface-500">{subtitle}</p>
            </div>
            {children}
          </div>

          <div className="mt-8 w-full max-w-sm mx-auto lg:mx-0 text-center text-sm text-surface-500">{footer}</div>
        </div>

        <div className="hidden lg:block relative">
          <img src={authLeaves} alt="" aria-hidden="true" className="absolute inset-0 w-full h-full object-cover" />
        </div>
      </div>
    </div>
  );
}
