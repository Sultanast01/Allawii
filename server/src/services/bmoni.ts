// Read lazily: ES module imports are evaluated before index.ts runs dotenv.config().
const baseUrl = () => process.env.BMONI_BASE_URL || 'https://embedded-dev.bmoni.com';
const apiKey = () => process.env.BMONI_API_KEY || '';

export interface BMoniResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  status?: number;
}

async function parseBMoniResponse<T = any>(response: Response): Promise<BMoniResult<T>> {
  const text = await response.text();
  const parsed = text ? safeJson(text) : undefined;
  if (!response.ok) {
    const message =
      (parsed as any)?.message ?? (parsed as any)?.error ?? `B Moni responded with ${response.status}`;
    return { success: false, error: Array.isArray(message) ? message.join(', ') : String(message), status: response.status };
  }
  return { success: true, data: parsed as T, status: response.status };
}

async function bmoniRequest<T = any>(
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  path: string,
  body?: unknown
): Promise<BMoniResult<T>> {
  if (!apiKey()) {
    return { success: false, error: 'BMONI_API_KEY is not configured on the server' };
  }

  try {
    const response = await fetch(`${baseUrl()}${path}`, {
      method,
      headers: {
        'x-api-key': apiKey(),
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    return await parseBMoniResponse<T>(response);
  } catch (error) {
    console.error('B Moni request failed:', method, path, error);
    return { success: false, error: 'Could not reach the B Moni sandbox' };
  }
}

/** Multipart forwarding: the boundary Content-Type is set by fetch, never manually. */
async function bmoniMultipartRequest(path: string, form: FormData): Promise<BMoniResult> {
  if (!apiKey()) {
    return { success: false, error: 'BMONI_API_KEY is not configured on the server' };
  }

  try {
    const response = await fetch(`${baseUrl()}${path}`, {
      method: 'POST',
      headers: { 'x-api-key': apiKey() },
      body: form,
    });
    return await parseBMoniResponse(response);
  } catch (error) {
    console.error('B Moni request failed:', 'POST', path, error);
    return { success: false, error: 'Could not reach the B Moni sandbox' };
  }
}

function safeJson(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/** POST /v1/users — requires firstName, email, phoneNumber (E.164). */
export function createBMoniUser(input: {
  firstName: string;
  lastName?: string;
  email: string;
  phoneNumber: string;
}) {
  return bmoniRequest('POST', '/v1/users', {
    firstName: input.firstName,
    lastName: input.lastName || 'Student',
    email: input.email,
    phoneNumber: input.phoneNumber,
  });
}

/** The shared sandbox rejects duplicate contact details, so reuse by listing first. */
export function listBMoniUsers() {
  return bmoniRequest('GET', '/v1/users?page=1&limit=50');
}

/**
 * Create (or reuse, when the shared sandbox already owns the contact details)
 * a B Moni identity. The hackathon sandbox is shared, so colliding phone
 * numbers are retried with synthesized unique contact details. Returns the
 * profile or null when the sandbox is unreachable/misconfigured.
 */
export async function resolveBMoniAccount(input: {
  firstName: string;
  lastName?: string;
  email: string;
  phoneNumber: string;
}) {
  const attempts = [
    { email: input.email, phoneNumber: input.phoneNumber },
    { email: input.email, phoneNumber: uniquePhone() },
    { email: `allowii-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`, phoneNumber: uniquePhone() },
  ];

  for (const attempt of attempts) {
    const result = await createBMoniUser({ ...input, ...attempt });
    const created = (result.data as any)?.user ?? (result as any).data;
    if (result.success && created) return created;

    const all = await listBMoniUsers();
    const match = all.success
      ? ((all.data as any)?.users ?? []).find(
          (u: any) => u.email === attempt.email || u.phoneNumber === attempt.phoneNumber
        )
      : undefined;
    if (match) return match;
  }
  return null;
}

/** The sandbox requires a unique E.164 per user; other partners claim common ones. */
function uniquePhone() {
  const suffix = String(Math.floor(Math.random() * 1e8)).padStart(8, '0');
  return `+2348${suffix.slice(0, 3)}${suffix.slice(3)}`.slice(0, 14);
}

/** Every other endpoint is keyed on bmoniUserId, not the partner user id. */
export function getBMoniUser(bmoniUserId: string) {
  return bmoniRequest('GET', `/v1/users/${bmoniUserId}`);
}

export function getKycReadiness(bmoniUserId: string) {
  return bmoniRequest('GET', `/v1/users/${bmoniUserId}/kyc/readiness`);
}

/** Latest reviewer verdict: pending / approved / action_required, with reject labels. */
export function getKycStatus(bmoniUserId: string) {
  return bmoniRequest('GET', `/v1/users/${bmoniUserId}/kyc/status`);
}

/** Re-syncs stored documents for a fresh review. Only valid while status is action_required. */
export function retryKycReview(bmoniUserId: string, sumsubLevelName: string) {
  return bmoniRequest('POST', `/v1/users/${bmoniUserId}/kyc/retry`, { sumsubLevelName });
}

export function getKycOptions(bmoniUserId: string) {
  return bmoniRequest('GET', `/v1/users/${bmoniUserId}/kyc/options`);
}

export function listKycOccupations(bmoniUserId: string) {
  return bmoniRequest('GET', `/v1/users/${bmoniUserId}/kyc/occupations`);
}

export interface KycUploadFile {
  buffer: Buffer;
  mimeType: string;
  originalName: string;
}

const MAX_KYC_FILE_BYTES = 5 * 1024 * 1024;

/**
 * Boundary check before anything is forwarded upstream. Returns an error
 * message, or null when the payload is acceptable.
 */
export function validateKycUpload(
  kind: 'identification' | 'proof-of-address' | 'biometric',
  fields: Record<string, string>,
  files: KycUploadFile[]
): string | null {
  if (!files.length) return 'Attach at least one file.';
  if (kind === 'biometric' && files.length !== 1) return 'Attach exactly one selfie.';
  if (kind !== 'biometric' && files.length > 2) return 'Attach at most two files (front and back).';
  if (!fields.type?.trim()) return 'Choose the document type.';
  if (kind === 'identification') {
    if (!fields.documentNumber?.trim()) return 'Enter the document number.';
    if (!fields.issuingCountry?.trim()) return 'Enter the issuing country.';
    if (!/^[A-Z]{3}$/.test(fields.issuingCountry.trim().toUpperCase())) {
      return 'Issuing country must be a 3-letter ISO code (e.g. NGA).';
    }
  }
  for (const file of files) {
    if (!file.buffer.length) return `${file.originalName} is empty.`;
    if (file.buffer.length > MAX_KYC_FILE_BYTES) return `${file.originalName} is larger than 5 MB.`;
    if (!file.mimeType.startsWith('image/') && file.mimeType !== 'application/pdf') {
      return `${file.originalName} must be an image or pdf.`;
    }
  }
  return null;
}

function toFormFile(file: KycUploadFile) {
  return new Blob([new Uint8Array(file.buffer)], { type: file.mimeType });
}

export async function uploadIdentificationDocument(bmoniUserId: string, input: {
  files: KycUploadFile[];
  type: string;
  documentNumber: string;
  issuingCountry: string;
  issueDate?: string;
  expirationDate?: string;
}) {
  const form = new FormData();
  for (const file of input.files) form.append('files', toFormFile(file), file.originalName);
  form.append('type', input.type);
  form.append('documentNumber', input.documentNumber);
  form.append('issuingCountry', input.issuingCountry);
  if (input.issueDate) form.append('issueDate', input.issueDate);
  if (input.expirationDate) form.append('expirationDate', input.expirationDate);
  return bmoniMultipartRequest(`/v1/users/${bmoniUserId}/kyc/documents/identification`, form);
}

export async function uploadProofOfAddressDocument(bmoniUserId: string, input: {
  files: KycUploadFile[];
  type: string;
}) {
  const form = new FormData();
  for (const file of input.files) form.append('files', toFormFile(file), file.originalName);
  form.append('type', input.type);
  return bmoniMultipartRequest(`/v1/users/${bmoniUserId}/kyc/documents/proof-of-address`, form);
}

export async function uploadBiometricDocument(bmoniUserId: string, input: {
  selfie: KycUploadFile[];
  type: string;
}) {
  const form = new FormData();
  for (const file of input.selfie) form.append('selfie', toFormFile(file), file.originalName);
  form.append('type', input.type);
  return bmoniMultipartRequest(`/v1/users/${bmoniUserId}/kyc/documents/biometric`, form);
}

/**
 * PATCH /v1/users/{userId}/kyc — submit identity data (address, BVN/NIN
 * details). The kyc/readiness endpoint is ground truth for what is still
 * missing after this call.
 */
export function submitKyc(bmoniUserId: string, payload: Record<string, unknown>) {
  return bmoniRequest('PATCH', `/v1/users/${bmoniUserId}/kyc`, payload);
}

/**
 * POST /v1/users/{userId}/kyc/activate — spins up the virtual bank account
 * rails (CNGN NUBAN for Nigerian users) once readiness reports ready.
 */
export function activateKyc(bmoniUserId: string, payload: Record<string, unknown>) {
  return bmoniRequest('POST', `/v1/users/${bmoniUserId}/kyc/activate`, payload);
}

/** GET /v1/users/{userId}/smart-wallets/account/balances — per-currency wallet balances. */
export function getWalletBalances(bmoniUserId: string) {
  return bmoniRequest('GET', `/v1/users/${bmoniUserId}/smart-wallets/account/balances`);
}

/** Deposit accounts: pooled activation VBAs until Nigeria onboarding issues a personal NUBAN. */
export function getDepositAccounts(bmoniUserId: string) {
  return bmoniRequest('GET', `/v1/users/${bmoniUserId}/bank-accounts/deposit-accounts`);
}

export function getOnboardingStatus(bmoniUserId: string) {
  return bmoniRequest('GET', `/v1/users/${bmoniUserId}/onboarding/status`);
}

/** Anchor/Nigeria onboarding — the step that provisions the user's own NUBAN. */
export function startNigeriaOnboarding(
  bmoniUserId: string,
  payload: { bvn: string; ngnWalletAddress: string; ngnWalletIndex: number }
) {
  return bmoniRequest('POST', `/v1/users/${bmoniUserId}/onboarding/start-nigeria`, payload);
}

/** The sandbox keys Nigeria onboarding on the NGN wallet's position in the wallet set. */
export async function getNgnWallet(bmoniUserId: string): Promise<BMoniResult<{ address: string; index: number; smartWalletId: string } | null>> {
  const wallets = await bmoniRequest<any[]>('GET', `/v1/users/${bmoniUserId}/smart-wallets/account/wallets`);
  if (!wallets.success) return { success: false, error: wallets.error, status: wallets.status };

  const list = Array.isArray(wallets.data) ? wallets.data : [];
  const index = list.findIndex(w => String(w?.currency).toUpperCase() === 'NGN');
  if (index === -1) return { success: true, data: null };

  const wallet = list[index];
  return { success: true, data: { address: String(wallet.walletAddress), index, smartWalletId: String(wallet.id) } };
}

export function listNigerianBanks(bmoniUserId: string) {
  return bmoniRequest('GET', `/v1/users/${bmoniUserId}/bank-accounts/nigerian-banks`);
}

/** Resolves the registered account holder name for a 10-digit NUBAN. */
export function verifyNigerianAccount(bmoniUserId: string, bankCode: string, accountNumber: string) {
  return bmoniRequest('POST', `/v1/users/${bmoniUserId}/bank-accounts/verify-nigerian-account`, {
    bankCode,
    accountNumber,
  });
}

/** Live NGN rate against a settlement currency, e.g. USD. */
export function getExchangeRate(bmoniUserId: string, from = 'NGN', to = 'USD') {
  return bmoniRequest('GET', `/v1/users/${bmoniUserId}/exchange/rate/${from}/${to}`);
}

export function supportedCurrencies() {
  return bmoniRequest('GET', '/v1/smart-wallets/supported-currencies');
}

/**
 * Smart wallets and money movement are intentionally not called here.
 * create-managed requires an owner-proof challenge signed (EIP-191) by the
 * end user's own device key, which only the B Moni embedded SDK can do.
 * The backend therefore never fabricates a signature or moves funds.
 */
export function createOwnerProofChallenge(bmoniUserId: string, currency: string, userOwnerAddress: string) {
  return bmoniRequest('POST', `/v1/users/${bmoniUserId}/smart-wallets/owner-proof-challenges`, {
    currency,
    userOwnerAddress,
  });
}

/**
 * Deploys a managed smart wallet after the user has signed the owner-proof
 * challenge with their own device key. The signature must come from the
 * browser wallet — never fabricated server-side.
 */
export function createManagedSmartWallet(bmoniUserId: string, payload: {
  currency: string;
  userOwnerAddress: string;
  ownerProofSignature: string;
  ownerProofChallengeId: string;
}) {
  return bmoniRequest('POST', `/v1/users/${bmoniUserId}/smart-wallets/create-managed`, {
    currency: payload.currency,
    userOwnerAddress: payload.userOwnerAddress,
    ownerProofSignature: payload.ownerProofSignature,
    ownerProofChallengeId: payload.ownerProofChallengeId,
  });
}

/**
 * Round-Up Savings: get an exchange quote for converting spare change.
 * POST /v1/exchange/quote — returns the rate and estimated output amount.
 */
export function getExchangeQuote(bmoniUserId: string, payload: {
  fromCurrency: string;
  toCurrency: string;
  amount: number;
}) {
  return bmoniRequest('POST', `/v1/users/${bmoniUserId}/exchange/quote`, {
    fromCurrency: payload.fromCurrency,
    toCurrency: payload.toCurrency,
    amount: payload.amount,
  });
}

/**
 * Round-Up Savings: transfer converted funds into a smart wallet.
 * POST /v1/transactions/transfer — requires a deployed smart wallet.
 */
export function createTransfer(bmoniUserId: string, payload: {
  fromCurrency: string;
  toCurrency: string;
  amount: number;
  destinationWalletAddress: string;
}) {
  return bmoniRequest('POST', `/v1/users/${bmoniUserId}/transactions/transfer`, {
    fromCurrency: payload.fromCurrency,
    toCurrency: payload.toCurrency,
    amount: payload.amount,
    destinationWalletAddress: payload.destinationWalletAddress,
  });
}
