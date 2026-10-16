import test from 'node:test';
import assert from 'node:assert/strict';
import { parseDateCell, parseMoneyCell, parseReceipt, parseStatement, suggestCategory } from './parsing';

test('money cells keep their sign and separators', () => {
  assert.equal(parseMoneyCell('1,250.50'), 1250.5);
  assert.equal(parseMoneyCell('₦2,800'), 2800);
  assert.equal(parseMoneyCell('-500'), -500);
  assert.equal(parseMoneyCell('(500)'), -500);
  assert.equal(parseMoneyCell('1.250,50'), 1250.5);
  assert.equal(parseMoneyCell('+50000'), 50000);
  assert.equal(parseMoneyCell('500 Cr'), 500);
  assert.equal(parseMoneyCell('500 Dr'), -500);
  assert.equal(parseMoneyCell('0.00'), null);
  assert.equal(parseMoneyCell('05/10/2026'), null);
  assert.equal(parseMoneyCell('GTBank Plc'), null);
});

test('statement dates are day-first, not month-first', () => {
  assert.equal(parseDateCell('05/10/2026'), '2026-10-05');
  assert.equal(parseDateCell('05-10-26'), '2026-10-05');
  assert.equal(parseDateCell('2026-10-05'), '2026-10-05');
  assert.equal(parseDateCell('5 Oct 2026'), '2026-10-05');
  assert.equal(parseDateCell('Shoprite'), null);
});

test('headerless statements read as date, description, amount', () => {
  const rows = parseStatement('05/10/2026,Shoprite rice,3500\n10/01/2026,MTN data,1500', []);
  assert.equal(rows.length, 2);
  assert.deepEqual(
    rows.map(r => [r.date, r.description, r.amount, r.type, r.category.id]),
    [
      ['2026-10-05', 'Shoprite rice', 3500, 'expense', 'food'],
      ['2026-01-10', 'MTN data', 1500, 'expense', 'data_airtime'],
    ],
  );
});

test('debit and credit columns beat the trailing balance column', () => {
  const rows = parseStatement(
    [
      'Date,Narration,Debit,Credit,Balance',
      '05/10/2026,Uber trip,1200.00,,45000.00',
      '06/10/2026,Salary paid in,,150000.00,195000.00',
    ].join('\n'),
    [],
  );
  assert.deepEqual(
    rows.map(r => [r.date, r.description, r.amount, r.type, r.category.id]),
    [
      ['2026-10-05', 'Uber trip', 1200, 'expense', 'transport'],
      ['2026-10-06', 'Salary paid in', 150000, 'income', 'other_expense'],
    ],
  );
});

test('semicolon files and naira signs parse', () => {
  const rows = parseStatement('Date;Description;Amount\n05/10/2026;MTN VTN;₦1,500.00', []);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].amount, 1500);
  assert.equal(rows[0].category.id, 'data_airtime');
});

test('an unrecognised description lands in Other instead of Food', () => {
  const rows = parseStatement('05/10/2026,Seminar registration,700', []);
  assert.equal(rows[0].category.id, 'other_expense');
});

test('rows without an amount are dropped and repeats are flagged', () => {
  const existing = [{ date: '2026-10-05', description: 'Shoprite rice', amountInKobo: 350000 }];
  const rows = parseStatement('05/10/2026,Shoprite rice,3500\nopening balance note', existing);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].duplicate, true);
});

test('category suggestions cover the everyday student spend', () => {
  assert.equal(suggestCategory('keke to school').id, 'transport');
  assert.equal(suggestCategory('Bolt trip to island').id, 'transport');
  assert.equal(suggestCategory('school fees payment').id, 'school_fees');
  assert.equal(suggestCategory('photocopy of handout').id, 'academics');
  assert.equal(suggestCategory('NECO result').id, 'other_expense');
});

test('receipt items ignore phones, references, dates and totals', () => {
  const receipt = [
    'JUSTRITE SUPERMARKET',
    '12 Admiralty Way, Lekki',
    'TEL: 08031234567',
    'Date: 05/10/2026',
    'Receipt No: 45210',
    'RICE 5KG        2,800.00',
    'VEG TABLES        950.00',
    'DETTERGENT        500.00',
    'SUB TOTAL        4250.00',
    'VAT 7.5%          318.75',
    'TOTAL           4568.75',
    'THANK YOU',
  ].join('\n');
  const parsed = parseReceipt(receipt);
  assert.equal(parsed.merchant, 'JUSTRITE SUPERMARKET');
  assert.equal(parsed.date, '2026-10-05');
  assert.equal(parsed.total, 4568.75);
  assert.deepEqual(parsed.items, [
    { name: 'RICE 5KG', price: 2800 },
    { name: 'VEG TABLES', price: 950 },
    { name: 'DETTERGENT', price: 500 },
  ]);
});

test('a card number or table count is never a price', () => {
  const parsed = parseReceipt(['SPENDING ZONE', 'CARD 4521', 'TABLE 4', 'POS 1234567890', 'TOTAL 1200.00'].join('\n'));
  assert.deepEqual(parsed.items, [{ name: 'SPENDING ZONE purchase', price: 1200 }]);
});

test('a receipt that only gives up its total still saves one line', () => {
  const parsed = parseReceipt('SHOP\nTOTAL 1200.00');
  assert.equal(parsed.items.length, 1);
  assert.equal(parsed.items[0].price, 1200);
});
