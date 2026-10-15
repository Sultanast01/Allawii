import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../context/store';
import { useBMoniStatus } from '../hooks/useBMoniStatus';
import { bmoni } from '../services/api';
import { formatNaira } from '../utils';
import { Wallet, Wifi, ChevronRight, Loader2 } from 'lucide-react';

interface WalletBalances {
  smartAccountAddress?: string;
  balances?: { smartWalletId: string; currency: string; balance: string; error: string | null }[];
}

export default function BMoniCard() {
  const navigate = useNavigate();
  const { savingsGoals } = useStore();
  const { status, loading } = useBMoniStatus();
  const [wallet, setWallet] = useState<WalletBalances | null>(null);

  useEffect(() => {
    let live = true;
    bmoni.balances()
      .then((d) => { if (live) setWallet(d); })
      .catch(() => {});
    return () => { live = false; };
  }, []);

  const totalSaved = savingsGoals.reduce((s, g) => s + g.currentAmountInKobo, 0);
  const hasSandbox = status?.profile != null;
  const ngnEntry = wallet?.balances?.find((b) => b.currency === 'NGN' || b.currency === 'CNGN');
  const walletKobo = ngnEntry ? Math.round(parseFloat(ngnEntry.balance || '0') * 100) : null;
  const hasWallet = walletKobo != null;

  return (
    <button
      onClick={() => navigate('/bmoni')}
      className="w-full text-left group"
      aria-label="Open B Moni wallet"
    >
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-teal-500 via-teal-600 to-emerald-700 p-5 text-white shadow-card-lg transition-transform active:scale-[0.98] lg:p-6">
        {/* Decorative blobs */}
        <div className="absolute -top-20 -right-16 w-56 h-56 rounded-full bg-white/10 blur-3xl" aria-hidden="true" />
        <div className="absolute -bottom-24 -left-12 w-48 h-48 rounded-full bg-teal-300/20 blur-3xl" aria-hidden="true" />

        {/* Top row: branding + status */}
        <div className="relative flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-white/20 backdrop-blur-sm flex items-center justify-center">
              <Wallet size={16} className="text-white" />
            </div>
            <div>
              <p className="text-[13px] font-bold leading-tight">B Moni</p>
              <p className="text-[10px] text-teal-100 leading-tight">Smart wallet</p>
            </div>
          </div>
          {loading ? (
            <Loader2 size={14} className="animate-spin text-teal-200" />
          ) : hasSandbox ? (
            <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-200 bg-white/10 backdrop-blur-sm px-2 py-1 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse" />
              Live
            </span>
          ) : (
            <span className="text-[10px] font-semibold text-teal-200 bg-white/10 backdrop-blur-sm px-2 py-1 rounded-full">
              Demo
            </span>
          )}
        </div>

        {/* Balance */}
        <div className="relative mb-5">
          <p className="text-[10px] font-semibold tracking-wider text-teal-100 uppercase mb-1">Wallet balance</p>
          <h2 className="text-3xl font-bold tracking-tight leading-tight lg:text-4xl">
            {formatNaira(hasWallet ? walletKobo! : totalSaved)}
          </h2>
          <p className="text-xs text-teal-100 mt-1">
            {hasWallet
              ? `B Moni smart wallet · ${savingsGoals.length} ${savingsGoals.length === 1 ? 'goal' : 'goals'} active`
              : `${savingsGoals.length} ${savingsGoals.length === 1 ? 'goal' : 'goals'} active`}
          </p>
        </div>

        {/* Card-like elements */}
        <div className="relative flex items-end justify-between pt-4 border-t border-white/15">
          <div className="flex items-center gap-3">
            {/* Decorative chip */}
            <div className="w-10 h-7 rounded-md bg-gradient-to-br from-amber-200 to-amber-400 shrink-0 relative overflow-hidden" aria-hidden="true">
              <div className="absolute inset-x-1 top-1/2 h-px bg-amber-700/30" />
              <div className="absolute inset-y-1 left-1/2 w-px bg-amber-700/30" />
            </div>
            {/* Contactless icon */}
            <Wifi size={16} className="text-white/60 rotate-90" aria-hidden="true" />
          </div>
          <div className="text-right">
            <p className="text-[10px] tracking-wider text-teal-200 uppercase mb-0.5">
              {hasSandbox ? status.profile?.firstName : 'Allawii'}
            </p>
            <p className="text-[11px] font-mono text-white/70">
              •••• •••• •••• {(totalSaved % 10000).toString().padStart(4, '0')}
            </p>
          </div>
        </div>

        {/* Hover indicator */}
        <div className="absolute top-5 right-5 opacity-0 group-hover:opacity-100 transition-opacity">
          <ChevronRight size={18} className="text-white/80" />
        </div>
      </div>
    </button>
  );
}
