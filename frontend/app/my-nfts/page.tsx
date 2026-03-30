'use client';

import { useEffect, useState } from 'react';
import NftCard from '../../components/NftCard';
import { api, getToken } from '../../lib/api';

type MyNft = {
  instance_id: string;
  name: string;
  serial_no: number;
  width: number;
  height: number;
  background_file?: string | null;
  color_hex?: string | null;
  model_file: string;
  emoji_value?: string | null;
  blockchain_hash?: string;
};

export default function MyNftsPage() {
  const [items, setItems] = useState<MyNft[]>([]);

  useEffect(() => {
    api<MyNft[]>('/users/me/nfts', undefined, getToken()).then(setItems).catch(() => setItems([]));
  }, []);

  return (
    <main>
      <h1>Мои NFT</h1>
      <div className="grid grid-3">
        {items.map((item) => (
          <NftCard key={item.instance_id} item={{ ...item, id: item.instance_id }} />
        ))}
      </div>
    </main>
  );
}
