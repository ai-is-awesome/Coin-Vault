/**
 * Seeds a realistic, browsable dataset: coin packages, a product catalog and a few users with real
 * activity (coin top-ups, a declined card, purchases, a refund and an admin adjustment).
 *
 * All coin movements go through the same services the API uses, so the ledger is consistent
 * (balance == credits - debits). Idempotent: existing packages, products and users are left alone.
 *
 *   npm run db:seed      then      npm run db:studio   (browse the data)
 */
import { randomUUID } from 'node:crypto';

// Seed instantly: skip the mock payment provider's simulated latency.
process.env.MOCK_PAYMENT_LATENCY_MS ??= '0';

const { prisma } = await import('../src/db/prisma.js');
const { register } = await import('../src/services/authService.js');
const { purchaseCoins } = await import('../src/services/coinPurchaseService.js');
const { purchaseProduct, refundPurchase } = await import('../src/services/purchaseService.js');
const { adjustBalance } = await import('../src/services/adminService.js');
type Category = 'SKIN' | 'EMOTE' | 'BATTLE_PASS';
type Rarity = 'COMMON' | 'RARE' | 'EPIC' | 'LEGENDARY';

const COIN_PACKAGES = [
  { code: 'pile', name: 'Pile of Gold', coins: 100, bonusCoins: 0, priceCents: 99, sortOrder: 1 },
  { code: 'pouch', name: 'Pouch of Gold', coins: 500, bonusCoins: 25, priceCents: 499, sortOrder: 2 },
  { code: 'sack', name: 'Sack of Gold', coins: 1000, bonusCoins: 100, priceCents: 999, sortOrder: 3 },
  { code: 'chest', name: 'Chest of Gold', coins: 2500, bonusCoins: 400, priceCents: 2499, sortOrder: 4 },
  { code: 'hoard', name: "Dragon's Hoard", coins: 5000, bonusCoins: 1000, priceCents: 4999, sortOrder: 5 },
];

const PRODUCTS: {
  sku: string;
  name: string;
  category: Category;
  rarity: Rarity;
  priceCoins: number;
  description: string;
  active?: boolean;
}[] = [
  {
    sku: 'SKN-NEON-SAMURAI',
    name: 'Neon Samurai',
    category: 'SKIN',
    rarity: 'LEGENDARY',
    priceCoins: 1800,
    description: 'A cyber-ronin clad in armor that pulses to the beat of battle.',
  },
  {
    sku: 'SKN-DRAGONFIRE',
    name: 'Dragonfire Knight',
    category: 'SKIN',
    rarity: 'LEGENDARY',
    priceCoins: 2000,
    description: 'Forged in dragon flame. Embers trail every step you take.',
  },
  {
    sku: 'SKN-GALAXY-DRIFTER',
    name: 'Galaxy Drifter',
    category: 'SKIN',
    rarity: 'EPIC',
    priceCoins: 1500,
    description: 'A spacesuit stitched from starlight and nebula dust.',
  },
  {
    sku: 'SKN-ARCTIC-OPS',
    name: 'Arctic Ops',
    category: 'SKIN',
    rarity: 'EPIC',
    priceCoins: 1200,
    description: 'Winter tactical gear built for silent snowfield takedowns.',
  },
  {
    sku: 'SKN-PIXEL-HERO',
    name: 'Pixel Hero',
    category: 'SKIN',
    rarity: 'RARE',
    priceCoins: 800,
    description: 'A retro 8-bit adventurer, lovingly rendered in chunky pixels.',
  },
  {
    sku: 'SKN-JUNGLE-SCOUT',
    name: 'Jungle Scout',
    category: 'SKIN',
    rarity: 'COMMON',
    priceCoins: 500,
    description: 'Lightweight camo for scouting the deep canopy.',
  },
  {
    sku: 'EMT-MIC-DROP',
    name: 'Mic Drop',
    category: 'EMOTE',
    rarity: 'EPIC',
    priceCoins: 450,
    description: 'End the round the only way that matters.',
  },
  {
    sku: 'EMT-VICTORY-DANCE',
    name: 'Victory Dance',
    category: 'EMOTE',
    rarity: 'RARE',
    priceCoins: 300,
    description: 'A celebratory jig for well-earned wins.',
  },
  {
    sku: 'EMT-FLOSS-BOSS',
    name: 'Floss Boss',
    category: 'EMOTE',
    rarity: 'RARE',
    priceCoins: 250,
    description: 'The classic, perfected.',
  },
  {
    sku: 'EMT-SALUTE',
    name: "Commander's Salute",
    category: 'EMOTE',
    rarity: 'COMMON',
    priceCoins: 200,
    description: 'Show respect to a worthy opponent.',
  },
  {
    sku: 'EMT-FACEPALM',
    name: 'Facepalm',
    category: 'EMOTE',
    rarity: 'COMMON',
    priceCoins: 150,
    description: 'For when your teammate walks into the storm. Again.',
  },
  {
    sku: 'BP-S7-PREMIUM',
    name: 'Season 7 Premium Pass',
    category: 'BATTLE_PASS',
    rarity: 'LEGENDARY',
    priceCoins: 2400,
    description: 'The Season 7 Battle Pass plus 25 instant tier skips.',
  },
  {
    sku: 'BP-S7-STANDARD',
    name: 'Season 7 Battle Pass',
    category: 'BATTLE_PASS',
    rarity: 'EPIC',
    priceCoins: 950,
    description: 'Unlock 100 tiers of Season 7 rewards.',
  },
  {
    sku: 'BP-S6-LEGACY',
    name: 'Season 6 Battle Pass',
    category: 'BATTLE_PASS',
    rarity: 'RARE',
    priceCoins: 950,
    description: 'Last season’s pass. No longer sold.',
    active: false,
  },
];

