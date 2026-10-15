import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import db from '../models/database.js';
import { authMiddleware } from './auth.js';
import { generateId } from '../utils/helpers.js';
import {
  resolveBMoniAccount,
  getBMoniUser,
  getKycReadiness,
  getKycOptions,
  getKycStatus,
  retryKycReview,
  listKycOccupations,
  getOnboardingStatus,
  startNigeriaOnboarding,
  getNgnWallet,
  submitKyc,
  activateKyc,
  getWalletBalances,
  getDepositAccounts,
  listNigerianBanks,
  verifyNigerianAccount,
  getExchangeRate,
  supportedCurrencies,
  createOwnerProofChallenge,
  createManagedSmartWallet,
  validateKycUpload,
  uploadIdentificationDocument,
  uploadProofOfAddressDocument,
  uploadBiometricDocument,
  type KycUploadFile,
} from '../services/bmoni.js';

const router = Router();

const kycUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 2 },
});

function parseKycFiles(req: Request): KycUploadFile[] {
  return ((req.files as Express.Multer.File[]) ?? []).map(f => ({
    buffer: f.buffer,
    mimeType: f.mimetype,
    originalName: f.originalname,
  }));
}

function kycDocRoute(
  kind: 'identification' | 'proof-of-address' | 'biometric',
  fieldName: string,
  maxCount: number
) {
  const upload = kycUpload.array(fieldName, maxCount);
  return [
    (req: Request, res: Response, next: NextFunction) => {
      upload(req, res, (err) => {
        if (err) {
          const detail = err instanceof multer.MulterError ? `File rejected: ${err.message}` : 'Upload could not be processed';
          return res.status(400).json({ error: detail });
        }
        next();
      });
    },
    async (req: Request, res: Response) => {
      const userId = (req as any).userId;
      const account = db.bmoniAccounts.findByUser(userId) as any;
      if (!account?.bmoniUserId) return res.status(404).json({ error: 'No sandbox identity linked yet' });

      const fields = {
        type: String(req.body?.type ?? ''),
        documentNumber: String(req.body?.documentNumber ?? ''),
        issuingCountry: String(req.body?.issuingCountry ?? ''),
      };
      const files = parseKycFiles(req);
      const validationError = validateKycUpload(kind, fields, files);
      if (validationError) return res.status(400).json({ error: validationError });

      const result = kind === 'identification'
        ? await uploadIdentificationDocument(account.bmoniUserId, {
            files,
            type: fields.type,
            documentNumber: fields.documentNumber,
            issuingCountry: fields.issuingCountry.toUpperCase(),
            issueDate: req.body?.issueDate,
            expirationDate: req.body?.expirationDate,
          })
        : kind === 'proof-of-address'
          ? await uploadProofOfAddressDocument(account.bmoniUserId, { files, type: fields.type })
          : await uploadBiometricDocument(account.bmoniUserId, { selfie: files, type: fields.type });

      if (!result.success) {
        return res.status(result.status && result.status >= 400 && result.status < 500 ? result.status : 502).json({ error: result.error });
      }
      res.json(result.data);
    },
  ];
}

router.use(authMiddleware);

/** Provision a real sandbox identity for the signed-in Allawii user. */
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

  const fullName = String(localUser?.name || 'Allawii Student').trim().split(' ');
  const sandboxEmail = email || localUser?.email || `allowii-${generateId()}@example.com`;
  const sandboxPhone = phoneNumber || localUser?.phoneNumber || '+2348023000001';

  const created = await resolveBMoniAccount({
    firstName: firstName || fullName[0] || 'Allawii',
    lastName: lastName || fullName.slice(1).join(' ') || 'Student',
    email: sandboxEmail,
    phoneNumber: sandboxPhone,
  });
  if (!created) {
    return res.status(502).json({ error: 'Sandbox could not create a test user' });
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

  const [profile, readiness, review, onboarding, currencies] = await Promise.all([
    getBMoniUser(account.bmoniUserId),
    getKycReadiness(account.bmoniUserId),
    getKycStatus(account.bmoniUserId),
    getOnboardingStatus(account.bmoniUserId),
    supportedCurrencies(),
  ]);

  res.json({
    bmoniUserId: account.bmoniUserId,
    partnerUserId: account.partnerUserId,
    profile: profile.success ? profile.data : null,
    kycReadiness: readiness.success ? readiness.data : null,
    kycReview: review.success ? review.data : null,
    onboarding: onboarding.success ? onboarding.data : null,
    supportedCurrencies: currencies.success ? (currencies.data as any)?.currencies ?? [] : [],
    linkedAt: account.createdAt,
  });
});

