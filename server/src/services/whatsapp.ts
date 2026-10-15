import db from '../models/database.js';
import { generateId } from '../utils/helpers.js';

export interface BotGoal {
  name: string;
  targetAmountInKobo: number;
  currentAmountInKobo: number;
  targetDate?: string | null;
  contributionPerCycleInKobo?: number;
  contributionFrequency?: string;
  isPaused?: boolean;
}

export interface BotData {
  name: string;
  totalIncomeInKobo: number;
  totalExpensesInKobo: number;
  balanceInKobo: number;
  spentByCategory: Record<string, number>;
  spentByBucket: Record<string, number>;
  goals: BotGoal[];
  nextIncomeDate: string | null;
  today: string;
}

export type BotIntent =
  | 'balance' | 'goals' | 'insights' | 'record' | 'income'
  | 'help' | 'undo' | 'cancel' | 'unknown';

export interface RecordInput {
  type: 'income' | 'expense';
  amountInKobo: number;
  category: string;
  description: string;
  budgetBucket?: string;
  source: 'whatsapp';
}

export interface RecordedTransaction extends RecordInput {
  id: string;
}

export interface BotDraft {
  type: 'income' | 'expense';
  amountInKobo?: number;
  category?: string;
  description?: string;
}

export interface BotSession {
  stage: 'idle' | 'awaiting_amount' | 'awaiting_category';
  draft?: BotDraft;
  lastRecordedId?: string;
}

export interface BotReply {
  text: string;
  session: BotSession;
}

export interface BotDeps {
  recordTransaction: (input: RecordInput) => RecordedTransaction;
  deleteTransaction: (id: string) => RecordedTransaction | null;
}

interface CategoryOption { id: string; name: string; bucket: string }

export const CATEGORY_MENU: CategoryOption[] = [
  { id: 'food', name: 'Food', bucket: 'essentials' },
  { id: 'transport', name: 'Transport', bucket: 'essentials' },
  { id: 'data_airtime', name: 'Data & Airtime', bucket: 'essentials' },
  { id: 'academics', name: 'Academic materials', bucket: 'essentials' },
  { id: 'utilities', name: 'Utilities', bucket: 'essentials' },
  { id: 'eating_out', name: 'Eating out', bucket: 'enjoyment' },
  { id: 'entertainment', name: 'Entertainment', bucket: 'enjoyment' },
  { id: 'shopping', name: 'Shopping', bucket: 'enjoyment' },
  { id: 'social', name: 'Social', bucket: 'enjoyment' },
  { id: 'rent', name: 'Rent', bucket: 'obligations' },
  { id: 'dues', name: 'Dues', bucket: 'obligations' },
  { id: 'other_expense', name: 'Something else', bucket: 'essentials' },
];

const INCOME_CATEGORIES: CategoryOption[] = [
  { id: 'allowance', name: 'Allowance', bucket: 'essentials' },
  { id: 'gift', name: 'Gift', bucket: 'essentials' },
  { id: 'side_hustle', name: 'Side hustle', bucket: 'essentials' },
  { id: 'other_income', name: 'Other income', bucket: 'essentials' },
];

