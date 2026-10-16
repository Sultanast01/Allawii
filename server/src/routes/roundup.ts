import { Router, Request, Response } from 'express';
import db from '../models/database.js';
import { authMiddleware } from './auth.js';
import { generateId } from '../utils/helpers.js';
import { getExchangeQuote, createTransfer } from '../services/bmoni.js';

const router = Router();

router.use(authMiddleware);

/** Round-up settings: threshold, target wallet, enabled flag. */
router.get('/settings', async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const settings = await db.roundUpSettings.findByUser(userId);
  res.json(settings || {
    userId,
    enabled: false,
    roundUpToInKobo: 5000,
    thresholdInKobo: 50000,
    targetGoalId: null,
    targetWalletAddress: null,
    fromCurrency: 'NGN',
    toCurrency: 'CNGN',
    lastSweepAt: null,
  });
});

router.put('/settings', async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const { enabled, roundUpToInKobo, thresholdInKobo, targetGoalId, targetWalletAddress, fromCurrency, toCurrency } = req.body || {};
  const settings = await db.roundUpSettings.upsert(userId, {
    enabled: enabled ?? false,
    roundUpToInKobo: roundUpToInKobo ?? 5000,
    thresholdInKobo: thresholdInKobo ?? 50000,
    targetGoalId: targetGoalId ?? null,
    targetWalletAddress: targetWalletAddress ?? null,
    fromCurrency: fromCurrency ?? 'NGN',
    toCurrency: toCurrency ?? 'CNGN',
  });
  res.json(settings);
});

/** Accrued spare change + recent ledger entries. */
router.get('/status', async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const stored = await db.roundUpSettings.findByUser(userId);
  const settings = stored || {
    userId,
    enabled: false,
    roundUpToInKobo: 5000,
    thresholdInKobo: 50000,
    targetGoalId: null,
    targetWalletAddress: null,
    fromCurrency: 'NGN',
    toCurrency: 'CNGN',
  };
  const ledger = (await db.roundUpLedger.findByUser(userId)).slice(0, 20);
  const accrued = ledger
    .filter(e => e.status === 'accrued')
    .reduce((sum, e) => sum + (e.spareChangeInKobo || 0), 0);

  res.json({
    settings,
    accruedInKobo: accrued,
    recentEntries: ledger,
  });
});

/**
 * Calculate spare change from recent transactions.
 * For each expense, round up to the nearest `roundUpTo` and sum the differences.
 */
router.post('/calculate', async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const settings = await db.roundUpSettings.findByUser(userId);
  if (!settings?.enabled) {
    return res.status(400).json({ error: 'Round-up is not enabled' });
  }

  const roundUpTo = settings.roundUpToInKobo || 5000;
  const transactions = await db.transactions.findByUser(userId, { type: 'expense', limit: 50 });

  const processedIds = new Set(
    (await db.roundUpLedger.findByUser(userId)).map(e => e.transactionId)
  );

  const newEntries: any[] = [];
  let totalSpare = 0;

  for (const tx of transactions) {
    if (processedIds.has(tx.id)) continue;

    const amountInKobo = Number(tx.amountInKobo || 0);
    if (amountInKobo <= 0) continue;

    const roundedUp = Math.ceil(amountInKobo / roundUpTo) * roundUpTo;
    const spareChange = roundedUp - amountInKobo;

    if (spareChange > 0) {
      const entry = {
        id: generateId(),
        userId,
        transactionId: tx.id,
        originalAmountInKobo: amountInKobo,
        roundedUpInKobo: roundedUp,
        spareChangeInKobo: spareChange,
        status: 'accrued',
        createdAt: new Date().toISOString(),
      };
      await db.roundUpLedger.create(entry);
      newEntries.push(entry);
      totalSpare += entry.spareChangeInKobo;
    }
  }

  res.json({
    processed: newEntries.length,
    totalSpareChangeInKobo: totalSpare,
    entries: newEntries,
  });
});

/**
 * Sweep accrued spare change into the target wallet via B Moni.
 * Requires: deployed smart wallet, accrued amount >= threshold.
 */
router.post('/sweep', async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const settings = await db.roundUpSettings.findByUser(userId);
  if (!settings?.enabled) {
    return res.status(400).json({ error: 'Round-up is not enabled' });
  }
  if (!settings.targetWalletAddress) {
    return res.status(400).json({ error: 'No target wallet configured. Deploy a smart wallet first.' });
  }

  const bmoniAccount = await db.bmoniAccounts.findByUser(userId) as any;
  if (!bmoniAccount?.bmoniUserId) {
    return res.status(400).json({ error: 'No B Moni identity linked. Connect via /bmoni/connect first.' });
  }

  const ledger = await db.roundUpLedger.findByUser(userId);
  const accruedEntries = ledger.filter(e => e.status === 'accrued');
  const totalAccrued = accruedEntries.reduce((sum, e) => sum + (e.spareChangeInKobo || 0), 0);

  if (totalAccrued < (settings.thresholdInKobo || 50000)) {
    return res.status(400).json({
      error: `Accrued ${totalAccrued} kobo is below threshold ${settings.thresholdInKobo || 50000} kobo`,
      accruedInKobo: totalAccrued,
      thresholdInKobo: settings.thresholdInKobo || 50000,
    });
  }

  try {
    const quoteResult = await getExchangeQuote(bmoniAccount.bmoniUserId, {
      fromCurrency: settings.fromCurrency || 'NGN',
      toCurrency: settings.toCurrency || 'CNGN',
      amount: totalAccrued / 100,
    });

    if (!quoteResult.success) {
      return res.status(502).json({ error: quoteResult.error || 'Exchange quote failed' });
    }

    const transferResult = await createTransfer(bmoniAccount.bmoniUserId, {
      fromCurrency: settings.fromCurrency || 'NGN',
      toCurrency: settings.toCurrency || 'CNGN',
      amount: totalAccrued / 100,
      destinationWalletAddress: settings.targetWalletAddress,
    });

    if (!transferResult.success) {
      return res.status(502).json({ error: transferResult.error || 'Transfer failed' });
    }

    for (const entry of accruedEntries) {
      await db.roundUpLedger.update(entry.id, userId, {
        status: 'swept',
        sweptAt: new Date().toISOString(),
        quoteData: quoteResult.data,
        transferData: transferResult.data,
      });
    }

    await db.roundUpSettings.upsert(userId, { lastSweepAt: new Date().toISOString() });

    res.json({
      success: true,
      sweptInKobo: totalAccrued,
      quote: quoteResult.data,
      transfer: transferResult.data,
    });
  } catch (error) {
    console.error('Round-up sweep failed:', error);
    res.status(500).json({ error: 'Sweep failed' });
  }
});

export default router;
