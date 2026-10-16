import { formatNaira, nairaToKobo } from './index';

export interface CoachData {
  name: string;
  cycleLabel: string;
  allowanceInKobo: number;
  safeToSpendInKobo: number;
  dailyLimitInKobo: number;
  daysLeft: number;
  spentInKobo: number;
  essentialsInKobo: number;
  goalCount: number;
  goalGapInKobo: number;
  topCategories: [string, number][];
  hasDebtSpending: boolean;
  entryCount: number;
}

export interface CoachAnswer {
  content: string;
  sub?: string;
}

interface CoachTopic {
  id: string;
  label: string;
  keywords: string[];
  answer: (d: CoachData) => CoachAnswer;
}

const catLabel = (id: string) => id.replace(/_/g, ' ');
const topCat = (d: CoachData) => (d.topCategories[0] ? catLabel(d.topCategories[0][0]) : 'your biggest category');

/**
 * Guidance is universal money practice first, then tied to figures the app already knows.
 * A topic wins on how many of its keywords appear in the question.
 */
export const COACH_TOPICS: CoachTopic[] = [
  {
    id: 'emergency_fund',
    label: 'How big should my emergency fund be?',
    keywords: ['emergency', 'buffer', 'rainy day', 'shock', 'sudden'],
    answer: d => ({
      content: `An emergency fund is money you touch only for a genuine shock — illness, a phone replacement, urgent travel. The textbook answer is three to six months of essential spending, but for a student one month of essentials is the honest starting line. Yours is around ${formatNaira(d.essentialsInKobo)}, so ${formatNaira(d.essentialsInKobo * 3)} would cover three months of food, transport, data and rent with no wants in it.`,
      sub: 'Build it in that order: one month, then two, then three. Keep it where casual spending cannot reach it — a separate account or a savings goal with that target. Ask me for a monthly contribution that gets you there.',
    }),
  },
  {
    id: 'split_rule',
    label: 'Is the 50/30/20 rule right for me?',
    keywords: ['50/30/20', '50 30 20', 'split', 'percentage', 'how should i divide', 'rule', 'allocation'],
    answer: d => ({
      content: 'The classic shape is 50% needs, 30% wants, 20% savings and debt. It is a starting point, not a law — on a student income needs often take 70%, and that is normal. The value is the discipline: you decide the percentages before the money arrives instead of discovering them afterwards.',
      sub: d.allowanceInKobo > 0
        ? `On ${formatNaira(d.allowanceInKobo)} a ${d.cycleLabel} that shape is roughly ${formatNaira(Math.round(d.allowanceInKobo * 0.5))} needs, ${formatNaira(Math.round(d.allowanceInKobo * 0.3))} wants, ${formatNaira(Math.round(d.allowanceInKobo * 0.2))} savings. Your categories are already grouped into obligations, essentials, future-you and enjoyment, so your real split is visible on the budget page.`
        : 'Record your income and I can turn the rule into actual naira figures for your cycle.',
    }),
  },
  {
    id: 'payday_runout',
    label: 'How do I stop running out before payday?',
    keywords: ['run out', 'running out', 'before payday', 'mid month', 'mid-month', 'stretch', 'finish early', 'last longer', 'will my money last', 'will my allowance last'],
    answer: d => ({
      content: `Money runs out when it is planned monthly but spent daily. Take what is genuinely free, divide it by the days left, and treat that as a ceiling rather than a target. You have ${formatNaira(d.safeToSpendInKobo)} uncommitted over ${Math.max(1, d.daysLeft)} days — ${formatNaira(d.dailyLimitInKobo)} a day.`,
      sub: 'Two habits make it stick: move the savings slice out the day money lands, and check the daily guide before discretionary spending, not after. Ask me for the weekly-envelope version if days feel too fine-grained.',
    }),
  },
  {
    id: 'debt_first',
    label: 'Which debt should I clear first?',
    keywords: ['debt', 'owe', 'loan', 'borrow', 'repay', 'advance', 'credit', 'interest'],
    answer: d => ({
      content: 'Two methods work. Avalanche clears the highest-interest debt first and saves you the most money; snowball clears the smallest balance first and buys an early win, which is often what keeps students going. What is never a good trade is a daily-interest or quick-loan app: a 5% weekly charge is over 100% a year, so those come before everything else and you stop taking new ones while repaying.',
      sub: d.hasDebtSpending
        ? 'Debt repayment already appears in your entries. List each balance with its charge and I will order them for you.'
        : 'Choosing between a goal and a debt: keep a small buffer, attack the debt, resume the goal after. Interest you avoid is a guaranteed return.',
    }),
  },
  {
    id: 'income_delay',
    label: 'What if my money comes late?',
    keywords: ['late', 'delay', 'delayed', 'not paid', 'hasnt come', 'has not come', 'pending', 'postponed'],
    answer: d => ({
      content: `A late payment is a liquidity problem, not a poverty problem, so the fix is pacing. Spread the same money over the longer window: your ${formatNaira(d.safeToSpendInKobo)} across ${Math.max(1, d.daysLeft) + 7} days is ${formatNaira(Math.floor(d.safeToSpendInKobo / (Math.max(1, d.daysLeft) + 7)))} a day instead of ${formatNaira(d.dailyLimitInKobo)}. Cut in this order — enjoyment, then non-urgent essentials, then savings contributions. Food and obligations come last.`,
      sub: 'Pause savings for the cycle rather than borrowing to keep contributing. A paused goal is not a failure; an interest-bearing loan to feed a goal is.',
    }),
  },
  {
    id: 'save_more',
    label: 'How can I save more each cycle?',
    keywords: ['save more', 'saving more', 'save faster', 'increase my savings', 'more savings', 'start saving', 'savings plan'],
    answer: d => ({
      content: `Savings grow from order, not willpower. Pay yourself first: the moment money lands, move the savings slice before any spending and let the rest be what it is. A boring fixed amount beats an ambitious variable one — ${formatNaira(Math.max(100000, Math.round((d.dailyLimitInKobo * 7 * 0.2) / 10000) * 10000))} a week is small enough to survive and large enough to compound.`,
      sub: d.goalCount > 0
        ? `You have ${d.goalCount} goal${d.goalCount > 1 ? 's' : ''} with ${formatNaira(d.goalGapInKobo)} still to fund. Fund one at a time — spreading contributions across several goals keeps all of them unfinished.`
        : 'Start with one goal that has a date attached. Undated savings always lose to dated spending.',
    }),
  },
  {
    id: 'food_cost',
    label: 'Food keeps eating my budget',
    keywords: ['food', 'eat', 'grocer', 'market', 'cook', 'meal', 'provision'],
    answer: d => ({
      content: 'Food is the most flexible essential there is, which is why it quietly becomes the biggest line. The three moves that work: buy non-perishables in bulk and split with housemates, shop on market days instead of corner-shop prices, and cook in batches so hunger never has to buy prepared food. Students routinely cut 20-30% of food spend without eating worse.',
      sub: d.topCategories.some(([c]) => c === 'food')
        ? `Food is your largest category at ${formatNaira(d.topCategories.find(([c]) => c === 'food')?.[1] || 0)}. Try one week of batch cooking and compare — the number moves faster than people expect.`
        : 'If food is not your biggest line, keep it simple: set the category limit and treat it as hard for one cycle.',
    }),
  },
  {
    id: 'transport_data',
    label: 'Transport and data cost too much',
    keywords: ['transport', 'keke', 'bus', 'taxi', 'fuel', 'data', 'airtime', 'wifi', 'internet', 'mtn', 'glo', 'airtel', 'recharge'],
    answer: d => ({
      content: 'Transport and data are where small repeated prices hide big totals. Batch errands into one trip instead of three, use campus wifi plus one larger bundle instead of daily top-ups, and compare a 30-day bundle against what your dailies actually add up to — the monthly one usually wins. Track the total for one week and you will finally know your real number.',
      sub: `Your biggest line is ${topCat(d)} at ${formatNaira(d.topCategories[0]?.[1] || 0)} this cycle. Check that against a monthly bundle before buying anything else.`,
    }),
  },
  {
    id: 'impulse',
    label: 'I buy things I did not plan',
    keywords: ['impulse', 'overspend', 'spend too much', 'self control', 'self-control', 'wants', 'unnecessary', 'buying', 'stopping myself', 'discipline'],
    answer: d => ({
      content: `Impulse spending is a timing problem, not a character problem. Put a wait between wanting and buying: under ${formatNaira(Math.max(50000, Math.round(d.dailyLimitInKobo / 1000) * 1000))} waits 24 hours, above it waits 7 days — most wants expire on their own. Add two frictions: do not save card details in shopping apps, and do not browse stores when bored or stressed, because that is when the buys happen.`,
      sub: 'If it still feels worth it after the wait, it is a real want and belongs inside your enjoyment budget rather than outside it as a guilt purchase.',
    }),
  },
  {
    id: 'school_fees',
    label: 'How do I plan for school fees?',
    keywords: ['school fees', 'tuition', 'fees', 'departmental', 'clearance', 'handout', 'result printing'],
    answer: d => ({
      content: 'Fees are a known future expense, so they should never be funded by leftovers. Work backwards: total divided by the cycles remaining gives a fixed contribution per cycle, and that amount moves out the day money lands. If the per-cycle figure is more than about 20% of your income, the honest options are a payment plan with the school, spreading it across more cycles, or raising income.',
      sub: 'Keep fees as an obligation rather than a savings goal: obligations get paid first and are not optional when money gets tight.',
    }),
  },
  {
    id: 'group_money',
    label: 'Are group contributions safe?',
    keywords: ['esusu', 'ajo', 'contribution', 'coop', 'thrift', 'rotating', 'circle', 'aajo'],
    answer: d => ({
      content: 'Rotating contributions can work, but they carry two risks people forget: whoever runs it, and everyone else in it. Judge it on four things — a written list of names and dates, everyone paying before the first payout, a collector with a reputation to lose, and whether you can exit without losing your turn. If those are unclear, it is an unsecured loan dressed as savings.',
      sub: `Never put emergency money into a group. Keep contributions at or below what you could lose without changing your ${d.cycleLabel} plan.`,
    }),
  },
  {
    id: 'investment',
    label: 'Should I invest my savings?',
    keywords: ['invest', 'investment', 'crypto', 'forex', 'stock', 'mutual fund', 'treasury', 'business', 'flip', 'return', 'passive income'],
    answer: d => ({
      content: 'Order matters more than product: one month of expenses in cash, then high-interest debt cleared, then invest. Anything promising a guaranteed monthly return of several percent is a scheme — the profit is paid from the next person and it stops. Realistic options at student balances are licensed mutual funds or treasury bills, and the honest expectation is single-digit annual growth, not monthly income.',
      sub: 'If losing the whole amount would wreck the rest of your cycle, it is not investment money yet.',
    }),
  },
  {
    id: 'prices_rising',
    label: 'Prices keep going up, what do I do?',
    keywords: ['price', 'prices', 'inflation', 'expensive', 'rising', 'cost of living', 'dear', 'went up', 'gone up', 'cost more', 'costs more', 'rent'],
    answer: d => ({
      content: `When prices rise, fix the structure before cutting the fun. Re-check what food, transport and data cost now against what your budget assumes — a stale budget is the usual reason money runs out. Then buy non-perishables in bulk while you have cash, keep one month of essentials as a buffer so a shock does not become a loan, and only then look at raising income: cutting has a floor, earning does not.`,
      sub: `You have spent ${formatNaira(d.spentInKobo)} of a ${formatNaira(d.allowanceInKobo)} allowance this cycle. If your category limits predate the last price changes, update them instead of fighting an out-of-date plan.`,
    }),
  },
  {
    id: 'raid_savings',
    label: 'Is it wrong to use my savings?',
    keywords: ['use my savings', 'withdraw', 'take out', 'break the bank', 'spend my goal', 'touch my savings', 'use my goal'],
    answer: d => ({
      content: 'Savings exist to be used — that is the point. The distinction is which pot: emergency money is for shocks and spending it on a real emergency means the system worked, while goal money is dated and borrowing from it is just a loan to yourself with a hidden cost. Take from a goal early when the goal no longer matches your life, not when a want appears.',
      sub: 'If you do withdraw, write down a refill date and amount. An untracked refill is how a savings pot quietly disappears.',
    }),
  },
];

