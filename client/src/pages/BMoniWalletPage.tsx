import { useCallback, useEffect, useState } from 'react';
import { useStore } from '../context/store';
import Header from '../components/Header';
import { formatNaira } from '../utils';
import { apiGet, apiPost, bmoni } from '../services/api';
import {
  Loader2, ShieldCheck, Link2, RefreshCw, KeyRound, SearchCheck,
  TrendingUp, AlertTriangle, CheckCircle2, XCircle,
} from 'lucide-react';

type Sandbox = {
  bmoniUserId: string;
  partnerUserId?: string;
  profile: any;
  kycReadiness: { ready: boolean; missing?: string[] } | null;
  onboarding: Record<string, string> | null;
  supportedCurrencies: string[];
};

export default function BMoniWalletPage() {
  const { savingsGoals, getMonthlyAllowance } = useStore();
  const [sandbox, setSandbox] = useState<Sandbox | null>(null);
  const [rate, setRate] = useState<any | null>(null);
  const [banks, setBanks] = useState<{ bankName: string; bankCode: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [bankQuery, setBankQuery] = useState('');
  const [selectedBank, setSelectedBank] = useState<{ bankName: string; bankCode: string } | null>(null);
  const [accountNumber, setAccountNumber] = useState('');
  const [lookup, setLookup] = useState<{ name: string; bank: string } | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);

  const q = bankQuery.trim().toLowerCase();
  const matches = (banks.length ? banks : [])
    .filter(b => !q || b.bankName.toLowerCase().includes(q))
    .slice(0, 30);

  const loadAll = useCallback(async () => {
    setError(null);
    const status = await bmoni.status();
    setSandbox(status);
    const [r, b] = await Promise.all([
      apiGet('/bmoni/rate?to=USD').catch(() => null),
      apiGet('/bmoni/banks').catch(() => []),
    ]);
    setRate(r);
    setBanks(Array.isArray(b) ? b : []);
  }, []);

  useEffect(() => {
    loadAll().catch(() => setSandbox(null));
  }, [loadAll]);

  const connect = async () => {
    setBusy(true);
    setError(null);
    try {
      await bmoni.connect();
      await loadAll();
    } catch (e: any) {
      setError(e.message || 'Sandbox connection failed');
    }
    setBusy(false);
  };

  const verify = async () => {
    setBusy(true);
    setLookup(null);
    setLookupError(null);
    try {
      const data = await apiPost('/bmoni/verify-account', {
        bankCode: selectedBank!.bankCode,
        accountNumber,
      });
      setLookup({ name: data.accountName, bank: data.bankName });
    } catch (e: any) {
      setLookupError(e.message || 'Verification failed');
    }
    setBusy(false);
  };

  const totalSaved = savingsGoals.reduce((s, g) => s + g.currentAmount, 0);
  const usdEquivalent = rate?.exchangeRate ? totalSaved / Number(rate.exchangeRate) : null;

  return (
    <div>
      <Header title="B Moni Sandbox" showBack />

      <div className="px-5 pt-5 pb-8 space-y-4">
        <div>
          <p className="section-label mb-1">Live partner integration</p>
          <h1 className="text-2xl font-bold text-navy-900">B Moni Embedded API</h1>
          <p className="text-sm text-surface-500 mt-0.5">
            Every call below goes through Moneva’s backend. Your API key never reaches the app.
          </p>
        </div>

        {!sandbox ? (
          <div className="card p-6 text-center">
            <div className="w-16 h-16 bg-primary-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Link2 size={28} className="text-primary-600" />
            </div>
            <h2 className="font-bold text-navy-900 text-lg mb-1">Link a sandbox identity</h2>
            <p className="text-sm text-surface-500 mb-5 max-w-xs mx-auto">
              Creates a test user on B Moni’s development environment with synthetic details.
              No BVN, no real money, no production data.
            </p>
            <button onClick={connect} disabled={busy} className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-60">
              {busy ? <><Loader2 size={17} className="animate-spin" /> Connecting…</> : <>Connect sandbox</>}
            </button>
          </div>
        ) : (
          <>
            <div className="bg-navy-800 rounded-2xl p-5 text-white shadow-card-lg">
              <div className="flex items-center justify-between mb-3">
                <p className="section-label !text-primary-300">Sandbox identity</p>
                <span className="badge bg-emerald-500/20 text-emerald-300 text-[10px] flex items-center gap-1">
                  <ShieldCheck size={11} /> Live
                </span>
              </div>
              <h2 className="text-xl font-bold">{sandbox.profile?.firstName} {sandbox.profile?.lastName}</h2>
              <p className="text-xs text-primary-200 mt-0.5">{sandbox.profile?.email} · {sandbox.profile?.phoneNumber}</p>
              <p className="text-[11px] text-navy-200 font-mono mt-3 break-all">id: {sandbox.bmoniUserId}</p>
              <div className="flex items-center justify-between mt-4 pt-3 border-t border-white/10">
                <span className="text-[11px] text-navy-200">Partner</span>
                <span className="text-[11px] font-medium text-white">{sandbox.profile?.partnerName ?? 'B Moni'}</span>
              </div>
              <button onClick={loadAll} disabled={busy} className="mt-3 text-[11px] text-primary-300 flex items-center gap-1">
                <RefreshCw size={11} /> Refresh from API
              </button>
            </div>

            <div className="card p-4">
              <div className="flex items-center gap-2 mb-3">
                <KeyRound size={15} className="text-primary-600" />
                <h3 className="font-bold text-navy-900 text-sm">KYC readiness</h3>
              </div>
              {sandbox.kycReadiness?.ready ? (
                <div className="flex items-center gap-2 text-emerald-700 text-sm">
                  <CheckCircle2 size={16} /> Ready for activation
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2 text-amber-700 text-sm mb-2">
                    <AlertTriangle size={16} /> Not ready yet — expected for a synthetic demo user
                  </div>
                  <ul className="space-y-1">
                    {(sandbox.kycReadiness?.missing ?? []).map((m, i) => (
                      <li key={i} className="text-xs text-surface-500 flex items-start gap-1.5">
                        <XCircle size={12} className="text-surface-400 mt-0.5 shrink-0" /> {m}
                      </li>
                    ))}
                  </ul>
                </>
              )}
              {sandbox.supportedCurrencies.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-surface-100">
                  {sandbox.supportedCurrencies.map(c => (
                    <span key={c} className="badge bg-surface-100 text-navy-700 text-[10px]">{c}</span>
                  ))}
                </div>
              )}
            </div>

            {rate && (
              <div className="card p-4 bg-primary-50 border-primary-100">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp size={15} className="text-primary-700" />
                  <h3 className="font-bold text-navy-900 text-sm">Live exchange rate</h3>
                </div>
                <p className="text-xs text-primary-700">{rate.displayLabel} · {rate.inverseLabel}</p>
                <p className="text-[11px] text-primary-600 mt-1">source: {rate.rateSource}</p>
                {usdEquivalent !== null && (
                  <div className="mt-3 pt-3 border-t border-primary-200/60">
                    <p className="text-[11px] text-primary-700">
                      Your {formatNaira(totalSaved)} in active goals is roughly{' '}
                      <span className="font-bold">${usdEquivalent.toFixed(2)}</span> at today’s sandbox rate.
                      Targets you set in naira lose purchasing power as prices move — this is the
                      inflation signal behind adaptive goals.
                    </p>
                  </div>
                )}
              </div>
            )}

            <div className="card p-4">
              <div className="flex items-center gap-2 mb-1">
                <SearchCheck size={15} className="text-primary-600" />
                <h3 className="font-bold text-navy-900 text-sm">Confirm who you’re paying</h3>
              </div>
              <p className="text-[11px] text-surface-500 mb-3">
                Real NUBAN name resolution from B Moni. Check the account holder’s name before you send
                money to someone you have not verified.
              </p>
              <div className="space-y-2.5">
                <div className="relative">
                  <input
                    value={selectedBank ? selectedBank.bankName : bankQuery}
                    onChange={(e) => { setBankQuery(e.target.value); setSelectedBank(null); }}
                    placeholder={`Search bank${banks.length ? ` — ${banks.length} available` : ''}`}
                    className="input-field text-sm"
                  />
                  {!selectedBank && q && (
                    <div className="absolute z-20 left-0 right-0 mt-1.5 bg-white border border-surface-200 rounded-xl shadow-card-lg max-h-52 overflow-y-auto">
                      {matches.map(b => (
                        <button
                          key={b.bankCode}
                          onClick={() => { setSelectedBank(b); setBankQuery(''); }}
                          className="w-full text-left px-4 py-2.5 text-sm text-navy-900 hover:bg-primary-50 flex items-center justify-between"
                        >
                          {b.bankName}
                          <span className="text-[10px] text-surface-400 font-mono">{b.bankCode}</span>
                        </button>
                      ))}
                      {matches.length === 0 && (
                        <p className="px-4 py-3 text-xs text-surface-400">No bank matches “{bankQuery}”.</p>
                      )}
                    </div>
                  )}
                  {selectedBank && (
                    <button
                      onClick={() => setSelectedBank(null)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-medium text-primary-600"
                    >
                      Change
                    </button>
                  )}
                </div>
                <div className="flex gap-2">
                  <input
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    placeholder="10-digit account number"
                    inputMode="numeric"
                    className="input-field text-sm flex-1"
                  />
                  <button
                    onClick={verify}
                    disabled={busy || !selectedBank || accountNumber.length !== 10}
                    className="btn-primary text-sm px-4 disabled:opacity-40"
                  >
                    Check
                  </button>
                </div>
              </div>
              {lookup && (
                <div className="mt-3 p-3 rounded-xl bg-emerald-50 border border-emerald-100 animate-slide-up">
                  <p className="text-[11px] text-emerald-700 font-medium">Registered name</p>
                  <p className="text-base font-bold text-emerald-800">{lookup.name}</p>
                  <p className="text-[11px] text-emerald-700">{lookup.bank}</p>
                </div>
              )}
              {lookup && lookup.name && (
                <p className="text-[11px] text-surface-500 mt-2">
                  If this name is not who you meant to pay, stop. That is the single most common
                  way students lose money to payment fraud.
                </p>
              )}
              {lookupError && (
                <p className="text-[11px] text-red-600 mt-2">{lookupError}</p>
              )}
            </div>
          </>
        )}

        {error && (
          <div className="card p-4 border-l-4 border-l-amber-500 flex items-start gap-3">
            <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-navy-900">Sandbox not reachable</p>
              <p className="text-xs text-surface-500 mt-0.5">{error}</p>
            </div>
          </div>
        )}

        <div className="card p-4">
          <p className="text-sm font-bold text-navy-900 mb-2">What this demo does and does not do</p>
          <ul className="space-y-1.5 text-xs text-surface-500">
            <li className="flex gap-2"><CheckCircle2 size={13} className="text-emerald-600 shrink-0 mt-0.5" /> Creates a real identity on B Moni’s development environment.</li>
            <li className="flex gap-2"><CheckCircle2 size={13} className="text-emerald-600 shrink-0 mt-0.5" /> Reads live KYC readiness, supported currencies, bank directory, NUBAN name resolution and FX rates.</li>
            <li className="flex gap-2"><XCircle size={13} className="text-surface-400 shrink-0 mt-0.5" /> Does not create a smart wallet or send funds — B Moni requires the wallet owner to sign an EIP-191 proof with their own device key, which only their embedded SDK can do.</li>
          </ul>
          <p className="text-[11px] text-surface-400 mt-3 leading-relaxed">
            We show this honestly instead of faking a transfer. Wiring the signing flow is the next
            step once the embedded SDK artefacts for this platform are provided.
          </p>
        </div>
      </div>
    </div>
  );
}