const PASSWORDS = { admin: 'Admin123!', player: 'Player123!', demo: 'Demo123!' };

async function seedCatalog() {
  for (const pkg of COIN_PACKAGES) {
    await prisma.coinPackage.upsert({ where: { code: pkg.code }, create: pkg, update: {} });
  }
  for (const product of PRODUCTS) {
    await prisma.product.upsert({ where: { sku: product.sku }, create: product, update: {} });
  }
}

const ids = {
  pkg: async (code: string) => (await prisma.coinPackage.findUniqueOrThrow({ where: { code } })).id,
  product: async (sku: string) => prisma.product.findUniqueOrThrow({ where: { sku } }),
};

/** Creates the user (with wallet) unless it already exists. Returns null when it already existed. */
async function createUser(email: string, password: string, name: string, role: 'USER' | 'ADMIN' = 'USER') {
  if (await prisma.user.findUnique({ where: { email } })) return null;
  const user = await register({ email, password, name });
  if (role === 'ADMIN') await prisma.user.update({ where: { id: user.id }, data: { role } });
  return user;
}

async function buyCoins(userId: string, packageCode: string, paymentToken: string) {
  return purchaseCoins({ userId, packageId: await ids.pkg(packageCode), paymentToken, idempotencyKey: randomUUID() });
}

async function buyProduct(userId: string, sku: string) {
  const product = await ids.product(sku);
  return purchaseProduct({
    userId,
    productId: product.id,
    expectedPriceCoins: product.priceCoins,
    idempotencyKey: randomUUID(),
  });
}

async function seedUsers() {
  const admin =
    (await createUser('admin@coinvault.dev', PASSWORDS.admin, 'Vault Admin', 'ADMIN')) ??
    (await prisma.user.findUniqueOrThrow({ where: { email: 'admin@coinvault.dev' } }));

  const demo = await createUser('demo@coinvault.dev', PASSWORDS.demo, 'Demo Player');
  if (demo) {
    await buyCoins(demo.id, 'sack', 'tok_visa'); // +1100
    await buyCoins(demo.id, 'pile', 'tok_chargeDeclined'); // declined, no coins
    await buyCoins(demo.id, 'pouch', 'tok_mastercard'); // +525
    await buyProduct(demo.id, 'EMT-VICTORY-DANCE'); // -300
    await buyProduct(demo.id, 'SKN-PIXEL-HERO'); // -800  => 525
  }

  const alex = await createUser('alex@coinvault.dev', PASSWORDS.player, 'Alex Rivera');
  if (alex) {
    await buyCoins(alex.id, 'chest', 'tok_visa'); // +2900
    await buyProduct(alex.id, 'BP-S7-STANDARD'); // -950
    await buyProduct(alex.id, 'SKN-NEON-SAMURAI'); // -1800
    const { purchase } = await buyProduct(alex.id, 'EMT-FACEPALM'); // -150  => 0
    await refundPurchase(purchase.id, admin.id); // +150
    await adjustBalance({
      userId: alex.id,
      amount: 200,
      note: 'Compensation for match server outage',
      actorId: admin.id,
      idempotencyKey: randomUUID(),
    }); // => 350
  }

  const sam = await createUser('sam@coinvault.dev', PASSWORDS.player, 'Sam Lee');
  if (sam) {
    await buyCoins(sam.id, 'pouch', 'tok_insufficientFunds'); // declined => 0
  }
}

async function main() {
  await seedCatalog();
  // Demo accounts have well-known passwords: never create them in production.
  if (process.env.NODE_ENV === 'production' && process.env.SEED_DEMO_USERS !== 'true') {
    console.log('NODE_ENV=production: seeded the catalog only (set SEED_DEMO_USERS=true to add demo accounts).');
  } else {
    await seedUsers();
  }

  const users = await prisma.user.findMany({
    orderBy: { createdAt: 'asc' },
    select: {
      email: true,
      role: true,
      wallet: { select: { balance: true } },
      _count: { select: { inventoryItems: true } },
    },
  });
  const counts = {
    coinPackages: await prisma.coinPackage.count(),
    products: await prisma.product.count(),
    paymentOrders: await prisma.paymentOrder.count(),
    purchases: await prisma.purchase.count(),
    ledgerEntries: await prisma.ledgerEntry.count(),
  };

  console.log('\nSeed complete.');
  console.table(counts);
  console.table(
    users.map((u) => ({
      email: u.email,
      role: u.role,
      balance: u.wallet?.balance ?? 0,
      items: u._count.inventoryItems,
    })),
  );
  console.log(
    'Logins:  admin@coinvault.dev / Admin123!   demo@coinvault.dev / Demo123!   alex@ & sam@coinvault.dev / Player123!',
  );
  console.log('Browse the data:  npm run db:studio\n');
}

try {
  await main();
} catch (err) {
  console.error(err);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
