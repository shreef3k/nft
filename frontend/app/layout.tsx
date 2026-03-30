import './globals.css';
import NavBar from '../components/NavBar';

export const metadata = {
  title: 'NFT Platform',
  description: 'Centralized NFT marketplace MVP'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body>
        <div className="container">
          <NavBar />
          {children}
        </div>
      </body>
    </html>
  );
}
