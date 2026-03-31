# Централизованная NFT-платформа (Web + Android) — MVP Архитектура

## 1) Целевая архитектура

**Технологический выбор (оптимальный):**
- **Backend:** NestJS (TypeScript) + PostgreSQL + Redis + S3/MinIO.
- **Web:** Next.js (React) + TailwindCSS + shadcn/ui.
- **Android:** Kotlin + Jetpack Compose + Retrofit/OkHttp + Room.

**Почему NestJS для этого кейса:**
- модульная структура “из коробки” (Auth, Users, Admin, Marketplace и т.д.);
- удобная ролевая авторизация (guards, decorators);
- зрелая экосистема для PostgreSQL (Prisma/TypeORM), Redis, очередей и валидации;
- единый язык TypeScript между backend/frontend ускоряет MVP.

### Схема взаимодействия

```text
[Web (Next.js)] -----------\
                             \  HTTPS + JWT
[Android (Compose)] ---------> [API Gateway / NestJS]
                                  |  |  |
                                  |  |  +--> [Redis: cache, sessions, rate-limit, queues]
                                  |  +-----> [S3/MinIO: layers + previews + renders]
                                  +--------> [PostgreSQL: source of truth]
```

### Принципиально важные правила домена (без блокчейна)
1. **Единственный источник истины** — PostgreSQL.
2. Проверка владения NFT и все торговые операции происходят **только на сервере** в транзакциях БД.
3. “Mint” = создание `nft_instances` на сервере; никаких смарт-контрактов.
4. Баланс — внутренний ledger/кошелек в БД.
5. Рендер NFT можно делать:
   - pre-render на backend для preview,
   - runtime-рендер на Web/Android из 3 слоёв.

---

## 2) Модули backend

Рекомендуемая модульная декомпозиция:

- `auth` — регистрация, логин, refresh, logout, OAuth (Google).
- `users` — профиль, роли, блокировки, баланс.
- `library` — CRUD слоёв: backgrounds, models, colors.
- `nft` — создание шаблонов (`nft_templates`), выпуск инстансов (`nft_instances`).
- `renderer` — генерация preview (например, Sharp/Canvas/ImageMagick worker).
- `marketplace` — листинги, фильтрация, статусы продаж.
- `orders` — покупка, проведение сделки, ledger-проводки.
- `transactions` — история финансовых движений.
- `admin` — модерация, действия с пользователями/NFT.
- `audit` — журнал админских действий.

### Состояния листинга
- `draft` (опционально)
- `active`
- `cancelled`
- `sold`
- `hidden_by_admin`

### Состояния ордера
- `pending`
- `paid`
- `completed`
- `failed`
- `refunded`

---

## 3) Структура репозитория

```text
/backend
  /src
    /common
      /guards
      /decorators
      /interceptors
      /filters
      /config
    /modules
      /auth
      /users
      /library
        /backgrounds
        /models
        /colors
      /nft
      /renderer
      /marketplace
      /orders
      /transactions
      /admin
      /audit
    /db
      /migrations
      /seeds
    main.ts

/frontend
  /src
    /app (или /pages)
    /components
    /features
      /auth
      /marketplace
      /profile
      /admin
    /hooks
    /lib
      /api-client
      /canvas-render
      /auth

/android
  /app/src/main/java/com/example/nft
    /ui
      /auth
      /marketplace
      /mynft
      /profile
    /data
      /local (Room)
      /remote (Retrofit)
      /repository
    /domain
      /model
      /usecase
    /core
      /network
      /auth
      /render
```

---

## 4) Схема БД (PostgreSQL)

Ниже — практичная схема для MVP (с важными ограничениями уникальности и атомарности).

