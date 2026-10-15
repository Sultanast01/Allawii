import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  uploadIdentificationDocument,
  uploadProofOfAddressDocument,
  uploadBiometricDocument,
  getKycOptions,
  getKycStatus,
  retryKycReview,
  startNigeriaOnboarding,
  getNgnWallet,
  validateKycUpload,
  type KycUploadFile,
} from './bmoni.js';

const API_KEY = 'test-api-key';
const BMONI_ID = 'bmoni-user-1';
const originalFetch = globalThis.fetch;

type CapturedCall = { url: string; init: RequestInit };
let captured: CapturedCall[] = [];
let nextResponse: { ok: boolean; status: number; body: Record<string, unknown> } = { ok: true, status: 201, body: { id: 'doc-1' } };

function fakeFetch(_url: string | URL, init?: RequestInit) {
  captured.push({ url: String(_url), init: init ?? {} });
  return Promise.resolve(new Response(JSON.stringify(nextResponse.body), {
    status: nextResponse.status,
    headers: { 'Content-Type': 'application/json' },
  }));
}

function png(name: string, sizeBytes = 1024): KycUploadFile {
  return { buffer: Buffer.alloc(sizeBytes, 7), mimeType: 'image/png', originalName: name };
}

describe('KYC document uploads', () => {
  beforeEach(() => {
    process.env.BMONI_API_KEY = API_KEY;
    delete process.env.BMONI_BASE_URL;
    captured = [];
    nextResponse = { ok: true, status: 201, body: { id: 'doc-1' } };
    globalThis.fetch = fakeFetch as typeof fetch;
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  test('identification upload posts files and text fields to the identification endpoint', async () => {
    const result = await uploadIdentificationDocument(BMONI_ID, {
      files: [png('front.png')],
      type: 'passport',
      documentNumber: 'A12345678',
      issuingCountry: 'NGA',
    });

    assert.equal(result.success, true);
    assert.equal(captured.length, 1);
    const call = captured[0];
    assert.equal(call.url, `https://embedded-dev.bmoni.com/v1/users/${BMONI_ID}/kyc/documents/identification`);
    assert.equal((call.init.headers as Record<string, string>)['x-api-key'], API_KEY);

    const form = call.init.body as FormData;
    assert.ok(form instanceof FormData);
    assert.equal(form.get('type'), 'passport');
    assert.equal(form.get('documentNumber'), 'A12345678');
    assert.equal(form.get('issuingCountry'), 'NGA');
    const fileEntries = [...form.getAll('files')];
    assert.equal(fileEntries.length, 1);
    assert.equal((fileEntries[0] as File).name, 'front.png');
  });

  test('identification upload forwards optional issue and expiration dates', async () => {
    await uploadIdentificationDocument(BMONI_ID, {
      files: [png('front.png')],
      type: 'national_id',
      documentNumber: '12345678901',
      issuingCountry: 'NGA',
      issueDate: '2020-01-01',
      expirationDate: '2030-01-01',
    });

    const form = captured[0].init.body as FormData;
    assert.equal(form.get('issueDate'), '2020-01-01');
    assert.equal(form.get('expirationDate'), '2030-01-01');
  });

  test('identification upload appends a second file so both faces of the ID arrive', async () => {
    await uploadIdentificationDocument(BMONI_ID, {
      files: [png('front.png'), png('back.png')],
      type: 'national_id',
      documentNumber: '12345678901',
      issuingCountry: 'NGA',
    });

    const form = captured[0].init.body as FormData;
    const files = [...form.getAll('files')];
    assert.equal(files.length, 2);
    assert.equal((files[0] as File).name, 'front.png');
    assert.equal((files[1] as File).name, 'back.png');
  });

  test('proof-of-address upload posts files under the files field with its type', async () => {
    const result = await uploadProofOfAddressDocument(BMONI_ID, {
      files: [png('bill.png')],
      type: 'utility_bill',
    });

    assert.equal(result.success, true);
    const call = captured[0];
    assert.equal(call.url, `https://embedded-dev.bmoni.com/v1/users/${BMONI_ID}/kyc/documents/proof-of-address`);
    const form = call.init.body as FormData;
    assert.equal(form.get('type'), 'utility_bill');
    assert.equal([...form.getAll('files')].length, 1);
  });

  test('biometric upload posts the selfie under the selfie field name', async () => {
    const result = await uploadBiometricDocument(BMONI_ID, {
      selfie: [png('selfie.png')],
      type: 'selfie',
    });

    assert.equal(result.success, true);
    const call = captured[0];
    assert.equal(call.url, `https://embedded-dev.bmoni.com/v1/users/${BMONI_ID}/kyc/documents/biometric`);
    const form = call.init.body as FormData;
    assert.equal([...form.getAll('selfie')].length, 1);
  });

  test('a BMoni rejection surfaces as success:false with the sandbox error and status', async () => {
    nextResponse = { ok: false, status: 400, body: { message: 'Document image unreadable' } };

    const result = await uploadBiometricDocument(BMONI_ID, {
      selfie: [png('selfie.png')],
      type: 'selfie',
    });

    assert.equal(result.success, false);
    assert.equal(result.error, 'Document image unreadable');
    assert.equal(result.status, 400);
  });

  test('kyc options are fetched from the per-user options endpoint', async () => {
    nextResponse = { ok: true, status: 200, body: { identificationTypes: ['passport'] } };

    const result = await getKycOptions(BMONI_ID);

    assert.equal(result.success, true);
    assert.equal(captured[0].url, `https://embedded-dev.bmoni.com/v1/users/${BMONI_ID}/kyc/options`);
    assert.deepEqual((result.data as any).identificationTypes, ['passport']);
  });

  test('kyc review status is read from the status endpoint', async () => {
    nextResponse = {
      ok: true,
      status: 200,
      body: { status: 'action_required', reviewAnswer: 'RED', reviewRejectType: 'RETRY', rejectLabels: ['BAD_SELFIE'] },
    };

    const result = await getKycStatus(BMONI_ID);

    assert.equal(result.success, true);
    assert.equal(captured[0].url, `https://embedded-dev.bmoni.com/v1/users/${BMONI_ID}/kyc/status`);
    assert.equal(captured[0].init.method, 'GET');
    assert.deepEqual((result.data as any).rejectLabels, ['BAD_SELFIE']);
  });

  test('retrying a failed review posts the sumsub level the sandbox asks for', async () => {
    nextResponse = { ok: true, status: 200, body: { message: 'Review re-requested' } };

    const result = await retryKycReview(BMONI_ID, 'id-and-liveness');

    assert.equal(result.success, true);
    assert.equal(captured[0].url, `https://embedded-dev.bmoni.com/v1/users/${BMONI_ID}/kyc/retry`);
    assert.equal(captured[0].init.method, 'POST');
    assert.equal(JSON.parse(String(captured[0].init.body)).sumsubLevelName, 'id-and-liveness');
  });
});

describe('validateKycUpload', () => {
  beforeEach(() => {
    process.env.BMONI_API_KEY = API_KEY;
  });

  test('identification requires a document number and issuing country', () => {
    assert.match(
      validateKycUpload('identification', { type: 'passport', issuingCountry: 'NGA' }, [png('f.png')])!,
      /document number/i,
    );
    assert.match(
      validateKycUpload('identification', { type: 'passport', documentNumber: 'A1' }, [png('f.png')])!,
      /issuing country/i,
    );
  });

  test('identification requires a valid ISO-3 issuing country code', () => {
    assert.match(
      validateKycUpload('identification', { type: 'passport', documentNumber: 'A1', issuingCountry: 'NG' }, [png('f.png')])!,
      /3-letter/i,
    );
  });

  test('every kind rejects a submission with no files', () => {
    for (const kind of ['identification', 'proof-of-address', 'biometric'] as const) {
      const fields: Record<string, string> = kind === 'identification'
        ? { type: 'passport', documentNumber: 'A1', issuingCountry: 'NGA' }
        : { type: 'selfie' };
      assert.match(validateKycUpload(kind, fields, [])!, /file/i);
    }
  });

  test('identification and proof-of-address accept at most two files', () => {
    const fields = { type: 'passport', documentNumber: 'A1', issuingCountry: 'NGA' };
    assert.match(
      validateKycUpload('identification', fields, [png('a.png'), png('b.png'), png('c.png')])!,
      /two files/i,
    );
  });

  test('biometric accepts exactly one selfie', () => {
    assert.match(
      validateKycUpload('biometric', { type: 'selfie' }, [png('a.png'), png('b.png')])!,
      /one/i,
    );
  });

  test('non-image and non-pdf files are rejected', () => {
    const fields = { type: 'passport', documentNumber: 'A1', issuingCountry: 'NGA' };
    assert.match(
      validateKycUpload('identification', fields, [{ buffer: Buffer.alloc(10), mimeType: 'application/zip', originalName: 'a.zip' }])!,
      /image or pdf/i,
    );
  });

  test('empty and oversized files are rejected', () => {
    const fields = { type: 'passport', documentNumber: 'A1', issuingCountry: 'NGA' };
    assert.match(validateKycUpload('identification', fields, [png('a.png', 0)])!, /empty/i);
    assert.match(
      validateKycUpload('identification', fields, [png('a.png', 6 * 1024 * 1024)])!,
      /5 MB/i,
    );
  });

  test('a valid identification payload passes validation', () => {
    const fields = { type: 'passport', documentNumber: 'A12345678', issuingCountry: 'NGA' };
    assert.equal(validateKycUpload('identification', fields, [png('front.png')]), null);
  });

  test('a valid biometric payload passes validation', () => {
    assert.equal(validateKycUpload('biometric', { type: 'selfie' }, [png('selfie.png')]), null);
  });
});

describe('Nigeria onboarding', () => {
  beforeEach(() => {
    process.env.BMONI_API_KEY = API_KEY;
    delete process.env.BMONI_BASE_URL;
    captured = [];
    nextResponse = { ok: true, status: 200, body: { anchorStatus: 'pending' } };
    globalThis.fetch = fakeFetch as typeof fetch;
  });
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  test('start-nigeria posts the BVN and NGN wallet details the sandbox requires', async () => {
    const result = await startNigeriaOnboarding(BMONI_ID, {
      bvn: '12345678901',
      ngnWalletAddress: '0xb6D6BDEdB231CCd1BFe348c6506adEa571E144da',
      ngnWalletIndex: 0,
    });

    assert.equal(result.success, true);
    assert.equal(captured[0].url, `https://embedded-dev.bmoni.com/v1/users/${BMONI_ID}/onboarding/start-nigeria`);
    assert.equal(captured[0].init.method, 'POST');
    assert.deepEqual(JSON.parse(String(captured[0].init.body)), {
      bvn: '12345678901',
      ngnWalletAddress: '0xb6D6BDEdB231CCd1BFe348c6506adEa571E144da',
      ngnWalletIndex: 0,
    });
  });

  test('the naira wallet is found by currency and carries its position in the wallet set', async () => {
    nextResponse = {
      ok: true,
      status: 200,
      body: [
        { id: 'w-usd', currency: 'USD', walletAddress: '0xaaa', isActive: true },
        { id: 'w-ngn-1', currency: 'NGN', walletAddress: '0xb6D6BDEdB231CCd1BFe348c6506adEa571E144da', isActive: true },
        { id: 'w-ngn-2', currency: 'NGN', walletAddress: '0xccc', isActive: true },
      ] as any,
    };

    const result = await getNgnWallet(BMONI_ID);

    assert.equal(result.success, true);
    assert.equal(captured[0].url, `https://embedded-dev.bmoni.com/v1/users/${BMONI_ID}/smart-wallets/account/wallets`);
    assert.deepEqual(result.data, {
      address: '0xb6D6BDEdB231CCd1BFe348c6506adEa571E144da',
      index: 1,
      smartWalletId: 'w-ngn-1',
    });
  });

  test('a naira-less wallet set reports no wallet rather than guessing', async () => {
    nextResponse = { ok: true, status: 200, body: [{ id: 'w-usd', currency: 'USD', walletAddress: '0xaaa' }] as any };

    const result = await getNgnWallet(BMONI_ID);

    assert.equal(result.success, true);
    assert.equal(result.data, null);
  });
});
