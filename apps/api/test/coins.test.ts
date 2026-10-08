import { describe, expect, it } from 'vitest';
import { prisma } from '../src/db/prisma.js';
import { purchaseCoins } from '../src/services/coinPurchaseService.js';
import { balanceOf, createPackage, expectLedgerConsistent, idem, signUp } from './helpers.js';

describe('buying Gold Coins', () => {
  it('lists only active coin packages', async () => {
    const { agent } = await signUp();
    await createPackage({ coins: 100, priceCents: 99 });
    await createPackage({ coins: 999, active: false });
    const res = await agent.get('/api/coin-packages').expect(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0]).toMatchObject({ coins: 100, priceCents: 99 });
  });

  it('charges the card and credits coins (including bonus) exactly once', async () => {
    const { agent, user } = await signUp();
    const pkg = await createPackage({ coins: 500, bonusCoins: 25, priceCents: 499 });

    const res = await agent
      .post('/api/coin-purchases')
      .set('Idempotency-Key', idem())
      .send({ packageId: pkg.id, paymentToken: 'tok_visa' })
      .expect(201);

    expect(res.body.balance).toBe(525);
    expect(res.body.order).toMatchObject({ status: 'SUCCEEDED', coins: 525, amountCents: 499, cardLast4: '4242' });
    expect(res.body.order.requestHash).toBeUndefined();

    const ledger = await prisma.ledgerEntry.findMany({ where: { userId: user.id } });
    expect(ledger).toHaveLength(1);
    expect(ledger[0]).toMatchObject({
      type: 'CREDIT',
      amount: 525,
      balanceAfter: 525,
      reason: 'COIN_PURCHASE',
      paymentOrderId: res.body.order.id,
    });
  });

  it('records a declined card as a FAILED order and credits nothing', async () => {
    const { agent, user } = await signUp();
    const pkg = await createPackage();

    const res = await agent
      .post('/api/coin-purchases')
      .set('Idempotency-Key', idem())
      .send({ packageId: pkg.id, paymentToken: 'tok_chargeDeclined' })
      .expect(402);

    expect(res.body.error.code).toBe('PAYMENT_DECLINED');
    expect(res.body.error.details).toMatchObject({ declineCode: 'card_declined', order: { status: 'FAILED' } });
    expect(await balanceOf(user.id)).toBe(0);
    expect(await prisma.ledgerEntry.count({ where: { userId: user.id } })).toBe(0);
  });

  it('replays a retried request instead of charging again', async () => {
    const { agent, user } = await signUp();
    const pkg = await createPackage({ coins: 500 });
    const key = idem();
    const send = () =>
      agent
        .post('/api/coin-purchases')
        .set('Idempotency-Key', key)
        .send({ packageId: pkg.id, paymentToken: 'tok_visa' });

    const first = await send().expect(201);
    const retry = await send().expect(200);

    expect(retry.headers['idempotent-replayed']).toBe('true');
    expect(retry.body.order.id).toBe(first.body.order.id);
    expect(await balanceOf(user.id)).toBe(500);
    expect(await prisma.paymentOrder.count({ where: { userId: user.id } })).toBe(1);
  });

  it('rejects reusing an Idempotency-Key for a different package', async () => {
    const { agent } = await signUp();
    const [a, b] = [await createPackage(), await createPackage()];
    const key = idem();
    await agent
      .post('/api/coin-purchases')
      .set('Idempotency-Key', key)
      .send({ packageId: a.id, paymentToken: 'tok_visa' })
      .expect(201);
    const res = await agent
      .post('/api/coin-purchases')
      .set('Idempotency-Key', key)
      .send({ packageId: b.id, paymentToken: 'tok_visa' })
      .expect(422);
    expect(res.body.error.code).toBe('IDEMPOTENCY_KEY_REUSED');
  });

  it('requires an Idempotency-Key and a payment token (never a card number)', async () => {
    const { agent } = await signUp();
    const pkg = await createPackage();
    const noKey = await agent
      .post('/api/coin-purchases')
      .send({ packageId: pkg.id, paymentToken: 'tok_visa' })
      .expect(400);
    expect(noKey.body.error.code).toBe('IDEMPOTENCY_KEY_REQUIRED');
    await agent
      .post('/api/coin-purchases')
      .set('Idempotency-Key', idem())
      .send({ packageId: pkg.id, paymentToken: '4242424242424242' })
      .expect(400);
  });

  it('recovers an order left PENDING by a crash when the client retries', async () => {
    const { user } = await signUp();
    const pkg = await createPackage({ coins: 300 });
    const key = idem();
    // Simulate a crash after the order was created but before it was finalized.
    await prisma.paymentOrder.create({
      data: {
        userId: user.id,
        packageId: pkg.id,
        packageName: pkg.name,
        coins: 300,
        amountCents: pkg.priceCents,
        currency: 'USD',
        idempotencyKey: key,
        requestHash: (await import('../src/lib/requestHash.js')).requestHash({ packageId: pkg.id }),
      },
    });

    const result = await purchaseCoins({
      userId: user.id,
      packageId: pkg.id,
      paymentToken: 'tok_visa',
      idempotencyKey: key,
    });
    expect(result.order.status).toBe('SUCCEEDED');
    expect(result.balance).toBe(300);
    await expectLedgerConsistent(user.id);
  });

  it('credits once when the same request is fired concurrently', async () => {
    const { agent, user } = await signUp();
    const pkg = await createPackage({ coins: 1000 });
    const key = idem();

    const responses = await Promise.all(
      Array.from({ length: 5 }, () =>
        agent
          .post('/api/coin-purchases')
          .set('Idempotency-Key', key)
          .send({ packageId: pkg.id, paymentToken: 'tok_visa' }),
      ),
    );

    for (const res of responses) expect([200, 201]).toContain(res.status);
    expect(await balanceOf(user.id)).toBe(1000);
    expect(await prisma.paymentOrder.count({ where: { userId: user.id } })).toBe(1);
    await expectLedgerConsistent(user.id);
  });
});
