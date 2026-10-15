import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import { bmoni } from '../services/api';
import {
  Loader2, ShieldCheck, IdCard, FileText, Camera, AlertTriangle,
  ChevronLeft, PartyPopper, Upload, Clock,
} from 'lucide-react';

type Readiness = { ready: boolean; missing?: string[] } | null;

type Review = {
  status?: string;
  reviewAnswer?: string;
  reviewRejectType?: string;
  rejectLabels?: string[];
  moderationComment?: string;
  clientComment?: string;
  lastReviewedAt?: string;
} | null;

type KycOptions = {
  genders: string[];
  employmentStatuses: string[];
  fundsSources: string[];
  identificationTypes: string[];
  accountPurposes: string[];
  estimatedMonthlyVolumeRanges: { label: string; value: number }[];
};

type Occupation = { socCode: string; displayName: string; category: string };

type Step = 'identity' | 'id' | 'poa' | 'selfie' | 'activate' | 'review' | 'done';

const MAX_FILE_MB = 5;
const PROOF_TYPES = ['utility_bill', 'bank_statement', 'tenancy_agreement', 'government_letter'];

/** Which upload a reject label points back at, so "fix this" is a real link. */
const LABEL_FIX: Record<string, Step> = {
  BAD_SELFIE: 'selfie',
  NO_FACE_DETECTED: 'selfie',
  MULTIPLE_FACES_DETECTED: 'selfie',
  SUSPICIOUS_DOCUMENT: 'id',
  BAD_DOCUMENT: 'id',
  INVALID_DOCUMENT: 'id',
  EXPIRED_DOCUMENT: 'id',
  DIGITAL_ANALYSIS: 'id',
  POOR_QUALITY_PHOTO: 'id',
  POOR_QUALITY_PROOF_OF_ADDRESS: 'poa',
  ADDRESS_MISMATCH: 'poa',
};

const LABEL_TEXT: Record<string, string> = {
  BAD_SELFIE: 'The selfie was too blurry or poorly lit.',
  NO_FACE_DETECTED: 'No face was detected in the selfie.',
  MULTIPLE_FACES_DETECTED: 'More than one face appeared in the selfie.',
  SUSPICIOUS_DOCUMENT: 'One ID image looked edited or generated.',
  BAD_DOCUMENT: 'One ID image was unreadable.',
  INVALID_DOCUMENT: 'The ID type or number was not accepted.',
  EXPIRED_DOCUMENT: 'The ID has passed its expiry date.',
  DIGITAL_ANALYSIS: 'The ID image failed a digital-tamper check.',
  POOR_QUALITY_PHOTO: 'An ID photo was too low quality to read.',
  POOR_QUALITY_PROOF_OF_ADDRESS: 'The proof-of-address image was unreadable.',
  ADDRESS_MISMATCH: 'The address on the document did not match what you typed.',
};

/** B Moni reports readiness gaps as camelCase keys; substring matches collide
 *  ("proofOfAddressDocuments" contains "address"), so compare exact keys. */
const DOC_KEYS = {
  id: 'identificationdocuments',
  poa: 'proofofaddressdocuments',
  selfie: 'biometricdocuments',
} as const;

function missingKeys(readiness: Readiness): string[] {
  return (readiness?.missing ?? []).map(m => m.trim().toLowerCase());
}

function gapsFor(readiness: Readiness) {
  const keys = missingKeys(readiness);
  const docs = Object.values(DOC_KEYS) as string[];
  return {
    needsIdentity: keys.some(k => !docs.includes(k)),
    needsId: keys.includes(DOC_KEYS.id),
    needsPoa: keys.includes(DOC_KEYS.poa),
    needsSelfie: keys.includes(DOC_KEYS.selfie),
  };
}

function nextStepAfterIdentity(readiness: Readiness): Step {
  const g = gapsFor(readiness);
  if (g.needsId) return 'id';
  if (g.needsPoa) return 'poa';
  if (g.needsSelfie) return 'selfie';
  return 'activate';
}

function isApproved(review: Review): boolean {
  return review?.status === 'approved' || review?.reviewAnswer === 'GREEN';
}

function isRejected(review: Review): boolean {
  return review?.status === 'action_required' || review?.reviewAnswer === 'RED';
}