```sql
-- users
create table users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  password_hash text,
  google_id text unique,
  role text not null default 'user' check (role in ('user','admin')),
  status text not null default 'active' check (status in ('active','blocked')),
  balance numeric(18,2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- asset libraries
create table backgrounds (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  type text not null check (type in ('gradient','solid','pattern','animated','image')),
  image_url text,
  config_json jsonb,
  rarity numeric(5,2) not null default 1.0,
  is_active boolean not null default true,
  created_by uuid not null references users(id),
  created_at timestamptz not null default now()
);

create table models (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  image_url text not null,
  rarity numeric(5,2) not null default 1.0,
  is_active boolean not null default true,
  created_by uuid not null references users(id),
  created_at timestamptz not null default now()
);

create table colors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  hex_code text not null check (hex_code ~ '^#[0-9A-Fa-f]{6}$'),
  rarity numeric(5,2) not null default 1.0,
  is_active boolean not null default true,
  created_by uuid not null references users(id),
  created_at timestamptz not null default now()
);

-- template = unique composition (background + model + color)
create table nft_templates (
  id uuid primary key default gen_random_uuid(),
  background_id uuid not null references backgrounds(id),
  model_id uuid not null references models(id),
  color_id uuid not null references colors(id),
  name text not null,
  description text,
  royalty_percent numeric(5,2) not null default 0,
  supply int not null check (supply > 0),
  minted_count int not null default 0,
  preview_url text,
  is_hidden boolean not null default false,
  created_by uuid not null references users(id),
  created_at timestamptz not null default now(),
  unique(background_id, model_id, color_id)
);

create table nft_instances (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references nft_templates(id),
  serial_no int not null,
  owner_id uuid not null references users(id),
  status text not null default 'owned' check (status in ('owned','listed','locked','burned')),
  minted_at timestamptz not null default now(),
  unique(template_id, serial_no)
);

create table listings (
  id uuid primary key default gen_random_uuid(),
  nft_instance_id uuid not null unique references nft_instances(id),
  seller_id uuid not null references users(id),
  price numeric(18,2) not null check (price > 0),
  status text not null default 'active' check (status in ('active','cancelled','sold','hidden_by_admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table orders (
  id uuid primary key default gen_random_uuid(),
  buyer_id uuid not null references users(id),
  listing_id uuid not null references listings(id),
  amount numeric(18,2) not null check (amount > 0),
  status text not null default 'pending' check (status in ('pending','paid','completed','failed','refunded')),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id),
  type text not null check (type in ('deposit','withdrawal','purchase_debit','sale_credit','fee','refund')),
  amount numeric(18,2) not null,
  currency text not null default 'USD_INTERNAL',
  reference_type text not null,
  reference_id uuid,
  created_at timestamptz not null default now()
);

create table admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references users(id),
  action text not null,
  entity_type text not null,
  entity_id uuid,
  payload jsonb,
  created_at timestamptz not null default now()
);

create index idx_market_filters on nft_templates(background_id, model_id, color_id);
create index idx_listings_status_price on listings(status, price);
create index idx_nft_instances_owner on nft_instances(owner_id);
create index idx_orders_buyer on orders(buyer_id, created_at desc);
create index idx_tx_user_created on transactions(user_id, created_at desc);
```

### Ключевая транзакционная логика покупки
Операция `POST /orders/:listingId/buy` должна идти в **одной DB-транзакции**:
1. `SELECT ... FOR UPDATE` листинг + nft_instance + buyer/seller.
2. Проверить `listing.status='active'`, `buyer.balance >= price`, `buyer != seller`.
3. Списать баланс buyer, зачислить seller (и комиссию платформы при необходимости).
4. Создать `orders` + `transactions` (debit/credit).
5. Передать ownership `nft_instances.owner_id = buyer_id`, снять `listed`.
6. `listings.status='sold'`, commit.

---

## 5) API-эндпоинты (MVP)

