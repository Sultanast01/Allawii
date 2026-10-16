import { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../context/store';
import Header from '../components/Header';
import { formatNaira, getRelativeTime, getCategoryIcon, getBucketLabel, nairaToKobo } from '../utils';
import { parseStatement, type ParsedRow } from '../utils/parsing';
import { DEFAULT_CATEGORIES } from '../types';
import type { Transaction } from '../types';
import { Plus, Search, Upload, ArrowLeftRight, X, Check, BarChart3, Wallet, ChevronRight, ChevronDown } from 'lucide-react';

/** `2026-10` for a date — the key a history month filter uses. */
function monthKey(dateString: string): string {
  const at = new Date(dateString);
  if (Number.isNaN(at.getTime())) return '';
  return `${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(key: string): string {
  const [year, month] = key.split('-').map(Number);
  return new Date(year, (month || 1) - 1, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
}

const SOURCE_LABELS: Record<string, string> = {
  manual: 'Added by you',
  csv: 'CSV import',
  receipt: 'Receipt scan',
  bmoni: 'B Moni wallet',
  telegram: 'Telegram bot',
};

export default function SpendPage() {
  const navigate = useNavigate();
  const { transactions, deleteTransaction, addTransaction, categoryBudgets, getMonthlyAllowance } = useStore();
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterMonth, setFilterMonth] = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [openId, setOpenId] = useState<string | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [fileName, setFileName] = useState('');
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [kept, setKept] = useState<Set<number>>(new Set());
  const [parseError, setParseError] = useState<string | null>(null);
  const [showBudgets, setShowBudgets] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const allowance = getMonthlyAllowance();

  const monthOptions = useMemo(() => {
    const keys = [...new Set(transactions.map(t => monthKey(t.date)).filter(Boolean))];
    return keys.sort((a, b) => b.localeCompare(a));
  }, [transactions]);

  const categoryOptions = useMemo(() => {
    const ids = [...new Set(transactions.map(t => t.category))];
    return ids
      .map(id => ({ id, label: DEFAULT_CATEGORIES.find(c => c.id === id)?.name || id.replace('_', ' ') }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [transactions]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return transactions
      .filter(tx => {
        const matchesText = !q
          || tx.description.toLowerCase().includes(q)
          || tx.category.toLowerCase().includes(q)
          || (tx.merchant || '').toLowerCase().includes(q);
        const matchesType = filterType === 'all' || tx.type === filterType;
        const matchesMonth = filterMonth === 'all' || monthKey(tx.date) === filterMonth;
        const matchesCategory = filterCategory === 'all' || tx.category === filterCategory;
        return matchesText && matchesType && matchesMonth && matchesCategory;
      })
      .sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
  }, [transactions, search, filterType, filterMonth, filterCategory]);

  const grouped = filtered.reduce((acc, tx) => {
    const date = new Date(tx.date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
    (acc[date] ||= []).push(tx);
    return acc;
  }, {} as Record<string, Transaction[]>);

  const shownIn = filtered.filter(t => t.type === 'income').reduce((s, t) => s + t.amountInKobo, 0);
  const shownOut = filtered.filter(t => t.type === 'expense').reduce((s, t) => s + t.amountInKobo, 0);
  const totalIn = transactions.filter(t => t.type === 'income').reduce((s, t) => s + t.amountInKobo, 0);
  const totalOut = transactions.filter(t => t.type === 'expense').reduce((s, t) => s + t.amountInKobo, 0);

  const byCategory = useMemo(() => {
    const map: Record<string, number> = {};
    transactions.filter(t => t.type === 'expense').forEach(t => { map[t.category] = (map[t.category] || 0) + t.amountInKobo; });
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [transactions]);

  const chosen = rows.filter((_, i) => kept.has(i));
  const importTotal = chosen.reduce((s, r) => s + r.amount, 0);

  const onFile = async (file?: File) => {
    if (!file) return;
    setFileName(file.name);
    setParseError(null);
    const text = await file.text();
    const parsed = parseStatement(text, transactions);
    if (parsed.length === 0) {
      setRows([]); setKept(new Set());
      setParseError('No rows with an amount were found. Expected columns: date, description, amount.');
      return;
    }
    setRows(parsed);
    setKept(new Set(parsed.map((_, i) => i).filter(i => !parsed[i].duplicate)));
  };

  const confirmImport = () => {
    chosen.forEach(r => addTransaction({
      userId: 'self', type: r.type, amountInKobo: Math.round(nairaToKobo(r.amount)), category: r.category.id,
      description: r.description, date: r.date, budgetBucket: r.category.bucket, source: 'csv',
    }));
    setShowImport(false); setRows([]); setFileName(''); setKept(new Set());
  };

  return (
    <div>
      <Header title="Activity" />

      <div className="px-5 pt-5 space-y-4 lg:px-10 lg:pt-10 lg:grid lg:grid-cols-12 lg:gap-8 lg:items-start">
        {/* Budget overview - collapsible */}
        <div className="lg:order-0 lg:col-span-12">
          <button
            onClick={() => setShowBudgets(!showBudgets)}
            className="w-full card p-4 flex items-center justify-between hover:bg-surface-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary-50 rounded-xl flex items-center justify-center">
                <Wallet size={18} className="text-primary-600" />
              </div>
              <div className="text-left">
                <p className="text-sm font-semibold text-navy-900">This cycle&apos;s budget</p>
                <p className="text-xs text-surface-500">{formatNaira(allowance)} · {categoryBudgets.length} categories</p>
              </div>
            </div>
            <ChevronRight size={20} className={`text-surface-500 transition-transform ${showBudgets ? 'rotate-90' : ''}`} />
          </button>

          {showBudgets && (
            <div className="card p-4 mt-2 space-y-3 animate-slide-up">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-surface-500 uppercase tracking-wider">Category budgets</p>
                <button onClick={() => navigate('/budget')} className="text-xs font-semibold text-primary-600">
                  Edit budgets
                </button>
              </div>
              {categoryBudgets.map(cat => {
                const spent = cat.spentInKobo;
                const pct = Math.min(100, (spent / (cat.allocatedInKobo || 1)) * 100);
                const isOver = spent > (cat.allocatedInKobo || 0);
                return (
                  <div key={cat.id}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-surface-600 capitalize">{cat.name}</span>
                      <span className={isOver ? 'text-red-600 font-semibold' : 'text-surface-500'}>
                        {formatNaira(spent)} / {formatNaira(cat.allocatedInKobo)}
                      </span>
                    </div>
                    <div className="h-1.5 bg-surface-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${isOver ? 'bg-red-500' : 'bg-primary-500'}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Side column: totals, actions, breakdown */}
        <div className="space-y-4 lg:order-2 lg:col-span-4 lg:sticky lg:top-8">
          <div className="grid grid-cols-2 gap-3">
            <div className="card p-4">
              <p className="text-xs text-surface-500 mb-1">Money in</p>
              <p className="text-lg font-bold text-emerald-700">{formatNaira(totalIn)}</p>
            </div>
            <div className="card p-4">
              <p className="text-xs text-surface-500 mb-1">Money out</p>
              <p className="text-lg font-bold text-navy-900">{formatNaira(totalOut)}</p>
            </div>
          </div>

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

          <div className="card p-4">
            <h3 className="text-sm font-bold text-navy-900 mb-3">Where the money went</h3>
            {byCategory.length === 0 ? (
              <p className="text-xs text-surface-500">No expenses recorded yet.</p>
            ) : (
              <div className="space-y-2.5">
                {byCategory.map(([cat, amount]) => {
                  const config = DEFAULT_CATEGORIES.find(c => c.id === cat);
                  return (
                    <div key={cat}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-surface-600">{getCategoryIcon(cat)} {config?.name || cat.replace('_', ' ')}</span>
                        <b className="text-navy-900">{formatNaira(amount)}</b>
                      </div>
                      <div className="h-1.5 bg-surface-100 rounded-full overflow-hidden">
                        <div className="h-full bg-primary-500 rounded-full" style={{ width: `${(amount / (totalOut || 1)) * 100}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            <button onClick={() => navigate('/statistics')} className="mt-3 pt-3 border-t border-surface-100 w-full flex items-center gap-2 text-xs font-semibold text-primary-600">
              <BarChart3 size={14} /> Open full statistics
            </button>
          </div>
        </div>

        {/* Main column: search, filters, list */}
        <div className="space-y-4 lg:order-1 lg:col-span-8">
          <div className="relative">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-surface-500" />
            <input type="text" placeholder="Search descriptions, categories, merchants..." value={search} onChange={(e) => setSearch(e.target.value)} className="input-field pl-10 py-2.5 text-sm" />
          </div>
          <div className="flex gap-2">
            {['all', 'income', 'expense'].map(t => (
              <button key={t} onClick={() => setFilterType(t)} className={`px-3.5 py-1.5 rounded-full text-xs font-semibold capitalize transition-colors ${
                filterType === t ? 'bg-navy-800 text-white' : 'bg-white border border-surface-200 text-surface-500'
              }`}>{t}</button>
            ))}
          </div>
          {transactions.length > 0 && (
            <div className="grid grid-cols-2 gap-2">
              <select value={filterMonth} onChange={(e) => setFilterMonth(e.target.value)} aria-label="Filter by month" className="input-field text-sm py-2">
                <option value="all">All months</option>
                {monthOptions.map(key => <option key={key} value={key}>{monthLabel(key)}</option>)}
              </select>
              <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)} aria-label="Filter by category" className="input-field text-sm py-2">
                <option value="all">All categories</option>
                {categoryOptions.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
            </div>
          )}
          {transactions.length > 0 && (
            <p className="text-xs text-surface-500">
              Showing {filtered.length} of {transactions.length} entries ·{' '}
              <span className="text-emerald-700 font-semibold">{formatNaira(shownIn)} in</span> ·{' '}
              <span className="text-navy-900 font-semibold">{formatNaira(shownOut)} out</span>
              {(filterMonth !== 'all' || filterCategory !== 'all' || filterType !== 'all' || search) && (
                <button onClick={() => { setFilterMonth('all'); setFilterCategory('all'); setFilterType('all'); setSearch(''); }} className="ml-2 font-semibold text-primary-600">
                  Clear filters
                </button>
              )}
            </p>
          )}

          {Object.keys(grouped).length === 0 ? (
            <div className="card p-10 text-center mt-6">
              <div className="w-14 h-14 bg-primary-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <ArrowLeftRight size={24} className="text-primary-600" />
              </div>
              <h3 className="font-bold text-navy-900 text-lg mb-1">{transactions.length === 0 ? 'No history yet' : 'No transactions match'}</h3>
              <p className="text-sm text-surface-500 mb-4">
                {transactions.length === 0
                  ? 'Everything you record lands here — manual entries, receipt scans, imported statements and bot logs.'
                  : 'Clear the search, switch the filter, or record your first expense.'}
              </p>
              <button onClick={() => navigate('/add-expense')} className="btn-primary text-sm py-2.5 px-6">Add an expense</button>
            </div>
          ) : (
            <div className="space-y-4 pb-2">
              {Object.entries(grouped).map(([date, txs]) => (
                <div key={date}>
                  <p className="text-xs font-semibold text-surface-500 mb-2">{date}</p>
                  <div className="card divide-y divide-surface-100">
                    {txs.map(tx => {
                      const isOpen = openId === tx.id;
                      const config = DEFAULT_CATEGORIES.find(c => c.id === tx.category);
                      return (
                        <div key={tx.id}>
                          <div className="flex items-center gap-3 p-3.5 group">
                            <div className="w-9 h-9 bg-surface-100 rounded-lg flex items-center justify-center text-base shrink-0">{getCategoryIcon(tx.category)}</div>
                            <button
                              onClick={() => setOpenId(isOpen ? null : tx.id)}
                              aria-expanded={isOpen}
                              className="flex-1 min-w-0 text-left flex items-center gap-2"
                            >
                              <span className="min-w-0">
                                <span className="block text-sm font-semibold text-navy-900 truncate">{tx.description || config?.name || 'Entry'}</span>
                                <span className="block text-xs text-surface-500 capitalize truncate">
                                  {config?.name || tx.category.replace('_', ' ')} · {getRelativeTime(tx.date)}
                                </span>
                              </span>
                              <ChevronDown size={14} className={`text-surface-500 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                            </button>
                            <span className={`font-bold text-sm ${tx.type === 'income' ? 'text-emerald-700' : 'text-navy-900'}`}>
                              {tx.type === 'income' ? '+' : '−'}{formatNaira(tx.amountInKobo)}
                            </span>
                            <button onClick={() => deleteTransaction(tx.id)} aria-label={`Delete ${tx.description}`} className="opacity-100 lg:opacity-0 lg:group-hover:opacity-100 p-2.5 -m-1 text-surface-500 hover:text-red-500 transition-all">
                              <X size={14} />
                            </button>
                          </div>
                          {isOpen && (
                            <div className="px-3.5 pb-3.5 animate-slide-up">
                              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-xl bg-surface-50 p-3.5 text-xs">
                                <div><dt className="text-surface-500">Date and time</dt><dd className="font-semibold text-navy-900">{new Date(tx.date).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</dd></div>
                                <div><dt className="text-surface-500">Amount</dt><dd className="font-semibold text-navy-900">{formatNaira(tx.amountInKobo)}</dd></div>
                                <div><dt className="text-surface-500">Category</dt><dd className="font-semibold text-navy-900 capitalize">{config?.name || tx.category.replace('_', ' ')}</dd></div>
                                <div><dt className="text-surface-500">Budget bucket</dt><dd className="font-semibold text-navy-900">{getBucketLabel(tx.budgetBucket)}</dd></div>
                                {tx.merchant && <div><dt className="text-surface-500">Merchant</dt><dd className="font-semibold text-navy-900">{tx.merchant}</dd></div>}
                                {tx.paymentMethod && <div><dt className="text-surface-500">Method</dt><dd className="font-semibold text-navy-900">{tx.paymentMethod}</dd></div>}
                                <div><dt className="text-surface-500">Recorded via</dt><dd className="font-semibold text-navy-900">{SOURCE_LABELS[tx.source] || tx.source}</dd></div>
                                <div><dt className="text-surface-500">Sync</dt><dd className="font-semibold text-navy-900 capitalize">{tx.syncStatus}</dd></div>
                                {tx.notes && <div className="col-span-2"><dt className="text-surface-500">Notes</dt><dd className="font-semibold text-navy-900">{tx.notes}</dd></div>}
                              </dl>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* CSV import */}
      {showImport && (
        <div className="fixed inset-0 z-50 bg-navy-950/40 backdrop-blur-sm flex items-end lg:items-center justify-center" onClick={() => setShowImport(false)}>
          <div className="bg-white w-full max-w-2xl rounded-t-3xl lg:rounded-3xl p-6 animate-slide-up max-h-[88dvh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="w-10 h-1 bg-surface-200 rounded-full mx-auto mb-4 lg:hidden" />
            <h3 className="font-bold text-navy-900 text-lg mb-1">Import a statement</h3>
            <p className="text-sm text-surface-500 mb-4">
              Dates read day-first (05/10/2026 is 5 October). A header row is matched by column name, so debit, credit and balance columns stay separate; without one, Allawii reads <code className="text-[12px] bg-surface-100 px-1 rounded">date, description, amount</code>. Every row stays editable below before anything is saved. Rows are parsed on this device — nothing is uploaded anywhere.
            </p>

            <button
              onClick={() => fileRef.current?.click()}
              className="w-full border-2 border-dashed border-surface-200 rounded-2xl p-6 text-center hover:border-primary-300 transition-colors mb-4"
            >
              <Upload size={24} className="text-surface-500 mx-auto mb-2" />
              <p className="text-sm font-medium text-navy-900">{fileName || 'Choose a .csv file'}</p>
              <p className="text-xs text-surface-500 mt-1">Parsed locally with a category guess per row</p>
            </button>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv,text/plain"
              className="hidden"
              onChange={(e) => onFile(e.target.files?.[0])}
            />

            {parseError && (
              <p className="text-xs rounded-xl px-3.5 py-2.5 bg-red-50 text-red-700 border border-red-100 mb-4">{parseError}</p>
            )}

            {rows.length > 0 && (
              <>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-surface-500 uppercase tracking-wider">{rows.length} rows read</p>
                  <p className="text-xs text-surface-500">
                    {rows.filter(r => r.duplicate).length} look like entries you already have
                  </p>
                </div>
                <div className="border border-surface-100 rounded-2xl divide-y divide-surface-100 mb-4 max-h-72 overflow-y-auto">
                  {rows.map((r, i) => {
                    const on = kept.has(i);
                    return (
                      <div key={`${r.description}-${i}`} className={`w-full flex items-center gap-3 p-3 text-left ${on ? '' : 'opacity-45'}`}>
                        <button
                          onClick={() => setKept(prev => {
                            const next = new Set(prev);
                            if (next.has(i)) next.delete(i); else next.add(i);
                            return next;
                          })}
                          className="flex-1 min-w-0 flex items-center gap-3 text-left"
                        >
                        <span className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 ${on ? 'bg-primary-600 border-primary-600 text-white' : 'border-surface-300'}`}>
                          {on && <Check size={13} />}
                        </span>
                        <span className="flex-1 min-w-0">
                          <span className="block text-sm font-semibold text-navy-900 truncate">{r.description}</span>
                          <span className="block text-[11px] text-surface-500">
                            {new Date(r.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                            {r.duplicate && ' · possible duplicate'}
                          </span>
                        </span>
                        <span className={`font-bold text-sm ${r.type === 'income' ? 'text-emerald-700' : 'text-navy-900'}`}>
                          {r.type === 'income' ? '+' : '−'}{formatNaira(Math.round(nairaToKobo(r.amount)))}
                        </span>
                        </button>
                        <select
                          value={r.category.id}
                          onChange={(e) => setRows(list => list.map((row, j) => j === i
                            ? { ...row, category: DEFAULT_CATEGORIES.find(c => c.id === e.target.value) || row.category }
                            : row))}
                          aria-label={`Category for ${r.description}`}
                          className="text-[11px] rounded-lg border border-surface-200 bg-white px-1.5 py-1 shrink-0"
                        >
                          {DEFAULT_CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                        <button
                          onClick={() => setRows(list => list.map((row, j) => j === i
                            ? { ...row, type: row.type === 'income' ? 'expense' : 'income' }
                            : row))}
                          aria-label={`Record ${r.description} as ${r.type === 'income' ? 'an expense' : 'income'}`}
                          className="text-[10px] font-semibold uppercase px-2 py-1 rounded-lg bg-surface-100 text-surface-600 shrink-0"
                        >
                          {r.type === 'income' ? 'in' : 'out'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            <div className="flex gap-2">
              <button onClick={() => setShowImport(false)} className="btn-secondary flex-1 text-sm">Cancel</button>
              <button onClick={confirmImport} disabled={chosen.length === 0} className="btn-primary flex-1 text-sm disabled:opacity-40">
                {chosen.length === 0 ? 'Select rows to import' : `Import ${chosen.length} · ${formatNaira(Math.round(nairaToKobo(importTotal)))}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
