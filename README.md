# NFT Platform (Web MVP + Custom Blockchain)

Локальный MVP сайта по централизованной архитектуре NFT + собственная внутренняя blockchain-цепочка для уникализации NFT.

## Что реализовано

### Авторизация и роли
- `POST /auth/register`, `POST /auth/login`, `GET /auth/me`
- JWT-сессия
- Веб-навигация скрывает **Админ** для незалогиненных и обычных пользователей.
- Кнопка **Выйти** в шапке.

### NFT-модель (как Telegram-стиль)
Каждый NFT собирается из:
1. **Фон** (из разрешенных цветов / фонов)
2. **Модель** (анимация поверх фона)
3. **Эмодзи** (по центру)

Фиксированный размер NFT: **512x512**.

### Свой блокчейн (внутренний)
- Для каждой minted NFT создается блок в `blockchain_blocks`:
  - `prev_hash`
  - `data_hash`
  - `block_hash`
  - `nonce`
- Используется простой PoW (difficulty=3) для построения цепочки.
- `blockchain_hash` сохраняется в `nft_instances`.

### Админ-панель (разделы)
В UI админки есть разделы:
1. Создание фонов
2. Создание моделей (с animation URL)
3. Добавление эмодзи
4. Создание коллекции
5. Привязка компонентов к коллекции
6. Mint из коллекции с расчетом `max_possible_supply`

### Backend API (основное)
- Marketplace: `GET /marketplace/listings`
- User: `GET /users/me/nfts`
- Listings: `POST /listings`, `DELETE /listings/:id`
- Buy flow: `POST /orders/:listingId/buy` (транзакционно)
- Admin bootstrap: `GET /admin/bootstrap`
- Admin assets: `POST /admin/backgrounds`, `POST /admin/models`, `POST /admin/emojis`
- Collections: `POST /admin/collections`,
  - `POST /admin/collections/:id/backgrounds`
  - `POST /admin/collections/:id/models`
  - `POST /admin/collections/:id/emojis`
  - `GET /admin/collections/:id/capacity`
  - `POST /admin/collections/:id/mint`
- Blockchain inspect: `GET /admin/blockchain`

---

## Инструкция по развертке и запуску

## Вариант A: Docker (рекомендуется)

### 1) Требования
- Docker
- Docker Compose

### 2) Запуск
```bash
docker compose up --build
```

### 3) Открыть
- Frontend: http://localhost:3000
- Backend health: http://localhost:4000/health

---

## Вариант B: Без Docker

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

---

## Первые шаги после запуска

1. Вход админа: `admin@nft.local / admin123`.
2. Открыть `/admin`.
3. Создать фон(ы), модель(и), эмодзи.
4. Создать коллекцию.
5. Привязать к коллекции фоны/модели/эмодзи.
6. Проверить `max_possible_supply`, указать custom supply.
7. Нажать mint.
8. После mint можно листить NFT и покупать на маркетплейсе.