const CATEGORY_KEYWORDS: Array<{ id: string; words: string[] }> = [
  { id: 'entertainment', words: ['netflix', 'spotify', 'youtube', 'showmax', 'game', 'gaming', 'cinema', 'stream', 'streaming'] },
  { id: 'data_airtime', words: ['data', 'airtime', 'recharge', 'mtn', 'glo', 'airtel', '9mobile', 'etisalat', 'wifi', 'internet', 'browsing', 'sub', 'subscription'] },
  { id: 'transport', words: ['taxi', 'uber', 'bolt', 'keke', 'okada', 'bus', 'fare', 'transport', 'fuel', 'petrol', 'shuttle', 'trip'] },
  { id: 'food', words: ['food', 'lunch', 'dinner', 'breakfast', 'snack', 'canteen', 'meal', 'groceries', 'rice', 'beans', 'indomie', 'egg', 'cook'] },
  { id: 'eating_out', words: ['shawarma', 'restaurant', 'buka', 'pizza', 'chinese', 'eat out', 'eating out'] },
  { id: 'utilities', words: ['nepa', 'electricity', 'light', 'water', 'bwf', 'bill'] },
  { id: 'academics', words: ['book', 'print', 'printing', 'lecture', 'note', 'handout', 'assignment', 'photocopy', 'lab', 'tuition'] },
  { id: 'rent', words: ['rent', 'room'] },
  { id: 'dues', words: ['dues', 'levy', 'association', 'departmental', 'union'] },
  { id: 'shopping', words: ['cloth', 'clothes', 'shoe', 'laptop', 'phone', 'bag', 'dress', 'hair'] },
  { id: 'social', words: ['party', 'outing', 'hangout', 'gift', 'gifted', 'club'] },
  { id: 'savings', words: ['save', 'savings', 'contribute', 'contribution'] },
];

const INCOME_KEYWORDS: Array<{ id: string; words: string[] }> = [
  { id: 'side_hustle', words: ['hustle', 'business', 'work', 'salary', 'job', 'freelance', 'client'] },
  { id: 'gift', words: ['gift', 'birthday', 'present'] },
  { id: 'allowance', words: ['allowance', 'support', 'parents', 'sponsor'] },
];

const COMMAND_WORDS = new Set(['spend', 'spent', 'expense', 'paid', 'pay', 'bought', 'buy', 'cost', 'used', 'log', 'record', 'add', 'new',
  'earned', 'earn', 'received', 'receive', 'got', 'income', 'credit', 'topup', 'funded', 'money', 'cash', 'naira', 'ngn']);
const FILLER_WORDS = new Set(['i', 'ive', 'on', 'for', 'the', 'a', 'an', 'my', 'to', 'at', 'of', 'in', 'just', 'was', 'is', 'this', 'and']);

const DAY_MS = 86400000;

