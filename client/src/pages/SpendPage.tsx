import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../context/store';
import Header from '../components/Header';
import { formatNaira, getRelativeTime, getCategoryIcon } from '../utils';
import { Plus, Search, Upload, ArrowLeftRight, X } from 'lucide-react';

export default function SpendPage() {
  const navigate = useNavigate();
  const { transactions, deleteTransaction } = useStore();
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [showImport, setShowImport] = useState(false);

  const filtered = transactions.filter(tx => {
    const m = tx.description.toLowerCase().includes(search.toLowerCase()) || tx.category.toLowerCase().includes(search.toLowerCase());
    const t = filterType === 'all' || tx.type === filterType;
    return m && t;
  });

  const grouped = filtered.reduce((acc, tx) => {
    const date = new Date(tx.date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
    (acc[date] ||= []).push(tx);
    return acc;
  }, {} as Record<string, typeof transactions>);

  const totalIn = transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const totalOut = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);

  return (
    <div>
      <Header title="Transactions" />

      <div className="px-5 pt-5 space-y-4">
        {/* Summary */}
        <div className="grid grid-cols-2 gap-3">
          <div className="card p-4">
            <p className="text-xs text-surface-500 mb-1">Money in</p>
            <p className="text-lg font-bold text-emerald-600">{formatNaira(totalIn)}</p>
          </div>
          <div className="card p-4">
            <p className="text-xs text-surface-500 mb-1">Money out</p>
            <p className="text-lg font-bold text-navy-900">{formatNaira(totalOut)}</p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <button onClick={() => navigate('/add-expense')} className="btn-primary flex-1 text-sm py-2.5 flex items-center justify-center gap-1.5">
            <Plus size={16} /> Add
          </button>
          <button onClick={() => navigate('/receipt')} className="btn-secondary flex-1 text-sm py-2.5 flex items-center justify-center gap-1.5">
            <span>📷</span> Scan
          </button>
          <button onClick={() => setShowImport(true)} className="btn-secondary text-sm py-2.5 px-4 flex items-center justify-center gap-1.5">
            <Upload size={16} /> CSV
          </button>
        </div>

        {/* Search + filter */}
        <div className="relative">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-surface-400" />
          <input type="text" placeholder="Search transactions..." value={search} onChange={(e) => setSearch(e.target.value)} className="input-field pl-10 py-2.5 text-sm" />
        </div>
        <div className="flex gap-2">
          {['all', 'income', 'expense'].map(t => (
            <button key={t} onClick={() => setFilterType(t)} className={`px-3.5 py-1.5 rounded-full text-xs font-semibold capitalize transition-colors ${
              filterType === t ? 'bg-navy-800 text-white' : 'bg-white border border-surface-200 text-surface-500'
            }`}>{t}</button>
          ))}
        </div>

        {/* List */}
        {Object.keys(grouped).length === 0 ? (
          <div className="card p-10 text-center mt-6">
            <div className="w-14 h-14 bg-primary-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <ArrowLeftRight size={24} className="text-primary-600" />
            </div>
            <h3 className="font-bold text-navy-900 text-lg mb-1">Transactions</h3>
            <p className="text-sm text-surface-500 mb-4">This area is ready for the next part of your money journey.</p>
            <button onClick={() => navigate('/add-expense')} className="btn-primary text-sm py-2.5 px-6">Explore transactions</button>
          </div>
        ) : (
          <div className="space-y-4 pb-2">
            {Object.entries(grouped).map(([date, txs]) => (
              <div key={date}>
                <p className="text-xs font-semibold text-surface-400 mb-2">{date}</p>
                <div className="card divide-y divide-surface-100">
                  {txs.map(tx => (
                    <div key={tx.id} className="flex items-center gap-3 p-3.5 group">
                      <div className="w-9 h-9 bg-surface-100 rounded-lg flex items-center justify-center text-base">{getCategoryIcon(tx.category)}</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-navy-900 truncate">{tx.description}</p>
                        <p className="text-xs text-surface-400 capitalize">{tx.category.replace('_', ' ')} · {getRelativeTime(tx.date)}</p>
                      </div>
                      <span className={`font-bold text-sm ${tx.type === 'income' ? 'text-emerald-600' : 'text-navy-900'}`}>
                        {tx.type === 'income' ? '+' : '−'}{formatNaira(tx.amount)}
                      </span>
                      <button onClick={() => deleteTransaction(tx.id)} className="opacity-0 group-hover:opacity-100 p-1 text-surface-300 hover:text-red-500 transition-all">
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* CSV import modal */}
      {showImport && (
        <div className="fixed inset-0 z-50 bg-navy-950/40 backdrop-blur-sm flex items-end justify-center" onClick={() => setShowImport(false)}>
          <div className="bg-white w-full max-w-md rounded-t-3xl p-6 animate-slide-up" onClick={(e) => e.stopPropagation()}>
            <div className="w-10 h-1 bg-surface-200 rounded-full mx-auto mb-4" />
            <h3 className="font-bold text-navy-900 text-lg mb-1">Import from CSV</h3>
            <p className="text-sm text-surface-500 mb-4">Upload a bank or mobile-money statement. We’ll suggest categories and flag duplicates before saving.</p>
            <div className="border-2 border-dashed border-surface-200 rounded-2xl p-8 text-center mb-4">
              <Upload size={28} className="text-surface-400 mx-auto mb-2" />
              <p className="text-sm font-medium text-navy-900">Tap to choose a .csv file</p>
              <p className="text-xs text-surface-400 mt-1">Columns: date, description, amount</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowImport(false)} className="btn-secondary flex-1 text-sm">Cancel</button>
              <button onClick={() => setShowImport(false)} className="btn-primary flex-1 text-sm">Preview import</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
