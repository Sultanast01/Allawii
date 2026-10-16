import db from '../models/database.js';
import {
  addToGoal,
  appCategory,
  BotError,
  getSummary,
  linkAccount,
  logExpense,
  transferBudget,
  type BotBudget,
  type BotSummary,
} from '../services/bot-gateway.js';
import { extractLinkCode, firstName, formatBudgets, formatHelp, guessCategory, parseAmount } from './intents.js';
import { TelegramClient, type ReplyMarkup, type TelegramUpdate } from './telegram.js';

const naira = (amount: number) => '₦' + Math.round(Number(amount) || 0).toLocaleString('en-NG');

const MENU: ReplyMarkup = {
  keyboard: [
    ["What's my safe spend today?", "What's my balance?"],
    ['How are my budgets?', 'My savings goals'],
    ['What can you do?', "What's my streak?"],
  ],
  resize_keyboard: true,
};

/** Listed in Telegram's own command menu, so /help is discoverable before anyone types it. */
const HELP_COMMANDS = [
  { command: 'start', description: 'How to link your Allawii account' },
  { command: 'help', description: 'What I can do, with example phrasings' },
];

const buttons = (pairs: [string, string][]): ReplyMarkup => ({
  inline_keyboard: [pairs.map(([text, data]) => ({ text, callback_data: data }))],
});

const NUDGE_MINUTES = 10;
const BUDGET_NUDGE_AT = 0.8;
const PROACTIVE_NUDGE_AT = 0.9;
const START_RETRY_MS = 20_000;
const START_RETRIES = 10;

let client: TelegramClient | null = null;
let running = false;
let detectedUsername: string | null = null;
let nudgeTimer: NodeJS.Timeout | null = null;
const nudgedAlready = new Set<string>();

export function isTelegramBotRunning(): boolean {
  return running;
}

/** The username Telegram reports for this token; TELEGRAM_BOT_USERNAME is only a placeholder. */
export function telegramBotUsername(): string | null {
  return detectedUsername || process.env.TELEGRAM_BOT_USERNAME || null;
}

const say = (chatId: number | string, text: string, markup?: ReplyMarkup) =>
  client!.sendMessage(chatId, text, markup).catch(error => {
    console.error('Telegram send failed:', (error as Error).message);
  });

async function ownedUserId(chatId: number | string): Promise<string | null> {
  const link = await db.botLinks.findByChatId(String(chatId));
  return link?.userId || null;
}

/** Run an action for a linked chat, or tell them how to link. */
async function withUser(chatId: number, action: (userId: string) => Promise<void>) {
  let userId: string | null = null;
  try {
    userId = await ownedUserId(chatId);
  } catch (error) {
    console.error('Telegram lookup failed:', (error as Error).message);
  }
  if (!userId) {
    await say(chatId, 'Link your account first: open Allawii, press the Telegram button on your Profile, and send the six-digit code it shows. Send /help meanwhile to see what I can do.');
    return;
  }
  try {
    await action(userId);
  } catch (error) {
    console.error('Telegram action failed:', (error as Error).message);
    if (error instanceof BotError && error.status >= 400 && error.status < 500) {
      await say(chatId, error.message);
      return;
    }
    await say(chatId, "I'm having trouble reaching Allawii right now. Please try again in a moment.");
  }
}

function nudgeIfNeeded(chatId: number, category: string, label: string, budget: BotBudget | undefined, at = BUDGET_NUDGE_AT) {
  if (!budget || budget.limit <= 0 || budget.spent / budget.limit < at) return;
  void say(
    chatId,
    `Your ${label} budget is getting close to its limit. Want a simple adjustment?`,
    buttons([['Show suggestion', `sugg:${category}`], ['Not now', 'dismiss']]),
  );
}

