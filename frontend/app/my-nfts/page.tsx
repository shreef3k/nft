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
  background_image?: string | null;
  color_hex?: string | null;
  model_animation: string;
  emoji_value?: string | null;
  blockchain_hash?: string;
};

export default function MyNftsPage() {
  const [items, setItems] = useState<MyNft[]>([]);

  useEffect(() => {
    api<MyNft[]>('/users/me/nfts', undefined, getToken())
      .then(setItems)
      .catch(() => setItems([]));
  }, []);

  return (
    <main>
      <h1>Мои NFT</h1>
      <div className="grid grid-3">
        {items.map((item) => (
          <NftCard
            key={item.instance_id}
            item={{
              id: item.instance_id,
              name: item.name,
              serial_no: item.serial_no,
              width: item.width,
              height: item.height,
              background_image: item.background_image,
              color_hex: item.color_hex,
              model_animation: item.model_animation,
              emoji_value: item.emoji_value,
              blockchain_hash: item.blockchain_hash
            }}
          />
        ))}
      </div>
    </main>
  );
}