const STATUS_KEYWORDS = ['safe to spend', 'daily limit', 'how much can i spend', 'remaining', 'left this', 'where is my money', 'biggest spend', 'am i on track', 'status'];

/** Word-start matching, so "eating" counts as food but "weather" does not. */
function hasKeyword(question: string, keyword: string): boolean {
  return new RegExp(`\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i').test(question);
}

function scoreTopic(question: string, topic: CoachTopic): number {
  return topic.keywords.reduce((score, keyword) => score + (hasKeyword(question, keyword) ? 1 : 0), 0);
}

/** Naira amounts arrive typed by hand: "₦8,000", "8k", "1500". Always returned in kobo. */
export function parseAffordAmount(question: string): number | null {
  const shorthand = question.match(/(\d+(?:[.,]\d+)?)\s*[kK]\b/);
  if (shorthand) return nairaToKobo(Number(shorthand[1].replace(',', '')) * 1000);
  const amounts = [...question.matchAll(/\d[\d,]*(?:\.\d{1,2})?/g)]
    .map(match => Number(match[0].replace(/,/g, '')))
    .filter(value => Number.isFinite(value) && value > 0);
  if (amounts.length === 0) return null;
  // The price is the largest number in the sentence, so "2 plans at 1,500" reads 1,500.
  return nairaToKobo(Math.max(...amounts));
}

function affordAnswer(amountInKobo: number, d: CoachData): CoachAnswer {
  if (amountInKobo <= d.safeToSpendInKobo) {
    const after = Math.max(0, d.safeToSpendInKobo - amountInKobo);
    const perDay = Math.floor(after / Math.max(1, d.daysLeft));
    return {
      content: `Yes — ${formatNaira(amountInKobo)} fits inside your ${formatNaira(d.safeToSpendInKobo)} of uncommitted money. After it you have ${formatNaira(after)} for the remaining ${Math.max(1, d.daysLeft)} days, which is ${formatNaira(perDay)} a day.`,
      sub: `If ${formatNaira(perDay)} is below what you really spend on an average day, the purchase is affordable but something else has to shrink. The what-if simulator shows which category absorbs it.`,
    };
  }
  return {
    content: `Not from this ${d.cycleLabel}'s free money: ${formatNaira(amountInKobo)} against ${formatNaira(d.safeToSpendInKobo)} uncommitted — you are ${formatNaira(amountInKobo - d.safeToSpendInKobo)} short.`,
    sub: 'Three honest routes: wait for the next income, fund it by cutting a specific category, or drop it. Borrowing to bridge a want turns a bad week into a bad two months.',
  };
}

