import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { prisma } from '../src/db/prisma.js';
import { app, balanceOf, createPackage, createProduct, fund, idem, signUp, signUpAdmin } from './helpers.js';

describe('admin product updates', () => {
  it('PATCH only changes the fields that were sent', async () => {
    const { agent } = await signUpAdmin();
    const created = await agent
      .post('/api/admin/products')
      .send({
        sku: 'SKN-PATCH',
        name: 'Patchy',
        description: 'Keep me',
        category: 'SKIN',
        rarity: 'EPIC',
        priceCoins: 500,
      })
      .expect(201);
    const id = created.body.product.id;

    await agent.patch(`/api/admin/products/${id}`).send({ active: false }).expect(200);
    await agent.patch(`/api/admin/products/${id}`).send({ priceCoins: 650 }).expect(200);

    const product = await prisma.product.findUniqueOrThrow({ where: { id } });
    expect(product).toMatchObject({ description: 'Keep me', rarity: 'EPIC', active: false, priceCoins: 650 });
  });

  it('rejects an empty PATCH and non-https image URLs', async () => {
    const { agent } = await signUpAdmin();
    const product = await createProduct();
    await agent.patch(`/api/admin/products/${product.id}`).send({}).expect(400);
    for (const imageUrl of ['javascript:alert(1)', 'http://example.com/a.png', 'data:image/png;base64,AAAA']) {
      await agent.patch(`/api/admin/products/${product.id}`).send({ imageUrl }).expect(400);
    }
    await agent.patch(`/api/admin/products/${product.id}`).send({ imageUrl: 'https://example.com/a.png' }).expect(200);
  });

  it('lists hidden products for admins but not in the store', async () => {
    const { agent } = await signUpAdmin();
    await createProduct({ name: 'Visible' });
    await createProduct({ name: 'Hidden', active: false });
    const admin = await agent.get('/api/admin/products').expect(200);
    expect(admin.body.items.map((p: { name: string }) => p.name).sort()).toEqual(['Hidden', 'Visible']);
    const store = await agent.get('/api/products').expect(200);
    expect(store.body.items.map((p: { name: string }) => p.name)).toEqual(['Visible']);
  });
});

describe('admin balance adjustments', () => {
  it('applies a retried adjustment once', async () => {
    const { agent: admin } = await signUpAdmin();
    const { user } = await signUp();
    const key = idem();
    const send = (amount: number) =>
      admin.post(`/api/admin/users/${user.id}/adjust`).set('Idempotency-Key', key).send({ amount, note: 'Goodwill' });

    await send(250).expect(201);
    const retry = await send(250).expect(200);
    expect(retry.headers['idempotent-replayed']).toBe('true');
    expect(retry.body.entry.idempotencyKey).toBeUndefined();
    expect(await balanceOf(user.id)).toBe(250);

    const reused = await send(999).expect(422);
    expect(reused.body.error.code).toBe('IDEMPOTENCY_KEY_REUSED');
  });

  it('requires an Idempotency-Key and an existing user', async () => {
    const { agent: admin } = await signUpAdmin();
    const { user } = await signUp();
    await admin.post(`/api/admin/users/${user.id}/adjust`).send({ amount: 10, note: 'No key' }).expect(400);
    await admin
      .post('/api/admin/users/00000000-0000-7000-8000-000000000000/adjust')
      .set('Idempotency-Key', idem())
      .send({ amount: 10, note: 'Nobody' })
      .expect(404);
  });
});

