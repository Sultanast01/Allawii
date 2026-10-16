export interface MergeRow {
  id: string;
  userId?: string;
  updatedAt?: string;
  [key: string]: unknown;
}

export interface MergePlan {
  writes: MergeRow[];
  deletes: string[];
  conflicts: string[];
  serverOnly: string[];
}

function stamp(row: MergeRow | undefined): number {
  if (!row?.updatedAt) return 0;
  const value = Date.parse(String(row.updatedAt));
  return Number.isNaN(value) ? 0 : value;
}

/**
 * Keep the client's own last-edit time so an unchanged row re-pushed after a pull
 * is recognised as identical instead of rewriting the whole ledger on every save.
 */
export function prepareIncoming(rows: MergeRow[], now: string): MergeRow[] {
  return rows.map(row => (stamp(row) ? row : { ...row, updatedAt: now }));
}

/**
 * Last-write-wins merge that never deletes a row a client cannot see —
 * Telegram-recorded rows live on the server before the app has ever heard of them.
 */
export function planLedgerMerge(stored: MergeRow[], incoming: MergeRow[], deletedIds: string[]): MergePlan {
  const storedById = new Map(stored.map(row => [row.id, row]));
  const incomingById = new Map(incoming.map(row => [row.id, row]));

  const writes: MergeRow[] = [];
  const conflicts: string[] = [];
  const foreignIds = new Set<string>();

  for (const [id, next] of incomingById) {
    const current = storedById.get(id);
    if (current && next.userId && current.userId && next.userId !== current.userId) {
      foreignIds.add(id);
      continue;
    }
    if (!current) {
      writes.push(next);
      continue;
    }
    if (stamp(next) > stamp(current)) writes.push(next);
    else if (stamp(next) < stamp(current)) conflicts.push(id);
  }

  const deletes: string[] = [];
  for (const id of deletedIds) {
    const current = storedById.get(id);
    if (!current || foreignIds.has(id)) continue;
    const next = incomingById.get(id);
    if (next && stamp(next) > stamp(current)) continue;
    deletes.push(id);
  }

  const incomingIds = new Set(incomingById.keys());
  const deleteSet = new Set(deletes);
  const serverOnly = stored.filter(row => !incomingIds.has(row.id) && !deleteSet.has(row.id)).map(row => row.id);

  return { writes, deletes, conflicts, serverOnly };
}