export function formatKobo(kobo: number): string {
  const sign = kobo < 0 ? '-' : '';
  const abs = Math.abs(Math.round(kobo));
  const whole = Math.floor(abs / 100);
  const cents = abs % 100;
  const grouped = String(whole).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${sign}₦${grouped}${cents ? `.${String(cents).padStart(2, '0')}` : ''}`;
}

export function waIdToE164(waId: string): string | null {
  const digits = String(waId || '').replace(/[^\d]/g, '');
  if (digits.length < 8 || digits.length > 15) return null;
  return `+${digits}`;
}

function normalize(text: string): string {
  return String(text || '').toLowerCase().replace(/[^\w\s₦,.'+]/g, ' ').replace(/\s+/g, ' ').trim();
}

function matchesWord(text: string, word: string): boolean {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').trim();
  if (!escaped) return false;
  // Prefix-boundary match: 'cloth' hits 'clothes', but 'rent' never hits 'current'.
  return new RegExp(`\\b${escaped.replace(/\s+/g, '\\s+')}`).test(text);
}

function matchesAny(text: string, words: string[]): boolean {
  return words.some(word => matchesWord(text, word));
}

export function classifyIntent(text: string): BotIntent {
  const t = normalize(text);
  if (!t) return 'unknown';
  if (matchesAny(t, ['undo', 'delete that', 'remove that', 'delete it', 'remove it'])) return 'undo';
  if (matchesAny(t, ['cancel', 'stop', 'never mind', 'nevermind', 'discard'])) return 'cancel';
  if (/^(help|menu|options|commands|start|hi|hello|hey|yo)\b/.test(t)) return 'help';
  if (matchesAny(t, ['goal', 'goals', 'saving', 'savings', 'target']) || t.includes('savings goal')) return 'goals';
  if (t.includes('balance') || t.includes('how much do i have') || t.includes('how much have i')
    || t.includes('my money') || t.includes('wallet') || t.includes('safe to spend') || t.includes('whats left') || t.includes("what's left")) return 'balance';
  if (matchesAny(t, ['insight', 'insights', 'advice', 'tip', 'tips', 'review', 'summary', 'report', 'analysis'])
    || t.includes('how am i doing') || t.includes('how am i') || t.includes('how is my') || t.includes('how’s my')) return 'insights';
  if (matchesAny(t, ['earn', 'earned', 'receive', 'received', 'income', 'allowance', 'credit', 'topup', 'top up', 'funded', 'deposited', 'paid me', 'sent me'])) return 'income';
  if (matchesAny(t, ['spend', 'spent', 'expense', 'paid', 'pay', 'bought', 'buy', 'cost', 'used', 'log', 'record', 'add'])) return 'record';
  return 'unknown';
}

export function parseAmountInKobo(text: string): number | null {
  const raw = String(text || '');
  const match = raw.match(/(\d[\d,]*(?:\.\d+)?)\s*(k|m|thousand|million)?/i);
  if (!match) return null;
  const value = Number(match[1].replace(/,/g, ''));
  if (!Number.isFinite(value) || value <= 0) return null;
  const suffix = (match[2] || '').toLowerCase();
  const naira = suffix === 'k' || suffix === 'thousand' ? value * 1000
    : suffix === 'm' || suffix === 'million' ? value * 1000000
    : value;
  return Math.round(naira * 100);
}

export function guessCategory(text: string): string | null {
  const t = normalize(text);
  if (!t) return null;
  for (const group of CATEGORY_KEYWORDS) {
    if (group.words.some(word => matchesWord(t, word))) return group.id;
  }
  return null;
}

function guessIncomeCategory(text: string): string {
  const t = normalize(text);
  for (const group of INCOME_KEYWORDS) {
    if (group.words.some(word => matchesWord(t, word))) return group.id;
  }
  return 'allowance';
}

function categoryOption(id: string): CategoryOption | undefined {
  return CATEGORY_MENU.find(c => c.id === id) || INCOME_CATEGORIES.find(c => c.id === id);
}

function cleanDescription(text: string): string {
  const tokens = normalize(text)
    .replace(/\b\d[\d,.]*\s*[km]?\b/g, ' ')
    .split(' ')
    .filter(word => word && word !== '₦' && word !== ',' && word !== '.');
  // Drop the command words at the front only, so "taxi to school" keeps its own wording.
  while (tokens.length && (COMMAND_WORDS.has(tokens[0]) || FILLER_WORDS.has(tokens[0]))) tokens.shift();
  const phrase = tokens.join(' ').replace(/[.,_]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!phrase) return '';
  return (phrase.charAt(0).toUpperCase() + phrase.slice(1)).slice(0, 80);
}

export function formatBalance(data: BotData): string {
  const lines: string[] = [];
  lines.push(`*Balance*${data.name ? ` — ${data.name}` : ''}`);
  lines.push(`Available: *${formatKobo(data.balanceInKobo)}*`);
  lines.push(`Income in: ${formatKobo(data.totalIncomeInKobo)}`);
  lines.push(`Spent out: ${formatKobo(data.totalExpensesInKobo)}`);

  const top = Object.entries(data.spentByCategory).sort((a, b) => b[1] - a[1]).slice(0, 3);
  if (top.length) {
    lines.push('');
    lines.push(`Biggest spend: ${top.map(([cat, kobo]) => `${labelFor(cat)} ${formatKobo(kobo)}`).join(' · ')}`);
  } else if (data.balanceInKobo === 0 && data.totalIncomeInKobo === 0) {
    lines.push('');
    lines.push(`You have no transactions yet. Send *spend 500 for lunch* or *received 60000 allowance* and I'll record it.`);
  } else {
    lines.push('');
    lines.push('No expenses recorded yet.');
  }
  lines.push('');
  lines.push('_Reply *goals*, *insights* or *help*_');
  return lines.join('\n');
}