export function answerCoach(question: string, d: CoachData): CoachAnswer {
  const lower = question.toLowerCase();

  if (/afford|can i (buy|get|pay|take|do)\b/i.test(lower)) {
    const amountInKobo = parseAffordAmount(question);
    if (!amountInKobo) return { content: 'Tell me the price and I will check it against your budget — for example, "Can I afford ₦8,000?"' };
    return affordAnswer(amountInKobo, d);
  }

  const best = COACH_TOPICS
    .map(topic => ({ topic, score: scoreTopic(lower, topic) }))
    .filter(matched => matched.score > 0)
    .sort((a, b) => b.score - a.score)[0];

  if (best) return best.topic.answer(d);

  if (STATUS_KEYWORDS.some(keyword => hasKeyword(lower, keyword))) {
    return {
      content: `You have ${formatNaira(d.safeToSpendInKobo)} uncommitted for the ${Math.max(1, d.daysLeft)} days left in this ${d.cycleLabel} — a daily guide of ${formatNaira(d.dailyLimitInKobo)}. You have spent ${formatNaira(d.spentInKobo)} so far.`,
      sub: d.topCategories.length > 0
        ? `Biggest lines: ${d.topCategories.slice(0, 3).map(([c, a]) => `${catLabel(c)} (${formatNaira(a)})`).join(', ')}. Ask me about any of them and I will tell you what usually works.`
        : 'Record a few entries and this becomes specific to you.',
    };
  }

  return {
    content: d.entryCount === 0
      ? 'There is little data yet, but the rules are the same for everyone: decide the split before the money lands, keep one month of essentials as a buffer, and never fund a want with a loan.'
      : `Here is where you stand: ${formatNaira(d.safeToSpendInKobo)} safe to spend, ${formatNaira(d.dailyLimitInKobo)} a day for ${Math.max(1, d.daysLeft)} days, ${formatNaira(d.spentInKobo)} spent this ${d.cycleLabel}.`,
    sub: 'Ask me something concrete: emergency funds, an affordable purchase, debt order, food, transport or data costs, saving faster, school fees, group contributions, or what to do if your money comes late.',
  };
}

