import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, CheckCircle, Clock, ChevronRight, ArrowLeft } from 'lucide-react';
import Header from '../components/Header';
import { useStore } from '../context/store';
import { LITERACY_ARTICLES, type LiteracyBlock } from '../data/literacyArticles';

const categoryColors: Record<string, string> = {
  budgeting: 'bg-primary-50 text-primary-700',
  saving: 'bg-emerald-50 text-emerald-700',
  spending: 'bg-amber-50 text-amber-700',
  safety: 'bg-red-50 text-red-700',
  general: 'bg-surface-100 text-navy-700',
};

function Block({ block }: { block: LiteracyBlock }) {
  if (block.type === 'h') {
    return <h2 className="text-base font-bold text-navy-900 pt-3 pb-1 lg:text-lg">{block.text}</h2>;
  }
  if (block.type === 'strong') {
    return (
      <p className="text-sm font-semibold text-navy-900 leading-relaxed border-l-2 border-primary-400 pl-3 lg:text-base">
        {block.text}
      </p>
    );
  }
  if (block.type === 'list') {
    return (
      <ul className="space-y-1.5 pl-1">
        {block.items.map((item, i) => (
          <li key={i} className="text-sm text-navy-800 leading-relaxed flex items-start gap-2 lg:text-base">
            <span className="w-1.5 h-1.5 rounded-full bg-primary-400 shrink-0 mt-2" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    );
  }
  if (block.type === 'table') {
    const [head, ...rows] = block.rows;
    return (
      <div className="overflow-x-auto rounded-xl border border-surface-100">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-surface-50">
              {head.map((cell, i) => (
                <th key={i} className="text-left px-3 py-2 font-semibold text-navy-900 whitespace-nowrap">{cell}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, r) => {
              const isTotal = row[0]?.trim().toLowerCase() === 'total';
              return (
                <tr key={r} className={`${isTotal ? 'bg-primary-50/60' : 'border-t border-surface-100'}`}>
                  {row.map((cell, c) => (
                    <td key={c} className={`px-3 py-2 text-navy-800 ${isTotal ? 'font-bold' : ''} ${c > 0 ? 'tabular-nums' : ''}`}>
                      {cell}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }
  return <p className="text-sm text-navy-800 leading-relaxed lg:text-base">{block.text}</p>;
}

export default function LiteracyPage() {
  const navigate = useNavigate();
  const [selected, setSelected] = useState<string | null>(null);
  const { literacyCompleted, toggleLiteracyCompleted } = useStore();

  const article = LITERACY_ARTICLES.find(a => a.id === selected);

  if (article) {
    const index = LITERACY_ARTICLES.findIndex(a => a.id === article.id);
    const next = LITERACY_ARTICLES[index + 1];

    return (
      <>
        <div className="sticky top-0 z-40 bg-surface-50/90 backdrop-blur-md border-b border-surface-100">
          <div className="flex items-center gap-2.5 px-5 h-14 lg:px-8">
            <button onClick={() => setSelected(null)} className="w-9 h-9 flex items-center justify-center hover:bg-surface-100 rounded-xl cursor-pointer">
              <ArrowLeft size={19} className="text-navy-800" />
            </button>
            <span className="font-bold text-navy-900 truncate">{article.title}</span>
            <span className="ml-auto flex items-center gap-1 text-[11px] text-surface-500 shrink-0">
              <Clock size={12} /> {article.duration} min
            </span>
          </div>
        </div>

        <div className="px-5 py-5 pb-8 space-y-4 lg:px-10 lg:max-w-3xl">
          <div className="card p-5 lg:p-7 space-y-3">
            <span className={`badge inline-block ${categoryColors[article.category]}`}>{article.category}</span>
            <h1 className="text-xl font-bold text-navy-900 lg:text-2xl">{article.title}</h1>
            <p className="text-sm text-surface-600 lg:text-base">{article.description}</p>
            {article.blocks.map((b, i) => <Block key={i} block={b} />)}
          </div>

          <button
            onClick={() => { toggleLiteracyCompleted(article.id); setSelected(null); }}
            className={`w-full py-3.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 cursor-pointer ${
              literacyCompleted.includes(article.id) ? 'bg-emerald-50 text-emerald-700' : 'btn-primary'
            }`}
          >
            {literacyCompleted.includes(article.id) ? (<><CheckCircle size={16} /> Completed</>) : 'Mark as complete'}
          </button>

          <button onClick={() => navigate('/coach')} className="w-full btn-secondary text-sm py-3">
            Ask the coach about this
          </button>

          {next && (
            <button
              onClick={() => { setSelected(next.id); window.scrollTo(0, 0); }}
              className="card p-4 w-full text-left flex items-center gap-3 hover:bg-surface-50 transition-colors cursor-pointer"
            >
              <div className="flex-1 min-w-0">
                <p className="text-[10px] uppercase tracking-wider text-surface-500 mb-0.5">Up next</p>
                <h3 className="font-semibold text-sm text-navy-900 truncate">{next.title}</h3>
              </div>
              <ChevronRight size={16} className="text-surface-300 shrink-0" />
            </button>
          )}
        </div>
      </>
    );
  }

  const pct = Math.round((literacyCompleted.length / LITERACY_ARTICLES.length) * 100);

  return (
    <>
      <Header title="Literacy Hub" showBack />

      <div className="px-5 py-4 space-y-4 pb-8 lg:px-10">
        <div className="card p-4 bg-navy-800 border-navy-800">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-medium text-primary-200">Your progress</span>
            <span className="text-[11px] font-bold text-white">{literacyCompleted.length}/{LITERACY_ARTICLES.length}</span>
          </div>
          <div className="h-2 bg-white/15 rounded-full overflow-hidden mb-2">
            <div className="h-full bg-primary-400 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
          </div>
          <p className="text-xs text-primary-200">Full guides tied to what you are actually doing with your money.</p>
        </div>

        <div className="space-y-2.5 lg:grid lg:grid-cols-2 lg:gap-3 lg:space-y-0 lg:content-start">
          {LITERACY_ARTICLES.map(a => (
            <button
              key={a.id}
              onClick={() => { setSelected(a.id); window.scrollTo(0, 0); }}
              className="card p-4 flex items-center gap-3 w-full text-left hover:bg-surface-50 transition-colors cursor-pointer"
            >
              <div className={`icon-tile ${literacyCompleted.includes(a.id) ? 'bg-emerald-50' : 'bg-primary-50'}`}>
                {literacyCompleted.includes(a.id)
                  ? <CheckCircle size={18} className="text-emerald-700" />
                  : <BookOpen size={18} className="text-primary-600" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <h3 className="font-semibold text-sm text-navy-900">{a.title}</h3>
                  <span className={`badge text-[10px] shrink-0 ${categoryColors[a.category]}`}>{a.category}</span>
                </div>
                <div className="flex items-center gap-2">
                  <p className="text-xs text-surface-500 truncate">{a.description}</p>
                  <span className="text-[10px] text-surface-300 shrink-0">{a.duration} min</span>
                </div>
              </div>
              <ChevronRight size={16} className="text-surface-300 shrink-0" />
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
