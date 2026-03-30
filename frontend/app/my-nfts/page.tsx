'use client';

import { useEffect, useState } from 'react';
import { api, getToken } from '../../lib/api';

type MyNft = {
  instance_id: string;
  name: string;
  serial_no: number;
  background_image: string;
  model_image: string;
  hex_code: string;
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
          <div className="card" key={item.instance_id}>
            <div className="preview">
              <img src={item.background_image} alt="bg" />
              <img src={item.model_image} alt="model" />
              <div className="tint" style={{ background: item.hex_code }} />
            </div>
            <p>{item.name}</p>
            <small>Серия #{item.serial_no}</small>
          </div>
        ))}
      </div>
    </main>
  );
}
