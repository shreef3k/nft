import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { pool, initDb, ensureAdmin } from './db.js';

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
  } catch (e) {
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

app.get('/users/me/nfts', auth, async (req, res) => {
  const query = `
    select ni.id as instance_id, ni.serial_no, nt.name, nt.description,
           b.name as background_name, b.image_url as background_image,
           m.name as model_name, m.image_url as model_image,
           c.name as color_name, c.hex_code
    from nft_instances ni
    join nft_templates nt on nt.id = ni.template_id
    join backgrounds b on b.id = nt.background_id
    join models m on m.id = nt.model_id
    join colors c on c.id = nt.color_id
    where ni.owner_id = $1
    order by ni.minted_at desc
  `;
  const result = await pool.query(query, [req.user.sub]);
  res.json(result.rows);
});

app.get('/marketplace/listings', async (req, res) => {
  const { backgroundId, modelId, colorId, minPrice, maxPrice } = req.query;
  const clauses = [`l.status = 'active'`];
  const values = [];

  if (backgroundId) {
    values.push(backgroundId);
    clauses.push(`nt.background_id = $${values.length}`);
  }
  if (modelId) {
    values.push(modelId);
    clauses.push(`nt.model_id = $${values.length}`);
  }
  if (colorId) {
    values.push(colorId);
    clauses.push(`nt.color_id = $${values.length}`);
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
    select l.id, l.price, l.created_at, ni.id as nft_instance_id, ni.serial_no,
           nt.name, nt.description,
           b.id as background_id, b.name as background_name, b.image_url as background_image,
           m.id as model_id, m.name as model_name, m.image_url as model_image,
           c.id as color_id, c.name as color_name, c.hex_code
    from listings l
    join nft_instances ni on ni.id = l.nft_instance_id
    join nft_templates nt on nt.id = ni.template_id
    join backgrounds b on b.id = nt.background_id
    join models m on m.id = nt.model_id
    join colors c on c.id = nt.color_id
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
    const seller = sellerRes.rows[0];

    if (Number(buyer.balance) < Number(listing.price)) {
      await client.query('rollback');
      return res.status(400).json({ message: 'Insufficient balance' });
    }

    await client.query('update users set balance = balance - $1 where id = $2', [listing.price, buyer.id]);
    await client.query('update users set balance = balance + $1 where id = $2', [listing.price, seller.id]);
    await client.query('update nft_instances set owner_id = $1 where id = $2', [buyer.id, listing.nft_instance_id]);
    await client.query("update listings set status = 'sold' where id = $1", [listing.id]);

    const order = await client.query(
      'insert into orders (buyer_id, listing_id, amount) values ($1, $2, $3) returning *',
      [buyer.id, listing.id, listing.price]
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

app.post('/admin/backgrounds', auth, onlyAdmin, async (req, res) => {
  const schema = z.object({ name: z.string().min(1), imageUrl: z.string().url(), rarity: z.number().min(0).max(100).default(1) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());

  const { name, imageUrl, rarity } = parsed.data;
  const inserted = await pool.query(
    'insert into backgrounds (name, image_url, rarity, created_by) values ($1, $2, $3, $4) returning *',
    [name, imageUrl, rarity, req.user.sub]
  );
  res.status(201).json(inserted.rows[0]);
});

app.post('/admin/models', auth, onlyAdmin, async (req, res) => {
  const schema = z.object({ name: z.string().min(1), imageUrl: z.string().url(), rarity: z.number().min(0).max(100).default(1) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());

  const { name, imageUrl, rarity } = parsed.data;
  const inserted = await pool.query(
    'insert into models (name, image_url, rarity, created_by) values ($1, $2, $3, $4) returning *',
    [name, imageUrl, rarity, req.user.sub]
  );
  res.status(201).json(inserted.rows[0]);
});

app.post('/admin/colors', auth, onlyAdmin, async (req, res) => {
  const schema = z.object({ name: z.string().min(1), hexCode: z.string().regex(/^#[0-9A-Fa-f]{6}$/), rarity: z.number().min(0).max(100).default(1) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());

  const { name, hexCode, rarity } = parsed.data;
  const inserted = await pool.query(
    'insert into colors (name, hex_code, rarity, created_by) values ($1, $2, $3, $4) returning *',
    [name, hexCode, rarity, req.user.sub]
  );
  res.status(201).json(inserted.rows[0]);
});

app.post('/admin/nft/template', auth, onlyAdmin, async (req, res) => {
  const schema = z.object({
    backgroundId: z.string().uuid(),
    modelId: z.string().uuid(),
    colorId: z.string().uuid(),
    name: z.string().min(1),
    description: z.string().default(''),
    supply: z.number().int().positive()
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json(parsed.error.flatten());

  const { backgroundId, modelId, colorId, name, description, supply } = parsed.data;

  const client = await pool.connect();
  try {
    await client.query('begin');
    const tplRes = await client.query(
      `insert into nft_templates (background_id, model_id, color_id, name, description, supply, minted_count, created_by)
       values ($1, $2, $3, $4, $5, $6, $6, $7)
       returning *`,
      [backgroundId, modelId, colorId, name, description, supply, req.user.sub]
    );

    const template = tplRes.rows[0];
    for (let i = 1; i <= supply; i += 1) {
      await client.query(
        'insert into nft_instances (template_id, serial_no, owner_id) values ($1, $2, $3)',
        [template.id, i, req.user.sub]
      );
    }

    await client.query('commit');
    res.status(201).json(template);
  } catch (error) {
    await client.query('rollback');
    res.status(400).json({ message: 'Template create failed', error: error.message });
  } finally {
    client.release();
  }
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