async function handleMessage(chatId: number, rawText: string) {
  const text = rawText.toLowerCase().trim();
  const amount = parseAmount(text);

  await withUser(chatId, async userId => {
    const summary = await getSummary(userId);

    if (/afford/.test(text) && amount) {
      const fits = amount <= summary.safeToSpendToday;
      await say(
        chatId,
        fits
          ? `Yes, ${naira(amount)} fits today's safe amount of ${naira(summary.safeToSpendToday)}.`
          : `${naira(amount)} is above today's safe amount of ${naira(summary.safeToSpendToday)}. It could leave you short before payday.`,
        buttons([['Buy it', `buy:${amount}`], ['Save it instead', `goal:${amount}`]]),
      );
      return;
    }

    if (/\bsave\b/.test(text) && amount) {
      const goal = summary.goals[0];
      if (!goal) {
        await say(chatId, 'You have no savings goal yet. Create one in the app.');
        return;
      }
      const goals = await addToGoal(userId, goal.id, amount);
      const updated = goals.find(x => x.id === goal.id) || goals[0];
      await say(chatId, `Saved ${naira(amount)} toward ${updated.name}: ${naira(updated.saved)} / ${naira(updated.target)}.`);
      return;
    }

    if (/(spent|paid|bought)/.test(text) && amount) {
      const guess = guessCategory(text);
      const next = await logExpense(userId, { amount, category: guess });
      // The ledger stores the mapped category, so "data" only matches a plan row as "data_airtime".
      const key = appCategory(guess);
      const budget = next.budgets[key];
      await say(chatId, `Logged ${naira(amount)} on ${budget?.label || guess}.\nBalance: ${naira(next.balance)}\nSafe to spend today: ${naira(next.safeToSpendToday)}`);
      nudgeIfNeeded(chatId, key, budget?.label || guess, budget);
      return;
    }

    if (/safe|spend today/.test(text)) {
      await say(chatId, `Your safe spending guide is ${naira(summary.safeToSpendToday)} today. You have ${naira(summary.balance)} available and ${summary.daysLeft} days until your next allowance.`);
      return;
    }

    if (/balance|how much.*(have|left)/.test(text)) {
      await say(chatId, `You have ${naira(summary.balance)} available with ${summary.daysLeft} days to go.`);
      return;
    }

    if (/budget/.test(text)) {
      await say(chatId, formatBudgets(summary.budgets));
      return;
    }

    if (/goal|saving/.test(text)) {
      await say(chatId, summary.goals.map(goal => `${goal.name}: ${naira(goal.saved)} / ${naira(goal.target)}`).join('\n') || 'No goals yet.');
      return;
    }

    if (/streak/.test(text)) {
      await say(chatId, `Your streak is ${summary.streak} days. Keep it going!`);
      return;
    }

    await say(chatId, formatHelp(firstName(summary.name)), MENU);
  });
}

async function handleCallback(chatId: number, data: string, callbackId: string) {
  const [action, first, second, third] = data.split(':');
  await client!.answerCallbackQuery(callbackId);

  if (action === 'dismiss') {
    await say(chatId, 'No problem. I will keep an eye on it.');
    return;
  }

  await withUser(chatId, async userId => {
    if (action === 'buy') {
      const summary = await logExpense(userId, { amount: Number(first), category: 'other' });
      await say(chatId, `Logged ${naira(Number(first))}. Balance: ${naira(summary.balance)}.`);
      return;
    }

    if (action === 'goal') {
      const summary = await getSummary(userId);
      if (!summary.goals[0]) {
        await say(chatId, 'You have no savings goal yet. Create one in the app.');
        return;
      }
      const goals = await addToGoal(userId, summary.goals[0].id, Number(first));
      await say(chatId, `Saved ${naira(Number(first))}. ${goals[0].name}: ${naira(goals[0].saved)} / ${naira(goals[0].target)}.`);
      return;
    }

    if (action === 'sugg') {
      const summary = await getSummary(userId);
      const donor = pickDonor(summary, first);
      if (!donor) {
        await say(chatId, 'There is no spare room in your other budgets right now.');
        return;
      }
      const room = donor.budget.limit - donor.budget.spent;
      const moveAmount = Math.min(2000, room);
      const needing = summary.budgets[first]?.label || first;
      const donorLabel = summary.budgets[donor.category]?.label || donor.category;
      await say(
        chatId,
        `Move ${naira(moveAmount)} from ${donorLabel} to ${needing}? ${donorLabel} has ${naira(room)} unused.`,
        buttons([['Apply', `apply:${donor.category}:${first}:${moveAmount}`], ['Skip', 'dismiss']]),
      );
      return;
    }

    if (action === 'apply') {
      const after = await transferBudget(userId, first, second || '', Number(third));
      const from = after.budgets[first || '']?.label || first;
      const to = after.budgets[second || '']?.label || second;
      await say(chatId, `Done. ${naira(Number(third))} moved from ${from} to ${to}.`);
    }
  });
}

/** The budget with the most unused room, excluding the one that needs help. */
function pickDonor(summary: BotSummary, needing: string): { category: string; budget: { limit: number; spent: number } } | null {
  const candidates = Object.entries(summary.budgets)
    .filter(([category, budget]) => category !== needing && budget.limit > budget.spent)
    .sort((a, b) => (b[1].limit - b[1].spent) - (a[1].limit - a[1].spent));
  const top = candidates[0];
  return top ? { category: top[0], budget: top[1] } : null;
}

/** The capability list, named for the account this chat is linked to when there is one. */
async function helpFor(chatId: number): Promise<string> {
  const userId = await ownedUserId(chatId);
  if (!userId) return formatHelp();
  try {
    return formatHelp(firstName((await getSummary(userId)).name));
  } catch (error) {
    console.error('Telegram help lookup failed:', (error as Error).message);
    return formatHelp();
  }
}

