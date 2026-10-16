import { Router, Request, Response } from 'express';
import { supabaseAdmin, supabaseUser } from '../lib/supabase.js';
import db from '../models/database.js';
import { resolveBMoniAccount } from '../services/bmoni.js';

const router = Router();

const DEMO_EMAIL = 'ada.allowii@example.com';
const DEMO_PASSWORD = process.env.DEMO_PASSWORD || 'allawii-demo';

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

interface SessionBundle {
  token: string;
  refreshToken: string;
  expiresIn: number;
}

function sessionBundle(session: { access_token: string; refresh_token: string; expires_in: number }): SessionBundle {
  return { token: session.access_token, refreshToken: session.refresh_token, expiresIn: session.expires_in };
}

function publicUser(profile: any) {
  if (!profile) return null;
  return {
    id: profile.id,
    name: profile.name,
    email: profile.email,
    university: profile.university,
    phoneNumber: profile.phoneNumber,
    incomeFrequency: profile.incomeFrequency,
    typicalIncomeInKobo: profile.typicalIncomeInKobo,
    nextIncomeDate: profile.nextIncomeDate,
  };
}

/** Verifies the Supabase access token and attaches the auth uid as req.userId. */
export async function authMiddleware(req: Request, res: Response, next: (err?: unknown) => void) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'No token provided' });
  try {
    const { data, error } = await supabaseUser().auth.getUser(token);
    if (error || !data.user) return res.status(401).json({ error: 'Invalid token' });
    (req as any).userId = data.user.id;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

/** Exchange the stored refresh token for a fresh Supabase session when the access token expires. */
router.post('/refresh', async (req: Request, res: Response) => {
  const refreshToken = String(req.body?.refreshToken || '');
  if (!refreshToken) return res.status(400).json({ error: 'refreshToken is required' });
  try {
    const { data, error } = await supabaseUser().auth.refreshSession({ refresh_token: refreshToken });
    if (error || !data.session) return res.status(401).json({ error: 'Session expired' });
    res.json({
      ...sessionBundle(data.session),
      user: publicUser(await db.users.findById(data.session.user.id)),
    });
  } catch (error) {
    console.error('Refresh error:', error);
    res.status(500).json({ error: 'Refresh failed' });
  }
});

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

    const existing = await db.users.find(String(email).toLowerCase());
    if (existing) return res.status(409).json({ error: 'Email already registered' });

    const normalizedPhone = normalizePhone(phoneNumber);
    if (String(phoneNumber || '').trim() && !normalizedPhone) {
      return res.status(400).json({ error: 'Enter a valid phone number, e.g. 08012345678 or +2348012345678' });
    }
    if (normalizedPhone && await db.users.findByPhone(normalizedPhone)) {
      return res.status(409).json({ error: 'That number is already linked to another Allawii account.' });
    }

    const { data: created, error: createError } = await supabaseAdmin().auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name },
    });
    if (createError || !created.user) {
      if (/already been registered|exists/i.test(createError?.message || '')) {
        return res.status(409).json({ error: 'Email already registered' });
      }
      console.error('Supabase createUser error:', createError?.message);
      return res.status(500).json({ error: 'Registration failed' });
    }

    const id = created.user.id;
    await db.users.create({
      id,
      name,
      email: String(email).toLowerCase(),
      university: university || null,
      phoneNumber: normalizedPhone,
      incomeFrequency: 'monthly',
      typicalIncomeInKobo: 0,
      nextIncomeDate: null,
      createdAt: new Date().toISOString(),
    });

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
        await db.bmoniAccounts.create({
          id: crypto.randomUUID(),
          userId: id,
          bmoniUserId: profile.bmoniUserId,
          partnerUserId: profile.id || null,
          profile,
          createdAt: new Date().toISOString(),
        });
        bmoniLinked = true;
      }
    }

    const { data: session, error: sessionError } = await supabaseUser().auth.signInWithPassword({ email, password });
    if (sessionError || !session.session) {
      return res.status(500).json({ error: 'Registration succeeded but sign-in failed — please log in.' });
    }

    res.status(201).json({
      ...sessionBundle(session.session),
      bmoniLinked,
      user: publicUser(await db.users.findById(id)),
    });
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

    const { data, error } = await supabaseUser().auth.signInWithPassword({ email, password });
    if (error || !data.session) return res.status(401).json({ error: 'Invalid credentials' });

    let profile = await db.users.findById(data.session.user.id);
    if (!profile) {
      // Auth user without a profile row (e.g. created in the dashboard): bootstrap one.
      profile = {
        id: data.session.user.id,
        name: data.session.user.user_metadata?.name || 'Student',
        email: String(data.session.user.email || '').toLowerCase(),
        university: null,
        phoneNumber: null,
        incomeFrequency: 'monthly',
        typicalIncomeInKobo: 0,
        nextIncomeDate: null,
        createdAt: new Date().toISOString(),
      };
      await db.users.create(profile);
    }
    res.json({ ...sessionBundle(data.session), user: publicUser(profile) });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

