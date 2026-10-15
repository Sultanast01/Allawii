import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import {
  verifyWebhookSignature,
  checkVerificationRequest,
  extractInboundMessages,
  sendWhatsAppMessage,
  isDuplicateMessage,
  type CloudWebhookPayload,
} from './whatsapp.cloud.js';

const APP_SECRET = 'test-app-secret';
const VERIFY_TOKEN = 'test-verify-token';
const PHONE_NUMBER_ID = '123456789012345';
const GRAPH_VERSION = 'v23.0';

function sign(body: string): string {
  return `sha256=${createHmac('sha256', APP_SECRET).update(body).digest('hex')}`;
}

function inboundPayload(overrides: Record<string, unknown> = {}): CloudWebhookPayload {
  return {
    object: 'whatsapp_business_account',
    entry: [{
      id: 'WBA_1',
      changes: [{
        field: 'messages',
        value: {
          messaging_product: 'whatsapp',
          metadata: { display_phone_number: '15550001111', phone_number_id: PHONE_NUMBER_ID },
          contacts: [{ profile: { name: 'Ada Obi' }, wa_id: '2348012345678' }],
          messages: [{ from: '2348012345678', id: 'wamid.A', timestamp: '1760000000', type: 'text', text: { body: 'balance' } }],
          ...overrides,
        },
      }],
    }],
  };
}

describe('Webhook signature verification', () => {
  test('accepts a correctly signed raw body', () => {
    const body = JSON.stringify(inboundPayload());
    assert.equal(verifyWebhookSignature(body, sign(body), APP_SECRET), true);
  });

  test('rejects a tampered body, a missing header and a wrong secret', () => {
    const body = JSON.stringify(inboundPayload());
    assert.equal(verifyWebhookSignature(`${body}x`, sign(body), APP_SECRET), false);
    assert.equal(verifyWebhookSignature(body, undefined, APP_SECRET), false);
    assert.equal(verifyWebhookSignature(body, sign(body), 'other-secret'), false);
  });

  test('rejects a non-sha256 scheme', () => {
    const body = JSON.stringify(inboundPayload());
    assert.equal(verifyWebhookSignature(body, `sha1=${createHmac('sha1', APP_SECRET).update(body).digest('hex')}`, APP_SECRET), false);
  });
});

describe('Subscription verification handshake', () => {
  test('returns the challenge when Meta sends the right token', () => {
    const result = checkVerificationRequest({ mode: 'subscribe', token: VERIFY_TOKEN, challenge: '424242' }, VERIFY_TOKEN);
    assert.equal(result.status, 'challenge');
    assert.equal(result.challenge, '424242');
  });

  test('rejects a wrong token or a non-subscribe mode', () => {
    assert.equal(checkVerificationRequest({ mode: 'subscribe', token: 'nope', challenge: '42' }, VERIFY_TOKEN).status, 'reject');
    assert.equal(checkVerificationRequest({ mode: 'unsubscribe', token: VERIFY_TOKEN, challenge: '42' }, VERIFY_TOKEN).status, 'reject');
    assert.equal(checkVerificationRequest({}, VERIFY_TOKEN).status, 'reject');
  });
});

describe('Inbound payload extraction', () => {
  test('pulls the sender, message id, body and contact name', () => {
    const [message] = extractInboundMessages(inboundPayload());
    assert.equal(message.from, '2348012345678');
    assert.equal(message.id, 'wamid.A');
    assert.equal(message.text, 'balance');
    assert.equal(message.senderName, 'Ada Obi');
  });

  test('reads button and list replies as text so menu taps work', () => {
    const button = extractInboundMessages(inboundPayload({
      messages: [{ from: '2348012345678', id: 'wamid.B', type: 'interactive', interactive: { type: 'button_reply', button_reply: { id: 'cat_2', title: 'Transport' } } }],
    }));
    assert.equal(button[0].text, 'Transport');

    const list = extractInboundMessages(inboundPayload({
      messages: [{ from: '2348012345678', id: 'wamid.C', type: 'interactive', interactive: { type: 'list_reply', list_reply: { id: 'cat_1', title: 'Food' } } }],
    }));
    assert.equal(list[0].text, 'Food');
  });

  test('ignores status-only callbacks and echoes of our own outgoing messages', () => {
    assert.deepEqual(extractInboundMessages(inboundPayload({ messages: undefined, statuses: [{ id: 'wamid.A', status: 'delivered' }] })), []);
    assert.deepEqual(extractInboundMessages(inboundPayload({
      metadata: { display_phone_number: '15550001111', phone_number_id: PHONE_NUMBER_ID },
      messages: [{ id: 'wamid.OUT', from: PHONE_NUMBER_ID, status: 'read' }],
    })), []);
  });

  test('returns nothing for an empty or unrelated payload', () => {
    assert.deepEqual(extractInboundMessages({ object: 'page', entry: [] }), []);
  });
});

