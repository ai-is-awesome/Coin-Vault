import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/db/prisma.js';
import { RATE_LIMITS } from '../src/middleware/rateLimit.js';
import { createPackage, idem } from './helpers.js';

const {
  failedLoginsPerAccount,
  authAttemptsPerClient: attemptsPerClient,
  coinPurchasesPerUser,
  declinedPaymentsPerUser,
  purchasesPerUser,
  adminWritesPerAdmin,
} = RATE_LIMITS;

// Each test builds its own app so limiter counters start from zero.
const freshApp = () => createApp({ rateLimit: true });

async function registerOn(app: ReturnType<typeof createApp>, email: string) {
  await request(app)
    .post('/api/auth/register')
    .send({ email, password: 'Password123!', name: 'Rate Test' })
    .expect(201);
}

const login = (app: ReturnType<typeof createApp>, email: string, password: string, ip?: string) => {
  const req = request(app).post('/api/auth/login');
  if (ip) req.set('X-Forwarded-For', ip);
  return req.send({ email, password });
};

describe('auth rate limiting', () => {
  it(`locks an account after ${failedLoginsPerAccount.limit} failed logins, even with the right password`, async () => {
    const app = freshApp();
    await registerOn(app, 'victim@test.dev');

    for (let i = 0; i < failedLoginsPerAccount.limit; i++) {
      await login(app, 'victim@test.dev', 'wrong-password').expect(401);
    }
    const blocked = await login(app, 'VICTIM@test.dev', 'wrong-password').expect(429);
    expect(blocked.body.error.code).toBe('RATE_LIMITED');
    expect(blocked.body.error.details.retryAfterSeconds).toBeGreaterThan(0);
    expect(blocked.headers['retry-after']).toBeDefined();
    expect(blocked.headers['ratelimit']).toBeDefined();

    // The correct password is also refused while the account is locked.
    await login(app, 'victim@test.dev', 'Password123!').expect(429);
    // Other accounts are unaffected.
    await registerOn(app, 'bystander@test.dev');
    await login(app, 'bystander@test.dev', 'Password123!').expect(200);
  });

  it('does not count successful logins toward the account limit', async () => {
    const app = freshApp();
    await registerOn(app, 'regular@test.dev');
    for (let i = 0; i < failedLoginsPerAccount.limit + 3; i++) {
      await login(app, 'regular@test.dev', 'Password123!').expect(200);
    }
  });

  it(`limits one client to ${attemptsPerClient.limit} attempts across many accounts (credential stuffing)`, async () => {
    const app = freshApp();
    for (let i = 0; i < attemptsPerClient.limit; i++) {
      await login(app, `stuffing-${i}@test.dev`, 'guess').expect(401);
    }
    const res = await login(app, 'one-more@test.dev', 'guess').expect(429);
    expect(res.body.error.code).toBe('RATE_LIMITED');
    // Registration shares the per-client budget.
    await request(app)
      .post('/api/auth/register')
      .send({ email: 'new@test.dev', password: 'Password123!', name: 'X' })
      .expect(429);
  });

  it('ignores spoofed X-Forwarded-For headers (TRUST_PROXY defaults to false)', async () => {
    const app = freshApp();
    for (let i = 0; i < attemptsPerClient.limit; i++) {
      await login(app, `spoof-${i}@test.dev`, 'guess', `203.0.113.${i}`).expect(401);
    }
    await login(app, 'spoof-final@test.dev', 'guess', '198.51.100.7').expect(429);
  });

  it('does not rate limit other endpoints', async () => {
    const app = freshApp();
    for (let i = 0; i < attemptsPerClient.limit + 5; i++) {
      await request(app).get('/api/auth/me').expect(401);
    }
  });
});

/** A signed-in agent on its own rate-limited app. */
async function sessionOn(app: ReturnType<typeof createApp>, role: 'USER' | 'ADMIN' = 'USER') {
  const agent = request.agent(app);
  const res = await agent
    .post('/api/auth/register')
    .send({ email: `${idem()}@test.dev`, password: 'Password123!', name: 'Limited' })
    .expect(201);
  if (role === 'ADMIN') await prisma.user.update({ where: { id: res.body.user.id }, data: { role } });
  return agent;
}

describe('rate limiting on money-moving and admin endpoints', () => {
  it(`allows ${coinPurchasesPerUser.limit} coin purchases per user per window`, async () => {
    const app = freshApp();
    const agent = await sessionOn(app);
    const other = await sessionOn(app);
    const pkg = await createPackage({ coins: 100 });
    const buy = (a: typeof agent) =>
      a
        .post('/api/coin-purchases')
        .set('Idempotency-Key', idem())
        .send({ packageId: pkg.id, paymentToken: 'tok_visa' });

    for (let i = 0; i < coinPurchasesPerUser.limit; i++) await buy(agent).expect(201);
    const blocked = await buy(agent).expect(429);
    expect(blocked.body.error.code).toBe('RATE_LIMITED');

    // Limits are per user, and reads stay available.
    await buy(other).expect(201);
    await agent.get('/api/coin-purchases').expect(200);
  });

  it(`pauses card payments after ${declinedPaymentsPerUser.limit} declines (card testing)`, async () => {
    const app = freshApp();
    const agent = await sessionOn(app);
    const pkg = await createPackage();
    const pay = (paymentToken: string) =>
      agent.post('/api/coin-purchases').set('Idempotency-Key', idem()).send({ packageId: pkg.id, paymentToken });

    await pay('tok_visa').expect(201); // successful payments don't count as declines
    for (let i = 0; i < declinedPaymentsPerUser.limit; i++) await pay('tok_chargeDeclined').expect(402);
    const blocked = await pay('tok_visa').expect(429);
    expect(blocked.body.error.message).toMatch(/declined payments/);
  });

  it(`allows ${purchasesPerUser.limit} product purchase attempts per user per minute`, async () => {
    const app = freshApp();
    const agent = await sessionOn(app);
    const missing = '00000000-0000-7000-8000-000000000000';
    for (let i = 0; i < purchasesPerUser.limit; i++) {
      await agent.post('/api/purchases').set('Idempotency-Key', idem()).send({ productId: missing }).expect(404);
    }
    await agent.post('/api/purchases').set('Idempotency-Key', idem()).send({ productId: missing }).expect(429);
    await agent.get('/api/purchases').expect(200);
  });

  it(`allows ${adminWritesPerAdmin.limit} admin writes per minute`, async () => {
    const app = freshApp();
    const admin = await sessionOn(app, 'ADMIN');
    for (let i = 0; i < adminWritesPerAdmin.limit; i++) {
      await admin.post('/api/admin/products').send({}).expect(400);
    }
    await admin.post('/api/admin/products').send({}).expect(429);
    await admin.get('/api/admin/stats').expect(200);
  });

  it('does not count or block anonymous requests (they get 401)', async () => {
    const app = freshApp();
    for (let i = 0; i < purchasesPerUser.limit + 5; i++) {
      await request(app).post('/api/purchases').send({}).expect(401);
    }
  });
});
