'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { getSession, logout, SessionUser } from '../lib/auth';

export default function NavBar() {
  const [user, setUser] = useState<SessionUser | null>(null);

  useEffect(() => {
    const session = getSession();
    setUser(session.user);
  }, []);

  return (
    <nav className="nav" style={{ alignItems: 'center', justifyContent: 'space-between' }}>
      <div style={{ display: 'flex', gap: 12 }}>
        <Link href="/">Маркетплейс</Link>
        {user ? <Link href="/my-nfts">Мои NFT</Link> : null}
        {user?.role === 'admin' ? <Link href="/admin">Админ</Link> : null}
      </div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        {user ? (
          <>
            <small>{user.email}</small>
            <button
              className="secondary"
              onClick={() => {
                logout();
                location.href = '/login';
              }}
            >
              Выйти
            </button>
          </>
        ) : (
          <Link href="/login">Вход</Link>
        )}
      </div>
    </nav>
  );
}
