import { supabaseAdmin } from '../lib/supabase.js';

/**
 * Supabase Postgres repository. The Express server is the only writer:
 * every table lives in `public` with RLS enabled but no policies, reachable
 * through the service-role client. Date-like columns are stored as ISO text
 * so rows round-trip through JS without timezone drift.
 */

type Row = Record<string, any>;

const toSnake = (camel: string): string => camel.replace(/[A-Z]/g, c => `_${c.toLowerCase()}`);
const toCamel = (snake: string): string => snake.replace(/_([a-z])/g, (_m, c: string) => c.toUpperCase());

function mapRow<T = any>(row: Row | null | undefined, columns: readonly string[]): T | null {
  if (!row) return null;
  const out: Row = {};
  for (const column of columns) {
    const snake = toSnake(column);
    if (snake in row) out[column] = row[snake];
  }
  return out as T;
}

function mapWrite(row: Row): Row {
  const out: Row = {};
  for (const [key, value] of Object.entries(row)) {
    if (value === undefined) continue;
    out[toSnake(key)] = value;
  }
  return out;
}

async function selectAll(table: string, userIdColumn: 'user_id' | 'id', userId: string, orderColumn?: string): Promise<Row[]> {
  let query = supabaseAdmin().from(table).select('*').eq(userIdColumn, userId);
  if (orderColumn) query = query.order(orderColumn);
  const { data, error } = await query;
  if (error) throw new Error(`${table} select failed: ${error.message}`);
  return data ?? [];
}

const PROFILE_COLUMNS = ['id', 'name', 'email', 'university', 'phoneNumber', 'incomeFrequency', 'typicalIncomeInKobo', 'nextIncomeDate', 'isDemo', 'botLinkCode', 'botLinkExpiresAt', 'streakDates', 'createdAt'] as const;
const TRANSACTION_COLUMNS = ['id', 'userId', 'type', 'amountInKobo', 'category', 'description', 'date', 'merchant', 'paymentMethod', 'budgetBucket', 'notes', 'source', 'syncStatus', 'updatedAt'] as const;
const GOAL_COLUMNS = ['id', 'userId', 'name', 'targetAmountInKobo', 'currentAmountInKobo', 'targetDate', 'contributionPerCycleInKobo', 'contributionFrequency', 'progress', 'isPaused', 'contributionDates', 'savingsType', 'withdrawalDate', 'createdAt', 'updatedAt'] as const;
const BUDGET_COLUMNS = ['userId', 'category', 'name', 'bucket', 'allocatedInKobo', 'updatedAt'] as const;
const BMONI_COLUMNS = ['id', 'userId', 'bmoniUserId', 'partnerUserId', 'profile', 'createdAt'] as const;
const SETTINGS_COLUMNS = ['userId', 'enabled', 'roundUpToInKobo', 'thresholdInKobo', 'targetGoalId', 'targetWalletAddress', 'fromCurrency', 'toCurrency', 'lastSweepAt'] as const;
const LEDGER_COLUMNS = ['id', 'userId', 'transactionId', 'originalAmountInKobo', 'roundedUpInKobo', 'spareChangeInKobo', 'status', 'createdAt', 'sweptAt', 'quoteData', 'transferData'] as const;

let goalExtras: boolean | null = null;

