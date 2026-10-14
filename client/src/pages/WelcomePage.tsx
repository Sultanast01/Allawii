import { useNavigate } from 'react-router-dom';
import { useStore } from '../context/store';
import { TrendingUp, Sparkles, Shield, ArrowRight } from 'lucide-react';

export default function WelcomePage() {
  const navigate = useNavigate();
  const { setUser, setDemoMode } = useStore();

  const handleDemo = () => { setDemoMode(true); navigate('/'); };

  const handleStart = () => {
    setUser({
      id: 'user-' + Date.now(), name: 'Ada', email: 'ada@moneva.app', university: 'University of Lagos',
      incomeFrequency: 'monthly', typicalIncome: 60000,
      nextIncomeDate: new Date(Date.now() + 12 * 86400000).toISOString(), createdAt: new Date().toISOString(),
    });
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-navy-800 via-navy-900 to-navy-950 flex flex-col">
      <div className="flex-1 flex flex-col items-center justify-center px-7 text-white">
        <div className="w-16 h-16 bg-white/10 backdrop-blur-sm rounded-2xl flex items-center justify-center text-3xl font-bold mb-6 border border-white/10">
          M
        </div>
        <h1 className="text-4xl font-bold mb-2 tracking-tight">Moneva</h1>
        <p className="text-navy-200 text-center text-base mb-10 max-w-xs">
          Know what you can spend. Protect what matters. Build your future.
        </p>

        <div className="space-y-3 w-full max-w-sm mb-10">
          <div className="flex items-center gap-3 bg-white/[0.06] backdrop-blur-sm rounded-2xl p-4 border border-white/5">
            <div className="w-10 h-10 bg-primary-500/20 rounded-xl flex items-center justify-center shrink-0">
              <TrendingUp size={18} className="text-primary-300" />
            </div>
            <span className="text-sm text-navy-100">Plan your allowance & track spending to the day</span>
          </div>
          <div className="flex items-center gap-3 bg-white/[0.06] backdrop-blur-sm rounded-2xl p-4 border border-white/5">
            <div className="w-10 h-10 bg-primary-500/20 rounded-xl flex items-center justify-center shrink-0">
              <Sparkles size={18} className="text-primary-300" />
            </div>
            <span className="text-sm text-navy-100">An AI coach that uses your real budget figures</span>
          </div>
          <div className="flex items-center gap-3 bg-white/[0.06] backdrop-blur-sm rounded-2xl p-4 border border-white/5">
            <div className="w-10 h-10 bg-primary-500/20 rounded-xl flex items-center justify-center shrink-0">
              <Shield size={18} className="text-primary-300" />
            </div>
            <span className="text-sm text-navy-100">Adaptive budgets that recover when life changes</span>
          </div>
        </div>
      </div>

      <div className="px-6 pb-10 space-y-3">
        <button onClick={handleStart} className="w-full bg-white text-navy-900 font-bold py-4 rounded-2xl text-base shadow-lg active:scale-[0.99] transition-transform flex items-center justify-center gap-2">
          Create free account <ArrowRight size={18} />
        </button>
        <button onClick={handleDemo} className="w-full bg-white/10 backdrop-blur-sm border border-white/10 text-white font-semibold py-4 rounded-2xl text-base active:scale-[0.99] transition-transform">
          Explore demo
        </button>
        <p className="text-center text-xs text-navy-400 pt-1">No card needed · Demo uses synthetic data</p>
      </div>
    </div>
  );
}