function labelFor(categoryId: string): string {
  const option = categoryOption(categoryId);
  if (option) return option.name;
  return categoryId.replace(/_/g, ' ').replace(/^\w/, c => c.toUpperCase());
}

export function goalProgress(goal: BotGoal): number {
  if (!goal.targetAmountInKobo) return 0;
  return Math.min(100, Math.round((goal.currentAmountInKobo / goal.targetAmountInKobo) * 100));
}

export function formatGoals(data: BotData, today: string = data.today): string {
  const active = data.goals.filter(goal => !goal.isPaused);
  if (!active.length) {
    return `*Savings goals*\n\nYou have no savings goal yet. Create one on Allawii and I'll track it here — even ${formatKobo(500000)} a week builds a real buffer.`;
  }
  const lines: string[] = ['*Savings goals*'];
  let total = 0;
  for (const goal of active) {
    total += goal.currentAmountInKobo;
    lines.push('');
    lines.push(`${goal.name} — ${formatKobo(goal.currentAmountInKobo)} of ${formatKobo(goal.targetAmountInKobo)} (${goalProgress(goal)}%)`);
    const remaining = Math.max(0, goal.targetAmountInKobo - goal.currentAmountInKobo);
    if (goal.targetDate) {
      const days = Math.max(0, Math.ceil((new Date(goal.targetDate).getTime() - new Date(today).getTime()) / DAY_MS));
      lines.push(days > 0
        ? `${formatKobo(remaining)} to go in ${days} day${days === 1 ? '' : 's'}.`
        : `Target date has passed with ${formatKobo(remaining)} still needed.`);
    } else if (goal.contributionPerCycleInKobo) {
      const cycles = Math.ceil(remaining / goal.contributionPerCycleInKobo);
      lines.push(`About ${cycles} more ${goal.contributionFrequency || 'monthly'} contribution${cycles === 1 ? '' : 's'} of ${formatKobo(goal.contributionPerCycleInKobo)}.`);
    }
  }
  const paused = data.goals.length - active.length;
  lines.push('');
  lines.push(`Total saved: *${formatKobo(total)}*${paused ? ` · ${paused} goal${paused === 1 ? '' : 's'} paused` : ''}`);
  return lines.join('\n');
}

