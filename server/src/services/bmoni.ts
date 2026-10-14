// Read lazily: ES module imports are evaluated before index.ts runs dotenv.config().
const baseUrl = () => process.env.BMONI_BASE_URL || 'https://embedded-dev.bmoni.com';
const apiKey = () => process.env.BMONI_API_KEY || '';

export interface BMoniResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  status?: number;
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

    const text = await response.text();
    const parsed = text ? safeJson(text) : undefined;

    if (!response.ok) {
      const message =
        (parsed as any)?.message ?? (parsed as any)?.error ?? `B Moni responded with ${response.status}`;
      return { success: false, error: Array.isArray(message) ? message.join(', ') : String(message), status: response.status };
    }

    return { success: true, data: parsed as T, status: response.status };
  } catch (error) {
    console.error('B Moni request failed:', method, path, error);
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

/** Every other endpoint is keyed on bmoniUserId, not the partner user id. */
export function getBMoniUser(bmoniUserId: string) {
  return bmoniRequest('GET', `/v1/users/${bmoniUserId}`);
}

export function getKycReadiness(bmoniUserId: string) {
  return bmoniRequest('GET', `/v1/users/${bmoniUserId}/kyc/readiness`);
}

export function getOnboardingStatus(bmoniUserId: string) {
  return bmoniRequest('GET', `/v1/users/${bmoniUserId}/onboarding/status`);
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