/** Patch the sandbox KYC record (identity + address) for the linked B Moni user. */
router.patch('/kyc', async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const account = db.bmoniAccounts.findByUser(userId) as any;
  if (!account?.bmoniUserId) return res.status(404).json({ error: 'No sandbox identity linked yet' });

  const result = await submitKyc(account.bmoniUserId, req.body ?? {});
  if (!result.success) return res.status(result.status && result.status >= 400 && result.status < 500 ? result.status : 502).json({ error: result.error });
  res.json(result.data);
});

/** Activate KYC once identity, address and documents are complete. */
router.post('/kyc/activate', async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const account = db.bmoniAccounts.findByUser(userId) as any;
  if (!account?.bmoniUserId) return res.status(404).json({ error: 'No sandbox identity linked yet' });

  const result = await activateKyc(account.bmoniUserId, req.body ?? {});
  if (!result.success) return res.status(result.status && result.status >= 400 && result.status < 500 ? result.status : 502).json({ error: result.error });
  res.json(result.data);
});

/** Document-type enums and other KYC field options from the sandbox. */
router.get('/kyc/options', async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const account = db.bmoniAccounts.findByUser(userId) as any;
  if (!account?.bmoniUserId) return res.status(404).json({ error: 'No sandbox identity linked yet' });

  const result = await getKycOptions(account.bmoniUserId);
  if (!result.success) return res.status(502).json({ error: result.error });
  res.json(result.data);
});

/** Occupation list (numeric socCodes) for the KYC employment section. */
router.get('/kyc/occupations', async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const account = db.bmoniAccounts.findByUser(userId) as any;
  if (!account?.bmoniUserId) return res.status(404).json({ error: 'No sandbox identity linked yet' });

  const result = await listKycOccupations(account.bmoniUserId);
  if (!result.success) return res.status(502).json({ error: result.error });
  res.json(result.data);
});

/** Reviewer verdict for the submitted KYC package: pending / approved / action_required. */
router.get('/kyc/status', async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const account = db.bmoniAccounts.findByUser(userId) as any;
  if (!account?.bmoniUserId) return res.status(404).json({ error: 'No sandbox identity linked yet' });

  const result = await getKycStatus(account.bmoniUserId);
  if (!result.success) return res.status(result.status && result.status >= 400 && result.status < 500 ? result.status : 502).json({ error: result.error });
  res.json(result.data);
});

/** Ask the reviewer to look again after re-uploading a rejected document. */
router.post('/kyc/retry', async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const account = db.bmoniAccounts.findByUser(userId) as any;
  if (!account?.bmoniUserId) return res.status(404).json({ error: 'No sandbox identity linked yet' });

  const result = await retryKycReview(account.bmoniUserId, String((req.body as any)?.sumsubLevelName ?? 'id-and-liveness'));
  if (!result.success) return res.status(result.status && result.status >= 400 && result.status < 500 ? result.status : 502).json({ error: result.error });
  res.json(result.data);
});

/** Government ID upload: one or two images plus document metadata. */
router.post('/kyc/documents/identification', ...kycDocRoute('identification', 'files', 2));

/** Utility bill / bank statement backing the submitted address. */
router.post('/kyc/documents/proof-of-address', ...kycDocRoute('proof-of-address', 'files', 2));

/** Liveness selfie for identity verification. */
router.post('/kyc/documents/biometric', ...kycDocRoute('biometric', 'selfie', 1));