/** A verdict exists but has not come back approved or rejected yet. */
function isPending(review: Review): boolean {
  return !!review && !isApproved(review) && !isRejected(review);
}

function stepFor(readiness: Readiness, review: Review): Step {
  if (isApproved(review)) return 'done';
  if (isRejected(review)) return 'review';
  if (!readiness?.ready) {
    if (gapsFor(readiness).needsIdentity) return 'identity';
    return nextStepAfterIdentity(readiness);
  }
  if (isPending(review)) return 'review';
  return 'activate';
}

function stepStatus(step: Step, readiness: Readiness, review: Review): 'done' | 'current' | 'todo' {
  if (step === 'activate') return review ? 'done' : 'todo';
  const g = gapsFor(readiness);
  switch (step) {
    case 'identity': return g.needsIdentity ? 'todo' : 'done';
    case 'id': return g.needsId ? 'todo' : 'done';
    case 'poa': return g.needsPoa ? 'todo' : 'done';
    case 'selfie': return g.needsSelfie ? 'todo' : 'done';
    default: return 'todo';
  }
}

export default function KycVerificationPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [readiness, setReadiness] = useState<Readiness>(null);
  const [review, setReview] = useState<Review>(null);
  const [profile, setProfile] = useState<any>(null);
  const [options, setOptions] = useState<KycOptions | null>(null);
  const [occupations, setOccupations] = useState<Occupation[]>([]);

  const [step, setStep] = useState<Step>('identity');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [identity, setIdentity] = useState({
    dateOfBirth: '', gender: '', streetLine1: '', city: '', state: '', postalCode: '',
    occupationCode: '', employerName: '', employmentStatus: 'student',
    sourceOfFunds: 'savings', estimatedMonthlyVolume: 4999, accountPurpose: 'personal',
    actingAsIntermediary: false,
  });
  const [idDoc, setIdDoc] = useState({ type: '', documentNumber: '', issueDate: '', expirationDate: '' });
  const [idFiles, setIdFiles] = useState<File[]>([]);
  const [proofType, setProofType] = useState('utility_bill');
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [selfieFile, setSelfieFile] = useState<File | null>(null);

  const idInputRef = useRef<HTMLInputElement>(null);
  const proofInputRef = useRef<HTMLInputElement>(null);
  const selfieInputRef = useRef<HTMLInputElement>(null);

  const loadStatus = useCallback(async () => {
    const status = await bmoni.status();
    setReadiness(status.kycReadiness ?? null);
    setReview(status.kycReview ?? null);
    setProfile(status.profile ?? null);
    return status;
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const [status, opts, occs] = await Promise.all([
          loadStatus(),
          bmoni.kycOptions().catch(() => null),
          bmoni.kycOccupations().catch(() => []),
        ]);
        if (!status.profile) {
          setLoadError('Link a B Moni sandbox identity on the wallet page first.');
          return;
        }
        setOptions(opts);
        setOccupations(Array.isArray(occs) ? occs : []);
        setStep(stepFor(status.kycReadiness ?? null, status.kycReview ?? null));
      } catch (e: any) {
        setLoadError(e.message || 'Could not load verification state');
      }
      setLoading(false);
    })();
  }, [loadStatus]);

  const refreshAndAdvance = async () => {
    const status = await loadStatus();
    setStep(stepFor(status.kycReadiness ?? null, status.kycReview ?? null));
  };

  const submitIdentity = async () => {
    if (!identity.dateOfBirth || !identity.gender || !identity.streetLine1 || !identity.city
      || !identity.state || !identity.postalCode || !identity.occupationCode) {
      setError('Fill in every required field before continuing.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await bmoni.kycUpdate({
        personalInfo: {
          firstName: profile?.firstName, lastName: profile?.lastName,
          email: profile?.email, phoneNumber: profile?.phoneNumber,
          dateOfBirth: identity.dateOfBirth, gender: identity.gender, nationality: 'NG',
        },
        address: {
          streetLine1: identity.streetLine1,
          city: identity.city,
          state: identity.state,
          postalCode: identity.postalCode,
          countryCode: 'NGA',
        },
        employment: {
          occupationCode: identity.occupationCode,
          employmentStatus: identity.employmentStatus,
          ...(identity.employerName ? { employerName: identity.employerName } : {}),
        },
        sourceOfFunds: identity.sourceOfFunds,
        estimatedMonthlyVolume: Number(identity.estimatedMonthlyVolume),
        accountPurpose: identity.accountPurpose,
        actingAsIntermediary: identity.actingAsIntermediary,
      });
      await refreshAndAdvance();
    } catch (e: any) {
      setError(e.message || 'Sandbox rejected the submission');
    }
    setBusy(false);
  };

  const submitIdentification = async () => {
    if (!idFiles.length) { setError('Attach a photo of your ID (front).'); return; }
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      idFiles.forEach(f => form.append('files', f));
      form.append('type', idDoc.type);
      form.append('documentNumber', idDoc.documentNumber);
      form.append('issuingCountry', 'NGA');
      if (idDoc.issueDate) form.append('issueDate', idDoc.issueDate);
      if (idDoc.expirationDate) form.append('expirationDate', idDoc.expirationDate);
      await bmoni.kycUploadIdentification(form);
      await refreshAndAdvance();
    } catch (e: any) {
      setError(e.message || 'Upload failed');
    }
    setBusy(false);
  };

  const submitProof = async () => {
    if (!proofFile) { setError('Attach the document image.'); return; }
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.append('files', proofFile);
      form.append('type', proofType);
      await bmoni.kycUploadProofOfAddress(form);
      await refreshAndAdvance();
    } catch (e: any) {
      setError(e.message || 'Upload failed');
    }
    setBusy(false);
  };

  const submitSelfie = async () => {
    if (!selfieFile) { setError('Attach a clear selfie.'); return; }
    setBusy(true);
    setError(null);
    try {
      const form = new FormData();
      form.append('selfie', selfieFile);
      form.append('type', 'selfie');
      await bmoni.kycUploadBiometric(form);
      await refreshAndAdvance();
    } catch (e: any) {
      setError(e.message || 'Upload failed');
    }
    setBusy(false);
  };

  const activate = async () => {
    setBusy(true);
    setError(null);
    try {
      await bmoni.kycActivate({ sumsubLevelName: 'id-and-liveness' });
      await refreshAndAdvance();
    } catch (e: any) {
      setError(e.message || 'Activation failed — the sandbox may still be verifying documents. Try again shortly.');
    }
    setBusy(false);
  };

  const requestNewReview = async () => {
    setBusy(true);
    setError(null);
    try {
      await bmoni.kycRetry();
      await refreshAndAdvance();
    } catch (e: any) {
      setError(e.message || 'The sandbox is not accepting a new review yet — re-upload the rejected document first.');
    }
    setBusy(false);
  };

  const goToStep = (next: Step) => {
    setError(null);
    setStep(next);
  };

  const pickFiles = (setter: (f: File[]) => void) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    const tooBig = files.find(f => f.size > MAX_FILE_MB * 1024 * 1024);
    if (tooBig) { setError(`${tooBig.name} is larger than ${MAX_FILE_MB} MB.`); return; }
    setError(null);
    setter(files);
  };

  if (loading) {
    return (
      <div>
        <Header title="Verify identity" showBack />
        <div className="px-5 pt-16 flex justify-center"><Loader2 size={26} className="text-primary-600 animate-spin" /></div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div>
        <Header title="Verify identity" showBack />
        <div className="px-5 pt-5">
          <div className="card p-6 text-center">
            <AlertTriangle size={28} className="text-amber-600 mx-auto mb-3" />
            <p className="text-sm text-surface-600">{loadError}</p>
            <button onClick={() => navigate('/bmoni')} className="btn-secondary mt-4 text-sm">Go to wallet</button>
          </div>
        </div>
      </div>
    );
  }

  const visibleSteps: Step[] = ['identity', 'id', 'poa', 'selfie', 'activate'];
  const stepLabels: Record<Step, string> = {
    identity: 'Details', id: 'ID document', poa: 'Proof of address', selfie: 'Selfie',
    activate: 'Activate', review: 'Review', done: 'Verified',
  };
  const indicatorStep: Step = step === 'done' ? 'activate' : step;
  const stepNumber = step === 'done' || step === 'review' ? visibleSteps.length : visibleSteps.indexOf(step) + 1;

  return (
    <div>
      <Header title="Verify identity" showBack />

      <div className="px-5 pt-5 pb-8 space-y-4 lg:px-10 lg:max-w-2xl">
        <div>
          <p className="section-label mb-1">B Moni KYC</p>
          <h1 className="text-2xl font-bold text-navy-900 lg:text-3xl">Verify your identity</h1>
          <p className="text-sm text-surface-500 mt-1">
            Details and documents go to B Moni&apos;s development sandbox for review — nothing here
            touches real identity records or money.
          </p>
        </div>

        <div className="flex items-center gap-1.5">
          {visibleSteps.map((s) => {
            const status = s === indicatorStep ? 'current' : stepStatus(s, readiness, review);
            return (
              <div key={s} className="flex items-center gap-1.5 flex-1 last:flex-none">
                <div
                  title={stepLabels[s]}
                  className={`h-1.5 rounded-full flex-1 min-w-[18px] ${
                    status === 'done' ? 'bg-emerald-500' : s === indicatorStep ? 'bg-primary-600' : 'bg-surface-200'
                  }`}
                />
              </div>
            );
          })}
        </div>
        <p className="text-[11px] text-surface-500 -mt-2">
          Step {stepNumber} of {visibleSteps.length}: {stepLabels[step]}
        </p>

        {step === 'identity' && (
          <div className="card p-5 space-y-3 animate-slide-up">
            <div className="flex items-center gap-2 mb-1">
              <ShieldCheck size={15} className="text-primary-600" />
              <h2 className="font-bold text-navy-900 text-sm">Personal details &amp; address</h2>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs text-surface-600">
                Date of birth *
                <input type="date" value={identity.dateOfBirth} max="2010-12-31"
                  onChange={e => setIdentity({ ...identity, dateOfBirth: e.target.value })} className="input-field text-sm mt-1" />
              </label>
              <label className="text-xs text-surface-600">
                Gender *
                <select value={identity.gender} onChange={e => setIdentity({ ...identity, gender: e.target.value })} className="input-field text-sm mt-1">
                  <option value="">Select…</option>
                  {(options?.genders ?? ['male', 'female', 'other']).map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </label>
            </div>
            <label className="text-xs text-surface-600 block">
              Street address *
              <input value={identity.streetLine1} onChange={e => setIdentity({ ...identity, streetLine1: e.target.value })}
                placeholder="15 Admiralty Way" className="input-field text-sm mt-1" />
            </label>
            <div className="grid grid-cols-3 gap-3">
              <label className="text-xs text-surface-600">
                City *
                <input value={identity.city} onChange={e => setIdentity({ ...identity, city: e.target.value })} className="input-field text-sm mt-1" />
              </label>
              <label className="text-xs text-surface-600">
                State *
                <input value={identity.state} onChange={e => setIdentity({ ...identity, state: e.target.value })} className="input-field text-sm mt-1" />
              </label>
              <label className="text-xs text-surface-600">
                Postal code *
                <input value={identity.postalCode} onChange={e => setIdentity({ ...identity, postalCode: e.target.value })} className="input-field text-sm mt-1" />
              </label>
            </div>
            <label className="text-xs text-surface-600 block">
              Occupation *
              <select value={identity.occupationCode} onChange={e => setIdentity({ ...identity, occupationCode: e.target.value })} className="input-field text-sm mt-1">
                <option value="">Select an occupation…</option>
                {[...new Set(occupations.map(o => o.category))].map(cat => (
                  <optgroup key={cat} label={cat}>
                    {occupations.filter(o => o.category === cat).map(o => (
                      <option key={o.socCode} value={o.socCode}>{o.displayName}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs text-surface-600">
                Employment status *
                <select value={identity.employmentStatus} onChange={e => setIdentity({ ...identity, employmentStatus: e.target.value })} className="input-field text-sm mt-1">
                  {(options?.employmentStatuses ?? ['student']).map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                </select>
              </label>
              <label className="text-xs text-surface-600">
                Employer / school
                <input value={identity.employerName} onChange={e => setIdentity({ ...identity, employerName: e.target.value })} className="input-field text-sm mt-1" />
              </label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs text-surface-600">
                Source of funds *
                <select value={identity.sourceOfFunds} onChange={e => setIdentity({ ...identity, sourceOfFunds: e.target.value })} className="input-field text-sm mt-1">
                  {(options?.fundsSources ?? ['savings']).map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                </select>
              </label>
              <label className="text-xs text-surface-600">
                Monthly volume *
                <select value={identity.estimatedMonthlyVolume} onChange={e => setIdentity({ ...identity, estimatedMonthlyVolume: Number(e.target.value) })} className="input-field text-sm mt-1">
                  {(options?.estimatedMonthlyVolumeRanges ?? [{ label: '$0-$4,999', value: 4999 }]).map(r => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </label>
            </div>
            <label className="text-xs text-surface-600 block">
              Account purpose *
              <select value={identity.accountPurpose} onChange={e => setIdentity({ ...identity, accountPurpose: e.target.value })} className="input-field text-sm mt-1">
                {(options?.accountPurposes ?? ['personal']).map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </label>
            <label className="flex items-start gap-2 text-xs text-surface-600 pt-1">
              <input type="checkbox" checked={identity.actingAsIntermediary}
                onChange={e => setIdentity({ ...identity, actingAsIntermediary: e.target.checked })}
                className="mt-0.5 accent-primary-600" />
              I am acting as an intermediary for someone else
            </label>
            <button onClick={submitIdentity} disabled={busy} className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-60">
              {busy ? <><Loader2 size={16} className="animate-spin" /> Saving…</> : 'Save and continue'}
            </button>
          </div>
        )}

        {step === 'id' && (
          <div className="card p-5 space-y-3 animate-slide-up">
            <div className="flex items-center gap-2 mb-1">
              <IdCard size={15} className="text-primary-600" />
              <h2 className="font-bold text-navy-900 text-sm">Government ID</h2>
            </div>
            <p className="text-xs text-surface-500">
              A clear photo of the front (and back, if your ID has one). Sandbox accepts any image —
              no real document needed.
            </p>
            <label className="text-xs text-surface-600 block">
              ID type *
              <select value={idDoc.type} onChange={e => setIdDoc({ ...idDoc, type: e.target.value })} className="input-field text-sm mt-1">
                <option value="">Select…</option>
                {(options?.identificationTypes ?? ['passport', 'national_id', 'driving_license', 'voter_id', 'tax_id']).map(t => (
                  <option key={t} value={t}>{t.replace('_', ' ')}</option>
                ))}
              </select>
            </label>
            <div className="grid grid-cols-3 gap-3">
              <label className="text-xs text-surface-600 col-span-3">
                Document number *
                <input value={idDoc.documentNumber} onChange={e => setIdDoc({ ...idDoc, documentNumber: e.target.value })} className="input-field text-sm mt-1" />
              </label>
              <label className="text-xs text-surface-600">
                Issue date
                <input type="date" value={idDoc.issueDate} onChange={e => setIdDoc({ ...idDoc, issueDate: e.target.value })} className="input-field text-sm mt-1" />
              </label>
              <label className="text-xs text-surface-600">
                Expiry date
                <input type="date" value={idDoc.expirationDate} onChange={e => setIdDoc({ ...idDoc, expirationDate: e.target.value })} className="input-field text-sm mt-1" />
              </label>
            </div>
            <input ref={idInputRef} type="file" accept="image/*,application/pdf" multiple hidden
              onChange={pickFiles(setIdFiles)} aria-label="ID document images" />
            <button onClick={() => idInputRef.current?.click()}
              className="w-full border-2 border-dashed border-surface-200 rounded-xl p-5 text-sm text-surface-600 hover:border-primary-300 hover:text-primary-700 transition-colors flex flex-col items-center gap-2 cursor-pointer">
              <Upload size={18} className="text-primary-600" />
              {idFiles.length
                ? idFiles.map(f => f.name).join(' + ')
                : 'Tap to attach ID photos (front + optional back)'}
            </button>
            <button onClick={submitIdentification} disabled={busy} className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-60">
              {busy ? <><Loader2 size={16} className="animate-spin" /> Uploading…</> : 'Upload ID'}
            </button>
          </div>
        )}

        {step === 'poa' && (
          <div className="card p-5 space-y-3 animate-slide-up">
            <div className="flex items-center gap-2 mb-1">
              <FileText size={15} className="text-primary-600" />
              <h2 className="font-bold text-navy-900 text-sm">Proof of address</h2>
            </div>
            <label className="text-xs text-surface-600 block">
              Document type *
              <select value={proofType} onChange={e => setProofType(e.target.value)} className="input-field text-sm mt-1">
                {PROOF_TYPES.map(t => <option key={t} value={t}>{t.replace('_', ' ')}</option>)}
              </select>
            </label>
            <input ref={proofInputRef} type="file" accept="image/*,application/pdf" hidden
              onChange={e => { const f = Array.from(e.target.files ?? [])[0]; if (f) { setError(null); setProofFile(f); } }}
              aria-label="Proof of address document" />
            <button onClick={() => proofInputRef.current?.click()}
              className="w-full border-2 border-dashed border-surface-200 rounded-xl p-5 text-sm text-surface-600 hover:border-primary-300 hover:text-primary-700 transition-colors flex flex-col items-center gap-2 cursor-pointer">
              <Upload size={18} className="text-primary-600" />
              {proofFile ? proofFile.name : 'Tap to attach the document'}
            </button>
            <button onClick={submitProof} disabled={busy} className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-60">
              {busy ? <><Loader2 size={16} className="animate-spin" /> Uploading…</> : 'Upload document'}
            </button>
          </div>
        )}

        {step === 'selfie' && (
          <div className="card p-5 space-y-3 animate-slide-up">
            <div className="flex items-center gap-2 mb-1">
              <Camera size={15} className="text-primary-600" />
              <h2 className="font-bold text-navy-900 text-sm">Selfie check</h2>
            </div>
            <p className="text-xs text-surface-500">
              A clear photo of your face, good lighting, no sunglasses. On a phone this opens the
              front camera.
            </p>
            <input ref={selfieInputRef} type="file" accept="image/*" capture="user" hidden
              onChange={e => { const f = Array.from(e.target.files ?? [])[0]; if (f) { setError(null); setSelfieFile(f); } }}
              aria-label="Selfie photo" />
            <button onClick={() => selfieInputRef.current?.click()}
              className="w-full border-2 border-dashed border-surface-200 rounded-xl p-5 text-sm text-surface-600 hover:border-primary-300 hover:text-primary-700 transition-colors flex flex-col items-center gap-2 cursor-pointer">
              <Camera size={18} className="text-primary-600" />
              {selfieFile ? selfieFile.name : 'Tap to take or attach a selfie'}
            </button>
            <button onClick={submitSelfie} disabled={busy} className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-60">
              {busy ? <><Loader2 size={16} className="animate-spin" /> Uploading…</> : 'Upload selfie'}
            </button>
          </div>
        )}

        {step === 'activate' && (
          <div className="card p-5 space-y-3 animate-slide-up">
            <div className="flex items-center gap-2 mb-1">
              <ShieldCheck size={15} className="text-emerald-600" />
              <h2 className="font-bold text-navy-900 text-sm">
                {readiness?.ready ? 'Everything is in' : 'Almost there'}
              </h2>
            </div>
            {readiness?.ready ? (
              <>
                <p className="text-xs text-surface-500">
                  B Moni has your details and all three documents. Activating sends the package to
                  their reviewer, who approves it or asks for a clearer shot.
                </p>
                <button onClick={activate} disabled={busy} className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-60">
                  {busy ? <><Loader2 size={16} className="animate-spin" /> Sending…</> : 'Send for review'}
                </button>
              </>
            ) : (
              <>
                <ul className="space-y-1.5">
                  {(readiness?.missing ?? []).map((m, i) => (
                    <li key={i} className="text-xs text-surface-600 flex items-start gap-1.5">
                      <AlertTriangle size={12} className="text-amber-600 mt-0.5 shrink-0" /> {m}
                    </li>
                  ))}
                </ul>
                <button onClick={() => loadStatus()} disabled={busy} className="btn-secondary w-full text-sm">
                  Re-check status
                </button>
              </>
            )}
          </div>
        )}

        {step === 'review' && isRejected(review) && (
          <div className="card p-5 space-y-3 animate-slide-up">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle size={15} className="text-amber-600" />
              <h2 className="font-bold text-navy-900 text-sm">The reviewer wants better shots</h2>
            </div>
            <p className="text-xs text-surface-500">
              Your documents are on file but the review came back needing another attempt.
              Re-upload what is flagged, then ask for a fresh review.
            </p>
            <ul className="space-y-1.5">
              {(review?.rejectLabels ?? []).map(label => (
                <li key={label} className="text-xs text-surface-600 flex items-start gap-1.5">
                  <AlertTriangle size={12} className="text-amber-600 mt-0.5 shrink-0" />
                  {LABEL_TEXT[label] ?? `Flagged as ${label.toLowerCase().replace(/_/g, ' ')}.`}
                </li>
              ))}
            </ul>
            {review?.clientComment && (
              <p className="text-xs text-surface-600 border-l-2 border-amber-400 pl-3">{review.clientComment}</p>
            )}
            <div className="space-y-2 pt-1">
              {([...new Set((review?.rejectLabels ?? []).map(l => LABEL_FIX[l]).filter(Boolean))] as Step[])
                .map(target => (
                  <button key={target} onClick={() => goToStep(target)} className="btn-secondary w-full text-sm flex items-center justify-center gap-2">
                    {target === 'selfie' ? <><Camera size={14} /> Re-upload selfie</>
                      : target === 'poa' ? <><FileText size={14} /> Re-upload proof of address</>
                      : <><IdCard size={14} /> Re-upload ID document</>}
                  </button>
                ))}
            </div>
            <button onClick={requestNewReview} disabled={busy} className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-60">
              {busy ? <><Loader2 size={16} className="animate-spin" /> Resending…</> : 'Request a new review'}
            </button>
            <p className="text-[11px] text-surface-400">
              {review?.reviewRejectType === 'PERMANENT'
                ? 'The reviewer marked this attempt as final — a new review may not be accepted.'
                : 'The sandbox only accepts a new review once the flagged document has been replaced.'}
            </p>
          </div>
        )}

        {step === 'review' && !isRejected(review) && (
          <div className="card p-5 space-y-3 animate-slide-up">
            <div className="flex items-center gap-2 mb-1">
              <Clock size={15} className="text-primary-600" />
              <h2 className="font-bold text-navy-900 text-sm">With the reviewer</h2>
            </div>
            <p className="text-xs text-surface-500">
              B Moni has your package and is checking it{review?.status ? ` (status: ${review.status})` : ''}.
              Sandbox reviews usually land within a minute.
            </p>
            {review?.lastReviewedAt && (
              <p className="text-[11px] text-surface-400">Last update: {review.lastReviewedAt}</p>
            )}
            <button onClick={() => refreshAndAdvance()} disabled={busy} className="btn-secondary w-full text-sm flex items-center justify-center gap-2 disabled:opacity-60">
              {busy ? <><Loader2 size={16} className="animate-spin" /> Checking…</> : 'Check for a verdict'}
            </button>
          </div>
        )}

        {step === 'done' && (
          <div className="card p-6 text-center animate-scale-in">
            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <PartyPopper size={30} className="text-emerald-700" />
            </div>
            <h2 className="text-xl font-bold text-navy-900 mb-1">Identity approved</h2>
            <p className="text-sm text-surface-500 mb-5">
              B Moni&apos;s reviewer signed off on your documents{review?.lastReviewedAt ? ` at ${review.lastReviewedAt}` : ''}.
              Your sandbox profile is now verified.
            </p>
            <button onClick={() => navigate('/bmoni')} className="btn-primary w-full flex items-center justify-center gap-2">
              Back to the wallet
            </button>
          </div>
        )}

        {error && (
          <div className="card p-4 border-l-4 border-l-amber-500 flex items-start gap-3">
            <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
            <p className="text-xs text-surface-600">{error}</p>
          </div>
        )}

        {step !== 'done' && (
          <button onClick={() => navigate('/bmoni')} className="w-full min-h-[44px] text-xs text-surface-500 flex items-center justify-center gap-1 cursor-pointer">
            <ChevronLeft size={13} /> Back to wallet for now
          </button>
        )}
      </div>
    </div>
  );
}