export function buildInsights(data: BotData, today: string = data.today): string[] {
  const lines: string[] = [];
  const spentCats = Object.entries(data.spentByCategory).sort((a, b) => b[1] - a[1]);
  const hasActivity = data.totalExpensesInKobo > 0 || data.totalIncomeInKobo > 0;
  if (!hasActivity) {
    return ['You have no transactions yet, so there is nothing to analyse. Record a spend and ask again tomorrow.'];
  }

  if (spentCats.length) {
    const [cat, amount] = spentCats[0];
    const share = data.totalExpensesInKobo ? Math.round((amount / data.totalExpensesInKobo) * 100) : 0;
    lines.push(`${labelFor(cat)} is your biggest spend area at ${formatKobo(amount)} (${share}% of everything spent).`);
    if (spentCats[1]) {
      lines.push(`Next: ${labelFor(spentCats[1][0])} ${formatKobo(spentCats[1][1])}${spentCats[2] ? ` · ${labelFor(spentCats[2][0])} ${formatKobo(spentCats[2][1])}` : ''}.`);
    }
  }

  const reserved = data.goals.filter(goal => !goal.isPaused).reduce((sum, goal) => sum + (goal.contributionPerCycleInKobo || 0), 0);
  const unallocated = Math.max(0, data.balanceInKobo - reserved);
  const nextIncome = data.nextIncomeDate ? new Date(data.nextIncomeDate).getTime() : null;
  const daysToIncome = nextIncome ? Math.max(1, Math.ceil((nextIncome - new Date(today).getTime()) / DAY_MS)) : 30;
  const perDay = Math.max(0, Math.round(unallocated / daysToIncome / 5000) * 5000);
  lines.push(nextIncome
    ? `${daysToIncome} day${daysToIncome === 1 ? '' : 's'} to your next income. Keep daily spending near ${formatKobo(perDay)} and it will last.`
    : `No next income date set, so I'm assuming a 30-day cycle: about ${formatKobo(perDay)} a day. Set the date on Allawii for an exact number.`);

  const activeGoals = data.goals.filter(goal => !goal.isPaused);
  if (reserved > 0) {
    lines.push(`${formatKobo(reserved)} of your balance is already spoken for by ${activeGoals.length} active goal contribution${activeGoals.length === 1 ? '' : 's'}.`);
  }

  const enjoyment = data.spentByBucket.enjoyment || 0;
  if (data.totalExpensesInKobo > 0 && enjoyment / data.totalExpensesInKobo > 0.35) {
    lines.push(`${Math.round((enjoyment / data.totalExpensesInKobo) * 100)}% of your spending is in the enjoyment bucket — trimming it is the fastest way to lengthen your runway.`);
  }

  for (const goal of activeGoals.filter(g => g.targetDate)) {
    const days = Math.ceil((new Date(goal.targetDate as string).getTime() - new Date(today).getTime()) / DAY_MS);
    if (days <= 0) continue;
    const remaining = Math.max(0, goal.targetAmountInKobo - goal.currentAmountInKobo);
    const cycleDays = goal.contributionFrequency === 'weekly' ? 7 : goal.contributionFrequency === 'daily' ? 1 : 30;
    const cyclesLeft = Math.max(1, Math.floor(days / cycleDays));
    const projected = (goal.contributionPerCycleInKobo || 0) * cyclesLeft;
    if (remaining === 0) {
      lines.push(`${goal.name} is fully funded — ${formatKobo(goal.targetAmountInKobo)} saved.`);
    } else if (projected < remaining) {
      const neededPerCycle = Math.ceil(((remaining - projected) / cyclesLeft) / 10000) * 10000;
      lines.push(`${goal.name} is behind pace: ${formatKobo(remaining)} needed in ${days} day${days === 1 ? '' : 's'} but your contributions only cover ${formatKobo(projected)}. Try ${formatKobo(neededPerCycle)} per ${goal.contributionFrequency || 'month'}.`);
    } else {
      lines.push(`${goal.name} is on pace: ${goalProgress(goal)}% there with ${days} days left.`);
    }
  }

  return lines.slice(0, 6);
}

export function formatInsights(data: BotData, today: string = data.today): string {
  return [`*Your insights*`, '', ...buildInsights(data, today).map((line, i) => `${i + 1}. ${line}`), '', `_Reply *balance* or *goals* anytime_`].join('\n');
}

export function formatHelp(data: BotData): string {
  return [
    `*Allawii on WhatsApp*${data.name ? ` — ${data.name}` : ''}`,
    '',
    'Send me any of these:',
    '• *balance* — what you have left',
    '• *spend 850 for data* — record an expense',
    '• *received 60000 allowance* — record income',
    '• *goals* — savings goal progress',
    '• *insights* — where your money is going',
    '• *undo* — remove the last thing I recorded',
    '',
    `You currently have *${formatKobo(data.balanceInKobo)}* available.`,
  ].join('\n');
}

function menuText(draft: BotDraft): string {
  const amount = formatKobo(draft.amountInKobo || 0);
  return [
    `*${amount}* — which category?`,
    '',
    ...CATEGORY_MENU.map((cat, i) => `${i + 1}. ${cat.name}`),
    '',
    'Reply with the number, or a word like *food* or *transport*.',
  ].join('\n');
}

