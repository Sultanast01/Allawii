import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = join(__dirname, '..', '..', 'data');
const dbPath = join(dataDir, 'moneva.json');

if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true });

interface Database {
  users: any[];
  transactions: any[];
  savingsGoals: any[];
  obligations: any[];
  bmoniAccounts: any[];
}

function loadDb(): Database {
  if (existsSync(dbPath)) {
    return JSON.parse(readFileSync(dbPath, 'utf-8'));
  }
  const empty: Database = { users: [], transactions: [], savingsGoals: [], obligations: [], bmoniAccounts: [] };
  writeFileSync(dbPath, JSON.stringify(empty, null, 2));
  return empty;
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
      const income = txs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
      const expenses = txs.filter(t => t.type === 'expense').reduce((s, t) => s + t.amount, 0);
      const byBucket: Record<string, number> = {};
      const byCategory: Record<string, number> = {};
      txs.filter(t => t.type === 'expense').forEach(t => {
        byBucket[t.budgetBucket] = (byBucket[t.budgetBucket] || 0) + t.amount;
        byCategory[t.category] = (byCategory[t.category] || 0) + t.amount;
      });
      return { totalIncome: income, totalExpenses: expenses, balance: income - expenses, byBucket, byCategory };
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
};

export default db;
