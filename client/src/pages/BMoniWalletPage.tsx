import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../context/store';
import Header from '../components/Header';
import { koboToNaira, formatNaira } from '../utils';
import { apiGet, apiPost, bmoni } from '../services/api';
import { useAccount, useConnect, useSignMessage } from 'wagmi';
import { injected } from 'wagmi/connectors';
import {
  Loader2, ShieldCheck, Link2, RefreshCw, KeyRound, SearchCheck,
  TrendingUp, AlertTriangle, CheckCircle2, XCircle, Wallet,
  ArrowDownToLine, Copy, Check, Landmark,
} from 'lucide-react';

type Sandbox = {
  bmoniUserId: string;
  partnerUserId?: string;
  profile: any;
  kycReadiness: { ready: boolean; missing?: string[] } | null;
  kycReview: {
    status?: string;
    reviewAnswer?: string;
    reviewRejectType?: string;
    rejectLabels?: string[];
  } | null;
  onboarding: Record<string, string> | null;
  supportedCurrencies: string[];
};

type SmartWallet = {
  address: string;
  currency: string;
  deployedAt: string;
};

/** What B Moni actually reports, rather than assuming readiness equals approval. */
function kycVerdict(sandbox: Sandbox): { title: string; label: string; tone: 'ok' | 'warn' | 'pending' } {
  const r = sandbox.kycReview;
  if (r?.status === 'approved' || r?.reviewAnswer === 'GREEN') return { title: 'Identity approved', label: 'Open verification', tone: 'ok' };
  if (r?.status === 'action_required' || r?.reviewAnswer === 'RED') return { title: 'Reviewer wants another look', label: 'Fix the flagged documents', tone: 'warn' };
  if (r) return { title: 'With the reviewer', label: 'Check the verdict', tone: 'pending' };
  return sandbox.kycReadiness?.ready
    ? { title: 'Ready to send for review', label: 'Send for review', tone: 'pending' }
    : { title: 'Not verified yet', label: 'Complete verification', tone: 'warn' };
}

