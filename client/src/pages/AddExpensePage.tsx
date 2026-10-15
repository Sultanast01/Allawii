import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../context/store';
import { DEFAULT_CATEGORIES } from '../types';
import Header from '../components/Header';
import { nairaToKobo } from '../utils';
import { Camera, Check, Sparkles } from 'lucide-react';

export default function AddExpensePage() {
  const navigate = useNavigate();
  const { addTransaction } = useStore();
  const [type, setType] = useState<'expense' | 'income'>('expense');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);

  const filteredCategories = DEFAULT_CATEGORIES.filter(c =>
    type === 'expense' ? ['obligations', 'essentials', 'enjoyment'].includes(c.bucket) : true
  );

  const suggestedCategory = description
    ? filteredCategories.find(c => description.toLowerCase().includes(c.name.split(' ')[0].toLowerCase()))
    : undefined;

  const handleSubmit = () => {
    if (!amount || !category) return;
    const cat = DEFAULT_CATEGORIES.find(c => c.id === category);
    addTransaction({
      userId: 'user',
      type,
      amountInKobo: nairaToKobo(Number(amount)),
      category,
      description: description || cat?.name || category,
      date: new Date().toISOString(),
      budgetBucket: cat?.bucket || 'essentials',
      source: 'manual',
    });
    setShowSuccess(true);
    setTimeout(() => navigate(-1), 1100);
  };

  if (showSuccess) {
    return (
      <>
        <Header title="Add Transaction" showBack />
        <div className="flex items-center justify-center py-32">
          <div className="text-center animate-scale-in">
            <div className="w-16 h-16 bg-primary-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check size={32} className="text-primary-600" strokeWidth={2.5} />
            </div>
            <p className="text-lg font-bold text-navy-900">Recorded!</p>
            <p className="text-sm text-surface-500 mt-1">Your budget has been updated</p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Header title="Add Transaction" showBack />

      <div className="px-5 py-4 space-y-5 pb-8 lg:px-10 lg:max-w-3xl">
        <div className="flex gap-2 bg-surface-100 p-1 rounded-xl">
          {(['expense', 'income'] as const).map(t => (
            <button
              key={t}
              onClick={() => { setType(t); setCategory(''); }}
              className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                type === t ? 'bg-white text-navy-900 shadow-card' : 'text-surface-500'
              }`}
            >
              {t === 'expense' ? 'Money out' : 'Money in'}
            </button>
          ))}
        </div>

        <div>
          <label className="section-label mb-2 block">Amount</label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-surface-300 text-2xl font-semibold">₦</span>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
              className="input-field pl-11 text-3xl font-bold py-5"
              autoFocus
            />
          </div>
        </div>

        <div>
          <label className="section-label mb-2 block">Description</label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What was this for?"
            className="input-field text-sm"
          />
          {suggestedCategory && suggestedCategory.id !== category && (
            <button
              onClick={() => setCategory(suggestedCategory.id)}
              className="flex items-center gap-1.5 mt-2 text-xs font-medium text-primary-600"
            >
              <Sparkles size={13} /> Suggested category: {suggestedCategory.name}
            </button>
          )}
        </div>

        <div>
          <label className="section-label mb-2 block">Category</label>
          <div className="grid grid-cols-3 gap-2 lg:grid-cols-4">
            {filteredCategories.map(cat => (
              <button
                key={cat.id}
                onClick={() => setCategory(cat.id)}
                className={`card p-3 flex flex-col items-center gap-1.5 transition-all ${
                  category === cat.id
                    ? 'border-primary-500 ring-2 ring-primary-500/15 bg-primary-50/50'
                    : 'hover:bg-surface-50'
                }`}
              >
                <span className="w-7 h-7 rounded-full flex items-center justify-center" style={{ backgroundColor: `${cat.color}1a` }}>
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: cat.color }} />
                </span>
                <span className="text-[11px] font-medium text-navy-800 text-center leading-tight">{cat.name}</span>
              </button>
            ))}
          </div>
        </div>

        <button onClick={() => navigate('/receipt')} className="w-full card p-4 flex items-center gap-3 hover:bg-surface-50 transition-colors">
          <div className="icon-tile bg-primary-50">
            <Camera size={18} className="text-primary-600" />
          </div>
          <div className="text-left flex-1">
            <p className="text-sm font-semibold text-navy-900">Scan a receipt instead</p>
            <p className="text-xs text-surface-500">We'll pull out the items for you to confirm</p>
          </div>
        </button>

        <button
          onClick={handleSubmit}
          disabled={!amount || !category}
          className="w-full btn-primary py-4 text-base disabled:opacity-40"
        >
          Record {type === 'expense' ? 'Expense' : 'Income'}
        </button>

        <p className="text-[11px] text-surface-500 text-center leading-relaxed">
          Everything you add here is used for real calculations — safe to spend, budget
          adjustments and coach advice all read from this record.
        </p>
      </div>
    </>
  );
}
