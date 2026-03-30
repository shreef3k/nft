# NFT Platform (Web MVP + Custom Blockchain)

Локальный MVP сайта по централизованной архитектуре NFT + собственная blockchain-цепочка для уникализации NFT.

## Что исправлено по последним требованиям
- Фоны и модели теперь загружаются **файлами** (multipart/form-data), а не ссылками.
- После логина происходит редирект на маркетплейс.
- Кнопка логина в шапке заменяется на кнопку **Профиль** с email/ролью + отдельная кнопка **Выйти**.
- В админке добавлена кнопка **полного сброса БД до заводских** с 3 подтверждениями (`YES`, `RESET`, `FACTORY`).

## Ключевые разделы
- Auth: `/auth/register`, `/auth/login`, `/auth/me`
- User: `/users/me/nfts`
- Marketplace: `/marketplace/listings`, `/orders/:listingId/buy`
- Admin:
  - `/admin/backgrounds` (file upload)
  - `/admin/models` (2 files: модель + анимация)
  - `/admin/emojis`
  - `/admin/collections`
  - `/admin/collections/:id/{backgrounds|models|emojis}`
  - `/admin/collections/:id/mint`
  - `/admin/reset-factory`

## Запуск

### Docker
```bash
docker compose up --build
```
- Frontend: http://localhost:3000
- Backend: http://localhost:4000/health

### Без Docker
```bash
cd backend
cp .env.example .env
npm install
npm run dev
```

```bash
cd frontend
cp .env.example .env.local
npm install
npm run dev
```

## Демо админ
- `admin@nft.local`
- `admin123`
