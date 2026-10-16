import type { SessionProfile } from '../context/store';

const TOKEN_KEY = 'allowii-token';
const REFRESH_KEY = 'allowii-refresh';
const EXPIRES_KEY = 'allowii-token-exp';

async function postJson(path: string, body?: unknown, token?: string) {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { ok: res.ok, status: res.status, data: await res.json().catch(() => ({})) };
}

export function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_KEY);
  localStorage.removeItem(EXPIRES_KEY);
}

/** The server proxies Supabase Auth, so sessions carry a refresh token and a 1h expiry. */
function storeSession(data: { token?: string; refreshToken?: string; expiresIn?: number }) {
  if (!data?.token) return;
  localStorage.setItem(TOKEN_KEY, data.token);
  if (data.refreshToken) localStorage.setItem(REFRESH_KEY, data.refreshToken);
  if (data.expiresIn) localStorage.setItem(EXPIRES_KEY, String(Date.now() + data.expiresIn * 1000));
}

let refreshInFlight: Promise<string | null> | null = null;

async function refreshSession(): Promise<string | null> {
  const refreshToken = localStorage.getItem(REFRESH_KEY);
  if (!refreshToken) return null;
  if (!refreshInFlight) {
    refreshInFlight = postJson('/api/auth/refresh', { refreshToken })
      .then(({ ok, data }) => {
        if (!ok || !data?.token) {
          clearSession();
          return null;
        }
        storeSession(data);
        return data.token as string;
      })
      .catch(() => null)
      .finally(() => { refreshInFlight = null; });
  }
  return refreshInFlight;
}

/** Real credentials, verified by Supabase Auth through the backend. */
export async function login(email: string, password: string, _remember: boolean): Promise<SessionProfile> {
  const { ok, data } = await postJson('/api/auth/login', { email, password });
  if (!ok || !data?.token) throw new Error(data?.error || 'Login failed');
  storeSession(data);
  return data.user as SessionProfile;
}

export async function register(payload: { name: string; email: string; password: string; university?: string; phoneNumber?: string }): Promise<SessionProfile> {
  const { ok, data } = await postJson('/api/auth/register', payload);
  if (!ok || !data?.token) throw new Error(data?.error || 'Registration failed');
  storeSession(data);
  return data.user as SessionProfile;
}

/** Demo users get a real Supabase session so backend routes stay authenticated. */
export async function getSessionToken(): Promise<string> {
  const cached = getStoredToken();
  const expiresAt = Number(localStorage.getItem(EXPIRES_KEY) || 0);
  if (cached) {
    if (!expiresAt || Date.now() < expiresAt - 60_000) return cached;
    const refreshed = await refreshSession();
    if (refreshed) return refreshed;
  }

  const { ok, data } = await postJson('/api/auth/demo-session');
  if (!ok || !data?.token) throw new Error(data?.error || 'Backend unavailable');
  storeSession(data);
  return data.token;
}

/** Authenticated fetch: transparently refreshes the Supabase session once on 401. */
async function authFetch(path: string, init: RequestInit, retryOn401 = true): Promise<Response> {
  const token = await getSessionToken();
  const res = await fetch(path, {
    ...init,
    headers: { ...init.headers, Authorization: `Bearer ${token}` },
  });
  if (res.status === 401 && retryOn401) {
    const refreshed = await refreshSession();
    if (refreshed) {
      return authFetch(path, { ...init, headers: { ...init.headers, Authorization: `Bearer ${refreshed}` } }, false);
    }
  }
  return res;
}

async function readJson(res: Response) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`);
  return data;
}

export async function apiGet(path: string) {
  return readJson(await authFetch(`/api${path}`, { headers: {} }));
}

export async function apiPost(path: string, body?: unknown) {
  return readJson(await authFetch(`/api${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  }));
}

export async function apiPut(path: string, body?: unknown) {
  return readJson(await authFetch(`/api${path}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  }));
}

export async function apiPatch(path: string, body?: unknown) {
  return readJson(await authFetch(`/api${path}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  }));
}

export async function apiUpload(path: string, form: FormData) {
  const token = await getSessionToken();
  const res = await fetch(`/api${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  return readJson(res);
}

export const bmoni = {
  connect: () => apiPost('/bmoni/connect'),
  status: () => apiGet('/bmoni/status'),
  balances: () => apiGet('/bmoni/balances'),
  depositAccounts: () => apiGet('/bmoni/deposit-accounts'),
  kycUpdate: (payload: Record<string, unknown>) => apiPatch('/bmoni/kyc', payload),
  kycOptions: () => apiGet('/bmoni/kyc/options'),
  kycOccupations: () => apiGet('/bmoni/kyc/occupations'),
  kycActivate: (payload: Record<string, unknown>) => apiPost('/bmoni/kyc/activate', payload),
  kycStatus: () => apiGet('/bmoni/kyc/status'),
  kycRetry: () => apiPost('/bmoni/kyc/retry', { sumsubLevelName: 'id-and-liveness' }),
  startNigeriaOnboarding: (bvn: string) => apiPost('/bmoni/onboarding/nigeria', { bvn }),
  kycUploadIdentification: (form: FormData) => apiUpload('/bmoni/kyc/documents/identification', form),
  kycUploadProofOfAddress: (form: FormData) => apiUpload('/bmoni/kyc/documents/proof-of-address', form),
  kycUploadBiometric: (form: FormData) => apiUpload('/bmoni/kyc/documents/biometric', form),
  rate: (to = 'USD') => apiGet(`/bmoni/rate?to=${to}`),
  banks: () => apiGet('/bmoni/banks'),
  verifyAccount: (bankCode: string, accountNumber: string) =>
    apiPost('/bmoni/verify-account', { bankCode, accountNumber }),
  walletChallenge: (currency: string, userOwnerAddress: string) =>
    apiPost('/bmoni/wallet/challenge', { currency, userOwnerAddress }),
  walletDeploy: (payload: { currency: string; userOwnerAddress: string; signature: string; challengeId?: string }) =>
    apiPost('/bmoni/wallet/deploy', payload),
};

export const roundUp = {
  getSettings: () => apiGet('/round-up/settings'),
  updateSettings: (settings: Record<string, unknown>) => apiPut('/round-up/settings', settings),
  getStatus: () => apiGet('/round-up/status'),
  calculate: () => apiPost('/round-up/calculate'),
  sweep: () => apiPost('/round-up/sweep'),
};

export const telegramBot = {
  status: () => apiGet('/bot/user/status'),
  newLinkCode: () => apiPost('/bot/user/link-code'),
};
