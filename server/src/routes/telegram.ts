import { Router, Request, Response } from 'express';
import {
  configureTelegramWebhook,
  handleTelegramWebhook,
  removeTelegramWebhook,
  runNudges,
  telegramWebhookUrl,
  webhookSecret,
} from '../bot/index.js';
import type { TelegramUpdate } from '../bot/telegram.js';
import { botKeyOk } from './bot.js';

/**
 * The endpoints Telegram and the scheduler call, rather than the app.
 * /webhook replaces the poll loop on hosts that cannot keep one open. The control
 * endpoints are guarded by BOT_API_KEY, and Vercel's own CRON_SECRET also opens /nudges.
 */
const router = Router();

const bearer = (req: Request) => String(req.headers.authorization?.replace(/^Bearer\s+/i, '') || '');

/** A scheduled call may arrive with Vercel's CRON_SECRET instead of our bot key. */
function scheduledOk(req: Request): boolean {
  const cronSecret = String(process.env.CRON_SECRET || '').trim();
  return Boolean(cronSecret && bearer(req) === cronSecret) || botKeyOk(req);
}

function guarded(req: Request, res: Response, run: () => Promise<unknown>) {
  if (!process.env.BOT_API_KEY) {
    res.status(503).json({ error: 'Set BOT_API_KEY before calling this endpoint.' });
    return;
  }
  if (!scheduledOk(req)) {
    res.status(401).json({ error: 'Invalid key' });
    return;
  }
  void run()
    .then(result => res.json(result))
    .catch(error => res.status(502).json({ error: (error as Error).message }));
}

router.get('/webhook/status', (req, res) => guarded(req, res, async () => ({
  webhookUrl: telegramWebhookUrl(),
  secretConfigured: Boolean(webhookSecret()),
})));

/** One call after the first deploy, and Telegram delivers updates by itself from then on. */
const setup = (req: Request, res: Response) => guarded(req, res, () => {
  const url = String(req.body?.url || req.query?.url || '').trim();
  return configureTelegramWebhook(url || undefined);
});
router.post('/webhook/setup', setup);
router.get('/webhook/setup', setup);

/** Hand delivery back to getUpdates, which is what a local dev server wants. */
router.post('/webhook/teardown', (req, res) => guarded(req, res, () => removeTelegramWebhook()));

/** The nudge sweep. Vercel's cron invokes the path with GET, so it answers GET too. */
const nudges = (req: Request, res: Response) => guarded(req, res, async () => ({ sent: await runNudges() }));
router.post('/nudges', nudges);
router.get('/nudges', nudges);

/**
 * Telegram's delivery. The shared secret is what proves the update is real: a forged one
 * would let anyone record spending against somebody else's linked chat.
 */
router.post('/webhook', async (req, res) => {
  const secret = webhookSecret();
  if (!secret) {
    res.status(503).json({ error: 'Telegram updates are not accepted until TELEGRAM_WEBHOOK_SECRET or BOT_API_KEY is set.' });
    return;
  }
  if (req.headers['x-telegram-bot-api-secret-token'] !== secret) {
    res.status(401).json({ error: 'Invalid webhook secret' });
    return;
  }
  const update = req.body as TelegramUpdate;
  if (!update?.update_id) {
    res.status(400).json({ error: 'Not a Telegram update' });
    return;
  }
  try {
    if (!(await handleTelegramWebhook(update))) {
      res.status(503).json({ error: 'TELEGRAM_BOT_TOKEN is not set or was refused by Telegram' });
      return;
    }
    res.json({ ok: true });
  } catch (error) {
    // Telegram retries anything it sees as a failure, which is what a Supabase blip wants.
    console.error('Telegram webhook failed:', (error as Error).message);
    res.status(500).json({ error: 'Update could not be processed' });
  }
});

export default router;
