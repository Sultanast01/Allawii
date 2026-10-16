/**
 * Pure text understanding for the Telegram assistant: turns a sentence a student
 * actually types into an amount and a category. Kept out of the bot loop so it
 * can be tested without Telegram or the database.
 */

/**
 * Pulls the first amount in naira out of free text, honouring "1.5k" and
 * thousands separators, and ignoring day counts so "in 3 days" is not money.
 * Returns null when the text names no amount.
 */
export function parseAmount(text: string): number | null {
  const match = String(text || '').replace(/,/g, '').match(/(\d+(?:\.\d+)?)\s*(k)?\b(?!\s*days?)/i);
  if (!match) return null;
  const value = Math.round(parseFloat(match[1]) * (match[2] ? 1000 : 1));
  return value > 0 ? value : null;
}

/** Maps the wording of an expense to one of the assistant's five categories. */
export function guessCategory(text: string): string {
  const value = String(text || '').toLowerCase();
  if (/(rice|lunch|dinner|suya|food|snack|eat)/.test(value)) return 'food';
  if (/(bolt|uber|bus|keke|transport|ride)/.test(value)) return 'transport';
  if (/(data|airtime)/.test(value)) return 'data';
  if (/(movie|game|party|fun|entertainment)/.test(value)) return 'entertainment';
  return 'other';
}

/**
 * The budgets answer as chat lines. Rows are labelled the way the user named them,
 * because the internal keys (`data_airtime`, `ob-mvaacjy7af8as534jx7`) mean nothing in a reply.
 */
export function formatBudgets(budgets: Record<string, { limit: number; spent: number; label: string }>): string {
  const rows = Object.values(budgets);
  if (!rows.length) return 'No budgets yet. Set them up in the app.';
  const nairaText = (amount: number) => '₦' + Math.round(amount).toLocaleString('en-NG');
  const totalLimit = rows.reduce((total, row) => total + row.limit, 0);
  const totalSpent = rows.reduce((total, row) => total + row.spent, 0);
  const lines = rows.map(row => {
    if (row.limit <= 0) return `${row.label}: ${nairaText(row.spent)} — outside your budgets`;
    if (row.spent > row.limit) return `${row.label}: ${nairaText(row.spent)} of ${nairaText(row.limit)} — over by ${nairaText(row.spent - row.limit)}`;
    return `${row.label}: ${nairaText(row.spent)} / ${nairaText(row.limit)}`;
  });
  const tail = totalSpent === 0
    ? '\n\nNothing is logged against these yet. Say "I spent 1500 on lunch" and I will put it in the right budget.'
    : '';
  return `Your budgets this cycle — ${nairaText(totalSpent)} of ${nairaText(totalLimit)} used:\n${lines.join('\n')}${tail}`;
}

/**
 * What the assistant can do, phrased as the sentences a student actually types.
 * Every example here is a phrase the bot loop really answers; the tests hold it to that.
 */
export function formatHelp(name = ''): string {
  const opener = name
    ? `Here is what I can do, ${name} — type it the way you would say it.`
    : 'Here is what I can do — type it the way you would say it.';
  return [
    opener,
    '',
    'Your money right now',
    '  "what is my balance?"',
    '  "how much can I spend today?"',
    '  "can I afford 6000?"',
    '',
    'Logging what you spent',
    '  "I spent 1500 on lunch" goes to Food',
    '  "paid 800 for a keke" goes to Transport',
    '  "bought data for 1000" goes to Data & Airtime',
    '',
    'Budgets, goals and streaks',
    '  "how are my budgets?"',
    '  "what are my goals?"',
    '  "save 2000" tops up your first goal',
    '  "what is my streak?"',
    '',
    'When a budget is nearly gone I suggest moving a little from one that has room, and I ask before changing anything. I only touch your Allawii numbers — no money moves from this chat.',
  ].join('\n');
}

/**
 * Only a first name belongs in a greeting; a full name reads like a form letter.
 * Returns '' for an account with no name on it, so the caller can drop the greeting.
 */
export function firstName(name: unknown): string {
  return String(name || '').trim().split(/\s+/)[0] || '';
}

/**
 * The code that connects a chat to an account, from any of the ways it arrives:
 * the app's deep link (`/start link_123456`), the command (`/link 123456`), or a
 * pasted code on its own. `allowBareCode` is false once a chat is already linked,
 * so a plain number typed mid-conversation is not read as a code.
 */
export function extractLinkCode(text: string, allowBareCode = true): string | null {
  const value = String(text || '').trim();
  const command = value.match(/^\/(?:start|link)[\s:]+link[_-]?(\d{4,8})\b/i) || value.match(/^\/link[\s:]+(\d{4,8})\b/i);
  if (command) return command[1];
  if (allowBareCode && /^\d{4,8}$/.test(value)) return value;
  return null;
}
