import { useState } from 'react';
import { GraduationCap, ExternalLink, Tag } from 'lucide-react';
import Header from '../components/Header';

const STUDENT_OFFERS = [
  { id: '1', title: '20% off meal combos', description: 'Valid at campus canteens every Tuesday', category: 'food', discount: '20%', vendor: 'Campus Eats', saves: '≈₦700 per meal' },
  { id: '2', title: 'Student data bundle', description: '5GB for ₦1,000 — cheaper than the regular plan', category: 'data', discount: '30%', vendor: 'MTN Student', saves: '≈₦430 per month' },
  { id: '3', title: 'Weekly transport pass', description: 'Discounted student rate on campus routes', category: 'transport', discount: '₦500 off', vendor: 'City Transit', saves: '≈₦500 per week' },
  { id: '4', title: 'Used textbooks', description: 'Buy second-hand course texts at up to 50% off retail', category: 'academics', discount: '50%', vendor: 'BookSwap', saves: '≈₦6,000 per semester' },
  { id: '5', title: 'Student streaming', description: 'Music and video at verified student pricing', category: 'entertainment', discount: '50%', vendor: 'SoundWave', saves: '≈₦1,200 per month' },
  { id: '6', title: 'Bulk printing credits', description: 'Lower per-page cost when you print lecture notes', category: 'academics', discount: '40%', vendor: 'PrintHub', saves: '≈₦900 per month' },
  { id: '7', title: 'Lunch deal', description: 'Rice + drink combo on weekdays', category: 'food', discount: '₦1,500', vendor: 'Mama Put Express', saves: '≈₦400 per lunch' },
  { id: '8', title: 'Shared ride discount', description: '25% off ride-sharing for verified students', category: 'transport', discount: '25%', vendor: 'RideShare', saves: '≈₦350 per trip' },
];

const categoryIcons: Record<string, string> = {
  food: '🍽️', transport: '🚌', data: '📱', academics: '📚', entertainment: '🎮', shopping: '🛍️',
};

export default function OffersPage() {
  const [filter, setFilter] = useState('all');
  const [selectedOffer, setSelectedOffer] = useState<typeof STUDENT_OFFERS[number] | null>(null);

  const filtered = filter === 'all' ? STUDENT_OFFERS : STUDENT_OFFERS.filter(o => o.category === filter);
  const categories = ['all', 'food', 'transport', 'data', 'academics', 'entertainment'];

  return (
    <>
      <Header title="Student Offers" showBack />

      <div className="px-5 py-4 space-y-4 pb-8 lg:px-10">
        <div className="card p-4 bg-navy-800 border-navy-800 flex items-start gap-3">
          <div className="icon-tile bg-white/10">
            <GraduationCap size={18} className="text-white" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">Deals chosen to save you money</p>
            <p className="text-xs text-primary-200 mt-1 leading-relaxed">
              These reduce costs on things you already buy. They are not designed to push
              new spending into your budget.
            </p>
          </div>
        </div>

        <div className="flex gap-2 overflow-x-auto scrollbar-hide -mx-5 px-5 lg:mx-0 lg:px-0 lg:flex-wrap">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setFilter(cat)}
              className={`px-3.5 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${
                filter === cat ? 'bg-navy-800 text-white' : 'bg-white text-navy-700 border border-surface-200'
              }`}
            >
              {cat === 'all' ? 'All deals' : `${categoryIcons[cat]} ${cat.charAt(0).toUpperCase() + cat.slice(1)}`}
            </button>
          ))}
        </div>

        <div className="space-y-3 lg:grid lg:grid-cols-2 lg:gap-4 lg:space-y-0 lg:content-start">
          {filtered.map(offer => (
            <div key={offer.id} className="card p-4">
              <div className="flex items-start gap-3">
                <span className="text-2xl">{categoryIcons[offer.category]}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold text-sm text-navy-900">{offer.title}</h3>
                    <span className="badge badge-success shrink-0">{offer.discount}</span>
                  </div>
                  <p className="text-xs text-surface-500 mt-0.5">{offer.description}</p>
                  <div className="flex items-center gap-1.5 mt-2 text-[11px] font-medium text-primary-600">
                    <Tag size={11} /> {offer.saves}
                  </div>
                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-surface-100">
                    <span className="text-[11px] text-surface-500">{offer.vendor}</span>
                    <button onClick={() => setSelectedOffer(offer)} className="text-primary-600 text-xs font-semibold flex items-center gap-1">
                      View deal <ExternalLink size={11} />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <p className="text-[11px] text-surface-500 text-center leading-relaxed">
          Offer data is illustrative for the demo. A live build would pull verified,
          time-limited offers from partner vendors.
        </p>
      </div>

      {selectedOffer && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4" onClick={() => setSelectedOffer(null)}>
          <div className="bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-md p-6 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-start gap-3">
              <span className="text-3xl">{categoryIcons[selectedOffer.category]}</span>
              <div className="flex-1">
                <h3 className="font-bold text-navy-900">{selectedOffer.title}</h3>
                <p className="text-xs text-surface-500 mt-0.5">{selectedOffer.vendor}</p>
              </div>
              <span className="badge badge-success">{selectedOffer.discount}</span>
            </div>

            <p className="text-sm text-surface-600">{selectedOffer.description}</p>

            <div className="bg-primary-50 rounded-xl p-3">
              <p className="text-xs font-semibold text-primary-800">
                You save {selectedOffer.saves}
              </p>
            </div>

            <div className="bg-amber-50 border border-amber-100 rounded-xl p-3">
              <p className="text-xs text-amber-900 leading-relaxed">
                This is a demo offer. In a live build, this would redirect to the vendor's redemption page or apply the discount automatically via your student verification.
              </p>
            </div>

            <button onClick={() => setSelectedOffer(null)} className="btn-primary w-full text-sm py-2.5">
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}
