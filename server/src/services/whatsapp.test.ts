import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  waIdToE164,
  classifyIntent,
  parseAmountInKobo,
  guessCategory,
  formatKobo,
  buildInsights,
  routeMessage,
  resolveLinkedUser,
  CATEGORY_MENU,
  type BotData,
  type BotSession,
  type RecordInput,
  type RecordedTransaction,
} from './whatsapp.js';

function makeData(overrides: Partial<BotData> = {}): BotData {
  return {
    name: 'Ada',
    totalIncomeInKobo: 6000000,
    totalExpensesInKobo: 1850000,
    balanceInKobo: 4150000,
    spentByCategory: { food: 850000, transport: 400000, data_airtime: 300000, entertainment: 300000 },
    spentByBucket: { essentials: 1550000, enjoyment: 300000 },
    goals: [
      { name: 'New laptop', targetAmountInKobo: 15000000, currentAmountInKobo: 4500000, targetDate: null, contributionPerCycleInKobo: 500000, contributionFrequency: 'weekly', isPaused: false },
      { name: 'Emergency fund', targetAmountInKobo: 3000000, currentAmountInKobo: 1800000, targetDate: null, contributionPerCycleInKobo: 400000, contributionFrequency: 'monthly', isPaused: false },
    ],
    nextIncomeDate: null,
    today: '2026-10-15T09:00:00.000Z',
    ...overrides,
  };
}

class FakeStore {
  recorded: RecordInput[] = [];
  deleted: string[] = [];
  deps = {
    recordTransaction: (input: RecordInput): RecordedTransaction => {
      this.recorded.push(input);
      return { id: `tx-${this.recorded.length}`, ...input };
    },
    deleteTransaction: (id: string): RecordedTransaction | null => {
      this.deleted.push(id);
      const index = Number(id.replace('tx-', '')) - 1;
      const found = this.recorded[index];
      return found ? { id, ...found } : null;
    },
  };
}

describe('WhatsApp sender identity', () => {
  test('converts a Cloud API wa_id into an E.164 phone number', () => {
    assert.equal(waIdToE164('2348012345678'), '+2348012345678');
    assert.equal(waIdToE164('+234 801 234 5678'), '+2348012345678');
  });

  test('returns null for ids that cannot be a phone number', () => {
    assert.equal(waIdToE164(''), null);
    assert.equal(waIdToE164('abc'), null);
    assert.equal(waIdToE164('12345'), null);
  });
});

describe('Intent classification', () => {
  test('maps the four core commands plus help, undo and cancel', () => {
    assert.equal(classifyIntent('balance'), 'balance');
    assert.equal(classifyIntent('How much do I have?'), 'balance');
    assert.equal(classifyIntent('my wallet'), 'balance');
    assert.equal(classifyIntent('goals'), 'goals');
    assert.equal(classifyIntent('how are my savings going'), 'goals');
    assert.equal(classifyIntent('insights'), 'insights');
    assert.equal(classifyIntent('how am I doing this month'), 'insights');
    assert.equal(classifyIntent('spend 500 for lunch'), 'record');
    assert.equal(classifyIntent('I earned 60000 allowance'), 'income');
    assert.equal(classifyIntent('help'), 'help');
    assert.equal(classifyIntent('undo'), 'undo');
    assert.equal(classifyIntent('cancel'), 'cancel');
  });

  test('unknown text falls through to the unknown intent', () => {
    assert.equal(classifyIntent('send me a poem about rice'), 'unknown');
  });
});

describe('Amount parsing', () => {
  test('reads plain naira amounts as kobo', () => {
    assert.equal(parseAmountInKobo('spend 850 on data'), 85000);
    assert.equal(parseAmountInKobo('₦1,500'), 150000);
  });

  test('reads k and m shorthand', () => {
    assert.equal(parseAmountInKobo('5k'), 500000);
    assert.equal(parseAmountInKobo('1.5k'), 150000);
    assert.equal(parseAmountInKobo('2m'), 200000000);
  });

  test('returns null when there is no amount', () => {
    assert.equal(parseAmountInKobo('check balance'), null);
    assert.equal(parseAmountInKobo('i spent money on data'), null);
  });
});

