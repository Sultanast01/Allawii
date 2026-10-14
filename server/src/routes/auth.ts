import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import db from '../models/database.js';
import { generateId } from '../utils/helpers.js';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'moneva-dev-secret';

function signToken(userId: string): string {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '7d' });
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
    const { name, email, password, university } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required' });
    }

    const existing = db.users.find(email);
    if (existing) return res.status(409).json({ error: 'Email already registered' });

    const passwordHash = await bcrypt.hash(password, 10);
    const id = generateId();
    const user = { id, name, email, passwordHash, university: university || null, incomeFrequency: 'monthly', typicalIncome: 0, nextIncomeDate: null, createdAt: new Date().toISOString() };
    db.users.create(user);

    const token = signToken(id);
    res.status(201).json({ token, user: { id, name, email, university } });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = db.users.find(email) as any;
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    const token = signToken(user.id);
    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        university: user.university,
        incomeFrequency: user.incomeFrequency,
        typicalIncome: user.typicalIncome,
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
  const existing = db.users.find('ada.moneva@example.com') as any;
  if (existing) {
    return res.json({ token: signToken(existing.id), user: { id: existing.id, name: existing.name, demo: true } });
  }

  const id = generateId();
  db.users.create({
    id,
    name: 'Ada',
    email: 'ada.moneva@example.com',
    passwordHash: null,
    university: 'University of Lagos',
    phoneNumber: '+2348023000001',
    incomeFrequency: 'monthly',
    typicalIncome: 60000,
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
  const { incomeFrequency, typicalIncome, nextIncomeDate, university } = req.body;
  db.users.update((req as any).userId, { incomeFrequency, typicalIncome, nextIncomeDate, university });
  res.json({ success: true });
});

export default router;