function commitRecord(input: RecordInput, data: BotData, deps: BotDeps, session: BotSession): BotReply {
  const recorded = deps.recordTransaction(input);
  const nextBalance = input.type === 'income'
    ? data.balanceInKobo + input.amountInKobo
    : data.balanceInKobo - input.amountInKobo;
  const label = labelFor(input.category);
  const note = input.description && !normalize(label).includes(normalize(input.description)) && !normalize(input.description).includes(normalize(label))
    ? ` · ${input.description}`
    : '';
  return {
    text: [
      '*Recorded*',
      `${formatKobo(input.amountInKobo)} → ${label}${note}`,
      '',
      `New balance: *${formatKobo(nextBalance)}*`,
      'Reply *undo* to remove it.',
    ].join('\n'),
    session: { stage: 'idle', lastRecordedId: recorded.id },
  };
}

function buildRecordInput(draft: BotDraft, category: string, data: BotData): RecordInput {
  const option = categoryOption(category);
  const description = draft.description || labelFor(category);
  return {
    type: draft.type,
    amountInKobo: draft.amountInKobo || 0,
    category,
    description: description || labelFor(category),
    budgetBucket: option?.bucket,
    source: 'whatsapp',
  };
}

function finishDraft(text: string, draft: BotDraft, data: BotData, session: BotSession, deps: BotDeps): BotReply {
  const category = draft.type === 'income' ? guessIncomeCategory(text) : guessCategory(`${draft.description || ''} ${text}`);
  if (!category) {
    return { text: menuText(draft), session: { ...session, stage: 'awaiting_category', draft: { ...draft, category: undefined } } };
  }
  return commitRecord(buildRecordInput(draft, category, data), data, deps, session);
}

function startRecording(text: string, data: BotData, session: BotSession, deps: BotDeps, type: 'income' | 'expense'): BotReply {
  const amountInKobo = parseAmountInKobo(text);
  const description = cleanDescription(text);
  if (!amountInKobo) {
    return {
      text: `How much? Send the amount in naira — for example *500*, *1.5k* or *2m*.`,
      session: { stage: 'awaiting_amount', draft: { type, description }, lastRecordedId: session.lastRecordedId },
    };
  }
  return finishDraft(text, { type, amountInKobo, description }, data, session, deps);
}

function continueRecording(text: string, draft: BotDraft, data: BotData, session: BotSession, deps: BotDeps): BotReply {
  const amountInKobo = parseAmountInKobo(text);
  if (!amountInKobo) {
    return { text: `I couldn't read an amount there. Send something like *500* or *1.5k*.`, session };
  }
  return finishDraft(text, { ...draft, amountInKobo }, data, { ...session, stage: 'idle' }, deps);
}

function pickCategory(text: string, draft: BotDraft, data: BotData, session: BotSession, deps: BotDeps): BotReply {
  const trimmed = String(text || '').trim();
  const numbered = trimmed.match(/^(\d{1,2})$/);
  if (numbered) {
    const option = CATEGORY_MENU[Number(numbered[1]) - 1];
    if (option) return commitRecord(buildRecordInput(draft, option.id, data), data, deps, session);
    return { text: `Pick a number between 1 and ${CATEGORY_MENU.length}.`, session };
  }
  const guessed = guessCategory(trimmed);
  const asName = CATEGORY_MENU.find(cat => normalize(cat.name).includes(normalize(trimmed)) && trimmed.length > 2);
  const category = guessed || asName?.id;
  if (category) return commitRecord(buildRecordInput(draft, category, data), data, deps, session);
  return { text: menuText(draft), session };
}

