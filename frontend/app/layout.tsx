import './globals.css';
import Link from 'next/link';

export const metadata = {
  title: 'NFT Platform',
  description: 'Centralized NFT marketplace MVP'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body>
        <div className="container">
          <nav className="nav">
            <Link href="/">Маркетплейс</Link>
            <Link href="/my-nfts">Мои NFT</Link>
            <Link href="/admin">Админ</Link>
            <Link href="/login">Вход</Link>
          </nav>
          {children}
        </div>
      </body>
    </html>
  );
}
