'use client';

import { useEffect, useState } from 'react';
import { api, getToken } from '../../lib/api';

type Me = { id: string; email: string; role: string; balance: string };

export default function ProfilePage() {
  const [me, setMe] = useState<Me | null>(null);

  useEffect(() => {
    api<Me>('/auth/me', undefined, getToken())
      .then(setMe)
      .catch(() => {
        location.href = '/login';
      });
  }, []);

  if (!me) return <p>Загрузка профиля...</p>;

  return (
    <main className="card" style={{ maxWidth: 520 }}>
      <h1>Профиль</h1>
      <p>Email: {me.email}</p>
      <p>Роль: {me.role}</p>
      <p>Баланс: {me.balance}</p>
    </main>
  );
}
