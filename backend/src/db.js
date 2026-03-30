import pg from 'pg';

const { Pool } = pg;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

export const NFT_WIDTH = 512;
export const NFT_HEIGHT = 512;

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
      file_path text,
      color_hex text,
      rarity numeric(5,2) not null default 1,
      created_by uuid not null references users(id),
      created_at timestamptz not null default now()
    );

    create table if not exists models (
      id uuid primary key default gen_random_uuid(),
      name text not null,
      file_path text not null,
      animation_path text,
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

    create table if not exists emojis (
      id uuid primary key default gen_random_uuid(),
      value text not null,
      rarity numeric(5,2) not null default 1,
      created_by uuid not null references users(id),
      created_at timestamptz not null default now(),
      unique(value)
    );

    create table if not exists collections (
      id uuid primary key default gen_random_uuid(),
      name text not null,
      description text,
      nft_width int not null default ${NFT_WIDTH},
      nft_height int not null default ${NFT_HEIGHT},
      max_possible_supply int not null default 0,
      custom_supply int not null default 0,
      created_by uuid not null references users(id),
      created_at timestamptz not null default now()
    );

    create table if not exists collection_backgrounds (
      collection_id uuid not null references collections(id) on delete cascade,
      background_id uuid not null references backgrounds(id) on delete cascade,
      primary key (collection_id, background_id)
    );

    create table if not exists collection_models (
      collection_id uuid not null references collections(id) on delete cascade,
      model_id uuid not null references models(id) on delete cascade,
      primary key (collection_id, model_id)
    );

    create table if not exists collection_emojis (
      collection_id uuid not null references collections(id) on delete cascade,
      emoji_id uuid not null references emojis(id) on delete cascade,
      primary key (collection_id, emoji_id)
    );

    create table if not exists nft_templates (
      id uuid primary key default gen_random_uuid(),
      collection_id uuid references collections(id),
      background_id uuid not null references backgrounds(id),
      model_id uuid not null references models(id),
      color_id uuid references colors(id),
      emoji_id uuid references emojis(id),
      name text not null,
      description text,
      width int not null default ${NFT_WIDTH},
      height int not null default ${NFT_HEIGHT},
      supply int not null,
      minted_count int not null default 0,
      created_by uuid not null references users(id),
      created_at timestamptz not null default now(),
      unique(background_id, model_id, emoji_id)
    );

    create table if not exists nft_instances (
      id uuid primary key default gen_random_uuid(),
      template_id uuid not null references nft_templates(id),
      serial_no int not null,
      owner_id uuid not null references users(id),
      blockchain_hash text,
      minted_at timestamptz not null default now(),
      unique(template_id, serial_no)
    );

    create table if not exists blockchain_blocks (
      id bigserial primary key,
      nft_instance_id uuid references nft_instances(id),
      block_index int not null,
      prev_hash text not null,
      data_hash text not null,
      block_hash text not null,
      nonce int not null,
      created_at timestamptz not null default now(),
      unique(block_index),
      unique(block_hash)
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

    alter table backgrounds add column if not exists file_path text;
    alter table models add column if not exists file_path text;
    alter table models add column if not exists animation_path text;
    alter table nft_instances add column if not exists blockchain_hash text;
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

export async function resetFactory(passwordHash) {
  await pool.query(`
    truncate table
      blockchain_blocks,
      orders,
      listings,
      nft_instances,
      nft_templates,
      collection_emojis,
      collection_models,
      collection_backgrounds,
      collections,
      emojis,
      models,
      backgrounds,
      users
    restart identity cascade;
  `);

  await ensureAdmin(passwordHash);
}
