'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { API_URL, api, getToken } from '../../lib/api';
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
  const [hex, setHex] = useState('#4466FF');
  const [emoji, setEmoji] = useState('🔥');
  const [collectionName, setCollectionName] = useState('Genesis');
  const [collectionDescription, setCollectionDescription] = useState('First collection');

  const [backgroundFile, setBackgroundFile] = useState<File | null>(null);
  const [modelFile, setModelFile] = useState<File | null>(null);
  const [animationFile, setAnimationFile] = useState<File | null>(null);

  const [selectedCollectionId, setSelectedCollectionId] = useState('');
  const [selectedBackgroundId, setSelectedBackgroundId] = useState('');
  const [selectedModelId, setSelectedModelId] = useState('');
  const [selectedEmojiId, setSelectedEmojiId] = useState('');

  const [mintSupply, setMintSupply] = useState(1);
  const [mintPrefix, setMintPrefix] = useState('Genesis NFT');

  const [c1, setC1] = useState('');
  const [c2, setC2] = useState('');
  const [c3, setC3] = useState('');

  const selectedCollection = useMemo(() => collections.find((c) => c.id === selectedCollectionId), [collections, selectedCollectionId]);

  async function load() {
    const data = await api<{ backgrounds: Option[]; models: Option[]; emojis: Option[]; collections: Collection[] }>('/admin/bootstrap', undefined, getToken());
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
    if (!session.user) return void (location.href = '/login');
    if (session.user.role !== 'admin') return void (location.href = '/');
    setAllowed(true);
    setReady(true);
    load().catch(() => null);
  }, []);

  if (!ready) return <p>Проверка доступа...</p>;
  if (!allowed) return null;

  async function createBackground(e: FormEvent) {
    e.preventDefault();
    if (!backgroundFile) return alert('Нужен файл фона');
    const fd = new FormData();
    fd.append('name', name);
    fd.append('colorHex', hex);
    fd.append('rarity', '5');
    fd.append('backgroundFile', backgroundFile);

    await fetch(`${API_URL}/admin/backgrounds`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${getToken()}` },
      body: fd
    });
    await load();
  }

  async function createModel(e: FormEvent) {
    e.preventDefault();
    if (!modelFile || !animationFile) return alert('Нужны оба файла модели');
    const fd = new FormData();
    fd.append('name', name);
    fd.append('rarity', '5');
    fd.append('modelFile', modelFile);
    fd.append('animationFile', animationFile);

    await fetch(`${API_URL}/admin/models`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${getToken()}` },
      body: fd
    });
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

  async function attachBackground() { await api(`/admin/collections/${selectedCollectionId}/backgrounds`, { method: 'POST', body: JSON.stringify({ backgroundId: selectedBackgroundId }) }, getToken()); await load(); }
  async function attachModel() { await api(`/admin/collections/${selectedCollectionId}/models`, { method: 'POST', body: JSON.stringify({ modelId: selectedModelId }) }, getToken()); await load(); }
  async function attachEmoji() { await api(`/admin/collections/${selectedCollectionId}/emojis`, { method: 'POST', body: JSON.stringify({ emojiId: selectedEmojiId }) }, getToken()); await load(); }

  async function mintCollection() {
    await api(`/admin/collections/${selectedCollectionId}/mint`, {
      method: 'POST',
      body: JSON.stringify({ namePrefix: mintPrefix, description: 'Minted from admin panel', customSupply: Number(mintSupply) })
    }, getToken());
    alert('Mint завершен');
  }

  async function resetFactoryDb() {
    if (c1 !== 'YES' || c2 !== 'RESET' || c3 !== 'FACTORY') return alert('Введите подтверждения: YES / RESET / FACTORY');
    await api('/admin/reset-factory', { method: 'POST', body: JSON.stringify({ confirm1: c1, confirm2: c2, confirm3: c3 }) }, getToken());
    alert('БД сброшена до заводских. Войдите снова: admin@nft.local / admin123');
    location.href = '/login';
  }

  return (
    <main className="grid" style={{ gap: 18 }}>
      <h1>Админ панель</h1>
      <small>Файлы загружаются напрямую (не ссылки). Размер NFT: 512x512.</small>

      <section className="grid grid-3">
        <form className="card grid" onSubmit={createBackground}>
          <h3>1) Фоны (файл)</h3>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Название" />
          <input value={hex} onChange={(e) => setHex(e.target.value)} placeholder="#RRGGBB" />
          <input type="file" accept="image/*" onChange={(e) => setBackgroundFile(e.target.files?.[0] ?? null)} />
          <button type="submit">Создать фон</button>
        </form>

        <form className="card grid" onSubmit={createModel}>
          <h3>2) Модели (файл + анимация)</h3>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Название" />
          <input type="file" accept="image/*" onChange={(e) => setModelFile(e.target.files?.[0] ?? null)} />
          <input type="file" accept="image/gif,image/webp,image/png" onChange={(e) => setAnimationFile(e.target.files?.[0] ?? null)} />
          <button type="submit">Создать модель</button>
        </form>

        <form className="card grid" onSubmit={createEmoji}>
          <h3>3) Эмодзи</h3>
          <input value={emoji} onChange={(e) => setEmoji(e.target.value)} placeholder="🔥" />
          <button type="submit">Добавить эмодзи</button>
        </form>
      </section>

      <section className="card grid">
        <h3>4) Коллекция</h3>
        <input value={collectionName} onChange={(e) => setCollectionName(e.target.value)} placeholder="Название коллекции" />
        <input value={collectionDescription} onChange={(e) => setCollectionDescription(e.target.value)} placeholder="Описание" />
        <button onClick={(e) => createCollection(e as unknown as FormEvent)}>Создать коллекцию</button>
      </section>

      <section className="card grid">
        <h3>5) Привязка компонентов</h3>
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
        <h3>6) Mint</h3>
        <small>Максимум комбинаций: {selectedCollection?.max_possible_supply ?? 0}</small>
        <input value={mintPrefix} onChange={(e) => setMintPrefix(e.target.value)} placeholder="Префикс NFT" />
        <input type="number" min={1} value={mintSupply} onChange={(e) => setMintSupply(Number(e.target.value))} />
        <button onClick={mintCollection}>Запустить mint</button>
      </section>

      <section className="card grid" style={{ border: '1px solid #8a243a' }}>
        <h3>⚠ Полный сброс БД до заводских</h3>
        <small>Введите 3 подтверждения:</small>
        <input placeholder="YES" value={c1} onChange={(e) => setC1(e.target.value)} />
        <input placeholder="RESET" value={c2} onChange={(e) => setC2(e.target.value)} />
        <input placeholder="FACTORY" value={c3} onChange={(e) => setC3(e.target.value)} />
        <button onClick={resetFactoryDb}>СБРОСИТЬ ПОЛНОСТЬЮ</button>
      </section>
    </main>
  );
}
