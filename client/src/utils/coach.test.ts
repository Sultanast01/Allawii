import test from 'node:test';
import assert from 'node:assert/strict';
import { answerCoach, coachChips, parseAffordAmount, type CoachData } from './coach';

const base: CoachData = {
  name: 'Ada',
  cycleLabel: 'month',
  allowanceInKobo: 6000000,
  safeToSpendInKobo: 1000000,
  dailyLimitInKobo: 33333,
  daysLeft: 30,
  spentInKobo: 4500000,
  essentialsInKobo: 3000000,
  goalCount: 1,
  goalGapInKobo: 500000,
  topCategories: [['food', 1588100], ['transport', 400000]],
  hasDebtSpending: false,
  entryCount: 12,
};

test('afford checks compare naira prices with kobo balances', () => {
  assert.equal(parseAffordAmount('Can I afford ₦8,000?'), 800000);
  assert.equal(parseAffordAmount('Can I afford 8k?'), 800000);
  assert.equal(parseAffordAmount('Can I afford 15,000 naira?'), 1500000);
  assert.equal(parseAffordAmount('two data plans at 1,500 each'), 150000);
  assert.equal(parseAffordAmount('can i afford it'), null);

  const fits = answerCoach('Can I afford ₦8,000?', base);
  assert.match(fits.content, /^Yes/);
  assert.match(fits.content, /₦8,000/);
  assert.doesNotMatch(fits.content, /₦80[^,0]/);

  const short = answerCoach('Can I afford ₦20,000?', base);
  assert.match(short.content, /Not from this month/);
  assert.match(short.content, /₦10,000 short/);
});

test('money questions get taught, not deflected', () => {
  const cases: [string, RegExp][] = [
    ['how big should my emergency fund be', /three to six months|emergency fund is money/i],
    ['is the 50/30/20 rule worth it', /50% needs/i],
    ['which debt should i clear first', /avalanche|snowball/i],
    ['my allowance is going to come late', /liquidity/i],
    ['how can i save more each month', /pay yourself first/i],
    ['food is too expensive here', /market days|bulk/i],
    ['data and transport are eating my money', /bundle|batch/i],
    ['i keep buying things i did not plan', /24 hours/i],
    ['how do i plan for school fees', /payment plan|cycles remaining/i],
    ['is esusu safe to join', /written list|rotating/i],
    ['should i invest my savings', /one month of expenses/i],
    ['prices keep rising what do i do', /stale budget|structure/i],
    ['my rent went up but my allowance stayed the same', /stale budget|structure/i],
    ['is it wrong to use my savings', /which pot/i],
  ];
  for (const [question, expectation] of cases) {
    const answer = answerCoach(question, base);
    assert.match(`${answer.content} ${answer.sub || ''}`, expectation, `unmatched: ${question}`);
  }
});

test('a status question still answers with their own figures', () => {
  const answer = answerCoach('how much can i spend per day', base);
  assert.match(answer.content, /₦10,000 uncommitted/);
  assert.match(answer.content, /₦333/);
});

test('an unknown question gives a useful fallback instead of a generic probe', () => {
  const answer = answerCoach('what do you think about the weather', base);
  assert.match(answer.content, /safe to spend/);
  assert.match(answer.sub || '', /emergency funds|debt order|school fees/);
});

test('suggestion chips rotate through topics as they get asked', () => {
  const first = coachChips(base, new Set());
  assert.equal(first.length, 4);
  assert.equal(new Set(first).size, 4);
  assert.equal(first[0], 'How much can I spend per day?');

  const afterAsking = coachChips(base, new Set(first));
  assert.equal(afterAsking.length, 4);
  assert.deepEqual(afterAsking.filter(c => first.includes(c)), []);

  const withDebt = coachChips({ ...base, hasDebtSpending: true }, new Set(['How much can I spend per day?']));
  assert.ok(withDebt.includes('Which debt should I clear first?'));

  const askedInLowercase = coachChips(base, new Set(['how much can i spend per day']));
  assert.ok(!askedInLowercase.includes('How much can I spend per day?'));
  assert.equal(askedInLowercase.length, 4);
});
