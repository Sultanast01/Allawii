import { Router, Request, Response } from 'express';
import db from '../models/database.js';
import { authMiddleware } from './auth.js';
import { generateId } from '../utils/helpers.js';
import {
  createBMoniUser,
  listBMoniUsers,
  getBMoniUser,
  getKycReadiness,
  getOnboardingStatus,
  listNigerianBanks,
  verifyNigerianAccount,
  getExchangeRate,
  supportedCurrencies,
} from '../services/bmoni.js';

const router = Router();

router.use(authMiddleware);

/** Provision a real sandbox identity for the signed-in Moneva user. */
router.post('/connect', async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const existing = db.bmoniAccounts.findByUser(userId) as any;
  if (existing?.bmoniUserId) {
    const profile = await getBMoniUser(existing.bmoniUserId);
    return res.json({
      alreadyConnected: true,
      bmoniUserId: existing.bmoniUserId,
      user: profile.success ? profile.data : existing.profile,
    });
  }

  const localUser = db.users.findById(userId) as any;
  const { firstName, lastName, email, phoneNumber } = req.body || {};

  const fullName = String(localUser?.name || 'Moneva Student').trim().split(' ');
  const sandboxEmail = email || localUser?.email || `moneva-${generateId()}@example.com`;
  const sandboxPhone = phoneNumber || localUser?.phoneNumber || '+2348023000001';

  const result = await createBMoniUser({
    firstName: firstName || fullName[0] || 'Moneva',
    lastName: lastName || fullName.slice(1).join(' ') || 'Student',
    email: sandboxEmail,
    phoneNumber: sandboxPhone,
  });

  let created = (result.data as any)?.user ?? (result as any).data;

  // The shared sandbox rejects duplicate phone/email; reuse the identity we already own.
  if (!result.success) {
    const all = await listBMoniUsers();
    const match = all.success
      ? ((all.data as any)?.users ?? []).find(
          (u: any) => u.email === sandboxEmail || u.phoneNumber === sandboxPhone
        )
      : undefined;
    if (match) {
      created = match;
    } else {
      return res.status(502).json({ error: result.error || 'Sandbox could not create a test user' });
    }
  }

  const account = {
    id: generateId(),
    userId,
    bmoniUserId: created?.bmoniUserId || null,
    partnerUserId: created?.id || null,
    profile: created,
    createdAt: new Date().toISOString(),
  };
  db.bmoniAccounts.create(account);

  res.status(201).json({
    alreadyConnected: false,
    bmoniUserId: account.bmoniUserId,
    partnerUserId: account.partnerUserId,
    user: created,
  });
});

/** Sandbox identity plus live KYC / onboarding / currency state. */
router.get('/status', async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const account = db.bmoniAccounts.findByUser(userId) as any;
  if (!account?.bmoniUserId) {
    return res.status(404).json({ error: 'No sandbox identity linked yet' });
  }

  const [profile, readiness, onboarding, currencies] = await Promise.all([
    getBMoniUser(account.bmoniUserId),
    getKycReadiness(account.bmoniUserId),
    getOnboardingStatus(account.bmoniUserId),
    supportedCurrencies(),
  ]);

  res.json({
    bmoniUserId: account.bmoniUserId,
    partnerUserId: account.partnerUserId,
    profile: profile.success ? profile.data : null,
    kycReadiness: readiness.success ? readiness.data : null,
    onboarding: onboarding.success ? onboarding.data : null,
    supportedCurrencies: currencies.success ? (currencies.data as any)?.currencies ?? [] : [],
    linkedAt: account.createdAt,
  });
});

/** Live NGN rate — powers inflation-aware goal views. */
router.get('/rate', async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const account = db.bmoniAccounts.findByUser(userId) as any;
  if (!account?.bmoniUserId) return res.status(404).json({ error: 'No sandbox identity linked yet' });

  const to = String(req.query.to || 'USD').toUpperCase();
  const rate = await getExchangeRate(account.bmoniUserId, 'NGN', to);
  if (!rate.success) return res.status(502).json({ error: rate.error });
  res.json(rate.data);
});

/** Real B Moni list of Nigerian banks (CBN codes). */
router.get('/banks', async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const account = db.bmoniAccounts.findByUser(userId) as any;
  if (!account?.bmoniUserId) return res.status(404).json({ error: 'No sandbox identity linked yet' });

  const banks = await listNigerianBanks(account.bmoniUserId);
  if (!banks.success) return res.status(502).json({ error: banks.error });
  res.json((banks.data as any)?.banks ?? []);
});

/** Resolve the registered name on a NUBAN before paying anyone. */
router.post('/verify-account', async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const account = db.bmoniAccounts.findByUser(userId) as any;
  if (!account?.bmoniUserId) return res.status(404).json({ error: 'No sandbox identity linked yet' });

  const bankCode = String(req.body?.bankCode || '').trim();
  const accountNumber = String(req.body?.accountNumber || '').trim();

  if (!/^\d{10}$/.test(accountNumber)) {
    return res.status(400).json({ error: 'Account number must be exactly 10 digits' });
  }
  if (!bankCode) return res.status(400).json({ error: 'bankCode is required' });

  const result = await verifyNigerianAccount(account.bmoniUserId, bankCode, accountNumber);
  if (!result.success) return res.status(502).json({ error: result.error });
  res.json(result.data);
});

export default router;
