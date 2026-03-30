import 'dotenv/config';
import crypto from 'crypto';
import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { pool, initDb, ensureAdmin, NFT_WIDTH, NFT_HEIGHT } from './db.js';

const app = express();
app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(express.json());

const PORT = Number(process.env.PORT || 4000);
const JWT_SECRET = process.env.JWT_SECRET || 'change_me';

function signToken(user) {
  return jwt.sign({ sub: user.id, role: user.role, email: user.email }, JWT_SECRET, { expiresIn: '1d' });
}

function auth(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace('Bearer ', '');
  if (!token) return res.status(401).json({ message: 'Unauthorized' });

  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ message: 'Invalid token' });
  }
}

function onlyAdmin(req, res, next) {
  if (req.user.role !== 'admin') return res.status(403).json({ message: 'Admin only' });
  next();
}

function hashText(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

function mineBlock(prevHash, payload, difficulty = 3) {
  const prefix = '0'.repeat(difficulty);
  const dataHash = hashText(payload);
  let nonce = 0;
  while (true) {
    const blockHash = hashText(`${prevHash}|${dataHash}|${nonce}`);
    if (blockHash.startsWith(prefix)) {
      return { nonce, blockHash, dataHash };
    }
    nonce += 1;
  }
}

async function appendBlockchainRecord(client, nftInstanceId, payload) {
  const latest = await client.query('select * from blockchain_blocks order by block_index desc limit 1');
  const prev = latest.rowCount ? latest.rows[0].block_hash : 'GENESIS';
  const nextIndex = latest.rowCount ? Number(latest.rows[0].block_index) + 1 : 0;
  const mined = mineBlock(prev, payload, 3);

  await client.query(
    `insert into blockchain_blocks (nft_instance_id, block_index, prev_hash, data_hash, block_hash, nonce)
     values ($1, $2, $3, $4, $5, $6)`,
    [nftInstanceId, nextIndex, prev, mined.dataHash, mined.blockHash, mined.nonce]
  );

  await client.query('update nft_instances set blockchain_hash = $1 where id = $2', [mined.blockHash, nftInstanceId]);
}

async function calcCollectionCapacity(collectionId) {
  const stats = await pool.query(
    `select
        (select count(*) from collection_backgrounds where collection_id = $1) as backgrounds_count,
        (select count(*) from collection_models where collection_id = $1) as models_count,
        (select count(*) from collection_emojis where collection_id = $1) as emojis_count`,
    [collectionId]
  );

  const row = stats.rows[0];
  const capacity = Number(row.backgrounds_count) * Number(row.models_count) * Number(row.emojis_count);
  await pool.query('update collections set max_possible_supply = $1 where id = $2', [capacity, collectionId]);
  return { ...row, max_possible_supply: capacity };
}

app.get('/health', (_, res) => res.json({ ok: true }));

app.post('/auth/register', async (req, res) => {
  const schema = z.object({ email: z.string().email(), password: z.string().min(6) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());

  const { email, password } = parsed.data;
  const hash = await bcrypt.hash(password, 10);

  try {
    const created = await pool.query(
      'insert into users (email, password_hash) values ($1, $2) returning id, email, role, balance',
      [email.toLowerCase(), hash]
    );
    const user = created.rows[0];
    res.json({ token: signToken(user), user });
  } catch {
    res.status(409).json({ message: 'User already exists' });
  }
});

app.post('/auth/login', async (req, res) => {
  const schema = z.object({ email: z.string().email(), password: z.string().min(1) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());

  const { email, password } = parsed.data;
  const found = await pool.query('select * from users where email = $1 limit 1', [email.toLowerCase()]);
  if (!found.rowCount) return res.status(401).json({ message: 'Invalid credentials' });

  const user = found.rows[0];
  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return res.status(401).json({ message: 'Invalid credentials' });
  if (user.status === 'blocked') return res.status(403).json({ message: 'User is blocked' });

  res.json({
    token: signToken(user),
    user: { id: user.id, email: user.email, role: user.role, balance: user.balance }
  });
});

app.get('/auth/me', auth, async (req, res) => {
  const me = await pool.query('select id, email, role, balance from users where id = $1', [req.user.sub]);
  res.json(me.rows[0]);
});

app.get('/users/me/nfts', auth, async (req, res) => {
  const query = `
    select ni.id as instance_id, ni.serial_no, ni.blockchain_hash,
           nt.name, nt.description, nt.width, nt.height,
           b.name as background_name, b.image_url as background_image, b.color_hex,
           m.name as model_name, coalesce(m.animation_url, m.image_url) as model_animation,
           e.value as emoji_value
    from nft_instances ni
    join nft_templates nt on nt.id = ni.template_id
    join backgrounds b on b.id = nt.background_id
    join models m on m.id = nt.model_id
    left join emojis e on e.id = nt.emoji_id
    where ni.owner_id = $1
    order by ni.minted_at desc
  `;
  const result = await pool.query(query, [req.user.sub]);
  res.json(result.rows);
});

app.get('/marketplace/listings', async (req, res) => {
  const { collectionId, minPrice, maxPrice } = req.query;
  const clauses = [`l.status = 'active'`];
  const values = [];

  if (collectionId) {
    values.push(collectionId);
    clauses.push(`nt.collection_id = $${values.length}`);
  }
  if (minPrice) {
    values.push(minPrice);
    clauses.push(`l.price >= $${values.length}`);
  }
  if (maxPrice) {
    values.push(maxPrice);
    clauses.push(`l.price <= $${values.length}`);
  }

  const query = `
    select l.id, l.price, l.created_at, ni.id as nft_instance_id, ni.serial_no, ni.blockchain_hash,
           nt.name, nt.description, nt.width, nt.height,
           b.name as background_name, b.image_url as background_image, b.color_hex,
           coalesce(m.animation_url, m.image_url) as model_animation,
           e.value as emoji_value
    from listings l
    join nft_instances ni on ni.id = l.nft_instance_id
    join nft_templates nt on nt.id = ni.template_id
    join backgrounds b on b.id = nt.background_id
    join models m on m.id = nt.model_id
    left join emojis e on e.id = nt.emoji_id
    where ${clauses.join(' and ')}
    order by l.created_at desc
  `;

  const result = await pool.query(query, values);
  res.json(result.rows);
});

app.post('/listings', auth, async (req, res) => {
  const schema = z.object({ nftInstanceId: z.string().uuid(), price: z.number().positive() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());

  const { nftInstanceId, price } = parsed.data;
  const nft = await pool.query('select * from nft_instances where id = $1 limit 1', [nftInstanceId]);
  if (!nft.rowCount) return res.status(404).json({ message: 'NFT instance not found' });
  if (nft.rows[0].owner_id !== req.user.sub) return res.status(403).json({ message: 'Not owner' });

  try {
    const listing = await pool.query(
      'insert into listings (nft_instance_id, seller_id, price) values ($1, $2, $3) returning *',
      [nftInstanceId, req.user.sub, price]
    );
    res.status(201).json(listing.rows[0]);
  } catch {
    res.status(409).json({ message: 'Already listed' });
  }
});

app.delete('/listings/:id', auth, async (req, res) => {
  const listing = await pool.query('select * from listings where id = $1 limit 1', [req.params.id]);
  if (!listing.rowCount) return res.status(404).json({ message: 'Listing not found' });
  const row = listing.rows[0];
  if (row.seller_id !== req.user.sub && req.user.role !== 'admin') return res.status(403).json({ message: 'Forbidden' });
  await pool.query("update listings set status = 'cancelled' where id = $1", [row.id]);
  res.json({ ok: true });
});

app.post('/orders/:listingId/buy', auth, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('begin');
    const listingRes = await client.query(
      "select * from listings where id = $1 and status = 'active' for update",
      [req.params.listingId]
    );
    if (!listingRes.rowCount) {
      await client.query('rollback');
      return res.status(404).json({ message: 'Active listing not found' });
    }

    const listing = listingRes.rows[0];
    if (listing.seller_id === req.user.sub) {
      await client.query('rollback');
      return res.status(400).json({ message: 'Cannot buy your own NFT' });
    }

    const buyerRes = await client.query('select * from users where id = $1 for update', [req.user.sub]);
    const sellerRes = await client.query('select * from users where id = $1 for update', [listing.seller_id]);
    const buyer = buyerRes.rows[0];
    if (Number(buyer.balance) < Number(listing.price)) {
      await client.query('rollback');
      return res.status(400).json({ message: 'Insufficient balance' });
    }

    await client.query('update users set balance = balance - $1 where id = $2', [listing.price, req.user.sub]);
    await client.query('update users set balance = balance + $1 where id = $2', [listing.price, listing.seller_id]);
    await client.query('update nft_instances set owner_id = $1 where id = $2', [req.user.sub, listing.nft_instance_id]);
    await client.query("update listings set status = 'sold' where id = $1", [listing.id]);

    const order = await client.query(
      'insert into orders (buyer_id, listing_id, amount) values ($1, $2, $3) returning *',
      [req.user.sub, listing.id, listing.price]
    );

    await client.query('commit');
    return res.json({ ok: true, order: order.rows[0] });
  } catch (error) {
    await client.query('rollback');
    return res.status(500).json({ message: 'Buy failed', error: error.message });
  } finally {
    client.release();
  }
});

app.get('/admin/bootstrap', auth, onlyAdmin, async (_, res) => {
  const [backgrounds, models, emojis, collections] = await Promise.all([
    pool.query('select * from backgrounds order by created_at desc'),
    pool.query('select * from models order by created_at desc'),
    pool.query('select * from emojis order by created_at desc'),
    pool.query('select * from collections order by created_at desc')
  ]);
  res.json({
    constraints: { width: NFT_WIDTH, height: NFT_HEIGHT },
    backgrounds: backgrounds.rows,
    models: models.rows,
    emojis: emojis.rows,
    collections: collections.rows
  });
});

app.post('/admin/backgrounds', auth, onlyAdmin, async (req, res) => {
  const schema = z.object({
    name: z.string().min(1),
    imageUrl: z.string().url().optional(),
    colorHex: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
    rarity: z.number().min(0).max(100).default(1)
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());

  const { name, imageUrl, colorHex, rarity } = parsed.data;
  const inserted = await pool.query(
    'insert into backgrounds (name, image_url, color_hex, rarity, created_by) values ($1, $2, $3, $4, $5) returning *',
    [name, imageUrl ?? null, colorHex, rarity, req.user.sub]
  );
  res.status(201).json(inserted.rows[0]);
});

app.post('/admin/models', auth, onlyAdmin, async (req, res) => {
  const schema = z.object({
    name: z.string().min(1),
    imageUrl: z.string().url(),
    animationUrl: z.string().url(),
    rarity: z.number().min(0).max(100).default(1)
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());

  const { name, imageUrl, animationUrl, rarity } = parsed.data;
  const inserted = await pool.query(
    'insert into models (name, image_url, animation_url, rarity, created_by) values ($1, $2, $3, $4, $5) returning *',
    [name, imageUrl, animationUrl, rarity, req.user.sub]
  );
  res.status(201).json(inserted.rows[0]);
});

app.post('/admin/emojis', auth, onlyAdmin, async (req, res) => {
  const schema = z.object({ value: z.string().min(1).max(4), rarity: z.number().min(0).max(100).default(1) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());

  const { value, rarity } = parsed.data;
  const inserted = await pool.query(
    'insert into emojis (value, rarity, created_by) values ($1, $2, $3) returning *',
    [value, rarity, req.user.sub]
  );
  res.status(201).json(inserted.rows[0]);
});

app.post('/admin/collections', auth, onlyAdmin, async (req, res) => {
  const schema = z.object({ name: z.string().min(1), description: z.string().default(''), customSupply: z.number().int().nonnegative().default(0) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());

  const { name, description, customSupply } = parsed.data;
  const inserted = await pool.query(
    `insert into collections (name, description, nft_width, nft_height, custom_supply, created_by)
     values ($1, $2, $3, $4, $5, $6) returning *`,
    [name, description, NFT_WIDTH, NFT_HEIGHT, customSupply, req.user.sub]
  );
  res.status(201).json(inserted.rows[0]);
});

app.post('/admin/collections/:id/backgrounds', auth, onlyAdmin, async (req, res) => {
  const schema = z.object({ backgroundId: z.string().uuid() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());

  await pool.query(
    'insert into collection_backgrounds (collection_id, background_id) values ($1, $2) on conflict do nothing',
    [req.params.id, parsed.data.backgroundId]
  );
  const stats = await calcCollectionCapacity(req.params.id);
  res.json(stats);
});

app.post('/admin/collections/:id/models', auth, onlyAdmin, async (req, res) => {
  const schema = z.object({ modelId: z.string().uuid() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());

  await pool.query(
    'insert into collection_models (collection_id, model_id) values ($1, $2) on conflict do nothing',
    [req.params.id, parsed.data.modelId]
  );
  const stats = await calcCollectionCapacity(req.params.id);
  res.json(stats);
});

app.post('/admin/collections/:id/emojis', auth, onlyAdmin, async (req, res) => {
  const schema = z.object({ emojiId: z.string().uuid() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());

  await pool.query(
    'insert into collection_emojis (collection_id, emoji_id) values ($1, $2) on conflict do nothing',
    [req.params.id, parsed.data.emojiId]
  );
  const stats = await calcCollectionCapacity(req.params.id);
  res.json(stats);
});

app.get('/admin/collections/:id/capacity', auth, onlyAdmin, async (req, res) => {
  const stats = await calcCollectionCapacity(req.params.id);
  res.json(stats);
});

app.post('/admin/collections/:id/mint', auth, onlyAdmin, async (req, res) => {
  const schema = z.object({ namePrefix: z.string().min(1), description: z.string().default(''), customSupply: z.number().int().positive() });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());

  const { namePrefix, description, customSupply } = parsed.data;
  const stats = await calcCollectionCapacity(req.params.id);
  if (customSupply > stats.max_possible_supply) {
    return res.status(400).json({ message: `customSupply > max_possible_supply (${stats.max_possible_supply})` });
  }

  const [bgRes, modelRes, emojiRes] = await Promise.all([
    pool.query('select b.* from backgrounds b join collection_backgrounds cb on cb.background_id=b.id where cb.collection_id=$1', [req.params.id]),
    pool.query('select m.* from models m join collection_models cm on cm.model_id=m.id where cm.collection_id=$1', [req.params.id]),
    pool.query('select e.* from emojis e join collection_emojis ce on ce.emoji_id=e.id where ce.collection_id=$1', [req.params.id])
  ]);

  const combos = [];
  for (const b of bgRes.rows) {
    for (const m of modelRes.rows) {
      for (const e of emojiRes.rows) {
        combos.push({ b, m, e });
      }
    }
  }

  const selected = combos.sort(() => Math.random() - 0.5).slice(0, customSupply);
  const client = await pool.connect();
  try {
    await client.query('begin');
    let minted = 0;

    for (const combo of selected) {
      const tpl = await client.query(
        `insert into nft_templates
         (collection_id, background_id, model_id, emoji_id, name, description, width, height, supply, minted_count, created_by)
         values ($1, $2, $3, $4, $5, $6, $7, $8, 1, 1, $9)
         on conflict do nothing
         returning *`,
        [req.params.id, combo.b.id, combo.m.id, combo.e.id, `${namePrefix} #${minted + 1}`, description, NFT_WIDTH, NFT_HEIGHT, req.user.sub]
      );

      if (!tpl.rowCount) continue;

      const instance = await client.query(
        'insert into nft_instances (template_id, serial_no, owner_id) values ($1, 1, $2) returning *',
        [tpl.rows[0].id, req.user.sub]
      );

      const payload = JSON.stringify({
        collectionId: req.params.id,
        templateId: tpl.rows[0].id,
        instanceId: instance.rows[0].id,
        combo: { backgroundId: combo.b.id, modelId: combo.m.id, emojiId: combo.e.id }
      });
      await appendBlockchainRecord(client, instance.rows[0].id, payload);
      minted += 1;
    }

    await client.query('update collections set custom_supply=$1 where id=$2', [customSupply, req.params.id]);
    await client.query('commit');
    res.json({ minted, max_possible_supply: stats.max_possible_supply });
  } catch (error) {
    await client.query('rollback');
    res.status(500).json({ message: 'Mint failed', error: error.message });
  } finally {
    client.release();
  }
});

app.get('/admin/blockchain', auth, onlyAdmin, async (_, res) => {
  const chain = await pool.query('select block_index, prev_hash, data_hash, block_hash, nonce, created_at from blockchain_blocks order by block_index asc');
  res.json(chain.rows);
});

async function start() {
  await initDb();
  const hash = await bcrypt.hash('admin123', 10);
  await ensureAdmin(hash);
  app.listen(PORT, () => {
    console.log(`Backend started on http://localhost:${PORT}`);
  });
}

start().catch((error) => {
  console.error(error);
  process.exit(1);
});
