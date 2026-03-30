# NFT Platform (Web-only MVP)

Локальный MVP сайта по централизованной архитектуре NFT (без блокчейна):
- Backend API (Node.js + Express + PostgreSQL)
- Frontend (Next.js)
- Docker Compose для быстрого запуска

## Что реализовано

### Backend
- Auth: `POST /auth/register`, `POST /auth/login`
- Marketplace: `GET /marketplace/listings`
- User: `GET /users/me/nfts`
- Listings: `POST /listings`, `DELETE /listings/:id`
- Buy flow: `POST /orders/:listingId/buy` (транзакционно)
- Admin: `POST /admin/backgrounds`, `POST /admin/models`, `POST /admin/colors`, `POST /admin/nft/template`

> При старте создаётся админ-пользователь:
> - email: `admin@nft.local`
> - password: `admin123`

### Frontend
- `/` — маркетплейс с карточками и кнопкой покупки
- `/login` — регистрация/вход
- `/my-nfts` — мои NFT
- `/admin` — базовая админ-форма создания слоёв

## Запуск (самый простой способ)

### 1) Требования
- Docker + Docker Compose

### 2) Старт
```bash
docker compose up --build
```

### 3) Открыть
- Frontend: http://localhost:3000
- Backend health: http://localhost:4000/health

## Быстрый сценарий проверки
1. Войти как `admin@nft.local / admin123` на `/login`.
2. На `/admin` создать `background`, `model`, `color`.
3. Создать NFT template через API (Postman/curl):
```bash
curl -X POST http://localhost:4000/admin/nft/template \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "backgroundId":"<UUID>",
    "modelId":"<UUID>",
    "colorId":"<UUID>",
    "name":"Demo NFT",
    "description":"Local test",
    "supply":3
  }'
```
4. Получить свои NFT: `GET /users/me/nfts`.
5. Создать листинг `POST /listings`.
6. Зарегистрировать второго пользователя и купить через `POST /orders/:listingId/buy`.

## Запуск без Docker

### Backend
```bash
cd backend
cp .env.example .env
npm install
npm run dev
```

### Frontend
```bash
cd frontend
cp .env.example .env.local
npm install
npm run dev
```
