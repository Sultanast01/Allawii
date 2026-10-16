import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { nairaBandLabel } from './index';

describe('B Moni monthly volume bands', () => {
  test('reads their dollar bands in naira at their own rate', () => {
    assert.equal(nairaBandLabel('$0-$4,999', 1376.99), '₦0 – ₦6.9m');
    assert.equal(nairaBandLabel('$5,000-$9,999', 1376.99), '₦6.9m – ₦13.8m');
    assert.equal(nairaBandLabel('$10,000-$49,999', 1376.99), '₦13.8m – ₦68.8m');
  });

  test('writes a small band out in full', () => {
    assert.equal(nairaBandLabel('$0-$500', 100), '₦0 – ₦50,000');
  });

  test('invents nothing without a rate or a number', () => {
    assert.equal(nairaBandLabel('$0-$4,999', null), null);
    assert.equal(nairaBandLabel('$0-$4,999', 0), null);
    assert.equal(nairaBandLabel('', 1376.99), null);
  });
});
