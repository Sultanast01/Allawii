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
