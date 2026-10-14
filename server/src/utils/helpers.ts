export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substring(2, 10);
}

export function formatNaira(amount: number): string {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function daysUntil(dateString: string): number {
  const target = new Date(dateString);
  const now = new Date();
  const diff = target.getTime() - now.getTime();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

export function calculateSafeToSpend(
  totalBalance: number,
  totalObligations: number,
  totalPlannedSavings: number,
  daysUntilNextIncome: number
) {
  const unallocated = Math.max(0, totalBalance - totalObligations - totalPlannedSavings);
  const dailyLimit = daysUntilNextIncome > 0 ? unallocated / daysUntilNextIncome : unallocated;
  return { unallocated, dailyLimit };
}
