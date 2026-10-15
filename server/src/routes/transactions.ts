import { Router, Request, Response } from 'express';
import db from '../models/database.js';
import { authMiddleware } from './auth.js';
import { generateId } from '../utils/helpers.js';

const router = Router();

router.use(authMiddleware);

router.get('/', (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const { type, category, bucket, limit } = req.query as Record<string, string>;

  const transactions = db.transactions.findByUser(userId, {
    type,
    category,
    bucket,
    limit: limit ? Number(limit) : undefined,
  });

  res.json(transactions);
});

router.get('/summary', (req: Request, res: Response) => {
  const userId = (req as any).userId;
  res.json(db.transactions.summary(userId));
});

router.post('/', (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const { type, amountInKobo, category, description, date, merchant, paymentMethod, budgetBucket, notes, source } = req.body;

  if (!type || amountInKobo == null || !category) {
    return res.status(400).json({ error: 'Type, amountInKobo, and category are required' });
  }

  const transaction = db.transactions.create({
    id: generateId(),
    userId,
    type,
    amountInKobo: Number(amountInKobo),
    category,
    description: description || '',
    date: date || new Date().toISOString(),
    merchant: merchant || null,
    paymentMethod: paymentMethod || null,
    budgetBucket: budgetBucket || 'essentials',
    notes: notes || null,
    source: source || 'manual',
    syncStatus: 'synced',
  });

  res.status(201).json(transaction);
});

router.put('/:id', (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const id = String(req.params.id);

  const existing = db.transactions.findByUser(userId).find(t => t.id === id);
  if (!existing) return res.status(404).json({ error: 'Transaction not found' });

  const allowed = ['type', 'amountInKobo', 'category', 'description', 'date', 'merchant', 'paymentMethod', 'budgetBucket', 'notes', 'source'];
  const updates: Record<string, any> = {};
  allowed.forEach(field => {
    if (req.body[field] !== undefined) updates[field] = req.body[field];
  });

  res.json(db.transactions.update(id, userId, updates));
});

router.delete('/:id', (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const id = String(req.params.id);

  const existing = db.transactions.findByUser(userId).find(t => t.id === id);
  if (!existing) return res.status(404).json({ error: 'Transaction not found' });

  db.transactions.delete(id, userId);
  res.json({ success: true });
});

export default router;
