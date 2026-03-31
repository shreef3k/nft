'use client';

import { FormEvent, useState } from 'react';
import { api } from '../../lib/api';

export default function LoginPage() {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  async function submit(e: FormEvent) {
    e.preventDefault();
    const endpoint = mode === 'login' ? '/auth/login' : '/auth/register';
    const data = await api<{ token: string }>(endpoint, {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });

    localStorage.setItem('token', data.token);
    location.href = '/';
  }

  return (
    <main className="card" style={{ maxWidth: 420 }}>
      <h1>{mode === 'login' ? 'Вход' : 'Регистрация'}</h1>
      <form onSubmit={submit} className="grid">
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" />
        <input value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Пароль" type="password" />
        <button type="submit">{mode === 'login' ? 'Войти' : 'Создать аккаунт'}</button>
      </form>
      <button className="secondary" onClick={() => setMode(mode === 'login' ? 'register' : 'login')}>
        {mode === 'login' ? 'Нет аккаунта? Регистрация' : 'Есть аккаунт? Вход'}
      </button>
      <p><small>Демо-админ: admin@nft.local / admin123</small></p>
    </main>
  );
}
