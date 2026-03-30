'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { api, getToken } from '../../lib/api';
import { getSession } from '../../lib/auth';

type Option = { id: string; name?: string; value?: string };
type Collection = { id: string; name: string; max_possible_supply: number; custom_supply: number };

export default function AdminPage() {
  const [allowed, setAllowed] = useState(false);
  const [ready, setReady] = useState(false);
  const [backgrounds, setBackgrounds] = useState<Option[]>([]);
  const [models, setModels] = useState<Option[]>([]);
  const [emojis, setEmojis] = useState<Option[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);

  const [name, setName] = useState('');
  const [imageUrl, setImageUrl] = useState('https://placehold.co/512x512/png');
  const [animationUrl, setAnimationUrl] = useState('https://media.giphy.com/media/v1.Y2lkPTc5MGI3NjExM3V5NnY2ZnBjMjV4b2N2c3VnM3N2c2M0NnQ4ZmQ0a2l4Y3RnczZwdCZlcD12MV9naWZzX3NlYXJjaCZjdD1n/13HgwGsXF0aiGY/giphy.gif');
  const [hex, setHex] = useState('#4466FF');
  const [emoji, setEmoji] = useState('🔥');
  const [collectionName, setCollectionName] = useState('Genesis');
  const [collectionDescription, setCollectionDescription] = useState('First collection');

  const [selectedCollectionId, setSelectedCollectionId] = useState('');
  const [selectedBackgroundId, setSelectedBackgroundId] = useState('');
  const [selectedModelId, setSelectedModelId] = useState('');
  const [selectedEmojiId, setSelectedEmojiId] = useState('');

  const [mintSupply, setMintSupply] = useState(1);
  const [mintPrefix, setMintPrefix] = useState('Genesis NFT');

  const selectedCollection = useMemo(
    () => collections.find((c) => c.id === selectedCollectionId),
    [collections, selectedCollectionId]
  );

  async function load() {
    const data = await api<{
      backgrounds: Option[];
      models: Option[];
      emojis: Option[];
      collections: Collection[];
    }>('/admin/bootstrap', undefined, getToken());
    setBackgrounds(data.backgrounds);
    setModels(data.models);
    setEmojis(data.emojis);
    setCollections(data.collections);
    if (data.collections[0]) setSelectedCollectionId(data.collections[0].id);
    if (data.backgrounds[0]) setSelectedBackgroundId(data.backgrounds[0].id);
    if (data.models[0]) setSelectedModelId(data.models[0].id);
    if (data.emojis[0]) setSelectedEmojiId(data.emojis[0].id);
  }

  useEffect(() => {
    const session = getSession();
    if (!session.user) {
      location.href = '/login';
      return;
    }
    if (session.user.role !== 'admin') {
      location.href = '/';
      return;
    }
    setAllowed(true);
    setReady(true);
    load().catch(() => null);
  }, []);

  if (!ready) return <p>Проверка доступа...</p>;
  if (!allowed) return null;

  async function createBackground(e: FormEvent) {
    e.preventDefault();
    await api('/admin/backgrounds', { method: 'POST', body: JSON.stringify({ name, imageUrl, colorHex: hex, rarity: 5 }) }, getToken());
    await load();
  }

  async function createModel(e: FormEvent) {
    e.preventDefault();
    await api('/admin/models', { method: 'POST', body: JSON.stringify({ name, imageUrl, animationUrl, rarity: 5 }) }, getToken());
    await load();
  }

  async function createEmoji(e: FormEvent) {
    e.preventDefault();
    await api('/admin/emojis', { method: 'POST', body: JSON.stringify({ value: emoji, rarity: 5 }) }, getToken());
    await load();
  }

  async function createCollection(e: FormEvent) {
    e.preventDefault();
    await api('/admin/collections', { method: 'POST', body: JSON.stringify({ name: collectionName, description: collectionDescription }) }, getToken());
    await load();
  }

  async function attachBackground() {
    await api(`/admin/collections/${selectedCollectionId}/backgrounds`, { method: 'POST', body: JSON.stringify({ backgroundId: selectedBackgroundId }) }, getToken());
    await load();
  }

  async function attachModel() {
    await api(`/admin/collections/${selectedCollectionId}/models`, { method: 'POST', body: JSON.stringify({ modelId: selectedModelId }) }, getToken());
    await load();
  }

  async function attachEmoji() {
    await api(`/admin/collections/${selectedCollectionId}/emojis`, { method: 'POST', body: JSON.stringify({ emojiId: selectedEmojiId }) }, getToken());
    await load();
  }

  async function mintCollection() {
    await api(`/admin/collections/${selectedCollectionId}/mint`, {
      method: 'POST',
      body: JSON.stringify({ namePrefix: mintPrefix, description: 'Minted from admin panel', customSupply: Number(mintSupply) })
    }, getToken());
    alert('Mint завершен');
  }

  return (
    <main className="grid" style={{ gap: 18 }}>
      <h1>Админ панель</h1>
      <small>Все NFT фиксированного размера 512x512. Сначала: коллекция → компоненты → расчет тиража → mint.</small>

      <section className="grid grid-3">
        <form className="card grid" onSubmit={createBackground}>
          <h3>1) Фоны</h3>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Название" />
          <input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="Image URL (optional)" />
          <input value={hex} onChange={(e) => setHex(e.target.value)} placeholder="#RRGGBB" />
          <button type="submit">Создать фон</button>
        </form>

        <form className="card grid" onSubmit={createModel}>
          <h3>2) Модели (анимация)</h3>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Название" />
          <input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="Preview image URL" />
          <input value={animationUrl} onChange={(e) => setAnimationUrl(e.target.value)} placeholder="Animation GIF/WebP URL" />
          <button type="submit">Создать модель</button>
        </form>

        <form className="card grid" onSubmit={createEmoji}>
          <h3>3) Эмодзи</h3>
          <input value={emoji} onChange={(e) => setEmoji(e.target.value)} placeholder="🔥" />
          <button type="submit">Добавить эмодзи</button>
        </form>
      </section>

      <section className="card grid">
        <h3>4) Создать коллекцию</h3>
        <input value={collectionName} onChange={(e) => setCollectionName(e.target.value)} placeholder="Название коллекции" />
        <input value={collectionDescription} onChange={(e) => setCollectionDescription(e.target.value)} placeholder="Описание" />
        <button onClick={(e) => createCollection(e as unknown as FormEvent)}>Создать коллекцию</button>
      </section>

      <section className="card grid">
        <h3>5) Привязать компоненты к коллекции</h3>
        <label>Коллекция</label>
        <select value={selectedCollectionId} onChange={(e) => setSelectedCollectionId(e.target.value)}>
          {collections.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>

        <div className="grid" style={{ gridTemplateColumns: '1fr auto' }}>
          <select value={selectedBackgroundId} onChange={(e) => setSelectedBackgroundId(e.target.value)}>
            {backgrounds.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
          <button onClick={attachBackground}>Добавить фон</button>
        </div>

        <div className="grid" style={{ gridTemplateColumns: '1fr auto' }}>
          <select value={selectedModelId} onChange={(e) => setSelectedModelId(e.target.value)}>
            {models.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
          <button onClick={attachModel}>Добавить модель</button>
        </div>

        <div className="grid" style={{ gridTemplateColumns: '1fr auto' }}>
          <select value={selectedEmojiId} onChange={(e) => setSelectedEmojiId(e.target.value)}>
            {emojis.map((em) => <option key={em.id} value={em.id}>{em.value}</option>)}
          </select>
          <button onClick={attachEmoji}>Добавить эмодзи</button>
        </div>
      </section>

      <section className="card grid">
        <h3>6) Mint из коллекции + блокчейн уникализация</h3>
        <small>Максимум комбинаций: {selectedCollection?.max_possible_supply ?? 0}</small>
        <input value={mintPrefix} onChange={(e) => setMintPrefix(e.target.value)} placeholder="Префикс NFT" />
        <input type="number" min={1} value={mintSupply} onChange={(e) => setMintSupply(Number(e.target.value))} />
        <button onClick={mintCollection}>Запустить mint</button>
      </section>
    </main>
  );
}
