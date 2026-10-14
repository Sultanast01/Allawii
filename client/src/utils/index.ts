export function formatNaira(amount: number): string {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatNairaShort(amount: number): string {
  if (amount >= 1000000) return `₦${(amount / 1000000).toFixed(1)}M`;
  if (amount >= 1000) return `₦${(amount / 1000).toFixed(1)}K`;
  return `₦${amount.toFixed(0)}`;
}

export function daysUntil(dateString: string): number {
  const target = new Date(dateString);
  const now = new Date();
  const diff = target.getTime() - now.getTime();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatDateShort(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-NG', { day: 'numeric', month: 'short' });
}

export function getRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return formatDate(dateString);
}

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

export function calculateSafeToSpend(
  totalBalance: number,
  totalObligations: number,
  totalPlannedSavings: number,
  daysUntilNextIncome: number
): { unallocated: number; dailyLimit: number } {
  const unallocated = Math.max(0, totalBalance - totalObligations - totalPlannedSavings);
  const dailyLimit = daysUntilNextIncome > 0 ? unallocated / daysUntilNextIncome : unallocated;
  return { unallocated, dailyLimit };
}

export function getCategoryIcon(categoryId: string): string {
  const icons: Record<string, string> = {
    rent: '🏠', school_fees: '🎓', debt: '💳', family: '❤️', dues: '👥',
    food: '🍽️', transport: '🚌', data_airtime: '📱', academics: '📚', utilities: '⚡',
    emergency: '🛡️', savings: '🐷', education: '🎯', entertainment: '🎮',
    social: '🎉', eating_out: '☕', shopping: '🛍️',
  };
  return icons[categoryId] || '💰';
}

export function getBucketColor(bucket: string): string {
  const colors: Record<string, string> = {
    obligations: '#ef4444',
    essentials: '#22c55e',
    future_you: '#3b82f6',
    enjoyment: '#a855f7',
  };
  return colors[bucket] || '#6b7280';
}

export function getBucketLabel(bucket: string): string {
  const labels: Record<string, string> = {
    obligations: 'Obligations',
    essentials: 'Essentials',
    future_you: 'Future You',
    enjoyment: 'Enjoyment',
  };
  return labels[bucket] || bucket;
}