/**
 * Issues a Supabase session for the synthetic demo persona so judges can exercise
 * the whole stack without registering. All data is fake. The auth user is created
 * on first use with the DEMO_PASSWORD from the server environment.
 */
router.post('/demo-session', async (req: Request, res: Response) => {
  try {
    let { data, error } = await supabaseUser().auth.signInWithPassword({ email: DEMO_EMAIL, password: DEMO_PASSWORD });
    if (error || !data.session) {
      const { data: created, error: createError } = await supabaseAdmin().auth.admin.createUser({
        email: DEMO_EMAIL,
        password: DEMO_PASSWORD,
        email_confirm: true,
        user_metadata: { name: 'Ada' },
      });
      if (createError && !/already been registered/i.test(createError.message)) {
        console.error('Demo user creation failed:', createError.message);
        return res.status(500).json({ error: 'Demo session failed' });
      }
      if (created.user && !(await db.users.findById(created.user.id))) {
        await db.users.create({
          id: created.user.id,
          name: 'Ada',
          email: DEMO_EMAIL,
          university: 'University of Lagos',
          phoneNumber: '+2348023000001',
          incomeFrequency: 'monthly',
          typicalIncomeInKobo: 6000000,
          nextIncomeDate: null,
          isDemo: true,
          createdAt: new Date().toISOString(),
        });
      }
      const retry = await supabaseUser().auth.signInWithPassword({ email: DEMO_EMAIL, password: DEMO_PASSWORD });
      if (retry.error || !retry.data.session) {
        return res.status(500).json({ error: 'Demo session failed' });
      }
      data = retry.data;
      error = retry.error;
    }

    const session = data.session!;
    const profile = await db.users.findById(session.user.id);
    if (profile && !profile.isDemo) await db.users.update(session.user.id, { isDemo: true });
    res.json({
      ...sessionBundle(session),
      user: { ...(publicUser(profile) || {}), demo: true },
    });
  } catch (error) {
    console.error('Demo session error:', error);
    res.status(500).json({ error: 'Demo session failed' });
  }
});

router.get('/me', authMiddleware, async (req: Request, res: Response) => {
  const profile = await db.users.findById((req as any).userId);
  if (!profile) return res.status(404).json({ error: 'User not found' });
  res.json(profile);
});

router.put('/profile', authMiddleware, async (req: Request, res: Response) => {
  const { incomeFrequency, typicalIncomeInKobo, nextIncomeDate, university, phoneNumber } = req.body;
  const updates: Record<string, unknown> = { incomeFrequency, typicalIncomeInKobo, nextIncomeDate, university };
  if (phoneNumber !== undefined) {
    const normalized = normalizePhone(phoneNumber);
    if (!normalized) {
      res.status(400).json({ error: 'Enter a valid phone number, e.g. 08012345678 or +2348012345678' });
      return;
    }
    const owner = await db.users.findByPhone(normalized);
    if (owner && owner.id !== (req as any).userId) {
      res.status(409).json({ error: 'That number is already linked to another Allawii account.' });
      return;
    }
    updates.phoneNumber = normalized;
  }
  await db.users.update((req as any).userId, updates);
  const fresh = await db.users.findById((req as any).userId);
  res.json({ success: true, phoneNumber: fresh?.phoneNumber || null });
});

export default router;
