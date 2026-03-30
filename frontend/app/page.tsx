'use client';

import { useEffect, useState } from 'react';
import NftCard from '../components/NftCard';
import { api, getToken } from '../lib/api';

type Listing = {
  id: string;
  price: string;
  name: string;
  serial_no: number;
  background_image: string;
  model_image: string;
  hex_code: string;
};

export default function MarketplacePage() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [error, setError] = useState('');

  async function load() {
    try {
      const data = await api<Listing[]>('/marketplace/listings');
      setListings(data);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function buy(listingId: string) {
    try {
      await api(`/orders/${listingId}/buy`, { method: 'POST' }, getToken());
      await load();
      alert('NFT успешно куплен');
    } catch (e) {
      alert(`Ошибка покупки: ${(e as Error).message}`);
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <main className="grid" style={{ gap: 20 }}>
      <h1>Маркетплейс NFT</h1>
      {error ? <p>{error}</p> : null}
      <div className="grid grid-3">
        {listings.map((item) => (
          <NftCard key={item.id} item={item} onBuy={buy} />
        ))}
      </div>
    </main>
  );
}
