import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { extractLinkCode, firstName, formatBudgets, formatHelp, guessCategory, parseAmount } from './intents.js';
import { currentStreak } from '../services/bot-gateway.js';

function dayKey(offsetDays: number): string {
  const date = new Date();
  date.setDate(date.getDate() - offsetDays);
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${m}-${d}`;
}

describe('Telegram intent parsing', () => {
  test('reads plain naira amounts', () => {
    assert.equal(parseAmount('I spent 1500 on lunch'), 1500);
    assert.equal(parseAmount('I spent ₦2,300 on rice'), 2300);
  });

  test('expands k shorthand', () => {
    assert.equal(parseAmount('can I afford 1.5k'), 1500);
    assert.equal(parseAmount('save 2k'), 2000);
  });

  test('ignores day counts', () => {
    assert.equal(parseAmount('I will pay in 3 days'), null);
  });

  test('returns null when no money is named', () => {
    assert.equal(parseAmount('what is my balance'), null);
    assert.equal(parseAmount(''), null);
  });

  test('maps wording to a category', () => {
    assert.equal(guessCategory('bought jollof rice'), 'food');
    assert.equal(guessCategory('bolt to campus'), 'transport');
    assert.equal(guessCategory('topped up MTN data'), 'data');
    assert.equal(guessCategory('netflix and a movie'), 'entertainment');
    assert.equal(guessCategory('printed my handout'), 'other');
  });

  test('streak counts consecutive days and tolerates one blank day', () => {
    assert.equal(currentStreak([dayKey(0), dayKey(1), dayKey(2)]), 3);
    assert.equal(currentStreak([dayKey(1), dayKey(2)]), 2, 'today may still be empty');
    assert.equal(currentStreak([dayKey(0), dayKey(2)]), 1, 'a gap stops the count');
    assert.equal(currentStreak([dayKey(3)]), 0);
  });
});

describe('Link code parsing', () => {
  test('reads the app deep link, the command and a pasted code', () => {
    assert.equal(extractLinkCode('/start link_482913'), '482913');
    assert.equal(extractLinkCode('/start:link_482913'), '482913');
    assert.equal(extractLinkCode('/link 482913'), '482913');
    assert.equal(extractLinkCode('482913'), '482913');
  });

  test('a linked chat never reads a plain number as a code', () => {
    assert.equal(extractLinkCode('1500', false), null);
    assert.equal(extractLinkCode('/link 1500', false), '1500', 'an explicit command still re-links');
  });

  test('money sentences are not codes', () => {
    assert.equal(extractLinkCode('I spent 1500 on lunch'), null);
    assert.equal(extractLinkCode('what is my balance'), null);
    assert.equal(extractLinkCode('/start'), null);
  });
});

describe('Assistant budget reply', () => {
  test('names each row the way the user named it', () => {
    const text = formatBudgets({
      food: { limit: 20500, spent: 4200, label: 'Food' },
      'ob-mvaacjy7af8as534jx7': { limit: 2500, spent: 2500, label: 'Generator fuel' },
    });
    assert.match(text, /^Your budgets this cycle — ₦6,700 of ₦23,000 used:/);
    assert.match(text, /Food: ₦4,200 \/ ₦20,500/);
    assert.match(text, /Generator fuel: ₦2,500 \/ ₦2,500/);
    assert.doesNotMatch(text, /ob-mvaacjy|data_airtime/);
  });

  test('calls out a blown budget and spend that has no budget', () => {
    const over = formatBudgets({ food: { limit: 15000, spent: 15881, label: 'Food' } });
    assert.match(over, /Food: ₦15,881 of ₦15,000 — over by ₦881/);
    const stray = formatBudgets({ haircut: { limit: 0, spent: 3000, label: 'Haircut' } });
    assert.match(stray, /Haircut: ₦3,000 — outside your budgets/);
  });

  test('an untouched plan tells the user how to fill it', () => {
    const empty = formatBudgets({ transport: { limit: 8000, spent: 0, label: 'Transport' } });
    assert.match(empty, /Nothing is logged against these yet/);
    assert.equal(formatBudgets({}), 'No budgets yet. Set them up in the app.');
  });
});

describe('Assistant help menu', () => {
  test('greets the account by first name only', () => {
    assert.equal(firstName('Ada Okonkwo'), 'Ada');
    assert.equal(firstName('  ada  '), 'ada');
    assert.equal(firstName(null), '');
    assert.match(formatHelp(firstName('Ada Okonkwo')), /what I can do, Ada —/);
    assert.doesNotMatch(formatHelp(firstName('Ada Okonkwo')), /Okonkwo/, 'a surname has no business in a greeting');
    assert.match(formatHelp(), /^Here is what I can do —/);
  });

  test('every example it quotes is something the parser reads', () => {
    const quoted = [...formatHelp('Ada').matchAll(/"([^"]+)"/g)].map(match => match[1]);
    assert.ok(quoted.length >= 10, 'the menu has to cover what the loop can do');
    quoted.forEach(line => {
      const text = line.toLowerCase();
      if (!/(spent|paid|bought|save|afford)/.test(text)) return;
      assert.ok(parseAmount(text), `"${line}" names an amount the parser can read`);
    });
    assert.equal(guessCategory('I spent 1500 on lunch'), 'food');
    assert.equal(guessCategory('paid 800 for a keke'), 'transport');
    assert.equal(guessCategory('bought data for 1000'), 'data');
  });
});