### Auth
- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/refresh`
- `POST /auth/logout`
- `POST /auth/google`

### Пользовательские
- `GET /marketplace/listings?backgroundId=&modelId=&colorId=&minPrice=&maxPrice=&sort=`
- `GET /marketplace/listings/:id`
- `POST /listings` (owner only)
- `DELETE /listings/:id` (seller/admin)
- `POST /orders/:listingId/buy`
- `GET /users/me/nfts`
- `GET /users/me/history`
- `GET /users/me/balance`

### Админские
- `POST /admin/backgrounds`, `PATCH /admin/backgrounds/:id`, `DELETE /admin/backgrounds/:id`
- `POST /admin/models`, `PATCH /admin/models/:id`, `DELETE /admin/models/:id`
- `POST /admin/colors`, `PATCH /admin/colors/:id`, `DELETE /admin/colors/:id`
- `POST /admin/nft/templates`
- `POST /admin/nft/templates/:id/mint`
- `PATCH /admin/nft/templates/:id/hide`
- `GET /admin/users`
- `PATCH /admin/users/:id/block`
- `GET /admin/orders`
- `GET /admin/audit-logs`

### Пример DTO: создание NFT-шаблона

```json
{
  "backgroundId": "uuid",
  "modelId": "uuid",
  "colorId": "uuid",
  "name": "Cyber Cat #Genesis",
  "description": "First collection",
  "royaltyPercent": 5.0,
  "supply": 100
}
```

---

## 6) UX-флоу (Web + Android)

1. Пользователь регистрируется/логинится → получает `access + refresh JWT`.
2. Открывает маркетплейс, фильтрует по фону/модели/цвету/цене.
3. Открывает карточку NFT: preview, параметры слоёв, цена, продавец.
4. Нажимает “Купить” → сервер проводит атомарную сделку.
5. NFT появляется в “Мои NFT”, в истории появляется ордер/транзакция.
6. Пользователь может выставить собственный NFT в листинг.

---

## 7) Логика рендера NFT (3 слоя)

## 7.1 Серверный preview
- При создании `nft_template` backend-воркер собирает preview PNG/WebP:
  - layer 1: background
  - layer 2: model (alpha PNG)
  - layer 3: color overlay (multiply/overlay/soft-light)
- Preview сохраняется в S3 и пишется в `nft_templates.preview_url`.

## 7.2 Клиентский runtime-render (Web)
Алгоритм Canvas:
1. Загрузить 3 источника (background/model/color config).
2. Отрисовать фон.
3. Отрисовать модель.
4. Установить blend mode и применить color overlay.
5. Вернуть dataURL/bitmap.

Псевдокод:

```ts
ctx.drawImage(background, 0, 0, w, h);
ctx.drawImage(model, 0, 0, w, h);
ctx.globalCompositeOperation = 'multiply';
ctx.fillStyle = colorHex;
ctx.fillRect(0, 0, w, h);
ctx.globalCompositeOperation = 'source-over';
```

## 7.3 Android-render
- Compose Canvas или LayerDrawable/Image compositing.
- Кэш итоговых bitmap в Room + disk cache (Coil/Glide).

---

## 8) План спринтов (2–4 недели)

## Спринт 1 (2 недели): Core + Admin Base
- Инициализация monorepo, CI, env-конфиги.
- PostgreSQL + Redis + S3 integration.
- Auth + роли + refresh tokens.
- CRUD библиотек слоёв.
- Создание NFT-шаблонов + preview renderer.

## Спринт 2 (2 недели): Web User MVP
- Marketplace list + filters + details.
- Listing create/cancel.
- Buy flow с атомарной транзакцией.
- Профиль: мои NFT, история.
- Web canvas render.

## Спринт 3 (2–3 недели): Android MVP
- Auth screens.
- Marketplace + NFT details.
- My NFT + history.
- Покупка/листинг.
- Offline cache (Room + image cache).

## Спринт 4 (1–2 недели): Hardening
- Админ-модерация/блокировки.
- Audit logs + observability.
- Security hardening + нагрузочное тестирование.
- QA-полировка.

---

## 9) Безопасность (обязательный чеклист)

1. JWT access (15 мин) + refresh (7–30 дней) с ротацией.
2. Хеширование паролей `bcrypt/argon2`.
3. Валидация DTO (class-validator/zod), sanitize input.
4. CSRF-защита для cookie-based flows.
5. Rate limiting + brute-force protection на `/auth/*`.
6. Проверка ownership перед созданием/отменой листинга.
7. Идемпотентность покупки (idempotency-key).
8. Логи админских действий (кто/что/когда).
9. Secrets management (dotenv only for local; vault in prod).
10. Ограничение типов/размеров файлов при загрузке ассетов.

---

## 10) Юридические/операционные риски

- **IP/лицензии:** в ToS явно прописать права на слои и финальные композиции.
- **Возвраты/споры:** централизованный arbitration policy (SLA, критерии возврата).
- **KYC/AML:** обязательно при фиатных выводах/крупных оборотах.
- **Content moderation:** даже при админской генерации нужны внутренние правила контента.
- **Регуляторика платежей:** возможно потребуется payment provider compliance.

---

## 11) Оценка сроков и бюджета

- MVP (backend + web admin + web marketplace): **4–6 недель**.
- Android MVP: **+3–4 недели**.
- v2 (push, уведомления, аналитика, рекомендации): **+4 недели**.

Команда минимум:
- 1 backend,
- 1 frontend,
- 1 Android,
- 1 QA part-time,
- 1 PM/аналитик part-time.

---

## 12) Что делать первым при ограниченном бюджете

1. Backend + PostgreSQL + базовые транзакции покупки.
2. Web admin (библиотеки + создание шаблонов + mint).
3. Web marketplace (просмотр, фильтры, покупка, мои NFT).
4. Android lite (только просмотр + покупка + мои NFT).

Это даст рабочий рынок с централизованной логикой, а Android можно наращивать итеративно.
