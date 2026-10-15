import type { SessionProfile } from '../context/store';

const TOKEN_KEY = 'allowii-token';

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
}

/** Real credentials. `remember` decides how long the issued session stays valid. */
export async function login(email: string, password: string, remember: boolean): Promise<SessionProfile> {
  const { ok, data } = await postJson('/api/auth/login', { email, password, remember });
  if (!ok || !data?.token) throw new Error(data?.error || 'Login failed');
  localStorage.setItem(TOKEN_KEY, data.token);
  return data.user as SessionProfile;
}

export async function register(payload: { name: string; email: string; password: string; university?: string; phoneNumber?: string }): Promise<SessionProfile> {
  const { ok, data } = await postJson('/api/auth/register', payload);
  if (!ok || !data?.token) throw new Error(data?.error || 'Registration failed');
  localStorage.setItem(TOKEN_KEY, data.token);
  return data.user as SessionProfile;
}

/** Demo users get a real server session so backend routes stay authenticated. */
export async function getSessionToken(): Promise<string> {
  const cached = getStoredToken();
  if (cached) return cached;

  const { ok, data } = await postJson('/api/auth/demo-session');
  if (!ok || !data?.token) throw new Error(data?.error || 'Backend unavailable');
  localStorage.setItem(TOKEN_KEY, data.token);
  return data.token;
}

export async function apiGet(path: string) {
  const token = await getSessionToken();
  const res = await fetch(`/api${path}`, { headers: { Authorization: `Bearer ${token}` } });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`);
  return data;
}

export async function apiPost(path: string, body?: unknown) {
  const token = await getSessionToken();
  const out = await postJson(`/api${path}`, body, token);
  if (!out.ok) throw new Error(out.data?.error || `Request failed (${out.status})`);
  return out.data;
}

export async function apiPut(path: string, body?: unknown) {
  const token = await getSessionToken();
  const res = await fetch(`/api${path}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`);
  return data;
}

export async function apiPatch(path: string, body?: unknown) {
  const token = await getSessionToken();
  const res = await fetch(`/api${path}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || `Request failed (${res.status})`);
  return data;
}

export async function apiUpload(path: string, form: FormData) {
  const token = await getSessionToken();
  const res = await fetch(`/api${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || `Upload failed (${res.status})`);
  return data;
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
