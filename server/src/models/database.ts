import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = join(__dirname, '..', '..', 'data');
const dbPath = join(dataDir, 'allowii.json');

if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });

interface Database {
  users: any[];
  transactions: any[];
  savingsGoals: any[];
  obligations: any[];
  bmoniAccounts: any[];
  roundUpSettings: any[];
  roundUpLedger: any[];
}

function loadDb(): Database {
  if (existsSync(dbPath)) {
    const data = JSON.parse(readFileSync(dbPath, 'utf-8'));
    // Ensure new arrays exist for backwards compatibility
    if (!data.roundUpSettings) data.roundUpSettings = [];
    if (!data.roundUpLedger) data.roundUpLedger = [];
    // Migrate from naira to kobo if old field names are present
    if (needsKoboMigration(data)) {
      migrateToKobo(data);
      saveDb(data);
    }
    return data;
  }
  const empty: Database = { users: [], transactions: [], savingsGoals: [], obligations: [], bmoniAccounts: [], roundUpSettings: [], roundUpLedger: [] };
  writeFileSync(dbPath, JSON.stringify(empty, null, 2));
  return empty;
}

function needsKoboMigration(data: any): boolean {
  return data.users?.some((u: any) => u.typicalIncome !== undefined && u.typicalIncomeInKobo === undefined) ||
         data.transactions?.some((t: any) => t.amount !== undefined && t.amountInKobo === undefined);
}

function migrateToKobo(data: any): void {
  if (data.users) {
    data.users.forEach((u: any) => {
      if (u.typicalIncome !== undefined && u.typicalIncomeInKobo === undefined) {
        u.typicalIncomeInKobo = Math.round(u.typicalIncome * 100);
        delete u.typicalIncome;
      }
    });
  }
  if (data.transactions) {
    data.transactions.forEach((t: any) => {
      if (t.amount !== undefined && t.amountInKobo === undefined) {
        t.amountInKobo = Math.round(t.amount * 100);
        delete t.amount;
      }
    });
  }
  if (data.savingsGoals) {
    data.savingsGoals.forEach((g: any) => {
      if (g.targetAmount !== undefined && g.targetAmountInKobo === undefined) {
        g.targetAmountInKobo = Math.round(g.targetAmount * 100);
        delete g.targetAmount;
      }
      if (g.currentAmount !== undefined && g.currentAmountInKobo === undefined) {
        g.currentAmountInKobo = Math.round(g.currentAmount * 100);
        delete g.currentAmount;
      }
      if (g.contributionPerCycle !== undefined && g.contributionPerCycleInKobo === undefined) {
        g.contributionPerCycleInKobo = Math.round(g.contributionPerCycle * 100);
        delete g.contributionPerCycle;
      }
    });
  }
  if (data.obligations) {
    data.obligations.forEach((o: any) => {
      if (o.amount !== undefined && o.amountInKobo === undefined) {
        o.amountInKobo = Math.round(o.amount * 100);
        delete o.amount;
      }
    });
  }
  if (data.roundUpSettings) {
    data.roundUpSettings.forEach((s: any) => {
      if (s.roundUpTo !== undefined && s.roundUpToInKobo === undefined) {
        s.roundUpToInKobo = Math.round(s.roundUpTo * 100);
        delete s.roundUpTo;
      }
      if (s.threshold !== undefined && s.thresholdInKobo === undefined) {
        s.thresholdInKobo = Math.round(s.threshold * 100);
        delete s.threshold;
      }
    });
  }
  if (data.roundUpLedger) {
    data.roundUpLedger.forEach((e: any) => {
      if (e.spareChange !== undefined && e.spareChangeInKobo === undefined) {
        e.spareChangeInKobo = Math.round(e.spareChange * 100);
        delete e.spareChange;
      }
      if (e.originalAmount !== undefined && e.originalAmountInKobo === undefined) {
        e.originalAmountInKobo = Math.round(e.originalAmount * 100);
        delete e.originalAmount;
      }
      if (e.roundedUp !== undefined && e.roundedUpInKobo === undefined) {
        e.roundedUpInKobo = Math.round(e.roundedUp * 100);
        delete e.roundedUp;
      }
    });
  }
}

function saveDb(data: Database) {
  writeFileSync(dbPath, JSON.stringify(data, null, 2));
}

