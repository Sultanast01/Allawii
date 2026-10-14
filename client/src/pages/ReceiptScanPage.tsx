import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../context/store';
import Header from '../components/Header';
import { formatNaira, generateId } from '../utils';
import { Camera, Upload, Check, Sparkles, Image as ImageIcon } from 'lucide-react';

interface Extracted {
  merchant: string; date: string; total: number; items: { name: string; price: number }[];
}

export default function ReceiptScanPage() {
  const navigate = useNavigate();
  const { addTransaction } = useStore();
  const [stage, setStage] = useState<'idle' | 'scanning' | 'review'>('idle');
  const [extracted, setExtracted] = useState<Extracted | null>(null);
  const [saved, setSaved] = useState(false);

  const simulateScan = () => {
    setStage('scanning');
    setTimeout(() => {
      setExtracted({
        merchant: 'Justrite Supermarket',
        date: new Date().toISOString().slice(0, 10),
        total: 4250,
        items: [
          { name: 'Rice 5kg', price: 2800 },
          { name: 'Vegetables', price: 950 },
          { name: 'Detergent', price: 500 },
        ],
      });
      setStage('review');
    }, 1600);
  };

  const handleSave = () => {
    if (!extracted) return;
    extracted.items.forEach(item => {
      addTransaction({
        userId: 'user', type: 'expense', amount: item.price, category: 'food',
        description: item.name, date: new Date(extracted.date).toISOString(),
        merchant: extracted.merchant, budgetBucket: 'essentials', source: 'receipt',
      });
    });
    setSaved(true);
    setTimeout(() => navigate('/spend'), 1300);
  };

  if (saved) {
    return (
      <div>
        <Header title="Scan Receipt" showBack />
        <div className="px-5 pt-20 text-center animate-scale-in">
          <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Check size={32} className="text-emerald-600" />
          </div>
          <h2 className="text-xl font-bold text-navy-900">Expenses added!</h2>
          <p className="text-sm text-surface-500 mt-1">{extracted?.items.length} items added from the sample receipt</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Header title="Scan Receipt" showBack />

      <div className="px-5 pt-5 space-y-5">
        {stage !== 'review' && (
          <>
            <div className="card p-8 flex flex-col items-center text-center">
              <div className="w-20 h-20 bg-primary-50 rounded-2xl flex items-center justify-center mb-4">
                {stage === 'scanning' ? <Sparkles size={32} className="text-primary-600 animate-pulse" /> : <ImageIcon size={32} className="text-primary-600" />}
              </div>
              <h2 className="text-lg font-bold text-navy-900 mb-1">{stage === 'scanning' ? 'Loading the sample receipt…' : 'Capture a receipt'}</h2>
              <p className="text-sm text-surface-500 mb-4 max-w-xs">
                {stage === 'scanning' ? 'Every field stays editable before anything is saved.' : 'Take a photo or upload one, then confirm the items. OCR is not wired up in this build, so either button loads a bundled sample receipt.'}
              </p>
              <div className="flex gap-3 w-full">
                <button onClick={simulateScan} disabled={stage === 'scanning'} className="btn-primary flex-1 flex items-center justify-center gap-2 disabled:opacity-60">
                  <Camera size={17} /> Take photo
                </button>
                <button onClick={simulateScan} disabled={stage === 'scanning'} className="btn-secondary flex-1 flex items-center justify-center gap-2 disabled:opacity-60">
                  <Upload size={17} /> Upload
                </button>
              </div>
              <p className="text-[11px] text-surface-400 mt-3">Sample mode · photo capture and OCR are placeholders</p>
            </div>
            <div className="card p-4 flex gap-3">
              <Check size={16} className="text-emerald-600 shrink-0 mt-0.5" />
              <p className="text-xs text-surface-500">You’ll always review and confirm extracted details before anything is saved to your budget.</p>
            </div>
          </>
        )}

        {stage === 'review' && extracted && (
          <div className="animate-slide-up space-y-4">
            <div className="card p-4 flex items-center gap-3 bg-primary-50 border-primary-100">
              <Sparkles size={18} className="text-primary-600" />
              <p className="text-sm font-medium text-primary-800">Sample details loaded — correct anything that doesn’t match, then save</p>
            </div>

            <div className="card p-5 space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-surface-500">Merchant</span>
                <input value={extracted.merchant} onChange={(e) => setExtracted({ ...extracted, merchant: e.target.value })} className="text-sm font-semibold text-navy-900 text-right bg-transparent outline-none" />
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-surface-500">Date</span>
                <input type="date" value={extracted.date} onChange={(e) => setExtracted({ ...extracted, date: e.target.value })} className="text-sm font-semibold text-navy-900 text-right bg-transparent outline-none" />
              </div>
              <div className="h-px bg-surface-100" />
              <p className="text-xs font-semibold text-surface-400 uppercase">Items</p>
              {extracted.items.map((item, i) => (
                <div key={i} className="flex justify-between items-center">
                  <input value={item.name} onChange={(e) => { const items = [...extracted.items]; items[i] = { ...item, name: e.target.value }; setExtracted({ ...extracted, items }); }} className="text-sm text-navy-900 bg-transparent outline-none flex-1" />
                  <input type="number" value={item.price} onChange={(e) => { const items = [...extracted.items]; items[i] = { ...item, price: Number(e.target.value) }; setExtracted({ ...extracted, items }); }} className="text-sm font-semibold text-navy-900 bg-transparent outline-none w-24 text-right" />
                </div>
              ))}
              <div className="h-px bg-surface-100" />
              <div className="flex justify-between">
                <span className="text-sm font-bold text-navy-900">Total</span>
                <span className="text-sm font-bold text-navy-900">{formatNaira(extracted.items.reduce((s, i) => s + i.price, 0))}</span>
              </div>
            </div>

            <div className="flex gap-2">
              <button onClick={() => setStage('idle')} className="btn-secondary flex-1 text-sm">Rescan</button>
              <button onClick={handleSave} className="btn-primary flex-1 text-sm flex items-center justify-center gap-1.5"><Check size={16} /> Save {extracted.items.length} expenses</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
