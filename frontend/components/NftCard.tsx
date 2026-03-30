'use client';

type Listing = {
  id: string;
  price: string;
  name: string;
  serial_no: number;
  background_image: string;
  model_image: string;
  hex_code: string;
};

export default function NftCard({ item, onBuy }: { item: Listing; onBuy?: (id: string) => void }) {
  return (
    <div className="card">
      <div className="preview">
        <img src={item.background_image} alt="background" />
        <img src={item.model_image} alt="model" />
        <div className="tint" style={{ background: item.hex_code }} />
      </div>
      <h3>{item.name}</h3>
      <small>Серия #{item.serial_no}</small>
      <p>Цена: {item.price}</p>
      {onBuy ? <button onClick={() => onBuy(item.id)}>Купить</button> : null}
    </div>
  );
}
