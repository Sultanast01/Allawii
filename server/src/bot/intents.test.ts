import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { extractLinkCode, guessCategory, parseAmount } from './intents.js';
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
