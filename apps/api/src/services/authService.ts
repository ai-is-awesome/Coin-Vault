import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { prisma } from '../db/prisma.js';
import { AppError, uniqueViolation } from '../lib/errors.js';
import { publicUserSelect, type PublicUser } from '../lib/serializers.js';

// Compared against when the email is unknown, so response time doesn't reveal which emails exist.
const DUMMY_HASH = bcrypt.hashSync('timing-safe-dummy-password', env.BCRYPT_ROUNDS);

export async function register(input: { email: string; password: string; name: string }): Promise<PublicUser> {
  const passwordHash = await bcrypt.hash(input.password, env.BCRYPT_ROUNDS);
  try {
    // Nested create: the user and their empty wallet are inserted in one transaction.
    return await prisma.user.create({
      data: { email: input.email, name: input.name, passwordHash, wallet: { create: {} } },
      select: publicUserSelect,
    });
  } catch (err) {
    if (uniqueViolation(err) === 'users_email_key') {
      throw new AppError(409, 'EMAIL_TAKEN', 'An account with this email already exists');
    }
    throw err;
  }
}

export async function login(input: { email: string; password: string }): Promise<PublicUser> {
  const user = await prisma.user.findUnique({
    where: { email: input.email },
    select: { ...publicUserSelect, passwordHash: true },
  });
  const valid = await bcrypt.compare(input.password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !valid) throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
  const { passwordHash: _hash, ...publicUser } = user;
  return publicUser;
}

export function signToken(userId: string): string {
  return jwt.sign({}, env.JWT_SECRET, {
    subject: userId,
    expiresIn: env.JWT_EXPIRES_IN_SECONDS,
    algorithm: 'HS256',
  });
}

/** Returns the user id from a valid token, or null. */
export function verifyToken(token: string): string | null {
  try {
    const payload = jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'] });
    return typeof payload === 'object' && typeof payload.sub === 'string' ? payload.sub : null;
  } catch {
    return null;
  }
}
