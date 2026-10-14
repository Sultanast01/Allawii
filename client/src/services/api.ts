const TOKEN_KEY = 'moneva-api-token';

async function postJson(path: string, body?: unknown, token?: string) {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { ok: res.ok, status: res.status, data: await res.json().catch(() => ({})) };
}

/** Demo users get a real server session so backend routes stay authenticated. */
export async function getSessionToken(): Promise<string> {
  const cached = localStorage.getItem(TOKEN_KEY);
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

export const bmoni = {
  connect: () => apiPost('/bmoni/connect'),
  status: () => apiGet('/bmoni/status'),
  rate: (to = 'USD') => apiGet(`/bmoni/rate?to=${to}`),
  banks: () => apiGet('/bmoni/banks'),
  verifyAccount: (bankCode: string, accountNumber: string) =>
    apiPost('/bmoni/verify-account', { bankCode, accountNumber }),
};
