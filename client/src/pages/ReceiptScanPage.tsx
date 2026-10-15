import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../context/store';
import Header from '../components/Header';
import { formatNaira } from '../utils';
import { Camera, Upload, Check, Sparkles, Image as ImageIcon, X, Plus, Loader2 } from 'lucide-react';

interface Extracted {
  merchant: string;
  date: string;
  total: number;
  items: { name: string; price: number }[];
}

/** Trailing amount on a receipt line: "RICE 5KG   2,800.00" → 2800.00 */
const AMOUNT_RE = /([\d,]+\.\d{2}|[\d,]{3,}(?:\.\d{1,2})?)\s*$/;
const SKIP_LINE_RE = /(sub\s*-?\s*total|\bvat\b|\btax\b|\bcash\b|\bchange\b|balance|discount|\btel\b|phone|\btotal\b|amount\s*due|thank)/i;

function parseAmount(raw: string): number {
  return parseFloat(raw.replace(/,/g, ''));
}

/** Accepts 15/10/2026, 15-10-26 (d/m/y) and 2026-10-15. */
function extractDate(text: string): string | null {
  const dmy = text.match(/\b(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})\b/);
  if (dmy) {
    const [, d, m, yRaw] = dmy;
    const y = yRaw.length === 2 ? `20${yRaw}` : yRaw;
    if (+m >= 1 && +m <= 12 && +d >= 1 && +d <= 31) {
      return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }
  }
  const iso = text.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  return iso ? `${iso[1]}-${iso[2]}-${iso[3]}` : null;
}

export function parseReceipt(text: string): Extracted {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  const merchant =
    (lines.find((l) => (l.match(/[A-Za-z]/g) || []).length >= 3 && !AMOUNT_RE.test(l)) || 'Unknown merchant')
      .replace(/^[-*=•.\s]+|[-*=•.\s]+$/g, '')
      .slice(0, 40);

  const items: { name: string; price: number }[] = [];
  for (const line of lines) {
    const m = line.match(AMOUNT_RE);
    if (!m || m.index === undefined) continue;
    if (SKIP_LINE_RE.test(line)) continue;
    const name = line.slice(0, m.index).replace(/[\s.\-•*=]+$/g, '').trim();
    if (name.replace(/[^A-Za-z0-9]/g, '').length < 2) continue;
    const price = parseAmount(m[1]);
    if (!isFinite(price) || price <= 0) continue;
    items.push({ name, price });
  }

  let total = 0;
  for (const line of lines) {
    if (/\btotal\b/i.test(line) && !/sub\s*-?\s*total/i.test(line)) {
      const m = line.match(AMOUNT_RE);
      if (m) {
        total = parseAmount(m[1]);
        break;
      }
    }
  }

  return {
    merchant,
    date: extractDate(text) || new Date().toISOString().slice(0, 10),
    total,
    items,
  };
}

const SAMPLE: Extracted = {
  merchant: 'Justrite Supermarket',
  date: new Date().toISOString().slice(0, 10),
  total: 4568.75,
  items: [
    { name: 'Rice 5kg', price: 2800 },
    { name: 'Vegetables', price: 950 },
    { name: 'Detergent', price: 500 },
  ],
};

const PROGRESS_LABELS: Record<string, string> = {
  'loading tesseract core': 'Starting the reader…',
  'initializing tesseract': 'Starting the reader…',
  'loading language traineddata': 'Downloading the language model…',
  'initializing api': 'Preparing the reader…',
  'recognizing text': 'Reading your receipt…',
};

