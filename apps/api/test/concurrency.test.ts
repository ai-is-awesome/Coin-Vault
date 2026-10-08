import { describe, expect, it } from 'vitest';
import { prisma } from '../src/db/prisma.js';
import { balanceOf, createProduct, expectLedgerConsistent, fund, idem, signUp } from './helpers.js';

describe('concurrent spending', () => {
  it('never overdraws: 5 parallel 30-coin purchases with 100 coins -> exactly 3 succeed', async () => {
    const { agent, user } = await signUp();
    await fund(user.id, 100);
    const products = await Promise.all(
      Array.from({ length: 5 }, (_, i) => createProduct({ name: `Item ${i}`, priceCoins: 30 })),
    );

    const responses = await Promise.all(
      products.map((p) => agent.post('/api/purchases').set('Idempotency-Key', idem()).send({ productId: p.id })),
    );

    const statuses = responses.map((r) => r.status).sort();
    expect(statuses).toEqual([201, 201, 201, 402, 402]);
    expect(await balanceOf(user.id)).toBe(10);
    expect(await prisma.inventoryItem.count({ where: { userId: user.id } })).toBe(3);
    await expectLedgerConsistent(user.id);
  });

  it('sells an item at most once when bought in parallel with different keys', async () => {
    const { agent, user } = await signUp();
    await fund(user.id, 1000);
    const product = await createProduct({ priceCoins: 100 });

    const responses = await Promise.all(
      Array.from({ length: 5 }, () =>
        agent.post('/api/purchases').set('Idempotency-Key', idem()).send({ productId: product.id }),
      ),
    );

    const statuses = responses.map((r) => r.status).sort();
    expect(statuses).toEqual([201, 409, 409, 409, 409]);
    expect(await balanceOf(user.id)).toBe(900);
    expect(await prisma.purchase.count({ where: { userId: user.id } })).toBe(1);
    await expectLedgerConsistent(user.id);
  });

  it('processes a request fired 10 times in parallel with the same key exactly once', async () => {
    const { agent, user } = await signUp();
    await fund(user.id, 1000);
    const product = await createProduct({ priceCoins: 100 });
    const key = idem();

    const responses = await Promise.all(
      Array.from({ length: 10 }, () =>
        agent.post('/api/purchases').set('Idempotency-Key', key).send({ productId: product.id }),
      ),
    );

    for (const res of responses) expect([200, 201]).toContain(res.status);
    expect(new Set(responses.map((r) => r.body.purchase.id)).size).toBe(1);
    expect(await balanceOf(user.id)).toBe(900);
    await expectLedgerConsistent(user.id);
  });

  it('keeps every wallet consistent under mixed parallel load from many users', async () => {
    const users = await Promise.all(Array.from({ length: 4 }, () => signUp()));
    for (const { user } of users) await fund(user.id, 200);
    const products = await Promise.all(
      Array.from({ length: 4 }, (_, i) => createProduct({ name: `Load ${i}`, priceCoins: 70 })),
    );

    const responses = await Promise.all(
      users.flatMap(({ agent }) =>
        products.map((p) => agent.post('/api/purchases').set('Idempotency-Key', idem()).send({ productId: p.id })),
      ),
    );

    expect(responses.every((r) => r.status === 201 || r.status === 402)).toBe(true);
    for (const { user } of users) {
      expect(await balanceOf(user.id)).toBe(60); // 200 - 2 x 70; a third item would overdraw
      await expectLedgerConsistent(user.id);
    }
  });
});