async function linkChat(chatId: number, code: string, alreadyLinked: boolean) {
  try {
    const { userId } = await linkAccount(code, chatId);
    const summary = await getSummary(userId);
    const name = firstName(summary.name);
    await say(chatId, name ? `Linked to ${name}'s account.` : 'Linked!', MENU);
    await say(chatId, formatHelp(name), MENU);
  } catch (error) {
    const status = error instanceof BotError ? error.status : 500;
    if (status === 410) {
      await say(chatId, 'That code has expired. Open Allawii and press the Telegram button — a fresh code travels with the link.');
      return;
    }
    if (alreadyLinked) {
      await say(chatId, 'This Telegram chat is already linked to an Allawii account, so you do not need a code. Ask me about your balance or safe spend.', MENU);
      return;
    }
    await say(chatId, 'I could not find that code. Press the Telegram button in Allawii and it will send the new six digits for you.');
  }
}

async function dispatch(update: TelegramUpdate) {
  if (update.callback_query?.data && update.callback_query.message?.chat) {
    await handleCallback(update.callback_query.message.chat.id, update.callback_query.data, update.callback_query.id);
    return;
  }

  const message = update.message;
  if (!message?.text) return;
  const text = message.text.trim();

  const alreadyLinked = Boolean(await ownedUserId(message.chat.id));
  const code = extractLinkCode(text, !alreadyLinked);
  if (code) {
    await linkChat(message.chat.id, code, alreadyLinked);
    return;
  }

  if (/^\/(?:help|menu)\b/i.test(text)) {
    await say(message.chat.id, await helpFor(message.chat.id), MENU);
    return;
  }

  if (/^\/start\b/i.test(text)) {
    if (alreadyLinked) {
      await say(message.chat.id, await helpFor(message.chat.id), MENU);
      return;
    }
    await say(message.chat.id, "Hi, I'm Allawii. Press the Telegram button in the Allawii app and it opens this chat with your six-digit link code already attached. Once linked, send /help and I will show you what I can do, with the exact phrasings to use.", MENU);
    return;
  }

  if (text.startsWith('/')) return;
  await handleMessage(message.chat.id, text);
}

/** Proactive sweep: one nudge per category per day once a budget is 90% gone. */
async function runNudges() {
  if (!client) return;
  const day = new Date().toDateString();
  let links: { chatId: string; userId: string }[] = [];
  try {
    links = await db.botLinks.all();
  } catch (error) {
    console.error('Telegram nudge sweep failed:', (error as Error).message);
    return;
  }

  for (const { chatId, userId } of links) {
    let summary: BotSummary;
    try {
      summary = await getSummary(userId);
    } catch (error) {
      console.error('Telegram nudge check failed:', (error as Error).message);
      continue;
    }
    for (const [category, budget] of Object.entries(summary.budgets)) {
      const key = `${userId}:${category}:${day}`;
      if (budget.limit > 0 && budget.spent / budget.limit >= PROACTIVE_NUDGE_AT && !nudgedAlready.has(key)) {
        nudgedAlready.add(key);
        nudgeIfNeeded(Number(chatId), category, budget.label, budget, PROACTIVE_NUDGE_AT);
      }
    }
  }
}

async function pollLoop(bot: TelegramClient) {
  let offset = 0;
  while (running) {
    try {
      const updates = await bot.getUpdates(offset);
      for (const update of updates) {
        offset = Math.max(offset, update.update_id + 1);
        try {
          await dispatch(update);
        } catch (error) {
          console.error('Telegram update failed:', (error as Error).message);
        }
      }
    } catch (error) {
      if (!running) break;
      console.error('Telegram polling paused for 5s:', (error as Error).message);
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
}

/**
 * Starts the assistant inside this process. Returns false when no token is
 * configured or Telegram refuses it right now — the API keeps running either way,
 * and a refused start is retried in the background instead of staying offline for
 * the rest of the session.
 */
export async function startTelegramBot(attempt = 0): Promise<boolean> {
  const token = String(process.env.TELEGRAM_BOT_TOKEN || '').trim();
  if (!token) {
    console.log('Telegram assistant: offline (TELEGRAM_BOT_TOKEN not set)');
    return false;
  }
  if (running) return true;

  const bot = new TelegramClient(token);
  try {
    const me = await bot.getMe();
    detectedUsername = me.username;
  } catch (error) {
    console.error('Telegram assistant could not start:', (error as Error).message);
    if (attempt < START_RETRIES) {
      console.log(`Telegram assistant: retrying in ${START_RETRY_MS / 1000}s (try ${attempt + 1} of ${START_RETRIES})`);
      setTimeout(() => { void startTelegramBot(attempt + 1); }, START_RETRY_MS).unref?.();
    }
    return false;
  }

  client = bot;
  running = true;
  await bot.setMyCommands(HELP_COMMANDS).catch(error => {
    console.error('Telegram command menu not updated:', (error as Error).message);
  });
  void pollLoop(bot);
  nudgeTimer = setInterval(() => { void runNudges(); }, NUDGE_MINUTES * 60 * 1000);
  nudgeTimer.unref?.();
  console.log(`Telegram assistant: live as @${detectedUsername}`);
  return true;
}