describe('Sending messages through the Graph API', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    process.env.WHATSAPP_TOKEN = 'test-page-token';
    process.env.WHATSAPP_PHONE_NUMBER_ID = PHONE_NUMBER_ID;
    delete process.env.WHATSAPP_GRAPH_VERSION;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  test('posts a text message to the phone_number_id messages endpoint', async () => {
    const calls: Array<{ url: string; init: RequestInit }> = [];
    globalThis.fetch = ((url: string | URL, init: RequestInit = {}) => {
      calls.push({ url: String(url), init });
      return Promise.resolve(new Response(JSON.stringify({ messaging_product: 'whatsapp', messages: [{ id: 'wamid.SENT' }] }), { status: 200 }));
    }) as typeof fetch;

    const result = await sendWhatsAppMessage('2348012345678', '*Balance*\n₦41,500 available');

    assert.equal(result.ok, true);
    assert.equal(result.messageId, 'wamid.SENT');
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, `https://graph.facebook.com/${GRAPH_VERSION}/${PHONE_NUMBER_ID}/messages`);
    const headers = calls[0].init.headers as Record<string, string>;
    assert.equal(headers.Authorization, 'Bearer test-page-token');
    assert.equal(headers['Content-Type'], 'application/json');
    assert.deepEqual(JSON.parse(String(calls[0].init.body)), {
      messaging_product: 'whatsapp',
      to: '2348012345678',
      text: { body: '*Balance*\n₦41,500 available' },
    });
  });

  test('uses an explicit graph version when configured', async () => {
    process.env.WHATSAPP_GRAPH_VERSION = 'v21.0';
    const seen: string[] = [];
    globalThis.fetch = ((url: string | URL) => {
      seen.push(String(url));
      return Promise.resolve(new Response('{}', { status: 200 }));
    }) as typeof fetch;

    await sendWhatsAppMessage('2348012345678', 'hi');
    assert.equal(seen[0], 'https://graph.facebook.com/v21.0/123456789012345/messages');
  });

  test('reports the Graph API error instead of throwing', async () => {
    globalThis.fetch = (() => Promise.resolve(new Response(JSON.stringify({
      error: { message: 'Error validating application. Invalid OAuth access token', type: 'OAuthException', code: 190 },
    }), { status: 401 }))) as unknown as typeof fetch;

    const result = await sendWhatsAppMessage('2348012345678', 'hi');
    assert.equal(result.ok, false);
    assert.match(result.error || '', /Invalid OAuth access token/);
  });

  test('fails fast when credentials are missing', async () => {
    delete process.env.WHATSAPP_TOKEN;
    globalThis.fetch = (() => Promise.resolve(new Response('{}', { status: 200 }))) as unknown as typeof fetch;
    const result = await sendWhatsAppMessage('2348012345678', 'hi');
    assert.equal(result.ok, false);
    assert.match(result.error || '', /not configured/i);
  });

  test('truncates replies to the WhatsApp text limit', async () => {
    let sentBody = '';
    globalThis.fetch = ((_url: string | URL, init: RequestInit = {}) => {
      sentBody = String(init.body);
      return Promise.resolve(new Response('{}', { status: 200 }));
    }) as unknown as typeof fetch;

    await sendWhatsAppMessage('2348012345678', 'x'.repeat(5000));
    const parsed = JSON.parse(sentBody) as { text: { body: string } };
    assert.equal(parsed.text.body.length <= 4096, true);
  });
});

describe('Webhook replay protection', () => {
  test('the second sight of a message id is a duplicate', () => {
    assert.equal(isDuplicateMessage('wamid.REPLAY'), false);
    assert.equal(isDuplicateMessage('wamid.REPLAY'), true);
  });
});
