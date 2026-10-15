import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import db from '../models/database.js';
import { generateId } from '../utils/helpers.js';
import { resolveBMoniAccount } from '../services/bmoni.js';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'allowii-dev-secret';

function signToken(userId: string, expiresIn: '30d' | '8h' | '7d' = '7d'): string {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn });
}

/** Accepts local (0801…), national (234801…) or E.164 input; null when unusable. */
function normalizePhone(raw: unknown): string | null {
  const digits = String(raw || '').replace(/[^\d+]/g, '');
  if (!digits) return null;
  let e164 = digits;
  if (!e164.startsWith('+')) {
    if (e164.startsWith('234')) e164 = `+${e164}`;
    else if (e164.length === 11 && e164.startsWith('0')) e164 = `+234${e164.slice(1)}`;
    else if (e164.length === 10) e164 = `+234${e164}`;
    else return null;
  }
  return /^\+[1-9]\d{7,14}$/.test(e164) ? e164 : null;
}

export function authMiddleware(req: Request, res: Response, next: Function) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'No token provided' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
    (req as any).userId = decoded.userId;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

router.post('/register', async (req: Request, res: Response) => {
  try {
    const { name, email, password, university, phoneNumber } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Enter a valid email address' });
    }
    if (String(password).length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    const existing = db.users.find(email);
    if (existing) return res.status(409).json({ error: 'Email already registered' });

    const normalizedPhone = normalizePhone(phoneNumber);
    const passwordHash = await bcrypt.hash(password, 10);
    const id = generateId();
    const user = { id, name, email, passwordHash, university: university || null, phoneNumber: normalizedPhone, incomeFrequency: 'monthly', typicalIncomeInKobo: 0, nextIncomeDate: null, createdAt: new Date().toISOString() };
    db.users.create(user);

    // Best-effort sandbox identity so wallet rails exist by first login — a
    // sandbox outage never blocks registration; the wallet page can link later.
    let bmoniLinked = false;
    if (normalizedPhone && process.env.BMONI_API_KEY) {
      const parts = String(name).trim().split(/\s+/);
      const profile = await resolveBMoniAccount({
        firstName: parts[0] || 'Allawii',
        lastName: parts.slice(1).join(' ') || 'Student',
        email,
        phoneNumber: normalizedPhone,
      });
      if (profile?.bmoniUserId) {
        db.bmoniAccounts.create({
          id: generateId(),
          userId: id,
          bmoniUserId: profile.bmoniUserId,
          partnerUserId: profile.id || null,
          profile,
          createdAt: new Date().toISOString(),
        });
        bmoniLinked = true;
      }
    }

    const token = signToken(id);
    res.status(201).json({
      token,
      bmoniLinked,
      user: { id, name, email, university, phoneNumber: normalizedPhone, incomeFrequency: user.incomeFrequency, typicalIncomeInKobo: user.typicalIncomeInKobo, nextIncomeDate: user.nextIncomeDate },
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password, remember } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = db.users.find(email) as any;
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    const token = signToken(user.id, remember ? '30d' : '8h');
    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        university: user.university,
        phoneNumber: user.phoneNumber,
        incomeFrequency: user.incomeFrequency,
        typicalIncomeInKobo: user.typicalIncomeInKobo,
        nextIncomeDate: user.nextIncomeDate,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

/**
 * Issues a session for the synthetic demo persona so judges can exercise the
 * server-side B Moni sandbox proxy without registering. All data is fake.
 */
router.post('/demo-session', (req: Request, res: Response) => {
  const existing = db.users.find('ada.allowii@example.com') as any;
  if (existing) {
    return res.json({ token: signToken(existing.id), user: { id: existing.id, name: existing.name, demo: true } });
  }

  const id = generateId();
  db.users.create({
    id,
    name: 'Ada',
    email: 'ada.allowii@example.com',
    passwordHash: null,
    university: 'University of Lagos',
    phoneNumber: '+2348023000001',
    incomeFrequency: 'monthly',
    typicalIncomeInKobo: 6000000,
    nextIncomeDate: null,
    isDemo: true,
    createdAt: new Date().toISOString(),
  });

  res.status(201).json({ token: signToken(id), user: { id, name: 'Ada', demo: true } });
});

router.get('/me', authMiddleware, (req: Request, res: Response) => {
  const user = db.users.findById((req as any).userId) as any;
  if (!user) return res.status(404).json({ error: 'User not found' });
  const { passwordHash, ...safeUser } = user;
  res.json(safeUser);
});

router.put('/profile', authMiddleware, (req: Request, res: Response) => {
  const { incomeFrequency, typicalIncomeInKobo, nextIncomeDate, university } = req.body;
  db.users.update((req as any).userId, { incomeFrequency, typicalIncomeInKobo, nextIncomeDate, university });
  res.json({ success: true });
});

export default router;