describe('Category guessing', () => {
  test('matches common student spend words to category ids', () => {
    assert.equal(guessCategory('bought data'), 'data_airtime');
    assert.equal(guessCategory('taxi to school'), 'transport');
    assert.equal(guessCategory('lunch at canteen'), 'food');
    assert.equal(guessCategory('paid NEPA bill'), 'utilities');
    assert.equal(guessCategory('netflix subscription'), 'entertainment');
    assert.equal(guessCategory('printing lecture notes'), 'academics');
  });

  test('returns null when no category matches', () => {
    assert.equal(guessCategory('gave money to someone'), null);
  });
});

describe('Money formatting', () => {
  test('formats kobo as naira with separators', () => {
    assert.equal(formatKobo(4150000), '₦41,500');
    assert.equal(formatKobo(85000), '₦850');
    assert.equal(formatKobo(1250), '₦12.50');
  });
});

describe('Balance reply', () => {
  test('reports balance, spending and income for a funded account', () => {
    const store = new FakeStore();
    const out = routeMessage('balance', makeData(), null, store.deps);
    assert.match(out.text, /₦41,500/);
    assert.match(out.text, /₦60,000/);
    assert.match(out.text, /₦18,500/);
    assert.equal(out.session.stage, 'idle');
    assert.equal(store.recorded.length, 0);
  });

  test('tells an empty account what to do next', () => {
    const store = new FakeStore();
    const out = routeMessage('balance', makeData({
      totalIncomeInKobo: 0, totalExpensesInKobo: 0, balanceInKobo: 0, spentByCategory: {}, spentByBucket: {}, goals: [],
    }), null, store.deps);
    assert.match(out.text, /₦0/);
    assert.match(out.text, /record/i);
  });
});

describe('Savings goal reply', () => {
  test('lists each goal with saved, target and progress', () => {
    const store = new FakeStore();
    const out = routeMessage('goals', makeData(), null, store.deps);
    assert.match(out.text, /New laptop/);
    assert.match(out.text, /₦45,000 of ₦150,000/);
    assert.match(out.text, /30%/);
    assert.match(out.text, /Emergency fund/);
  });

  test('prompts for a first goal when there are none', () => {
    const store = new FakeStore();
    const out = routeMessage('goals', makeData({ goals: [] }), null, store.deps);
    assert.match(out.text, /no savings goal/i);
  });
});

describe('Insights reply', () => {
  test('names the biggest category and a spending pace', () => {
    const store = new FakeStore();
    const out = routeMessage('insights', makeData(), null, store.deps);
    assert.match(out.text, /Food/);
    assert.match(out.text, /day/);
  });

  test('flags a goal that is behind its own pace', () => {
    const goals = [{
      name: 'Rent', targetAmountInKobo: 1500000, currentAmountInKobo: 100000,
      targetDate: '2026-10-22T09:00:00.000Z', contributionPerCycleInKobo: 100000, contributionFrequency: 'weekly', isPaused: false,
    }];
    const lines = buildInsights(makeData({ goals }), '2026-10-15T09:00:00.000Z');
    assert.ok(lines.some(line => /behind/.test(line)), `expected a behind-pace line in ${JSON.stringify(lines)}`);
  });

  test('says there is nothing to analyse on a clean account', () => {
    const out = routeMessage('insights', makeData({
      totalIncomeInKobo: 0, totalExpensesInKobo: 0, balanceInKobo: 0, spentByCategory: {}, spentByBucket: {}, goals: [],
    }), null, new FakeStore().deps);
    assert.match(out.text, /no transactions yet|not enough/i);
  });
});

