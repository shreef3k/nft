export type SessionUser = {
  sub: string;
  email: string;
  role: 'admin' | 'user';
};

export function parseJwt(token: string): SessionUser | null {
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    const payload = JSON.parse(atob(parts[1]));
    return payload;
  } catch {
    return null;
  }
}

export function getSession() {
  if (typeof window === 'undefined') return { token: '', user: null as SessionUser | null };
  const token = localStorage.getItem('token') || '';
  return { token, user: token ? parseJwt(token) : null };
}

export function logout() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('token');
}
