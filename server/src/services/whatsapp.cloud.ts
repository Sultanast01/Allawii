import { createHmac, timingSafeEqual } from 'node:crypto';

const WHATSAPP_TEXT_LIMIT = 4096;
const DEFAULT_GRAPH_VERSION = 'v23.0';

export interface CloudWebhookPayload {
  object?: string;
  entry?: Array<{
    id?: string;
    changes?: Array<{
      field?: string;
      value?: {
        messaging_product?: string;
        metadata?: { display_phone_number?: string; phone_number_id?: string };
        contacts?: Array<{ profile?: { name?: string }; wa_id?: string }>;
        messages?: Array<{
          from?: string;
          id?: string;
          timestamp?: string;
          type?: string;
          status?: string;
          text?: { body?: string };
          button?: { text?: string };
          interactive?: {
            type?: string;
            button_reply?: { id?: string; title?: string };
            list_reply?: { id?: string; title?: string };
          };
        }>;
        statuses?: Array<{ id?: string; status?: string }>;
      };
    }>;
  }>;
}

export interface InboundMessage {
  from: string;
  id: string;
  text: string;
  senderName?: string;
}

export interface SendResult {
  ok: boolean;
  messageId?: string;
  error?: string;
}

export function verifyWebhookSignature(rawBody: string | Buffer, signatureHeader: string | undefined, appSecret: string): boolean {
  if (!signatureHeader || !appSecret) return false;
  const [algorithm, digest] = String(signatureHeader).split('=');
  if (algorithm !== 'sha256' || !digest) return false;
  const body = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(String(rawBody), 'utf-8');
  const expected = createHmac('sha256', appSecret).update(body).digest('hex');
  const expectedBuf = Buffer.from(expected, 'hex');
  const receivedBuf = Buffer.from(digest, 'hex');
  if (expectedBuf.length !== receivedBuf.length) return false;
  return timingSafeEqual(expectedBuf, receivedBuf);
}

export function checkVerificationRequest(
  query: { mode?: string; token?: string; challenge?: string },
  expectedToken: string,
): { status: 'challenge' | 'reject'; challenge?: string } {
  if (query.mode !== 'subscribe') return { status: 'reject' };
  if (!expectedToken || query.token !== expectedToken) return { status: 'reject' };
  if (!query.challenge) return { status: 'reject' };
  return { status: 'challenge', challenge: query.challenge };
}

function messageText(message: Record<string, any>): string {
  if (message?.text?.body) return String(message.text.body);
  if (message?.interactive?.button_reply?.title) return String(message.interactive.button_reply.title);
  if (message?.interactive?.list_reply?.title) return String(message.interactive.list_reply.title);
  if (message?.button?.text) return String(message.button.text);
  return '';
}

export function extractInboundMessages(payload: CloudWebhookPayload): InboundMessage[] {
  const found: InboundMessage[] = [];
  for (const entry of payload.entry || []) {
    for (const change of entry.changes || []) {
      if (change.field !== 'messages') continue;
      const value = change.value || {};
      const ownNumbers = [value.metadata?.display_phone_number, value.metadata?.phone_number_id].filter(Boolean) as string[];
      const namesByWaId = new Map<string, string>();
      for (const contact of value.contacts || []) {
        if (contact.wa_id && contact.profile?.name) namesByWaId.set(contact.wa_id, contact.profile.name);
      }
      for (const message of value.messages || []) {
        // Delivery/read receipts and echoes of our own outgoing replies carry no inbound text.
        if (!message.from || message.status) continue;
        if (ownNumbers.includes(message.from)) continue;
        const text = messageText(message);
        if (!message.id || !text) continue;
        found.push({ from: message.from, id: message.id, text, senderName: namesByWaId.get(message.from) });
      }
    }
  }
  return found;
}

export function isWhatsAppConfigured(): boolean {
  return Boolean(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID);
}

export async function sendWhatsAppMessage(to: string, body: string): Promise<SendResult> {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!token || !phoneNumberId) {
    return { ok: false, error: 'WhatsApp credentials are not configured (WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID)' };
  }
  const version = process.env.WHATSAPP_GRAPH_VERSION || DEFAULT_GRAPH_VERSION;
  const text = body.length > WHATSAPP_TEXT_LIMIT ? `${body.slice(0, WHATSAPP_TEXT_LIMIT - 1)}…` : body;

  try {
    const res = await fetch(`https://graph.facebook.com/${version}/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ messaging_product: 'whatsapp', to, text: { body: text } }),
    });
    const data = await res.json().catch(() => ({}) as Record<string, unknown>);
    if (!res.ok) {
      const err = data?.error as { message?: string } | undefined;
      return { ok: false, error: err?.message || `WhatsApp send failed (${res.status})` };
    }
    const messages = (data?.messages as Array<{ id?: string }> | undefined) || [];
    return { ok: true, messageId: messages[0]?.id };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'WhatsApp send failed' };
  }
}

const seenMessageIds: string[] = [];
const seenLookup = new Set<string>();

export function isDuplicateMessage(id: string): boolean {
  if (seenLookup.has(id)) return true;
  seenLookup.add(id);
  seenMessageIds.push(id);
  if (seenMessageIds.length > 2000) {
    const dropped = seenMessageIds.splice(0, 500);
    for (const entry of dropped) seenLookup.delete(entry);
  }
  return false;
}