describe('history endpoints', () => {
  it('lists coin orders (including declined) and purchases for the current user only', async () => {
    const { agent, user } = await signUp();
    const other = await signUp();
    const pkg = await createPackage({ coins: 500 });
    await agent
      .post('/api/coin-purchases')
      .set('Idempotency-Key', idem())
      .send({ packageId: pkg.id, paymentToken: 'tok_visa' })
      .expect(201);
    await agent
      .post('/api/coin-purchases')
      .set('Idempotency-Key', idem())
      .send({ packageId: pkg.id, paymentToken: 'tok_chargeDeclined' })
      .expect(402);
    await other.agent
      .post('/api/coin-purchases')
      .set('Idempotency-Key', idem())
      .send({ packageId: pkg.id, paymentToken: 'tok_visa' })
      .expect(201);
    const product = await createProduct({ priceCoins: 100 });
    await agent.post('/api/purchases').set('Idempotency-Key', idem()).send({ productId: product.id }).expect(201);

    const orders = await agent.get('/api/coin-purchases').expect(200);
    expect(orders.body.items.map((o: { status: string }) => o.status).sort()).toEqual(['FAILED', 'SUCCEEDED']);
    expect(orders.body.items[0].idempotencyKey).toBeUndefined();

    const purchases = await agent.get('/api/purchases').expect(200);
    expect(purchases.body).toMatchObject({ total: 1, items: [{ productId: product.id, priceCoins: 100 }] });
    expect(await balanceOf(user.id)).toBe(400);
  });

  it('returns ledger entries without internal ids', async () => {
    const { agent, user } = await signUp();
    await fund(user.id, 50);
    const res = await agent.get('/api/wallet/transactions').expect(200);
    expect(Object.keys(res.body.items[0]).sort()).toEqual(
      ['amount', 'balanceAfter', 'createdAt', 'description', 'id', 'note', 'reason', 'type'].sort(),
    );
  });

  it('filters all purchases by status for admins', async () => {
    const { agent: admin } = await signUpAdmin();
    const { agent, user } = await signUp();
    await fund(user.id, 1000);
    const [a, b] = [await createProduct({ name: 'A' }), await createProduct({ name: 'B' })];
    const bought = await agent
      .post('/api/purchases')
      .set('Idempotency-Key', idem())
      .send({ productId: a.id })
      .expect(201);
    await agent.post('/api/purchases').set('Idempotency-Key', idem()).send({ productId: b.id }).expect(201);
    await admin.post(`/api/admin/purchases/${bought.body.purchase.id}/refund`).expect(200);

    const refunded = await admin.get('/api/admin/purchases?status=REFUNDED').expect(200);
    expect(refunded.body.items).toEqual([
      expect.objectContaining({ productName: 'A', user: expect.objectContaining({ id: user.id }) }),
    ]);
    const all = await admin.get('/api/admin/purchases').expect(200);
    expect(all.body.total).toBe(2);
  });
});

describe('catalog browsing', () => {
  it('filters by category, searches case-insensitively and paginates', async () => {
    await createProduct({ name: 'Neon Samurai', category: 'SKIN', priceCoins: 300 });
    await createProduct({ name: 'Neon Dance', category: 'EMOTE', priceCoins: 200 });
    await createProduct({ name: 'Arctic Ops', category: 'SKIN', priceCoins: 100 });

    const skins = await request(app).get('/api/products?category=SKIN&sort=price_asc').expect(200);
    expect(skins.body.items.map((p: { name: string }) => p.name)).toEqual(['Arctic Ops', 'Neon Samurai']);

    const search = await request(app).get('/api/products?search=neon&sort=name').expect(200);
    expect(search.body.items.map((p: { name: string }) => p.name)).toEqual(['Neon Dance', 'Neon Samurai']);

    const page2 = await request(app).get('/api/products?sort=price_asc&limit=2&page=2').expect(200);
    expect(page2.body).toMatchObject({ page: 2, limit: 2, total: 3, totalPages: 2, items: [{ name: 'Neon Samurai' }] });

    await request(app).get('/api/products?category=HATS').expect(400);
  });

  it('keeps an owned product reachable after it is delisted', async () => {
    const { agent, user } = await signUp();
    const stranger = await signUp();
    await fund(user.id, 100);
    const product = await createProduct({ priceCoins: 100 });
    await agent.post('/api/purchases').set('Idempotency-Key', idem()).send({ productId: product.id }).expect(201);
    await prisma.product.update({ where: { id: product.id }, data: { active: false } });

    const owned = await agent.get(`/api/products/${product.id}`).expect(200);
    expect(owned.body.product).toMatchObject({ owned: true, active: false });
    await stranger.agent.get(`/api/products/${product.id}`).expect(404);
    await request(app).get(`/api/products/${product.id}`).expect(404);
  });
});

describe('request handling', () => {
  it('returns structured errors for bad JSON, oversized bodies, bad ids and unknown routes', async () => {
    const badJson = await request(app)
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send('{"email":')
      .expect(400);
    expect(badJson.body.error.code).toBe('INVALID_JSON');

    const huge = await request(app)
      .post('/api/auth/login')
      .send({ email: 'a@b.co', password: 'x'.repeat(200_000) })
      .expect(413);
    expect(huge.body.error.code).toBe('PAYLOAD_TOO_LARGE');

    const badId = await request(app).get('/api/products/not-a-uuid').expect(400);
    expect(badId.body.error.code).toBe('VALIDATION_ERROR');

    const unknown = await request(app).get('/api/nope').expect(404);
    expect(unknown.body.error.code).toBe('ROUTE_NOT_FOUND');
  });

  it('rejects passwords longer than bcrypt can handle', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'long@test.dev', password: 'é'.repeat(40), name: 'Long' })
      .expect(400);
    expect(res.body.error.details[0].message).toMatch(/72 bytes/);
  });
});