export default function ReceiptScanPage() {
  const navigate = useNavigate();
  const { addTransaction } = useStore();
  const [stage, setStage] = useState<'idle' | 'scanning' | 'review'>('idle');
  const [extracted, setExtracted] = useState<Extracted | null>(null);
  const [saved, setSaved] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState('');
  const [scanError, setScanError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const uploadInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  const handleFile = async (file: File | undefined | null) => {
    if (!file) return;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    setStage('scanning');
    setProgress(0);
    setProgressLabel('Starting the reader…');
    setScanError(null);
    try {
      const { createWorker } = await import('tesseract.js');
      const worker = await createWorker('eng', 1, {
        logger: (m: { status: string; progress: number }) => {
          if (PROGRESS_LABELS[m.status]) setProgressLabel(PROGRESS_LABELS[m.status]);
          if (typeof m.progress === 'number') setProgress(m.progress);
        },
      });
      let text = '';
      try {
        const { data } = await worker.recognize(file);
        text = data.text || '';
      } finally {
        await worker.terminate();
      }
      const parsed = parseReceipt(text);
      setExtracted(parsed);
      setStage('review');
    } catch (e) {
      setScanError(
        (e as Error)?.message?.includes('fetch') || (e as Error)?.message?.includes('network')
          ? 'The reader could not load its language model. Check your connection and try again.'
          : 'Could not read that image. Try a sharper photo, or enter the details manually below.'
      );
      setStage('idle');
    }
  };

  const useSample = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setExtracted({ ...SAMPLE, items: SAMPLE.items.map((i) => ({ ...i })) });
    setScanError(null);
    setStage('review');
  };

  const handleSave = () => {
    if (!extracted || extracted.items.length === 0) return;
    extracted.items.forEach((item) => {
      addTransaction({
        userId: 'user', type: 'expense', amountInKobo: Math.round(item.price * 100), category: 'food',
        description: item.name || 'Receipt item', date: new Date(extracted.date).toISOString(),
        merchant: extracted.merchant, budgetBucket: 'essentials', source: 'receipt',
      });
    });
    setSaved(true);
    setTimeout(() => navigate('/spend'), 1300);
  };

  const itemsSum = extracted ? extracted.items.reduce((s, i) => s + i.price, 0) : 0;

  if (saved) {
    return (
      <div>
        <Header title="Scan Receipt" showBack />
        <div className="px-5 pt-20 text-center animate-scale-in">
          <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Check size={32} className="text-emerald-700" />
          </div>
          <h2 className="text-xl font-bold text-navy-900">Expenses added!</h2>
          <p className="text-sm text-surface-500 mt-1">{extracted?.items.length} items added from the scanned receipt</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Header title="Scan Receipt" showBack />

      <div className="px-5 pt-5 pb-8 space-y-5 lg:px-10 lg:max-w-3xl">
        {stage !== 'review' && (
          <>
            <div className="card p-8 flex flex-col items-center text-center">
              {stage === 'scanning' ? (
                <>
                  {previewUrl && (
                    <img src={previewUrl} alt="Receipt preview" className="w-32 h-32 object-cover rounded-xl border border-surface-200 mb-4" />
                  )}
                  <div className="w-20 h-20 bg-primary-50 rounded-2xl flex items-center justify-center mb-4">
                    <Loader2 size={32} className="text-primary-600 animate-spin" />
                  </div>
                  <h2 className="text-lg font-bold text-navy-900 mb-1">{progressLabel || 'Reading your receipt…'}</h2>
                  <div className="w-full max-w-xs h-2 bg-surface-100 rounded-full overflow-hidden mt-2 mb-2">
                    <div className="h-full bg-primary-500 rounded-full transition-all duration-300" style={{ width: `${Math.round(progress * 100)}%` }} />
                  </div>
                  <p className="text-xs text-surface-500">{Math.round(progress * 100)}% · first scan downloads the language model and can take a minute</p>
                </>
              ) : (
                <>
                  <div className="w-20 h-20 bg-primary-50 rounded-2xl flex items-center justify-center mb-4">
                    <ImageIcon size={32} className="text-primary-600" />
                  </div>
                  <h2 className="text-lg font-bold text-navy-900 mb-1">Capture a receipt</h2>
                  <p className="text-sm text-surface-500 mb-4 max-w-xs">
                    Take a photo or upload one. The text is read on-device and you confirm every line before anything is saved.
                  </p>
                  <div className="flex gap-3 w-full">
                    <button onClick={() => photoInputRef.current?.click()} className="btn-primary flex-1 flex items-center justify-center gap-2">
                      <Camera size={17} /> Take photo
                    </button>
                    <button onClick={() => uploadInputRef.current?.click()} className="btn-secondary flex-1 flex items-center justify-center gap-2">
                      <Upload size={17} /> Upload
                    </button>
                  </div>
                  <button onClick={useSample} className="mt-3 text-xs font-semibold text-primary-600 underline underline-offset-2 cursor-pointer">
                    No receipt handy? Try a sample
                  </button>
                </>
              )}
              <input ref={photoInputRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => handleFile(e.target.files?.[0])} />
              <input ref={uploadInputRef} type="file" accept="image/*" hidden onChange={(e) => handleFile(e.target.files?.[0])} />
              {scanError && (
                <div className="mt-4 w-full p-3 rounded-xl bg-red-50 border border-red-100 text-left">
                  <p className="text-xs text-red-700">{scanError}</p>
                  <button onClick={() => { setExtracted({ merchant: 'Unknown merchant', date: new Date().toISOString().slice(0, 10), total: 0, items: [{ name: '', price: 0 }] }); setScanError(null); setStage('review'); }} className="mt-2 text-xs font-semibold text-red-700 underline underline-offset-2 cursor-pointer">
                    Enter the details manually instead
                  </button>
                </div>
              )}
            </div>
            <div className="card p-4 flex gap-3">
              <Check size={16} className="text-emerald-700 shrink-0 mt-0.5" />
              <p className="text-xs text-surface-500">You’ll always review and confirm extracted details before anything is saved to your budget.</p>
            </div>
          </>
        )}

        {stage === 'review' && extracted && (
          <div className="animate-slide-up space-y-4">
            <div className="card p-4 flex items-center gap-3 bg-primary-50 border-primary-100">
              <Sparkles size={18} className="text-primary-600" />
              <p className="text-sm font-medium text-primary-800">
                {previewUrl ? 'Details read from your receipt — correct anything that doesn’t match, then save' : 'Details loaded — correct anything that doesn’t match, then save'}
              </p>
            </div>

            <div className="card p-5 space-y-3">
              {previewUrl && (
                <img src={previewUrl} alt="Receipt" className="w-full max-h-56 object-contain rounded-xl border border-surface-100 mb-2" />
              )}
              <div className="flex justify-between">
                <span className="text-sm text-surface-500">Merchant</span>
                <input value={extracted.merchant} onChange={(e) => setExtracted({ ...extracted, merchant: e.target.value })} className="text-sm font-semibold text-navy-900 text-right bg-transparent outline-none" />
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-surface-500">Date</span>
                <input type="date" value={extracted.date} onChange={(e) => setExtracted({ ...extracted, date: e.target.value })} className="text-sm font-semibold text-navy-900 text-right bg-transparent outline-none" />
              </div>
              <div className="h-px bg-surface-100" />
              <p className="text-xs font-semibold text-surface-500 uppercase">Items</p>
              {extracted.items.length === 0 && (
                <p className="text-xs text-surface-500">No items were detected — add them manually below.</p>
              )}
              {extracted.items.map((item, i) => (
                <div key={i} className="flex justify-between items-center gap-2">
                  <input value={item.name} placeholder="Item name" onChange={(e) => { const items = [...extracted.items]; items[i] = { ...item, name: e.target.value }; setExtracted({ ...extracted, items }); }} className="text-sm text-navy-900 bg-transparent outline-none flex-1 min-w-0" />
                  <input type="number" step="0.01" min="0" value={item.price} onChange={(e) => { const items = [...extracted.items]; items[i] = { ...item, price: Number(e.target.value) }; setExtracted({ ...extracted, items }); }} className="text-sm font-semibold text-navy-900 bg-transparent outline-none w-24 text-right" />
                  <button onClick={() => setExtracted({ ...extracted, items: extracted.items.filter((_, j) => j !== i) })} aria-label={`Remove ${item.name || 'item'}`} className="text-surface-300 hover:text-red-500 transition-colors cursor-pointer shrink-0">
                    <X size={14} />
                  </button>
                </div>
              ))}
              <button onClick={() => setExtracted({ ...extracted, items: [...extracted.items, { name: '', price: 0 }] })} className="text-xs font-semibold text-primary-600 flex items-center gap-1 cursor-pointer">
                <Plus size={12} /> Add item
              </button>
              <div className="h-px bg-surface-100" />
              <div className="flex justify-between">
                <span className="text-sm font-bold text-navy-900">Total</span>
                <span className="text-sm font-bold text-navy-900">{formatNaira(itemsSum * 100)}</span>
              </div>
              {extracted.total > 0 && Math.abs(extracted.total - itemsSum) > 0.01 && (
                <p className="text-[11px] text-surface-500">Receipt shows {formatNaira(extracted.total * 100)} — the difference stays unrecorded unless you add the missing items.</p>
              )}
            </div>

            <div className="flex gap-2">
              <button onClick={() => setStage('idle')} className="btn-secondary flex-1 text-sm">Scan another</button>
              <button onClick={handleSave} disabled={extracted.items.length === 0} className="btn-primary flex-1 text-sm flex items-center justify-center gap-1.5 disabled:opacity-50">
                <Check size={16} /> Save {extracted.items.length} expense{extracted.items.length === 1 ? '' : 's'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