export function routeMessage(text: string, data: BotData, session: BotSession | null, deps: BotDeps): BotReply {
  const current: BotSession = session || { stage: 'idle' };
  const intent = classifyIntent(text);

  if (intent === 'cancel') {
    return { text: `Done — nothing was recorded. Reply *help* whenever you want the list of commands.`, session: { stage: 'idle', lastRecordedId: current.lastRecordedId } };
  }

  if (intent === 'undo') {
    if (!current.lastRecordedId) {
      return { text: `There's nothing to undo — I haven't recorded a transaction in this chat.`, session: current };
    }
    const removed = deps.deleteTransaction(current.lastRecordedId);
    if (!removed) {
      return { text: `I couldn't remove that one — it may already be deleted. Check the Allawii app.`, session: current };
    }
    const restored = removed.type === 'expense'
      ? data.balanceInKobo + removed.amountInKobo
      : data.balanceInKobo - removed.amountInKobo;
    return {
      text: `Removed ${formatKobo(removed.amountInKobo)} · ${labelFor(removed.category)}. Your balance is now *${formatKobo(restored)}*.`,
      session: { stage: 'idle' },
    };
  }

  if (current.stage === 'awaiting_amount' && current.draft) {
    if (intent === 'unknown' || intent === 'record' || intent === 'income') {
      return continueRecording(text, current.draft, data, current, deps);
    }
    if (intent === 'balance' || intent === 'goals' || intent === 'insights' || intent === 'help') {
      return routeMessage(text, data, { stage: 'idle', lastRecordedId: current.lastRecordedId }, deps);
    }
    return continueRecording(text, current.draft, data, current, deps);
  }

  if (current.stage === 'awaiting_category' && current.draft) {
    if (intent === 'balance' || intent === 'goals' || intent === 'insights' || intent === 'help') {
      return routeMessage(text, data, { stage: 'idle', lastRecordedId: current.lastRecordedId }, deps);
    }
    return pickCategory(text, current.draft, data, current, deps);
  }

  switch (intent) {
    case 'balance':
      return { text: formatBalance(data), session: { stage: 'idle', lastRecordedId: current.lastRecordedId } };
    case 'goals':
      return { text: formatGoals(data), session: { stage: 'idle', lastRecordedId: current.lastRecordedId } };
    case 'insights':
      return { text: formatInsights(data), session: { stage: 'idle', lastRecordedId: current.lastRecordedId } };
    case 'help':
      return { text: formatHelp(data), session: { stage: 'idle', lastRecordedId: current.lastRecordedId } };
    case 'record':
      return startRecording(text, data, current, deps, 'expense');
    case 'income':
      return startRecording(text, data, current, deps, 'income');
    default: {
      const amount = parseAmountInKobo(text);
      if (amount) {
        const guessed = guessCategory(text);
        const draft: BotDraft = { type: 'expense', amountInKobo: amount, description: cleanDescription(text) };
        if (guessed) return commitRecord(buildRecordInput(draft, guessed, data), data, deps, current);
        return { text: menuText(draft), session: { stage: 'awaiting_category', draft, lastRecordedId: current.lastRecordedId } };
      }
      return {
        text: `I didn't catch that. Send *balance*, *goals*, *insights*, or record a spend like *spend 850 for data*. Reply *help* for everything I can do.`,
        session: { stage: 'idle', lastRecordedId: current.lastRecordedId },
      };
    }
  }
}

export type LinkResult =
  | { status: 'linked'; user: any }
  | { status: 'unlinked' }
  | { status: 'ambiguous' };

export function resolveLinkedUser(users: Array<{ phoneNumber?: string | null }>, phone: string | null): LinkResult {
  if (!phone) return { status: 'unlinked' };
  const owners = users.filter(user => user.phoneNumber === phone);
  if (!owners.length) return { status: 'unlinked' };
  // Two accounts on one number means any reply could leak the wrong ledger.
  if (owners.length > 1) return { status: 'ambiguous' };
  return { status: 'linked', user: owners[0] };
}

