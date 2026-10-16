import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { planLedgerMerge, prepareIncoming, type MergeRow } from './sync.js';

function row(id: string, updatedAt: string, extra: Record<string, unknown> = {}): MergeRow {
  return { id, userId: 'u1', updatedAt, ...extra };
}

describe('Ledger merge for app <-> Telegram sync', () => {
  test('unknown ids are inserted', () => {
    const plan = planLedgerMerge([], [row('t1', '2026-10-15T10:00:00.000Z')], []);
    assert.deepEqual(plan.writes.map(w => w.id), ['t1']);
    assert.deepEqual(plan.deletes, []);
  });

  test('a newer incoming row replaces the stored one', () => {
    const stored = [row('t1', '2026-10-14T10:00:00.000Z', { amountInKobo: 50000 })];
    const incoming = [row('t1', '2026-10-15T10:00:00.000Z', { amountInKobo: 85000 })];
    const plan = planLedgerMerge(stored, incoming, []);
    assert.equal(plan.writes.length, 1);
    assert.equal(plan.writes[0].amountInKobo, 85000);
  });

  test('an older incoming row loses to the stored copy', () => {
    const stored = [row('t1', '2026-10-15T12:00:00.000Z', { amountInKobo: 85000 })];
    const incoming = [row('t1', '2026-10-15T09:00:00.000Z', { amountInKobo: 50000 })];
    const plan = planLedgerMerge(stored, incoming, []);
    assert.equal(plan.writes.length, 0);
    assert.deepEqual(plan.conflicts, ['t1']);
  });

  test('an identical timestamp is not rewritten', () => {
    const stored = [row('t1', '2026-10-15T10:00:00.000Z')];
    const plan = planLedgerMerge(stored, [row('t1', '2026-10-15T10:00:00.000Z')], []);
    assert.equal(plan.writes.length, 0);
  });

  test('a deleted id removes the row and blocks an older incoming copy', () => {
    const stored = [row('t1', '2026-10-14T10:00:00.000Z'), row('t2', '2026-10-14T10:00:00.000Z')];
    const incoming = [row('t1', '2026-10-13T10:00:00.000Z')];
    const plan = planLedgerMerge(stored, incoming, ['t1']);
    assert.deepEqual(plan.deletes, ['t1']);
    assert.equal(plan.writes.length, 0);
  });

  test('a row deleted then re-recorded newer than the delete wins over the tombstone', () => {
    const stored = [row('t1', '2026-10-14T10:00:00.000Z', { amountInKobo: 50000 })];
    const incoming = [row('t1', '2026-10-15T10:00:00.000Z', { amountInKobo: 60000 })];
    const plan = planLedgerMerge(stored, incoming, ['t1']);
    assert.deepEqual(plan.deletes, []);
    assert.equal(plan.writes.length, 1);
  });

  test('rows the client no longer holds but the server kept are not treated as deletes', () => {
    const stored = [row('bot1', '2026-10-15T10:00:00.000Z')];
    const plan = planLedgerMerge(stored, [], []);
    assert.deepEqual(plan.deletes, []);
    assert.deepEqual(plan.serverOnly, ['bot1']);
  });

  test('tombstones for ids the server never had are dropped', () => {
    const plan = planLedgerMerge([], [], ['ghost']);
    assert.deepEqual(plan.deletes, []);
  });

  test('incoming rows from another account are ignored', () => {
    const foreign = { id: 't9', userId: 'u2', updatedAt: '2026-10-15T10:00:00.000Z' };
    const plan = planLedgerMerge([row('t9', '2026-10-14T10:00:00.000Z')], [foreign], ['t9']);
    assert.equal(plan.writes.length, 0);
    assert.deepEqual(plan.deletes, []);
  });

  test('a client row that carries its own last-edit time keeps it', () => {
    const stamped = prepareIncoming([row('t1', '2026-10-14T10:00:00.000Z')], '2026-10-15T09:00:00.000Z');
    assert.equal(stamped[0].updatedAt, '2026-10-14T10:00:00.000Z');
  });

  test('a row the client never stamped is stamped with the push time', () => {
    const stamped = prepareIncoming([{ id: 't2', userId: 'u1' }], '2026-10-15T09:00:00.000Z');
    assert.equal(stamped[0].updatedAt, '2026-10-15T09:00:00.000Z');
  });
});