/** Start Anchor/Nigeria onboarding — the step that issues the user's own NUBAN. */
router.post('/onboarding/nigeria', async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const account = db.bmoniAccounts.findByUser(userId) as any;
  if (!account?.bmoniUserId) return res.status(404).json({ error: 'No sandbox identity linked yet' });

  const bvn = String((req.body as any)?.bvn ?? '').trim();
  if (!/^\d{11}$/.test(bvn)) return res.status(400).json({ error: 'BVN must be exactly 11 digits' });

  const wallet = await getNgnWallet(account.bmoniUserId);
  if (!wallet.success) return res.status(502).json({ error: wallet.error });
  if (!wallet.data) return res.status(409).json({ error: 'Deploy an NGN smart wallet before starting Nigeria onboarding' });

  const result = await startNigeriaOnboarding(account.bmoniUserId, {
    bvn,
    ngnWalletAddress: wallet.data.address,
    ngnWalletIndex: wallet.data.index,
  });
  if (!result.success) return res.status(result.status && result.status >= 400 && result.status < 500 ? result.status : 502).json({ error: result.error });
  res.json(result.data);
});

/** Live smart-wallet balances across supported currencies. */
router.get('/balances', async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const account = db.bmoniAccounts.findByUser(userId) as any;
  if (!account?.bmoniUserId) return res.status(404).json({ error: 'No sandbox identity linked yet' });

  const result = await getWalletBalances(account.bmoniUserId);
  if (!result.success) {
    // A freshly registered user has no smart wallet until they deploy one in
    // the browser — that is an expected state, not an error worth a 4xx.
    if (/no embedded smart wallet/i.test(result.error || '')) {
      return res.json({ wallet: null });
    }
    return res.status(result.status && result.status >= 400 && result.status < 500 ? result.status : 502).json({ error: result.error });
  }
  res.json(result.data);
});

/** Where money can be sent in: activation VBA before KYC, personal NUBAN after. */
router.get('/deposit-accounts', async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const account = db.bmoniAccounts.findByUser(userId) as any;
  if (!account?.bmoniUserId) return res.status(404).json({ error: 'No sandbox identity linked yet' });

  const result = await getDepositAccounts(account.bmoniUserId);
  if (!result.success) return res.status(result.status && result.status >= 400 && result.status < 500 ? result.status : 502).json({ error: result.error });
  res.json(result.data);
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

/**
 * Fetch an owner-proof challenge for the signed-in user's browser wallet.
 * The frontend must sign this challenge with the connected wallet and send
 * the signature back to /bmoni/wallet/deploy.
 */
router.post('/wallet/challenge', async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const account = db.bmoniAccounts.findByUser(userId) as any;
  if (!account?.bmoniUserId) return res.status(404).json({ error: 'No sandbox identity linked yet' });

  const currency = String(req.body?.currency || 'CNGN').toUpperCase();
  const userOwnerAddress = String(req.body?.userOwnerAddress || '').trim();
  if (!/^0x[a-fA-F0-9]{40}$/.test(userOwnerAddress)) {
    return res.status(400).json({ error: 'userOwnerAddress must be a 0x-prefixed 40-hex Ethereum address' });
  }

  const result = await createOwnerProofChallenge(account.bmoniUserId, currency, userOwnerAddress);
  if (!result.success) return res.status(502).json({ error: result.error });
  res.json(result.data);
});

/**
 * Deploy the managed smart wallet after the user has signed the challenge.
 * The signature must be produced by the browser wallet — never fabricated.
 */
router.post('/wallet/deploy', async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const account = db.bmoniAccounts.findByUser(userId) as any;
  if (!account?.bmoniUserId) return res.status(404).json({ error: 'No sandbox identity linked yet' });

  const { currency, userOwnerAddress, signature, challengeId } = req.body || {};
  if (!currency || !userOwnerAddress || !signature || !challengeId) {
    return res.status(400).json({ error: 'currency, userOwnerAddress, signature and challengeId are required' });
  }
  if (!/^0x[a-fA-F0-9]{40}$/.test(userOwnerAddress)) {
    return res.status(400).json({ error: 'userOwnerAddress must be a 0x-prefixed 40-hex Ethereum address' });
  }
  if (typeof signature !== 'string' || signature.length < 32) {
    return res.status(400).json({ error: 'signature must be a non-empty hex string' });
  }

  const result = await createManagedSmartWallet(account.bmoniUserId, {
    currency: String(currency).toUpperCase(),
    userOwnerAddress,
    ownerProofSignature: signature,
    ownerProofChallengeId: challengeId,
  });
  if (!result.success) return res.status(502).json({ error: result.error });
  res.json(result.data);
});

export default router;
