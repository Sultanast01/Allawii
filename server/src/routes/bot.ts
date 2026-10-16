import { Router, Request, Response } from 'express';
import { timingSafeEqual } from 'crypto';
import db from '../models/database.js';
import { authMiddleware } from './auth.js';
import { isTelegramBotRunning, telegramBotUsername } from '../bot/index.js';
import {
  BotError,
  addToGoal,
  getSummary,
  issueLinkCode,
  linkAccount,
  logExpense,
  transferBudget,
} from '../services/bot-gateway.js';

/**
 * HTTP mirror of the assistant's abilities. The bot itself runs in this process
 * (src/bot), so these endpoints exist only for anyone running the standalone
 * github.com/Sultanast01/allawii-bot against this server instead.
 */

function botKeyOk(req: Request): boolean {
  const expected = process.env.BOT_API_KEY || '';
  if (!expected) return false;
  const provided = String(req.headers.authorization?.replace('Bearer ', '') || '');
  if (provided.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
}

const botRouter = Router();

botRouter.use((req: Request, res: Response, next) => {
  if (!process.env.BOT_API_KEY) {
    res.status(503).json({ error: 'Bot API is not configured. Set BOT_API_KEY in server/.env.' });
    return;
  }
  if (!botKeyOk(req)) {
    res.status(401).json({ error: 'Invalid bot key' });
    return;
  }
  next();
});

/** Run one gateway action, mapping its BotError onto the matching HTTP status. */
async function viaGateway(res: Response, action: () => Promise<unknown>) {
  try {
    res.json(await action());
  } catch (error) {
    if (error instanceof BotError) {
      res.status(error.status).json({ error: error.message });
      return;
    }
    throw error;
  }
}

botRouter.post('/link', (req, res) => viaGateway(res, () =>
  linkAccount(String(req.body?.code ?? ''), String(req.body?.chatId ?? ''))));

botRouter.get('/users/:userId/summary', (req, res) =>
  viaGateway(res, () => getSummary(String(req.params.userId))));

botRouter.post('/users/:userId/expenses', (req, res) => viaGateway(res, () => logExpense(String(req.params.userId), {
  amount: Number(req.body?.amount),
  category: req.body?.category,
  description: req.body?.description,
})));

botRouter.post('/users/:userId/goals/:goalId/contribute', (req, res) => viaGateway(res, async () => ({
  goals: await addToGoal(String(req.params.userId), String(req.params.goalId), Number(req.body?.amount)),
})));

botRouter.post('/users/:userId/budgets/transfer', (req, res) => viaGateway(res, () => transferBudget(
  String(req.params.userId),
  String(req.body?.from ?? ''),
  String(req.body?.to ?? ''),
  Number(req.body?.amount),
)));

/** App-side endpoints (user JWT): assistant status plus link-code minting. */
const userRouter = Router();

userRouter.use(authMiddleware);

userRouter.get('/status', async (req: Request, res: Response) => {
  const userId = (req as any).userId;
  const profile = await db.users.findById(userId) as any;
  const link = await db.botLinks.findByUserId(userId);
  const codeActive = Boolean(profile?.botLinkCode && (!profile.botLinkExpiresAt || Date.parse(profile.botLinkExpiresAt) > Date.now()));
  res.json({
    botRunning: isTelegramBotRunning(),
    botUsername: telegramBotUsername(),
    linked: Boolean(link),
    linkedChatId: link?.chatId || null,
    activeCode: codeActive ? profile.botLinkCode : null,
    codeExpiresAt: codeActive ? profile.botLinkExpiresAt : null,
  });
});

userRouter.post('/link-code', async (req: Request, res: Response) => {
  const { code, expiresAt } = await issueLinkCode((req as any).userId);
  res.json({ code, expiresAt, botUsername: telegramBotUsername() });
});

export { userRouter as botUserRouter };
export default botRouter;
