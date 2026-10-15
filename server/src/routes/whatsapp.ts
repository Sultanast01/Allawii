import { Router, Request, Response } from 'express';
import db from '../models/database.js';
import { authMiddleware } from './auth.js';
import {
  checkVerificationRequest,
  extractInboundMessages,
  isDuplicateMessage,
  isWhatsAppConfigured,
  sendWhatsAppMessage,
  verifyWebhookSignature,
  type CloudWebhookPayload,
} from '../services/whatsapp.cloud.js';
import { processInboundMessage } from '../services/whatsapp.js';

const router = Router();

// Meta's subscription handshake: echo hub.challenge back when the verify token matches.
router.get('/webhook', (req: Request, res: Response) => {
  const result = checkVerificationRequest(
    {
      mode: req.query['hub.mode'] as string | undefined,
      token: req.query['hub.verify_token'] as string | undefined,
      challenge: req.query['hub.challenge'] as string | undefined,
    },
    process.env.WHATSAPP_VERIFY_TOKEN || '',
  );
  if (result.status === 'challenge') {
    res.status(200).send(result.challenge as string);
    return;
  }
  res.sendStatus(403);
});

router.post('/webhook', async (req: Request, res: Response) => {
  const appSecret = process.env.WHATSAPP_APP_SECRET || '';
  if (!appSecret) {
    res.status(503).json({ error: 'WhatsApp webhook is not configured. Set WHATSAPP_APP_SECRET.' });
    return;
  }

  // The router is mounted with a raw body parser so the HMAC can be computed over exact bytes.
  const raw = Buffer.isBuffer(req.body) ? req.body : Buffer.from(String(req.body ?? ''), 'utf-8');
  if (!verifyWebhookSignature(raw, req.header('x-hub-signature-256'), appSecret)) {
    res.sendStatus(403);
    return;
  }

  let payload: CloudWebhookPayload;
  try {
    payload = JSON.parse(raw.toString('utf-8')) as CloudWebhookPayload;
  } catch {
    res.sendStatus(400);
    return;
  }

  const messages = extractInboundMessages(payload);
  let handled = 0;

  for (const message of messages) {
    if (isDuplicateMessage(message.id)) continue;
    const outcome = processInboundMessage(message.from, message.text);
    if (outcome.status !== 'reply' || !outcome.text) continue;
    handled += 1;

    if (isWhatsAppConfigured()) {
      const sent = await sendWhatsAppMessage(message.from, outcome.text);
      if (!sent.ok) console.error('[whatsapp] send failed:', sent.error);
    } else {
      // No Meta credentials yet: keep the conversation visible in the terminal instead of silently dropping it.
      console.log(`[whatsapp] reply to ${outcome.phone}:\n${outcome.text}\n`);
    }
  }

  // Meta expects a fast 200; anything else is retried and our id de-dupe makes replays harmless.
  res.status(200).json({ received: messages.length, handled });
});

router.get('/status', authMiddleware, (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const user = db.users.findById(userId);
  res.json({
    webhookConfigured: Boolean(process.env.WHATSAPP_APP_SECRET && process.env.WHATSAPP_VERIFY_TOKEN),
    sendingConfigured: isWhatsAppConfigured(),
    linkedPhone: user?.phoneNumber || null,
    ready: Boolean(user?.phoneNumber && process.env.WHATSAPP_APP_SECRET && isWhatsAppConfigured()),
  });
});

export default router;
