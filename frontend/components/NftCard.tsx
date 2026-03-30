'use client';

type Listing = {
  id: string;
  price?: string;
  name: string;
  serial_no: number;
  width: number;
  height: number;
  background_file?: string | null;
  color_hex?: string | null;
  model_file: string;
  emoji_value?: string | null;
  blockchain_hash?: string | null;
};

export default function NftCard({ item, onBuy }: { item: Listing; onBuy?: (id: string) => void }) {
  return (
    <div className="card">
      <div className="preview" style={{ width: item.width / 2, height: item.height / 2, margin: '0 auto' }}>
        {item.background_file ? <img src={item.background_file} alt="background" /> : null}
        <div style={{ position: 'absolute', inset: 0, background: item.color_hex ?? '#3c4d8d' }} />
        <img src={item.model_file} alt="model" style={{ objectFit: 'contain', zIndex: 2 }} />
        <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', zIndex: 3, fontSize: 36 }}>
          {item.emoji_value ?? '✨'}
        </div>
      </div>
      <h3>{item.name}</h3>
      <small>Серия #{item.serial_no} · {item.width}x{item.height}</small>
      {item.blockchain_hash ? <small style={{ display: 'block' }}>hash: {item.blockchain_hash.slice(0, 16)}...</small> : null}
      {item.price ? <p>Цена: {item.price}</p> : null}
      {onBuy ? <button onClick={() => onBuy(item.id)}>Купить</button> : null}
    </div>
  );
}
