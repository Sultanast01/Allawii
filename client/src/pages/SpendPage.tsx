import { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../context/store';
import Header from '../components/Header';
import { formatNaira, getRelativeTime, getCategoryIcon, nairaToKobo } from '../utils';
import { DEFAULT_CATEGORIES } from '../types';
import type { CategoryConfig } from '../types';
import { Plus, Search, Upload, ArrowLeftRight, X, Check, BarChart3, Wallet, ChevronRight } from 'lucide-react';

interface ParsedRow {
  date: string;
  description: string;
  amount: number;
  type: 'income' | 'expense';
  category: CategoryConfig;
  duplicate: boolean;
}

const KEYWORDS: [RegExp, string][] = [
  [/fuel|petrol|bus|taxi|keke|okada|uber|bolt|transport|trip/i, 'transport'],
  [/data|airtime|mtn|glo\b|airtel|9mobile|recharge|subscri|netflix|spotify|youtube/i, 'data_airtime'],
  [/rent|lease/i, 'rent'],
  [/school|fees|tuition|dues|department/i, 'school_fees'],
  [/book|print|photocopy|binding|lecture|lab coat|stationery/i, 'academics'],
  [/food|meal|grocer|rice|beans|market|eat|restaur|catering|provision/i, 'food'],
  [/loan|debt|repay|owe|payback/i, 'debt'],
  [/family|parents|home support|mummy|daddy/i, 'family'],
  [/game|gaming|casino|bets|entertain/i, 'entertainment'],
  [/shop|cloth|shoe|store|mall/i, 'shopping'],
  [/light|elec|neon|power|gen|fuel gen/i, 'utilities'],
];

function suggestCategory(description: string): CategoryConfig {
  const id = KEYWORDS.find(([re]) => re.test(description))?.[1];
  return DEFAULT_CATEGORIES.find(c => c.id === id) || DEFAULT_CATEGORIES.find(c => c.id === 'food')!;
}

function splitLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let quoted = false;
  for (const ch of line) {
    if (ch === '"') quoted = !quoted;
    else if (ch === ',' && !quoted) { out.push(cur.trim()); cur = ''; }
    else cur += ch;
  }
  out.push(cur.trim());
  return out.map(c => c.replace(/^"|"$/g, ''));
}

/** Accepts `date,description,amount` with or without a header row; a negative amount is an expense. */
export function parseStatement(text: string, existing: { date: string; description: string; amountInKobo: number }[]): ParsedRow[] {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const body = lines.filter(l => {
    const cells = splitLine(l);
    const hasNumber = cells.some(c => /[\d.]{3,}/.test(c));
    const looksHeader = /date|amount|description|narration|details/i.test(l) && !hasNumber;
    return !looksHeader;
  });

  return body.map(line => {
    const cells = splitLine(line);
    const rawDate = cells[0] || '';
    const description = cells.find((c, i) => i > 0 && isNaN(Number(c.replace(/[,\s]/g, '')))) || rawDate;
    const amountCell = [...cells].reverse().find(c => /-?[\d,]*\.?\d+/.test(c)) || '0';
    const amount = Math.abs(Number(amountCell.replace(/[₦,\s]/g, ''))) || 0;
    const parsed = new Date(rawDate);
    const date = isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
    const credit = /^[+]/.test(amountCell) || /credit|cr\b|paid in|salary|allowance|received|refund/i.test(line);
    const category = suggestCategory(description);
    const type: ParsedRow['type'] = credit ? 'income' : 'expense';
    return {
      date,
      description: description || 'Imported entry',
      amount,
      type,
      category,
      duplicate: existing.some(t => t.amountInKobo === nairaToKobo(amount) && t.description.toLowerCase() === description.toLowerCase()),
    };
  }).filter(r => r.amount > 0);
}

