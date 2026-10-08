import { describe, expect, it } from 'vitest';
import { prisma } from '../src/db/prisma.js';
import { balanceOf, createProduct, expectLedgerConsistent, fund, idem, signUp } from './helpers.js';

describe('buying products with Gold Coins', () => {
  it('debits the wallet, records the purchase and grants the item', async () => {
    const { agent, user } = await signUp();
    await fund(user.id, 500);
    const product = await createProduct({ name: 'Neon Samurai', priceCoins: 300 });

    const res = await agent
      .post('/api/purchases')
      .set('Idempotency-Key', idem())
      .send({ productId: product.id, expectedPriceCoins: 300 })
      .expect(201);

    expect(res.body.balance).toBe(200);
    expect(res.body.purchase).toMatchObject({
      productId: product.id,
      productName: 'Neon Samurai',
      priceCoins: 300,
      status: 'COMPLETED',
    });

    const inventory = await agent.get('/api/inventory').expect(200);
    expect(inventory.body.items.map((i: { product: { id: string } }) => i.product.id)).toEqual([product.id]);

    const tx = await agent.get('/api/wallet/transactions').expect(200);
    expect(tx.body.items[0]).toMatchObject({
      type: 'DEBIT',
      amount: 300,
      balanceAfter: 200,
      reason: 'PRODUCT_PURCHASE',
      description: 'Purchased Neon Samurai',
    });
    await expectLedgerConsistent(user.id);
  });

  it('rejects the purchase when the balance is too low and changes nothing', async () => {
    const { agent, user } = await signUp();
    await fund(user.id, 99);
    const product = await createProduct({ priceCoins: 100 });

    const res = await agent
      .post('/api/purchases')
      .set('Idempotency-Key', idem())
      .send({ productId: product.id })
      .expect(402);

    expect(res.body.error).toMatchObject({
      code: 'INSUFFICIENT_FUNDS',
      details: { required: 100, balance: 99, shortBy: 1 },
    });
    expect(await balanceOf(user.id)).toBe(99);
    expect(await prisma.purchase.count()).toBe(0);
    expect(await prisma.inventoryItem.count()).toBe(0);
  });

  it('does not sell the same item twice', async () => {
    const { agent, user } = await signUp();
    await fund(user.id, 1000);
    const product = await createProduct({ priceCoins: 100 });

    await agent.post('/api/purchases').set('Idempotency-Key', idem()).send({ productId: product.id }).expect(201);
    const res = await agent
      .post('/api/purchases')
      .set('Idempotency-Key', idem())
      .send({ productId: product.id })
      .expect(409);

    expect(res.body.error.code).toBe('ALREADY_OWNED');
    expect(await balanceOf(user.id)).toBe(900);
  });

  it('rejects inactive or unknown products', async () => {
    const { agent, user } = await signUp();
    await fund(user.id, 1000);
    const retired = await createProduct({ active: false });

    const res = await agent
      .post('/api/purchases')
      .set('Idempotency-Key', idem())
      .send({ productId: retired.id })
      .expect(404);
    expect(res.body.error.code).toBe('PRODUCT_UNAVAILABLE');
    await agent
      .post('/api/purchases')
      .set('Idempotency-Key', idem())
      .send({ productId: '00000000-0000-7000-8000-000000000000' })
      .expect(404);
    expect(await balanceOf(user.id)).toBe(1000);
  });

  it('rejects the purchase if the price changed since the user saw it', async () => {
    const { agent, user } = await signUp();
    await fund(user.id, 1000);
    const product = await createProduct({ priceCoins: 250 });

    const res = await agent
      .post('/api/purchases')
      .set('Idempotency-Key', idem())
      .send({ productId: product.id, expectedPriceCoins: 200 })
      .expect(409);

    expect(res.body.error).toMatchObject({ code: 'PRICE_CHANGED', details: { priceCoins: 250 } });
    expect(await balanceOf(user.id)).toBe(1000);
  });

  it('replays a retried purchase without charging twice', async () => {
    const { agent, user } = await signUp();
    await fund(user.id, 1000);
    const product = await createProduct({ priceCoins: 400 });
    const key = idem();

    const first = await agent
      .post('/api/purchases')
      .set('Idempotency-Key', key)
      .send({ productId: product.id })
      .expect(201);
    const retry = await agent
      .post('/api/purchases')
      .set('Idempotency-Key', key)
      .send({ productId: product.id })
      .expect(200);

    expect(retry.headers['idempotent-replayed']).toBe('true');
    expect(retry.body.purchase.id).toBe(first.body.purchase.id);
    expect(await balanceOf(user.id)).toBe(600);
    await expectLedgerConsistent(user.id);
  });

  it('marks owned products in the catalog for the signed-in user', async () => {
    const { agent, user } = await signUp();
    await fund(user.id, 1000);
    const owned = await createProduct({ name: 'Owned', priceCoins: 100 });
    await createProduct({ name: 'Not owned', priceCoins: 100 });
    await createProduct({ name: 'Hidden', active: false });

    await agent.post('/api/purchases').set('Idempotency-Key', idem()).send({ productId: owned.id }).expect(201);
    const res = await agent.get('/api/products?sort=name').expect(200);

    expect(res.body.items.map((p: { name: string; owned: boolean }) => [p.name, p.owned])).toEqual([
      ['Not owned', false],
      ['Owned', true],
    ]);
  });
});