export default function BMoniWalletPage() {
  const navigate = useNavigate();
  const { savingsGoals, getMonthlyAllowance } = useStore();
  const [sandbox, setSandbox] = useState<Sandbox | null>(null);
  const [rate, setRate] = useState<any | null>(null);
  const [banks, setBanks] = useState<{ bankName: string; bankCode: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [linking, setLinking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [bankQuery, setBankQuery] = useState('');
  const [selectedBank, setSelectedBank] = useState<{ bankName: string; bankCode: string } | null>(null);
  const [accountNumber, setAccountNumber] = useState('');
  const [lookup, setLookup] = useState<{ name: string; bank: string } | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);

  // Smart wallet state
  const [smartWallet, setSmartWallet] = useState<SmartWallet | null>(null);
  const [deploying, setDeploying] = useState(false);
  const [deployError, setDeployError] = useState<string | null>(null);
  const [walletError, setWalletError] = useState<string | null>(null);
  const [selectedCurrency, setSelectedCurrency] = useState('CNGN');

  // Add-money state
  const [balances, setBalances] = useState<{ smartAccountAddress?: string; balances?: { smartWalletId: string; currency: string; balance: string; error: string | null }[] } | null>(null);
  const [deposits, setDeposits] = useState<{ nigerianAccounts: any[]; activationAccounts: any[]; europeanAccounts?: any[]; usaAccounts?: any[] } | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  // Nigeria (Anchor) onboarding — the step that issues a personal NUBAN
  const [bvn, setBvn] = useState('');
  const [anchor, setAnchor] = useState<any | null>(null);
  const [anchorBusy, setAnchorBusy] = useState(false);
  const [anchorError, setAnchorError] = useState<string | null>(null);

  const { address, isConnected } = useAccount();
  const { connect, isPending: connecting, error: connectError } = useConnect();
  const { signMessageAsync } = useSignMessage();

  const q = bankQuery.trim().toLowerCase();
  const matches = (banks.length ? banks : [])
    .filter(b => !q || b.bankName.toLowerCase().includes(q))
    .slice(0, 30);

  const loadAll = useCallback(async () => {
    setError(null);
    let status: Sandbox | null = null;
    try {
      status = await bmoni.status();
    } catch {
      status = null;
    }
    if (!status?.bmoniUserId) {
      // A sandbox identity is a dev fixture built from synthetic details, so linking it is
      // the default state of this page instead of a decision the user has to make first.
      setLinking(true);
      try {
        await bmoni.connect();
        status = await bmoni.status();
      } finally {
        setLinking(false);
      }
    }
    setSandbox(status);
    const [r, b, bal, dep] = await Promise.all([
      apiGet('/bmoni/rate?to=USD').catch(() => null),
      apiGet('/bmoni/banks').catch(() => []),
      bmoni.balances().catch(() => null),
      bmoni.depositAccounts().catch(() => null),
    ]);
    setRate(r);
    setBanks(Array.isArray(b) ? b : []);
    setBalances(bal);
    setDeposits(dep);
  }, []);

  useEffect(() => {
    loadAll().catch((e: any) => {
      setSandbox(null);
      setError(e?.message || 'The sandbox identity could not be linked.');
    });
  }, [loadAll]);

  const connectSandbox = async () => {
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

  const startNigeriaOnboarding = async () => {
    setAnchorBusy(true);
    setAnchorError(null);
    try {
      setAnchor(await bmoni.startNigeriaOnboarding(bvn));
      await loadAll();
    } catch (e: any) {
      setAnchorError(e.message || 'The sandbox refused to start Nigeria onboarding');
    }
    setAnchorBusy(false);
  };

  const connectWallet = () => {
    setWalletError(null);
    if (!(window as any).ethereum) {
      setWalletError('No browser wallet detected. Install MetaMask or any EIP-1193 wallet to anchor and sign for your smart wallet.');
      return;
    }
    connect({ connector: injected() });
  };

  const deploySmartWallet = async () => {
    if (!address || !sandbox) return;
    setDeploying(true);
    setDeployError(null);
    try {
      const challenge = await bmoni.walletChallenge(selectedCurrency, address);
      const message = challenge.message || challenge.data?.message;
      const challengeId = challenge.challengeId || challenge.data?.challengeId;

      if (!message) {
        throw new Error('No challenge message returned from BMONI');
      }

      const signature = await signMessageAsync({
        message,
      });

      const deployed = await bmoni.walletDeploy({
        currency: selectedCurrency,
        userOwnerAddress: address,
        signature,
        challengeId,
      });

      const walletAddress = deployed.address || deployed.data?.address;
      if (!walletAddress) {
        throw new Error('No wallet address returned after deployment');
      }

      setSmartWallet({
        address: walletAddress,
        currency: selectedCurrency,
        deployedAt: new Date().toISOString(),
      });
    } catch (e: any) {
      setDeployError(e.message || 'Wallet deployment failed');
    }
    setDeploying(false);
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

  const copyValue = async (id: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(id);
      setTimeout(() => setCopied((c) => (c === id ? null : c)), 2000);
    } catch {
      setCopied(null);
    }
  };

  const totalSaved = savingsGoals.reduce((s, g) => s + g.currentAmountInKobo, 0);
  const usdEquivalent = rate?.exchangeRate ? koboToNaira(totalSaved) / Number(rate.exchangeRate) : null;

  return (
    <div>
      <Header title="B Moni Sandbox" />

      <div className="px-5 pt-5 pb-8 space-y-4 lg:px-10 lg:max-w-5xl">
        <div>
          <p className="section-label mb-1">Live partner integration</p>
          <h1 className="text-2xl font-bold text-navy-900 lg:text-3xl">B Moni Embedded API</h1>
          <p className="text-sm text-surface-500 mt-1 lg:text-base">
            Every call below goes through Allawii&apos;s backend. Your API key never reaches the app.
          </p>
        </div>

        {!sandbox ? (
          <div className="card p-6 text-center">
            <div className="w-16 h-16 bg-primary-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Link2 size={28} className="text-primary-600" />
            </div>
            <h2 className="font-bold text-navy-900 text-lg mb-1">Linking your sandbox identity</h2>
            <p className="text-sm text-surface-500 mb-5 max-w-xs mx-auto">
              Creates a test user on B Moni&apos;s development environment with synthetic details.
              No BVN, no real money, no production data.
            </p>
            {error ? (
              <>
                <p role="alert" className="text-xs text-red-600 mb-3">{error}</p>
                <button onClick={connectSandbox} disabled={busy} className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-60">
                  {busy ? <><Loader2 size={17} className="animate-spin" /> Retrying...</> : <>Try again</>}
                </button>
              </>
            ) : (
              <p className="flex items-center justify-center gap-2 text-sm text-surface-500">
                <Loader2 size={16} className="animate-spin" /> {linking ? 'Creating the sandbox user...' : 'Checking for a linked identity...'}
              </p>
            )}
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
              <p className="text-xs text-primary-200 mt-0.5">{sandbox.profile?.email} &middot; {sandbox.profile?.phoneNumber}</p>
              <p className="text-[11px] text-navy-200 font-mono mt-3 break-all">id: {sandbox.bmoniUserId}</p>
              <div className="flex items-center justify-between mt-4 pt-3 border-t border-white/10">
                <span className="text-[11px] text-navy-200">Partner</span>
                <span className="text-[11px] font-medium text-white">{sandbox.profile?.partnerName ?? 'B Moni'}</span>
              </div>
              <button onClick={loadAll} disabled={busy} className="mt-2 -mb-2 min-h-[44px] text-[11px] text-primary-300 flex items-center gap-1 cursor-pointer">
                <RefreshCw size={11} /> Refresh from API
              </button>
            </div>

            {/* Add money — wallet balance + accounts that can receive transfers */}
            <div className="card p-5">
              <div className="flex items-center gap-2 mb-3">
                <ArrowDownToLine size={15} className="text-emerald-600" />
                <h3 className="font-bold text-navy-900 text-sm">Add money</h3>
              </div>
              <p className="text-xs text-surface-500 mb-4">
                Transfer into the account below and the money lands in your B Moni wallet &mdash;
                the balance that powers your Allawii savings.
              </p>

              {balances?.balances && balances.balances.length > 0 ? (
                <div className="bg-surface-50 rounded-xl p-3 mb-4">
                  <p className="text-[10px] uppercase tracking-wider text-surface-500 mb-1">Wallet balance</p>
                  {balances.balances.map((b) => (
                    <div key={b.smartWalletId} className="flex items-baseline justify-between py-0.5">
                      <span className="text-sm font-semibold text-navy-900">{b.currency}</span>
                      <span className="text-sm font-bold text-navy-900">{Number(b.balance || 0).toLocaleString('en-NG', { minimumFractionDigits: 2 })}</span>
                    </div>
                  ))}
                  {balances.smartAccountAddress && (
                    <button
                      onClick={() => copyValue('wallet-address', balances.smartAccountAddress!)}
                      className="mt-2 text-[11px] text-primary-600 flex items-center gap-1 cursor-pointer"
                    >
                      {copied === 'wallet-address' ? <><Check size={11} /> Copied</> : <><Copy size={11} /> {balances.smartAccountAddress.slice(0, 10)}…{balances.smartAccountAddress.slice(-6)}</>}
                    </button>
                  )}
                </div>
              ) : (
                <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 mb-4">
                  <p className="text-xs text-amber-800">
                    No smart wallet yet. Deploy one below first &mdash; transfers need a wallet to land in.
                  </p>
                </div>
              )}

              {deposits && (deposits.activationAccounts?.length > 0 || deposits.nigerianAccounts?.length > 0) && (
                <div className="space-y-3">
                  {[...(deposits.nigerianAccounts ?? []), ...(deposits.activationAccounts ?? [])].map((acct: any) => (
                    <div key={acct.id || acct.accountNumber} className="bg-emerald-50 border border-emerald-100 rounded-xl p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-navy-900">{acct.accountNumber}</p>
                          <p className="text-xs text-surface-600 truncate">{acct.accountName} &middot; {acct.bankName}</p>
                          <p className="text-[10px] text-surface-500 mt-1">
                            {deposits.nigerianAccounts?.includes(acct) ? 'Your personal account number' : `Sandbox activation account (${acct.targetCurrency} rail)`}
                          </p>
                        </div>
                        <button
                          onClick={() => copyValue(acct.id || acct.accountNumber, acct.accountNumber)}
                          className="shrink-0 min-h-[44px] min-w-[44px] px-3 rounded-lg bg-white border border-surface-200 text-xs font-semibold text-navy-900 flex items-center gap-1 active:scale-95 transition-transform cursor-pointer"
                        >
                          {copied === (acct.id || acct.accountNumber) ? <><Check size={12} /> Copied</> : <><Copy size={12} /> Copy</>}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {sandbox?.kycReadiness && (
                <div className="mt-4 pt-3 border-t border-surface-100">
                  <p className="text-[11px] text-surface-500">
                    The number above is B Moni&apos;s pooled sandbox account. A personal naira account
                    number comes from Nigeria onboarding, which needs a BVN and an approved KYC review.
                    {!sandbox.kycReadiness.ready && ` Still open: ${(sandbox.kycReadiness.missing || []).join('; ')}.`}
                  </p>
                  <button onClick={() => navigate('/bmoni/kyc')} className="mt-2 text-[11px] font-semibold text-primary-600 cursor-pointer">
                    {kycVerdict(sandbox).label} &rarr;
                  </button>
                </div>
              )}
            </div>

            {/* Smart wallet section */}
            <div className="card p-5">
              <div className="flex items-center gap-2 mb-3">
                <Wallet size={15} className="text-primary-600" />
                <h3 className="font-bold text-navy-900 text-sm">Self-custody smart wallet</h3>
              </div>
              <p className="text-xs text-surface-500 mb-4">
                Your browser wallet (MetaMask, WalletConnect, etc.) anchors a BMONI managed smart wallet.
                You sign an owner-proof challenge with your own key &mdash; never server-side.
              </p>

              {!isConnected ? (
                <>
                  <button
                    onClick={connectWallet}
                    disabled={connecting}
                    className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-60"
                  >
                    {connecting ? <><Loader2 size={16} className="animate-spin" /> Connecting...</> : <><Wallet size={16} /> Connect browser wallet</>}
                  </button>
                  {(walletError || connectError) && (
                    <div className="mt-3 p-3 rounded-xl bg-amber-50 border border-amber-100">
                      <p className="text-xs text-amber-800">{walletError || connectError?.message || 'Could not connect wallet'}</p>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="bg-surface-50 rounded-xl p-3 mb-4">
                    <p className="text-[10px] uppercase tracking-wider text-surface-500 mb-1">Connected address</p>
                    <p className="text-sm font-mono text-navy-900 break-all">{address}</p>
                  </div>

                  {smartWallet ? (
                    <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3">
                      <div className="flex items-center gap-2 text-emerald-700 text-sm mb-2">
                        <CheckCircle2 size={14} /> Smart wallet deployed
                      </div>
                      <p className="text-[10px] uppercase tracking-wider text-emerald-700 mb-1">Wallet address</p>
                      <p className="text-sm font-mono text-emerald-800 break-all">{smartWallet.address}</p>
                      <p className="text-[11px] text-emerald-700 mt-2">
                        Currency: <b>{smartWallet.currency}</b> &middot; Deployed {new Date(smartWallet.deployedAt).toLocaleString()}
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className="mb-3">
                        <label className="text-[10px] uppercase tracking-wider text-surface-500 mb-1 block">Settlement currency</label>
                        <select
                          value={selectedCurrency}
                          onChange={(e) => setSelectedCurrency(e.target.value)}
                          className="input-field text-sm"
                        >
                          {sandbox.supportedCurrencies.length > 0
                            ? sandbox.supportedCurrencies.map((c) => <option key={c} value={c}>{c}</option>)
                            : ['CNGN', 'USDB', 'EURe'].map((c) => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>
                      <button
                        onClick={deploySmartWallet}
                        disabled={deploying}
                        className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-60"
                      >
                        {deploying ? <><Loader2 size={16} className="animate-spin" /> Deploying...</> : <>Deploy smart wallet</>}
                      </button>
                    </>
                  )}
                </>
              )}

              {deployError && (
                <div className="mt-3 p-3 rounded-xl bg-red-50 border border-red-100">
                  <p className="text-xs text-red-700">{deployError}</p>
                </div>
              )}
            </div>

            <div className="space-y-4 lg:grid lg:grid-cols-2 lg:gap-4 lg:space-y-0 lg:items-start">
            <div className="card p-4">
              <div className="flex items-center gap-2 mb-3">
                <KeyRound size={15} className="text-primary-600" />
                <h3 className="font-bold text-navy-900 text-sm">KYC with B Moni</h3>
              </div>
              <div className={`flex items-center gap-2 text-sm mb-2 ${
                kycVerdict(sandbox).tone === 'ok' ? 'text-emerald-700'
                  : kycVerdict(sandbox).tone === 'pending' ? 'text-primary-700' : 'text-amber-700'
              }`}>
                {kycVerdict(sandbox).tone === 'ok'
                  ? <CheckCircle2 size={16} />
                  : kycVerdict(sandbox).tone === 'pending' ? <Loader2 size={16} /> : <AlertTriangle size={16} />}
                {kycVerdict(sandbox).title}
              </div>
              {!sandbox.kycReadiness?.ready && (
                <ul className="space-y-1">
                  {(sandbox.kycReadiness?.missing ?? []).map((m, i) => (
                    <li key={i} className="text-xs text-surface-500 flex items-start gap-1.5">
                      <XCircle size={12} className="text-surface-500 mt-0.5 shrink-0" /> {m}
                    </li>
                  ))}
                </ul>
              )}
              {(sandbox.kycReview?.rejectLabels ?? []).length > 0 && (
                <ul className="space-y-1">
                  {(sandbox.kycReview?.rejectLabels ?? []).map((l: string) => (
                    <li key={l} className="text-xs text-surface-500 flex items-start gap-1.5">
                      <XCircle size={12} className="text-amber-600 mt-0.5 shrink-0" /> {l.toLowerCase().replace(/_/g, ' ')}
                    </li>
                  ))}
                </ul>
              )}
              <button
                onClick={() => navigate('/bmoni/kyc')}
                className={`mt-3 w-full text-sm flex items-center justify-center gap-2 ${
                  kycVerdict(sandbox).tone === 'ok' ? 'btn-primary' : 'btn-secondary'
                }`}
              >
                <ShieldCheck size={15} />
                {kycVerdict(sandbox).label}
              </button>
              {sandbox.supportedCurrencies.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-3 pt-3 border-t border-surface-100">
                  {sandbox.supportedCurrencies.map(c => (
                    <span key={c} className="badge bg-surface-100 text-navy-700 text-[10px]">{c}</span>
                  ))}
                </div>
              )}
            </div>

            <div className="card p-4 mt-4">
              <div className="flex items-center gap-2 mb-2">
                <Landmark size={15} className="text-primary-600" />
                <h3 className="font-bold text-navy-900 text-sm">Personal naira account</h3>
              </div>
              {(deposits?.nigerianAccounts?.length ?? 0) > 0 ? (
                <p className="text-xs text-emerald-700 flex items-center gap-1.5">
                  <CheckCircle2 size={14} /> Issued &mdash; listed with the other accounts above.
                </p>
              ) : (
                <>
                  <p className="text-xs text-surface-500 mb-3">
                    B Moni issues your own NUBAN through Nigeria (Anchor) onboarding, which needs a BVN
                    and a deployed NGN wallet. Sandbox only: any 11 digits stand in for a BVN and no real
                    identity record is read.
                  </p>
                  <input
                    value={bvn}
                    onChange={e => setBvn(e.target.value.replace(/\D/g, '').slice(0, 11))}
                    inputMode="numeric"
                    placeholder="11-digit sandbox BVN"
                    className="input-field text-sm"
                    aria-label="Sandbox BVN"
                  />
                  <button
                    onClick={startNigeriaOnboarding}
                    disabled={anchorBusy || bvn.length !== 11}
                    className="btn-primary w-full mt-2 text-sm flex items-center justify-center gap-2 disabled:opacity-60"
                  >
                    {anchorBusy
                      ? <><Loader2 size={15} className="animate-spin" /> Starting…</>
                      : 'Start Nigeria onboarding'}
                  </button>
                  {anchor && (
                    <div className="mt-3 pt-3 border-t border-surface-100 space-y-1">
                      <p className="text-[11px] text-surface-600">Workflow: {anchor.workflowId}</p>
                      <p className="text-[11px] text-surface-600">
                        BVN on file: {String(anchor.status?.hasBvn)} &middot; local wallet: {String(anchor.status?.hasLocalWallet)} &middot; international wallet: {String(anchor.status?.hasInternationalWallet)}
                      </p>
                      <p className="text-[11px] text-surface-500">
                        Anchor status is now {sandbox.onboarding?.anchorStatus ?? 'unknown'}. The sandbox has not
                        minted a personal number for this identity yet.
                      </p>
                    </div>
                  )}
                  {anchorError && (
                    <p className="text-[11px] text-red-700 mt-2">{anchorError}</p>
                  )}
                </>
              )}
            </div>

            {rate && (
              <div className="card p-4 bg-primary-50 border-primary-100">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp size={15} className="text-primary-700" />
                  <h3 className="font-bold text-navy-900 text-sm">Live exchange rate</h3>
                </div>
                <p className="text-xs text-primary-700">{rate.displayLabel} &middot; {rate.inverseLabel}</p>
                <p className="text-[11px] text-primary-600 mt-1">source: {rate.rateSource}</p>
                {usdEquivalent !== null && (
                  <div className="mt-3 pt-3 border-t border-primary-200/60">
                    <p className="text-[11px] text-primary-700">
                      Your {formatNaira(totalSaved)} in active goals is roughly{' '}
                      <span className="font-bold">${usdEquivalent.toFixed(2)}</span> at today&apos;s sandbox rate.
                      Targets you set in naira lose purchasing power as prices move &mdash; this is the
                      inflation signal behind adaptive goals.
                    </p>
                  </div>
                )}
              </div>
            )}

            </div>

            <div className="card p-4 lg:max-w-2xl">
              <div className="flex items-center gap-2 mb-1">
                <SearchCheck size={15} className="text-primary-600" />
                <h3 className="font-bold text-navy-900 text-sm">Confirm who you&apos;re paying</h3>
              </div>
              <p className="text-[11px] text-surface-500 mb-3">
                Real NUBAN name resolution from B Moni. Check the account holder&apos;s name before you send
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
                          <span className="text-[10px] text-surface-500 font-mono">{b.bankCode}</span>
                        </button>
                      ))}
                      {matches.length === 0 && (
                        <p className="px-4 py-3 text-xs text-surface-500">No bank matches &quot;{bankQuery}&quot;.</p>
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
            <li className="flex gap-2"><CheckCircle2 size={13} className="text-emerald-700 shrink-0 mt-0.5" /> Creates a real identity on B Moni&apos;s development environment.</li>
            <li className="flex gap-2"><CheckCircle2 size={13} className="text-emerald-700 shrink-0 mt-0.5" /> Reads live KYC readiness, supported currencies, bank directory, NUBAN name resolution and FX rates.</li>
            <li className="flex gap-2"><CheckCircle2 size={13} className="text-emerald-700 shrink-0 mt-0.5" /> Deploys a self-custody smart wallet anchored to your browser wallet address &mdash; you sign the owner-proof challenge yourself.</li>
            <li className="flex gap-2"><CheckCircle2 size={13} className="text-emerald-700 shrink-0 mt-0.5" /> Runs the whole KYC wizard for real: details, three document uploads, activation, and the reviewer&apos;s verdict with its reject labels and a retry.</li>
            <li className="flex gap-2"><XCircle size={13} className="text-amber-600 shrink-0 mt-0.5" /> Generated ID photos and selfies do not clear B Moni&apos;s reviewer, so this sandbox identity sits in &ldquo;needs another look&rdquo; rather than approved.</li>
            <li className="flex gap-2"><XCircle size={13} className="text-amber-600 shrink-0 mt-0.5" /> Nigeria onboarding starts a workflow, but the sandbox has not minted a personal NUBAN for this identity, so deposits use the pooled account.</li>
          </ul>
          <p className="text-[11px] text-surface-500 mt-3 leading-relaxed">
            The wallet deploy flow is real: your browser wallet produces the EIP-191 signature, our backend
            forwards it to BMONI, and the managed smart wallet is created on-chain. No keys are fabricated.
          </p>
        </div>
      </div>
    </div>
  );
}