const STATUS_CHIP = 'How much can I spend per day?';

/** Someone typing "how much can I spend per day" has already asked the "How much can I spend per day?" chip. */
const normChip = (value: string) => value.trim().toLowerCase().replace(/[?.!\s]+$/g, '');

/** Openers that fit their situation: their own numbers first, then topics they have not asked about. */
export function coachChips(d: CoachData, asked: Set<string>): string[] {
  const askedLabels = new Set(Array.from(asked, normChip));
  const picks: string[] = [];
  if (d.entryCount > 0 && !askedLabels.has(normChip(STATUS_CHIP))) picks.push(STATUS_CHIP);
  const priority = [
    d.hasDebtSpending ? 'debt_first' : '',
    d.goalCount > 0 ? 'raid_savings' : 'save_more',
    'payday_runout',
    'emergency_fund',
    'food_cost',
    'transport_data',
    'prices_rising',
    'impulse',
    'school_fees',
    'group_money',
    'investment',
    'split_rule',
    'income_delay',
  ].filter(Boolean);
  for (const id of priority) {
    if (picks.length >= 4) break;
    const label = COACH_TOPICS.find(t => t.id === id)?.label;
    if (label && !askedLabels.has(normChip(label))) picks.push(label);
  }
  return picks.slice(0, 4);
}
