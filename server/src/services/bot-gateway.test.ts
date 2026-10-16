import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { appCategory, budgetLabel } from './bot-gateway.js';

describe('Assistant budget labels', () => {
  test('a plan is named the way the user named it', () => {
    assert.equal(budgetLabel('Data & Airtime', 'data_airtime'), 'Data & Airtime');
    assert.equal(budgetLabel('  Generator fuel  ', 'ob-mvaacjy7af8as534jx7'), 'Generator fuel');
  });

  test('a raw category id is never shown to a person', () => {
    assert.equal(budgetLabel('', 'data_airtime'), 'Data airtime');
    assert.equal(budgetLabel(null, 'other_expense'), 'Other expense');
  });

  test('an unnamed obligation row still reads as money talk, not as an id', () => {
    assert.equal(budgetLabel('', 'ob-mvaacjy7af8as534jx7'), 'Fixed commitment');
  });

  test('the word the user typed resolves to the row the plan is stored under', () => {
    assert.equal(appCategory('data'), 'data_airtime');
    assert.equal(appCategory('Food'), 'food');
    assert.equal(appCategory(''), 'other_expense');
    assert.equal(appCategory('handout'), 'handout');
  });
});
