export const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

function parseResponseError(text: string, fallback: string) {
  if (!text) return fallback;
  try {
    const data = JSON.parse(text);
    return data?.message || fallback;
  } catch {
    return text;
  }
}

function dropSessionOnUnauthorized(status: number) {
  if (status !== 401 || typeof window === 'undefined') return;
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  if (window.location.pathname !== '/login') window.location.href = '/login';
}

export async function api<T>(path: string, init?: RequestInit, token?: string): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers || {})
    },
    cache: 'no-store'
  });

  if (!res.ok) {
    const text = await res.text();
    dropSessionOnUnauthorized(res.status);
    throw new Error(parseResponseError(text, `API error ${res.status}`));
  }

  return res.json();
}

export async function uploadApi<T = unknown>(path: string, formData: FormData, token?: string): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: formData,
    cache: 'no-store'
  });

  if (!res.ok) {
    const text = await res.text();
    dropSessionOnUnauthorized(res.status);
    throw new Error(parseResponseError(text, `Upload failed (${res.status})`));
  }

  return res.json();
}

export function getToken() {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem('token') || '';
}