describe('Recording a transaction in one message', () => {
  let store: FakeStore;
  beforeEach(() => { store = new FakeStore(); });

  test('expense with amount and category is recorded immediately', () => {
    const out = routeMessage('spend 850 on data', makeData(), null, store.deps);
    assert.equal(store.recorded.length, 1);
    assert.equal(store.recorded[0].type, 'expense');
    assert.equal(store.recorded[0].amountInKobo, 85000);
    assert.equal(store.recorded[0].category, 'data_airtime');
    assert.equal(store.recorded[0].source, 'whatsapp');
    assert.match(out.text, /Recorded/);
    assert.match(out.text, /undo/i);
  });

  test('income wording records an income', () => {
    const out = routeMessage('i received 60000 allowance', makeData(), null, store.deps);
    assert.equal(store.recorded.length, 1);
    assert.equal(store.recorded[0].type, 'income');
    assert.equal(store.recorded[0].amountInKobo, 6000000);
    assert.equal(store.recorded[0].category, 'allowance');
    assert.match(out.text, /Recorded/);
  });
});

describe('Recording a transaction over several messages', () => {
  let store: FakeStore;
  beforeEach(() => { store = new FakeStore(); });

  test('bare "spend" asks for the amount without writing anything', () => {
    const out = routeMessage('spend', makeData(), null, store.deps);
    assert.equal(store.recorded.length, 0);
    assert.equal(out.session.stage, 'awaiting_amount');
    assert.match(out.text, /how much/i);
  });

  test('the amount then asks for a category and still writes nothing', () => {
    const first = routeMessage('spend', makeData(), null, store.deps);
    const second = routeMessage('1200', makeData(), first.session, store.deps);
    assert.equal(store.recorded.length, 0);
    assert.equal(second.session.stage, 'awaiting_category');
    assert.equal(second.session.draft?.amountInKobo, 120000);
    assert.match(second.text, /Food/);
  });

  test('a menu number finishes the flow and writes one expense', () => {
    const first = routeMessage('spend', makeData(), null, store.deps);
    const second = routeMessage('1200', makeData(), first.session, store.deps);
    const third = routeMessage('2', makeData(), second.session, store.deps);
    assert.equal(store.recorded.length, 1);
    assert.equal(store.recorded[0].category, CATEGORY_MENU[1].id);
    assert.equal(store.recorded[0].amountInKobo, 120000);
    assert.equal(third.session.stage, 'idle');
    assert.equal(third.session.lastRecordedId, 'tx-1');
  });

  test('a category word finishes the flow too', () => {
    const first = routeMessage('spend', makeData(), null, store.deps);
    const second = routeMessage('1200', makeData(), first.session, store.deps);
    const third = routeMessage('transport', makeData(), second.session, store.deps);
    assert.equal(store.recorded.length, 1);
    assert.equal(store.recorded[0].category, 'transport');
  });

  test('cancel abandons the draft', () => {
    const first = routeMessage('spend', makeData(), null, store.deps);
    const out = routeMessage('cancel', makeData(), first.session, store.deps);
    assert.equal(store.recorded.length, 0);
    assert.equal(out.session.stage, 'idle');
    assert.equal(out.session.draft, undefined);
  });

  test('text that is not an amount while awaiting one is re-asked', () => {
    const first = routeMessage('spend', makeData(), null, store.deps);
    const out = routeMessage('banana', makeData(), first.session, store.deps);
    assert.equal(store.recorded.length, 0);
    assert.equal(out.session.stage, 'awaiting_amount');
  });
});

