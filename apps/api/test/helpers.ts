import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import request from 'supertest';
import { afterAll, expect } from 'vitest';
import { createApp } from '../src/app.js';
import { prisma } from '../src/db/prisma.js';
import { adjustBalance } from '../src/services/adminService.js';
import type { ProductCategory, Rarity } from '../src/generated/prisma/enums.js';

export const app = createApp();

// One already-listening server shared by all session agents (supertest would otherwise attach a
// listener per in-flight request to a lazily started server, which trips MaxListeners in parallel tests).
const server = createServer(app).listen(0);
afterAll(() => new Promise<void>((resolve) => server.close(() => resolve())));

export const idem = () => randomUUID();

let seq = 0;
const unique = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${++seq}`;

/** Registers a user and returns a supertest agent that carries their session cookie. */
export async function signUp(overrides: { email?: string; password?: string; name?: string } = {}) {
  const agent = request.agent(server);
  const body = {
    email: overrides.email ?? `${unique('user')}@test.dev`,
    password: overrides.password ?? 'Password123!',
    name: overrides.name ?? 'Test User',
  };
  const res = await agent.post('/api/auth/register').send(body).expect(201);
  return { agent, user: res.body.user as { id: string; email: string; role: string }, password: body.password };
}

export async function signUpAdmin() {
  const session = await signUp({ name: 'Admin' });
  await prisma.user.update({ where: { id: session.user.id }, data: { role: 'ADMIN' } });
  return session;
}

let systemAdminId: string | undefined;

/** Gives a user coins through the real ledger path (an admin adjustment). */
export async function fund(userId: string, amount: number) {
  if (!systemAdminId || !(await prisma.user.findUnique({ where: { id: systemAdminId } }))) {
    const admin = await prisma.user.create({
      data: {
        email: `${unique('system')}@test.dev`,
        name: 'System',
        passwordHash: 'x',
        role: 'ADMIN',
        wallet: { create: {} },
      },
    });
    systemAdminId = admin.id;
  }
  await adjustBalance({ userId, amount, note: 'test funding', actorId: systemAdminId, idempotencyKey: randomUUID() });
}

export async function createProduct(
  overrides: Partial<{
    name: string;
    priceCoins: number;
    category: ProductCategory;
    rarity: Rarity;
    active: boolean;
  }> = {},
) {
  return prisma.product.create({
    data: {
      sku: unique('SKU').toUpperCase(),
      name: overrides.name ?? 'Test Skin',
      category: overrides.category ?? 'SKIN',
      rarity: overrides.rarity ?? 'RARE',
      priceCoins: overrides.priceCoins ?? 100,
      active: overrides.active ?? true,
    },
  });
}

export async function createPackage(
  overrides: Partial<{ coins: number; bonusCoins: number; priceCents: number; active: boolean }> = {},
) {
  return prisma.coinPackage.create({
    data: {
      code: unique('pkg'),
      name: 'Test Pack',
      coins: overrides.coins ?? 500,
      bonusCoins: overrides.bonusCoins ?? 0,
      priceCents: overrides.priceCents ?? 499,
      active: overrides.active ?? true,
    },
  });
}

export async function balanceOf(userId: string) {
  return (await prisma.wallet.findUniqueOrThrow({ where: { userId } })).balance;
}

/** Invariant: wallet balance == sum(credits) - sum(debits), and every entry's balanceAfter is >= 0. */
export async function expectLedgerConsistent(userId: string) {
  const entries = await prisma.ledgerEntry.findMany({ where: { userId } });
  const sum = entries.reduce((acc, e) => acc + (e.type === 'CREDIT' ? e.amount : -e.amount), 0);
  expect(await balanceOf(userId)).toBe(sum);
  for (const e of entries) expect(e.balanceAfter).toBeGreaterThanOrEqual(0);
}
