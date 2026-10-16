const API_ROOT = 'https://api.telegram.org';

/** Long-poll window Telegram holds a request open for. */
const POLL_SECONDS = 25;

export interface TelegramMessage {
  chat: { id: number };
  text?: string;
}

export interface TelegramCallbackQuery {
  id: string;
  data?: string;
  message?: { chat: { id: number } };
}

export interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  callback_query?: TelegramCallbackQuery;
}

export type ReplyMarkup =
  | { inline_keyboard: { text: string; callback_data: string }[][] }
  | { keyboard: string[][]; resize_keyboard: true };

/**
 * The three Bot API calls the assistant needs, over fetch instead of
 * node-telegram-bot-api — that library drags in the deprecated `request`
 * package and is CommonJS, and this server is ESM with no other use for it.
 */
export class TelegramClient {
  constructor(private readonly token: string) {}

  private async call<T>(method: string, params: Record<string, unknown>, timeoutMs: number): Promise<T> {
    const response = await fetch(`${API_ROOT}/bot${this.token}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(params),
      signal: AbortSignal.timeout(timeoutMs),
    });
    const payload: any = await response.json().catch(() => null);
    if (!response.ok || !payload?.ok) {
      throw new Error(`Telegram ${method} failed: ${payload?.description || response.status}`);
    }
    return payload.result as T;
  }

  getMe() {
    return this.call<{ username: string; first_name: string }>('getMe', {}, 15_000);
  }

  sendMessage(chatId: number | string, text: string, markup?: ReplyMarkup) {
    return this.call('sendMessage', {
      chat_id: chatId,
      text,
      ...(markup ? { reply_markup: markup } : {}),
    }, 15_000);
  }

  answerCallbackQuery(callbackQueryId: string) {
    return this.call('answerCallbackQuery', { callback_query_id: callbackQueryId }, 10_000).catch(() => null);
  }

  /** Fills the command menu Telegram shows beside the text field. */
  setMyCommands(commands: { command: string; description: string }[]) {
    return this.call('setMyCommands', { commands }, 15_000);
  }

  /**
   * Switches delivery from getUpdates to POSTs at `url`. `secret` comes back in the
   * X-Telegram-Bot-Api-Secret-Token header of every update, so the endpoint can prove
   * the request is Telegram's rather than someone imitating a user's message.
   */
  setWebhook(url: string, secret: string) {
    return this.call('setWebhook', {
      url,
      secret_token: secret,
      drop_pending_updates: false,
      allowed_updates: ['message', 'callback_query'],
    }, 15_000);
  }

  deleteWebhook() {
    return this.call('deleteWebhook', { drop_pending_updates: false }, 15_000);
  }

  /** What Telegram believes it is currently doing — the check after a setup attempt. */
  getWebhookInfo() {
    return this.call<{ url: string; pending_update_count: number; last_error_message?: string }>('getWebhookInfo', {}, 15_000);
  }

  /** Waits up to POLL_SECONDS for new activity, then returns whatever arrived. */
  getUpdates(offset: number) {
    return this.call<TelegramUpdate[]>('getUpdates', {
      offset,
      timeout: POLL_SECONDS,
      allowed_updates: ['message', 'callback_query'],
    }, (POLL_SECONDS + 15) * 1000);
  }
}