describe('Undo', () => {
  test('deletes the transaction the bot just recorded', () => {
    const store = new FakeStore();
    const recorded = routeMessage('spend 850 on data', makeData(), null, store.deps);
    const session: BotSession = recorded.session;
    assert.equal(session.lastRecordedId, 'tx-1');
    const undone = routeMessage('undo', makeData(), session, store.deps);
    assert.deepEqual(store.deleted, ['tx-1']);
    assert.match(undone.text, /removed/i);
    assert.equal(undone.session.lastRecordedId, undefined);
  });

  test('undo with nothing to remove says so', () => {
    const store = new FakeStore();
    const out = routeMessage('undo', makeData(), null, store.deps);
    assert.equal(store.deleted.length, 0);
    assert.match(out.text, /nothing to undo/i);
  });

  test('undo still works after reading the balance in between', () => {
    const store = new FakeStore();
    const recorded = routeMessage('spend 850 on data', makeData(), null, store.deps);
    const readBack = routeMessage('balance', makeData(), recorded.session, store.deps);
    assert.equal(readBack.session.lastRecordedId, 'tx-1');
    const undone = routeMessage('undo', makeData(), readBack.session, store.deps);
    assert.deepEqual(store.deleted, ['tx-1']);
    assert.match(undone.text, /removed/i);
  });

  test('undo still works in the middle of an unrelated multi-turn draft', () => {
    const store = new FakeStore();
    const recorded = routeMessage('spend 850 on data', makeData(), null, store.deps);
    const started = routeMessage('spend', makeData(), recorded.session, store.deps);
    assert.equal(started.session.stage, 'awaiting_amount');
    const undone = routeMessage('undo', makeData(), started.session, store.deps);
    assert.deepEqual(store.deleted, ['tx-1']);
    assert.match(undone.text, /removed/i);
  });

  test('undo reports the balance actually restored by the deletion', () => {
    const store = new FakeStore();
    const recorded = routeMessage('spend 850 on data', makeData(), null, store.deps);
    const undone = routeMessage('undo', makeData(), recorded.session, store.deps);
    // Balance in the snapshot already includes the ₦850 expense, so removing it puts back ₦850.
    assert.match(undone.text, /₦42,350/);
  });

  test('undoing an income takes the credited amount back off', () => {
    const store = new FakeStore();
    const recorded = routeMessage('received 60000 allowance', makeData(), null, store.deps);
    assert.equal(store.recorded[0].type, 'income');
    const undone = routeMessage('undo', makeData(), recorded.session, store.deps);
    // The snapshot balance counted the ₦60,000 income, so removing it drops below zero.
    assert.match(undone.text, /-₦18,500/);
  });

  test('the description keeps the wording the user sent', () => {
    const store = new FakeStore();
    routeMessage('spend 400 for taxi to school', makeData(), null, store.deps);
    assert.equal(store.recorded[0].description, 'Taxi to school');
  });

  test('the recorded line does not repeat the category as its note', () => {
    const store = new FakeStore();
    const out = routeMessage('spend 850 on data', makeData(), null, store.deps);
    assert.equal(out.text.includes('Data & Airtime · Data'), false);
    assert.match(out.text, /₦850 → Data & Airtime/);
  });
});

describe('Linking a WhatsApp number to one account', () => {
  const ada = { id: 'u-ada', name: 'Ada', phoneNumber: '+2348012345678' };
  const zainab = { id: 'u-zainab', name: 'Zainab', phoneNumber: '+2348099998877' };
  const twin = { id: 'u-twin', name: 'Twin', phoneNumber: '+2348012345678' };

  test('returns the single account that owns the number', () => {
    assert.deepEqual(resolveLinkedUser([ada, zainab], '+2348012345678'), { status: 'linked', user: ada });
  });

  test('returns unlinked when nobody owns the number', () => {
    assert.deepEqual(resolveLinkedUser([zainab], '+2348012345678'), { status: 'unlinked' });
  });

  test('refuses to guess when two accounts share the number', () => {
    assert.deepEqual(resolveLinkedUser([ada, twin], '+2348012345678'), { status: 'ambiguous' });
  });

  test('an unusable phone never resolves', () => {
    assert.deepEqual(resolveLinkedUser([ada], null), { status: 'unlinked' });
  });
});

describe('Help and unknown messages', () => {
  test('help lists every capability the bot has', () => {
    const out = routeMessage('help', makeData(), null, new FakeStore().deps);
    for (const phrase of ['balance', 'spend', 'goals', 'insights']) {
      assert.match(out.text, new RegExp(phrase, 'i'));
    }
  });

  test('unknown text points at help instead of failing silently', () => {
    const out = routeMessage('what is the weather', makeData(), null, new FakeStore().deps);
    assert.match(out.text, /balance|help/i);
  });
});