const db = {
  users: {
    find: async (email: string) => {
      const { data, error } = await supabaseAdmin().from('profiles').select('*').eq('email', email).maybeSingle();
      if (error) throw new Error(`users.find failed: ${error.message}`);
      return mapRow(data, PROFILE_COLUMNS);
    },
    findById: async (id: string) => {
      const { data, error } = await supabaseAdmin().from('profiles').select('*').eq('id', id).maybeSingle();
      if (error) throw new Error(`users.findById failed: ${error.message}`);
      return mapRow(data, PROFILE_COLUMNS);
    },
    findByPhone: async (phone: string) => {
      const { data, error } = await supabaseAdmin().from('profiles').select('*').eq('phone_number', phone).maybeSingle();
      if (error) throw new Error(`users.findByPhone failed: ${error.message}`);
      return mapRow<any>(data, PROFILE_COLUMNS);
    },
    findByBotLinkCode: async (code: string) => {
      const { data, error } = await supabaseAdmin().from('profiles').select('*').eq('bot_link_code', code).maybeSingle();
      if (error) throw new Error(`users.findByBotLinkCode failed: ${error.message}`);
      return mapRow<any>(data, PROFILE_COLUMNS);
    },
    create: async (user: Row) => {
      const { error } = await supabaseAdmin().from('profiles').insert(mapWrite(user));
      if (error) throw new Error(`users.create failed: ${error.message}`);
      return user;
    },
    update: async (id: string, updates: Row) => {
      const { error } = await supabaseAdmin().from('profiles').update(mapWrite(updates)).eq('id', id);
      if (error) throw new Error(`users.update failed: ${error.message}`);
      return db.users.findById(id);
    },
  },

  transactions: {
    findByUser: async (userId: string, filters?: { type?: string; category?: string; bucket?: string; limit?: number }) => {
      let query = supabaseAdmin().from('transactions').select('*').eq('user_id', userId);
      if (filters?.type) query = query.eq('type', filters.type);
      if (filters?.category) query = query.eq('category', filters.category);
      if (filters?.bucket) query = query.eq('budget_bucket', filters.bucket);
      query = query.order('date', { ascending: false });
      if (filters?.limit) query = query.limit(filters.limit);
      const { data, error } = await query;
      if (error) throw new Error(`transactions.findByUser failed: ${error.message}`);
      return (data ?? []).map(row => mapRow(row, TRANSACTION_COLUMNS));
    },
    findById: async (id: string, userId: string) => {
      const { data, error } = await supabaseAdmin().from('transactions').select('*').eq('id', id).eq('user_id', userId).maybeSingle();
      if (error) throw new Error(`transactions.findById failed: ${error.message}`);
      return mapRow(data, TRANSACTION_COLUMNS);
    },
    create: async (tx: Row) => {
      const { error } = await supabaseAdmin().from('transactions').insert(mapWrite(tx));
      if (error) throw new Error(`transactions.create failed: ${error.message}`);
      return tx;
    },
    update: async (id: string, userId: string, updates: Row) => {
      const { error } = await supabaseAdmin().from('transactions').update(mapWrite(updates)).eq('id', id).eq('user_id', userId);
      if (error) throw new Error(`transactions.update failed: ${error.message}`);
      return db.transactions.findById(id, userId);
    },
    delete: async (id: string, userId: string) => {
      const { error } = await supabaseAdmin().from('transactions').delete().eq('id', id).eq('user_id', userId);
      if (error) throw new Error(`transactions.delete failed: ${error.message}`);
    },
    summary: async (userId: string) => {
      const rows = (await db.transactions.findByUser(userId)) as any[];
      const income = rows.filter(t => t.type === 'income').reduce((s, t) => s + (Number(t.amountInKobo) || 0), 0);
      const expenses = rows.filter(t => t.type === 'expense').reduce((s, t) => s + (Number(t.amountInKobo) || 0), 0);
      const byBucket: Record<string, number> = {};
      const byCategory: Record<string, number> = {};
      rows.filter(t => t.type === 'expense').forEach(t => {
        byBucket[t.budgetBucket] = (byBucket[t.budgetBucket] || 0) + (Number(t.amountInKobo) || 0);
        byCategory[t.category] = (byCategory[t.category] || 0) + (Number(t.amountInKobo) || 0);
      });
      return { totalIncomeInKobo: income, totalExpensesInKobo: expenses, balanceInKobo: income - expenses, byBucket, byCategory };
    },
  },

  savingsGoals: {
    /**
     * `savings_type` and `withdrawal_date` were added after the first deploy, so a project that
     * has not re-run schema.sql yet has no such columns. The writer asks once, caches the answer,
     * and leaves the fields out until the migration lands instead of failing the whole batch.
     */
    supportsExtras: async (): Promise<boolean> => {
      if (goalExtras !== null) return goalExtras;
      const { error } = await supabaseAdmin().from('savings_goals').select('savings_type, withdrawal_date').limit(0);
      goalExtras = !error;
      return goalExtras;
    },
    findByUser: async (userId: string) => {
      const rows = await selectAll('savings_goals', 'user_id', userId);
      return rows.map(row => mapRow(row, GOAL_COLUMNS));
    },
    findById: async (id: string, userId: string) => {
      const { data, error } = await supabaseAdmin().from('savings_goals').select('*').eq('id', id).eq('user_id', userId).maybeSingle();
      if (error) throw new Error(`savingsGoals.findById failed: ${error.message}`);
      return mapRow(data, GOAL_COLUMNS);
    },
    create: async (goal: Row) => {
      const { error } = await supabaseAdmin().from('savings_goals').insert(mapWrite(goal));
      if (error) throw new Error(`savingsGoals.create failed: ${error.message}`);
      return goal;
    },
    update: async (id: string, userId: string, updates: Row) => {
      const { error } = await supabaseAdmin().from('savings_goals').update(mapWrite(updates)).eq('id', id).eq('user_id', userId);
      if (error) throw new Error(`savingsGoals.update failed: ${error.message}`);
      return db.savingsGoals.findById(id, userId);
    },
    delete: async (id: string, userId: string) => {
      const { error } = await supabaseAdmin().from('savings_goals').delete().eq('id', id).eq('user_id', userId);
      if (error) throw new Error(`savingsGoals.delete failed: ${error.message}`);
    },
  },

  budgetPlans: {
    findByUser: async (userId: string) => {
      const rows = await selectAll('budget_plans', 'user_id', userId);
      return rows.map(row => mapRow(row, BUDGET_COLUMNS));
    },
    replaceForUser: async (userId: string, plans: Row[]) => {
      const supabase = supabaseAdmin();
      const { error: delError } = await supabase.from('budget_plans').delete().eq('user_id', userId);
      if (delError) throw new Error(`budgetPlans clear failed: ${delError.message}`);
      if (plans.length) {
        const { error } = await supabase.from('budget_plans').insert(plans.map(plan => mapWrite({ ...plan, userId })));
        if (error) throw new Error(`budgetPlans replace failed: ${error.message}`);
      }
      return plans;
    },
  },

  bmoniAccounts: {
    findByUser: async (userId: string) => {
      const { data, error } = await supabaseAdmin().from('bmoni_accounts').select('*').eq('user_id', userId).maybeSingle();
      if (error) throw new Error(`bmoniAccounts.findByUser failed: ${error.message}`);
      return mapRow(data, BMONI_COLUMNS);
    },
    create: async (account: Row) => {
      const { error } = await supabaseAdmin().from('bmoni_accounts').insert(mapWrite(account));
      if (error) throw new Error(`bmoniAccounts.create failed: ${error.message}`);
      return account;
    },
  },

  roundUpSettings: {
    findByUser: async (userId: string) => {
      const { data, error } = await supabaseAdmin().from('round_up_settings').select('*').eq('user_id', userId).maybeSingle();
      if (error) throw new Error(`roundUpSettings.findByUser failed: ${error.message}`);
      return mapRow<any>(data, SETTINGS_COLUMNS);
    },
    upsert: async (userId: string, settings: Row) => {
      const { error } = await supabaseAdmin()
        .from('round_up_settings')
        .upsert(mapWrite({ ...settings, userId }), { onConflict: 'user_id' });
      if (error) throw new Error(`roundUpSettings.upsert failed: ${error.message}`);
      return db.roundUpSettings.findByUser(userId);
    },
  },

  roundUpLedger: {
    findByUser: async (userId: string) => {
      const rows = await selectAll('round_up_ledger', 'user_id', userId, 'created_at');
      return rows.map(row => mapRow<any>(row, LEDGER_COLUMNS)).reverse();
    },
    create: async (entry: Row) => {
      const { error } = await supabaseAdmin().from('round_up_ledger').insert(mapWrite(entry));
      if (error) throw new Error(`roundUpLedger.create failed: ${error.message}`);
      return entry;
    },
    update: async (id: string, userId: string, updates: Row) => {
      const { error } = await supabaseAdmin().from('round_up_ledger').update(mapWrite(updates)).eq('id', id).eq('user_id', userId);
      if (error) throw new Error(`roundUpLedger.update failed: ${error.message}`);
      const rows = await selectAll('round_up_ledger', 'user_id', userId);
      return mapRow(rows.find(r => r.id === id), LEDGER_COLUMNS);
    },
  },

  botLinks: {
    link: async (chatId: string, userId: string) => {
      const { error } = await supabaseAdmin()
        .from('bot_links')
        .upsert({ chat_id: String(chatId), user_id: userId, created_at: new Date().toISOString() }, { onConflict: 'chat_id' });
      if (error) throw new Error(`botLinks.link failed: ${error.message}`);
    },
    findByChatId: async (chatId: string) => {
      const { data, error } = await supabaseAdmin().from('bot_links').select('*').eq('chat_id', String(chatId)).maybeSingle();
      if (error) throw new Error(`botLinks.findByChatId failed: ${error.message}`);
      return data ? { chatId: data.chat_id, userId: data.user_id, createdAt: data.created_at } : null;
    },
    findByUserId: async (userId: string) => {
      const { data, error } = await supabaseAdmin().from('bot_links').select('*').eq('user_id', userId).maybeSingle();
      if (error) throw new Error(`botLinks.findByUserId failed: ${error.message}`);
      return data ? { chatId: data.chat_id, userId: data.user_id, createdAt: data.created_at } : null;
    },
    all: async () => {
      const { data, error } = await supabaseAdmin().from('bot_links').select('chat_id,user_id');
      if (error) throw new Error(`botLinks.all failed: ${error.message}`);
      return (data || []).map(row => ({ chatId: String(row.chat_id), userId: String(row.user_id) }));
    },
  },
};

export { toCamel };
export default db;
