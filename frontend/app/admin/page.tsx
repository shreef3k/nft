'use client';

import { FormEvent, useState } from 'react';
import { api, getToken } from '../../lib/api';

export default function AdminPage() {
  const [name, setName] = useState('');
  const [imageUrl, setImageUrl] = useState('https://placehold.co/600x600/png');
  const [hex, setHex] = useState('#FF00AA');

  async function createBackground(e: FormEvent) {
    e.preventDefault();
    await api('/admin/backgrounds', { method: 'POST', body: JSON.stringify({ name, imageUrl, rarity: 5 }) }, getToken());
    alert('Фон создан');
  }

  async function createModel(e: FormEvent) {
    e.preventDefault();
    await api('/admin/models', { method: 'POST', body: JSON.stringify({ name, imageUrl, rarity: 5 }) }, getToken());
    alert('Модель создана');
  }

  async function createColor(e: FormEvent) {
    e.preventDefault();
    await api('/admin/colors', { method: 'POST', body: JSON.stringify({ name, hexCode: hex, rarity: 5 }) }, getToken());
    alert('Цвет создан');
  }

  return (
    <main className="grid grid-3">
      <form className="card grid" onSubmit={createBackground}>
        <h3>Новый Background</h3>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Название" />
        <input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="Image URL" />
        <button type="submit">Создать</button>
      </form>

      <form className="card grid" onSubmit={createModel}>
        <h3>Новая Model</h3>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Название" />
        <input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="Image URL" />
        <button type="submit">Создать</button>
      </form>

      <form className="card grid" onSubmit={createColor}>
        <h3>Новый Color</h3>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Название" />
        <input value={hex} onChange={(e) => setHex(e.target.value)} placeholder="#RRGGBB" />
        <button type="submit">Создать</button>
      </form>
    </main>
  );
}
