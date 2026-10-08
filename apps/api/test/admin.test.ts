import { describe, expect, it } from 'vitest';
import { prisma } from '../src/db/prisma.js';
import { balanceOf, createProduct, expectLedgerConsistent, fund, idem, signUp, signUpAdmin } from './helpers.js';

describe('admin', () => {
  it('manages the catalog (create, update, soft delete)', async () => {
    const { agent } = await signUpAdmin();

    const created = await agent
      .post('/api/admin/products')
      .send({ sku: 'skn-test-1', name: 'Test Skin', category: 'SKIN', rarity: 'EPIC', priceCoins: 1200 })
      .expect(201);
    expect(created.body.product).toMatchObject({ sku: 'SKN-TEST-1', active: true });

    const dupe = await agent
      .post('/api/admin/products')
      .send({ sku: 'SKN-TEST-1', name: 'Again', category: 'SKIN', priceCoins: 1 })
      .expect(409);
    expect(dupe.body.error.code).toBe('SKU_TAKEN');

    const id = created.body.product.id;
    await agent.patch(`/api/admin/products/${id}`).send({ priceCoins: 999 }).expect(200);
    await agent.delete(`/api/admin/products/${id}`).expect(200);

    const product = await prisma.product.findUniqueOrThrow({ where: { id } });
    expect(product).toMatchObject({ priceCoins: 999, active: false });
    await agent.get(`/api/products/${id}`).expect(404);
  });

  it('refunds a purchase exactly once: coins back, item revoked', async () => {
    const { agent: admin } = await signUpAdmin();
    const { agent, user } = await signUp();
    await fund(user.id, 500);
    const product = await createProduct({ priceCoins: 200 });
    const bought = await agent
      .post('/api/purchases')
      .set('Idempotency-Key', idem())
      .send({ productId: product.id })
      .expect(201);

    const refund = await admin.post(`/api/admin/purchases/${bought.body.purchase.id}/refund`).expect(200);
    expect(refund.body).toMatchObject({ balance: 500, purchase: { status: 'REFUNDED' } });
    expect(await prisma.inventoryItem.count({ where: { userId: user.id } })).toBe(0);

    const again = await admin.post(`/api/admin/purchases/${bought.body.purchase.id}/refund`).expect(409);
    expect(again.body.error.code).toBe('ALREADY_REFUNDED');
    expect(await balanceOf(user.id)).toBe(500);
    await expectLedgerConsistent(user.id);

    // The item can be bought again after a refund.
    await agent.post('/api/purchases').set('Idempotency-Key', idem()).send({ productId: product.id }).expect(201);
  });

  it('adjusts balances with an audit trail but never below zero', async () => {
    const { agent: admin, user: adminUser } = await signUpAdmin();
    const { user } = await signUp();

    const credit = await admin
      .post(`/api/admin/users/${user.id}/adjust`)
      .set('Idempotency-Key', idem())
      .send({ amount: 300, note: 'Goodwill credit' })
      .expect(201);
    expect(credit.body.balance).toBe(300);
    expect(credit.body.entry).toMatchObject({
      type: 'CREDIT',
      reason: 'ADMIN_ADJUSTMENT',
      actorId: adminUser.id,
      note: 'Goodwill credit',
    });

    const overdraw = await admin
      .post(`/api/admin/users/${user.id}/adjust`)
      .set('Idempotency-Key', idem())
      .send({ amount: -301, note: 'Too much' })
      .expect(402);
    expect(overdraw.body.error.code).toBe('INSUFFICIENT_FUNDS');

    await admin
      .post(`/api/admin/users/${user.id}/adjust`)
      .set('Idempotency-Key', idem())
      .send({ amount: -300, note: 'Chargeback' })
      .expect(201);
    expect(await balanceOf(user.id)).toBe(0);
    await expectLedgerConsistent(user.id);
  });

  it('reports platform stats and lists users with balances', async () => {
    const { agent: admin } = await signUpAdmin();
    const { user } = await signUp({ email: 'rich@test.dev' });
    await fund(user.id, 750);

    const users = await admin.get('/api/admin/users?search=rich').expect(200);
    expect(users.body.items).toEqual([
      expect.objectContaining({ email: 'rich@test.dev', balance: 750, itemsOwned: 0 }),
    ]);

    const stats = await admin.get('/api/admin/stats').expect(200);
    expect(stats.body.coinsInCirculation).toBe(750);
  });
});

describe('database guards', () => {
  it('blocks edits to the append-only ledger', async () => {
    const { user } = await signUp();
    await fund(user.id, 10);
    const entry = await prisma.ledgerEntry.findFirstOrThrow({ where: { userId: user.id } });
    await expect(prisma.ledgerEntry.update({ where: { id: entry.id }, data: { amount: 1_000_000 } })).rejects.toThrow();
    await expect(prisma.ledgerEntry.delete({ where: { id: entry.id } })).rejects.toThrow();
  });

  it('rejects a negative balance at the database level', async () => {
    const { user } = await signUp();
    await expect(prisma.wallet.update({ where: { userId: user.id }, data: { balance: -1 } })).rejects.toThrow(
      /check constraint/i,
    );
  });
});