export function buildBotData(user: any): BotData {
  const summary = db.transactions.summary(user.id);
  const goals = db.savingsGoals.findByUser(user.id).map((goal: any) => ({
    name: goal.name,
    targetAmountInKobo: goal.targetAmountInKobo || 0,
    currentAmountInKobo: goal.currentAmountInKobo || 0,
    targetDate: goal.targetDate || null,
    contributionPerCycleInKobo: goal.contributionPerCycleInKobo || 0,
    contributionFrequency: goal.contributionFrequency || 'monthly',
    isPaused: !!goal.isPaused,
  }));
  return {
    name: user.name || '',
    totalIncomeInKobo: summary.totalIncomeInKobo,
    totalExpensesInKobo: summary.totalExpensesInKobo,
    balanceInKobo: summary.balanceInKobo,
    spentByCategory: summary.byCategory,
    spentByBucket: summary.byBucket,
    goals,
    nextIncomeDate: user.nextIncomeDate || null,
    today: new Date().toISOString(),
  };
}

export function botDepsFor(user: any): BotDeps {
  return {
    recordTransaction: (input) => {
      const tx = {
        id: generateId(),
        userId: user.id,
        type: input.type,
        amountInKobo: input.amountInKobo,
        category: input.category,
        description: input.description,
        date: new Date().toISOString(),
        paymentMethod: undefined,
        merchant: undefined,
        source: 'whatsapp',
        syncStatus: 'synced',
      } as any;
      if (input.budgetBucket) tx.budgetBucket = input.budgetBucket;
      return db.transactions.create(tx) as RecordedTransaction;
    },
    deleteTransaction: (id) => {
      const existing = db.load().transactions.find(tx => tx.id === id && tx.userId === user.id);
      if (!existing) return null;
      db.transactions.delete(id, user.id);
      return existing as RecordedTransaction;
    },
  };
}

const SESSION_TTL_MS = 30 * 60 * 1000;
const UNLINKED_PROMPT_COOLDOWN_MS = 24 * 60 * 60 * 1000;
const sessions = new Map<string, { session: BotSession; seenAt: number }>();
const unlinkedPrompts = new Map<string, number>();

export function sessionFor(phone: string): BotSession | null {
  const entry = sessions.get(phone);
  if (!entry) return null;
  if (Date.now() - entry.seenAt > SESSION_TTL_MS) {
    sessions.delete(phone);
    return null;
  }
  return entry.session;
}

export function rememberSession(phone: string, session: BotSession): void {
  if (session.stage === 'idle' && !session.lastRecordedId) {
    sessions.delete(phone);
    return;
  }
  sessions.set(phone, { session, seenAt: Date.now() });
}

export interface InboundResult {
  status: 'reply' | 'ignored';
  phone: string | null;
  text?: string;
}

export function processInboundMessage(from: string, body: string): InboundResult {
  const phone = waIdToE164(from);
  if (!phone) return { status: 'ignored', phone: null };

  const link = resolveLinkedUser(db.load().users, phone);
  if (link.status !== 'linked') {
    const lastPrompted = unlinkedPrompts.get(phone) || 0;
    if (Date.now() - lastPrompted < UNLINKED_PROMPT_COOLDOWN_MS) return { status: 'ignored', phone };
    unlinkedPrompts.set(phone, Date.now());
    const advice = link.status === 'ambiguous'
      ? `That number is saved on more than one Allawii account, so I won't guess whose ledger to show. Open the app and keep the number unique, then message me again.`
      : `I only answer WhatsApp numbers saved on an Allawii account. Sign up or edit your profile with *${phone}*, then send *balance*.`;
    return {
      status: 'reply',
      phone,
      text: [
        link.status === 'ambiguous' ? `*This number matches several Allawii accounts*` : `*Allawii isn't linked to this number yet*`,
        '',
        advice,
      ].join('\n'),
    };
  }

  const data = buildBotData(link.user);
  const reply = routeMessage(body, data, sessionFor(phone), botDepsFor(link.user));
  rememberSession(phone, reply.session);
  return { status: 'reply', phone, text: reply.text };
}