export default function SpendPage() {
  const navigate = useNavigate();
  const { transactions, deleteTransaction, addTransaction, categoryBudgets, getMonthlyAllowance } = useStore();
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [showImport, setShowImport] = useState(false);
  const [fileName, setFileName] = useState('');
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [kept, setKept] = useState<Set<number>>(new Set());
  const [parseError, setParseError] = useState<string | null>(null);
  const [showBudgets, setShowBudgets] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const allowance = getMonthlyAllowance();

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
      userId: 'self', type: r.type, amountInKobo: nairaToKobo(r.amount), category: r.category.id,
      description: r.description, date: r.date, budgetBucket: r.category.bucket, source: 'csv',
    }));
    setShowImport(false); setRows([]); setFileName(''); setKept(new Set());
  };

  return (
    <div>
      <Header title="Activity" showBack />

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
                <p className="text-sm font-semibold text-navy-900">Monthly budget</p>
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
                const spent = transactions
                  .filter(t => t.type === 'expense' && t.category === cat.name && new Date(t.date).getMonth() === new Date().getMonth())
                  .reduce((sum, t) => sum + t.amountInKobo, 0);
                const pct = Math.min(100, (spent / (cat.allocatedInKobo || 1)) * 100);
                const isOver = spent > (cat.allocatedInKobo || 0);
                return (
                  <div key={cat.name}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-surface-600 capitalize">{cat.name.replace('_', ' ')}</span>
                      <span className={isOver ? 'text-red-600 font-semibold' : 'text-surface-500'}>
                        {formatNaira(spent)} / {formatNaira(cat.allocatedInKobo || 0)}
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
            <input type="text" placeholder="Search transactions..." value={search} onChange={(e) => setSearch(e.target.value)} className="input-field pl-10 py-2.5 text-sm" />
          </div>
          <div className="flex gap-2">
            {['all', 'income', 'expense'].map(t => (
              <button key={t} onClick={() => setFilterType(t)} className={`px-3.5 py-1.5 rounded-full text-xs font-semibold capitalize transition-colors ${
                filterType === t ? 'bg-navy-800 text-white' : 'bg-white border border-surface-200 text-surface-500'
              }`}>{t}</button>
            ))}
          </div>

          {Object.keys(grouped).length === 0 ? (
            <div className="card p-10 text-center mt-6">
              <div className="w-14 h-14 bg-primary-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <ArrowLeftRight size={24} className="text-primary-600" />
              </div>
              <h3 className="font-bold text-navy-900 text-lg mb-1">No transactions match</h3>
              <p className="text-sm text-surface-500 mb-4">Clear the search, switch the filter, or record your first expense.</p>
              <button onClick={() => navigate('/add-expense')} className="btn-primary text-sm py-2.5 px-6">Add an expense</button>
            </div>
          ) : (
            <div className="space-y-4 pb-2">
              {Object.entries(grouped).map(([date, txs]) => (
                <div key={date}>
                  <p className="text-xs font-semibold text-surface-500 mb-2">{date}</p>
                  <div className="card divide-y divide-surface-100">
                    {txs.map(tx => (
                      <div key={tx.id} className="flex items-center gap-3 p-3.5 group">
                        <div className="w-9 h-9 bg-surface-100 rounded-lg flex items-center justify-center text-base">{getCategoryIcon(tx.category)}</div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-navy-900 truncate">{tx.description}</p>
                          <p className="text-xs text-surface-500 capitalize">{tx.category.replace('_', ' ')} · {getRelativeTime(tx.date)}</p>
                        </div>
                        <span className={`font-bold text-sm ${tx.type === 'income' ? 'text-emerald-700' : 'text-navy-900'}`}>
                          {tx.type === 'income' ? '+' : '−'}{formatNaira(tx.amountInKobo)}
                        </span>
                        <button onClick={() => deleteTransaction(tx.id)} aria-label={`Delete ${tx.description}`} className="opacity-100 lg:opacity-0 lg:group-hover:opacity-100 p-2.5 -m-1 text-surface-500 hover:text-red-500 transition-all">
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
      </div>

      {/* CSV import */}
      {showImport && (
        <div className="fixed inset-0 z-50 bg-navy-950/40 backdrop-blur-sm flex items-end lg:items-center justify-center" onClick={() => setShowImport(false)}>
          <div className="bg-white w-full max-w-2xl rounded-t-3xl lg:rounded-3xl p-6 animate-slide-up max-h-[88dvh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="w-10 h-1 bg-surface-200 rounded-full mx-auto mb-4 lg:hidden" />
            <h3 className="font-bold text-navy-900 text-lg mb-1">Import a statement</h3>
            <p className="text-sm text-surface-500 mb-4">
              Pick a <code className="text-[12px] bg-surface-100 px-1 rounded">date, description, amount</code> file. Rows are parsed on this device — nothing is uploaded anywhere.
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
                      <button
                        key={`${r.description}-${i}`}
                        onClick={() => setKept(prev => {
                          const next = new Set(prev);
                          if (next.has(i)) next.delete(i); else next.add(i);
                          return next;
                        })}
                        className={`w-full flex items-center gap-3 p-3 text-left ${on ? '' : 'opacity-45'}`}
                      >
                        <span className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 ${on ? 'bg-primary-600 border-primary-600 text-white' : 'border-surface-300'}`}>
                          {on && <Check size={13} />}
                        </span>
                        <span className="flex-1 min-w-0">
                          <span className="block text-sm font-semibold text-navy-900 truncate">{r.description}</span>
                          <span className="block text-[11px] text-surface-500">
                            {new Date(r.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} · {r.category.name}
                            {r.duplicate && ' · possible duplicate'}
                          </span>
                        </span>
                        <span className={`font-bold text-sm ${r.type === 'income' ? 'text-emerald-700' : 'text-navy-900'}`}>
                          {r.type === 'income' ? '+' : '−'}{formatNaira(nairaToKobo(r.amount))}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </>
            )}

            <div className="flex gap-2">
              <button onClick={() => setShowImport(false)} className="btn-secondary flex-1 text-sm">Cancel</button>
              <button onClick={confirmImport} disabled={chosen.length === 0} className="btn-primary flex-1 text-sm disabled:opacity-40">
                {chosen.length === 0 ? 'Select rows to import' : `Import ${chosen.length} · ${formatNaira(nairaToKobo(importTotal))}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
