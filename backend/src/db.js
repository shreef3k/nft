import pg from 'pg';

const { Pool } = pg;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

export async function initDb() {
  await pool.query(`
    create extension if not exists pgcrypto;

    create table if not exists users (
      id uuid primary key default gen_random_uuid(),
      email text unique not null,
      password_hash text not null,
      role text not null default 'user' check (role in ('user','admin')),
      status text not null default 'active' check (status in ('active','blocked')),
      balance numeric(18,2) not null default 1000,
      created_at timestamptz not null default now()
    );

    create table if not exists backgrounds (
      id uuid primary key default gen_random_uuid(),
      name text not null,
      image_url text not null,
      rarity numeric(5,2) not null default 1,
      created_by uuid not null references users(id),
      created_at timestamptz not null default now()
    );

    create table if not exists models (
      id uuid primary key default gen_random_uuid(),
      name text not null,
      image_url text not null,
      rarity numeric(5,2) not null default 1,
      created_by uuid not null references users(id),
      created_at timestamptz not null default now()
    );

    create table if not exists colors (
      id uuid primary key default gen_random_uuid(),
      name text not null,
      hex_code text not null,
      rarity numeric(5,2) not null default 1,
      created_by uuid not null references users(id),
      created_at timestamptz not null default now()
    );

    create table if not exists nft_templates (
      id uuid primary key default gen_random_uuid(),
      background_id uuid not null references backgrounds(id),
      model_id uuid not null references models(id),
      color_id uuid not null references colors(id),
      name text not null,
      description text,
      supply int not null,
      minted_count int not null default 0,
      created_by uuid not null references users(id),
      created_at timestamptz not null default now(),
      unique(background_id, model_id, color_id)
    );

    create table if not exists nft_instances (
      id uuid primary key default gen_random_uuid(),
      template_id uuid not null references nft_templates(id),
      serial_no int not null,
      owner_id uuid not null references users(id),
      minted_at timestamptz not null default now(),
      unique(template_id, serial_no)
    );

    create table if not exists listings (
      id uuid primary key default gen_random_uuid(),
      nft_instance_id uuid unique not null references nft_instances(id),
      seller_id uuid not null references users(id),
      price numeric(18,2) not null,
      status text not null default 'active' check (status in ('active', 'cancelled', 'sold')),
      created_at timestamptz not null default now()
    );

    create table if not exists orders (
      id uuid primary key default gen_random_uuid(),
      buyer_id uuid not null references users(id),
      listing_id uuid not null references listings(id),
      amount numeric(18,2) not null,
      status text not null default 'completed',
      created_at timestamptz not null default now()
    );
  `);
}

export async function ensureAdmin(passwordHash) {
  const exists = await pool.query("select id from users where email = 'admin@nft.local' limit 1");
  if (exists.rowCount > 0) return;

  await pool.query(
    `insert into users (email, password_hash, role, balance)
     values ('admin@nft.local', $1, 'admin', 100000)`,
    [passwordHash]
  );
}