const db = {
  load: loadDb,
  save: saveDb,

  users: {
    find: (email: string) => loadDb().users.find(u => u.email === email),
    findById: (id: string) => loadDb().users.find(u => u.id === id),
    create: (user: any) => {
      const data = loadDb();
      data.users.push(user);
      saveDb(data);
      return user;
    },
    update: (id: string, updates: any) => {
      const data = loadDb();
      const idx = data.users.findIndex(u => u.id === id);
      if (idx >= 0) { data.users[idx] = { ...data.users[idx], ...updates }; saveDb(data); }
      return data.users[idx];
    },
  },

  transactions: {
    findByUser: (userId: string, filters?: { type?: string; category?: string; bucket?: string; limit?: number }) => {
      let txs = loadDb().transactions.filter(t => t.userId === userId);
      if (filters?.type) txs = txs.filter(t => t.type === filters.type);
      if (filters?.category) txs = txs.filter(t => t.category === filters.category);
      if (filters?.bucket) txs = txs.filter(t => t.budgetBucket === filters.bucket);
      txs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      if (filters?.limit) txs = txs.slice(0, filters.limit);
      return txs;
    },
    create: (tx: any) => {
      const data = loadDb();
      data.transactions.push(tx);
      saveDb(data);
      return tx;
    },
    update: (id: string, userId: string, updates: any) => {
      const data = loadDb();
      const idx = data.transactions.findIndex(t => t.id === id && t.userId === userId);
      if (idx >= 0) { data.transactions[idx] = { ...data.transactions[idx], ...updates }; saveDb(data); }
      return data.transactions[idx];
    },
    delete: (id: string, userId: string) => {
      const data = loadDb();
      data.transactions = data.transactions.filter(t => !(t.id === id && t.userId === userId));
      saveDb(data);
    },
    summary: (userId: string) => {
      const txs = loadDb().transactions.filter(t => t.userId === userId);
      const income = txs.filter(t => t.type === 'income').reduce((s, t) => s + (t.amountInKobo || 0), 0);
      const expenses = txs.filter(t => t.type === 'expense').reduce((s, t) => s + (t.amountInKobo || 0), 0);
      const byBucket: Record<string, number> = {};
      const byCategory: Record<string, number> = {};
      txs.filter(t => t.type === 'expense').forEach(t => {
        byBucket[t.budgetBucket] = (byBucket[t.budgetBucket] || 0) + (t.amountInKobo || 0);
        byCategory[t.category] = (byCategory[t.category] || 0) + (t.amountInKobo || 0);
      });
      return { totalIncomeInKobo: income, totalExpensesInKobo: expenses, balanceInKobo: income - expenses, byBucket, byCategory };
    },
  },

  bmoniAccounts: {
    findByUser: (userId: string) => loadDb().bmoniAccounts.find(a => a.userId === userId),
    create: (account: any) => {
      const data = loadDb();
      data.bmoniAccounts.push(account);
      saveDb(data);
      return account;
    },
  },

  roundUpSettings: {
    findByUser: (userId: string) => loadDb().roundUpSettings.find(s => s.userId === userId),
    upsert: (userId: string, settings: any) => {
      const data = loadDb();
      const idx = data.roundUpSettings.findIndex(s => s.userId === userId);
      if (idx >= 0) {
        data.roundUpSettings[idx] = { ...data.roundUpSettings[idx], ...settings };
        saveDb(data);
        return data.roundUpSettings[idx];
      }
      const newSettings = { userId, ...settings };
      data.roundUpSettings.push(newSettings);
      saveDb(data);
      return newSettings;
    },
  },

  roundUpLedger: {
    findByUser: (userId: string) => {
      const entries = loadDb().roundUpLedger.filter(e => e.userId === userId);
      entries.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      return entries;
    },
    create: (entry: any) => {
      const data = loadDb();
      data.roundUpLedger.push(entry);
      saveDb(data);
      return entry;
    },
    update: (id: string, userId: string, updates: any) => {
      const data = loadDb();
      const idx = data.roundUpLedger.findIndex(e => e.id === id && e.userId === userId);
      if (idx >= 0) {
        data.roundUpLedger[idx] = { ...data.roundUpLedger[idx], ...updates };
        saveDb(data);
        return data.roundUpLedger[idx];
      }
      return null;
    },
  },
};

export default db;
