import type { CookieOptions, Request, RequestHandler, Response } from 'express';
import { env } from '../config/env.js';
import { prisma } from '../db/prisma.js';
import { Errors } from '../lib/errors.js';
import { publicUserSelect } from '../lib/serializers.js';
import { verifyToken } from '../services/authService.js';

export const SESSION_COOKIE = 'cv_session';

const cookieOptions: CookieOptions = {
  httpOnly: true,
  sameSite: 'lax',
  secure: env.COOKIE_SECURE ?? env.NODE_ENV === 'production',
  path: '/',
};

export function setSessionCookie(res: Response, token: string) {
  res.cookie(SESSION_COOKIE, token, { ...cookieOptions, maxAge: env.JWT_EXPIRES_IN_SECONDS * 1000 });
}

export function clearSessionCookie(res: Response) {
  res.clearCookie(SESSION_COOKIE, cookieOptions);
}

function extractToken(req: Request): string | undefined {
  const header = req.get('Authorization');
  if (header?.startsWith('Bearer ')) return header.slice('Bearer '.length).trim();
  const cookie: unknown = req.cookies?.[SESSION_COOKIE];
  return typeof cookie === 'string' ? cookie : undefined;
}

/**
 * Attaches `req.user` when the request carries a valid session (httpOnly cookie for the web app,
 * or `Authorization: Bearer` for API clients). The user is re-read from the database on every
 * request, so role changes and deleted accounts take effect immediately.
 */
export const loadUser: RequestHandler = async (req, _res, next) => {
  const token = extractToken(req);
  const userId = token ? verifyToken(token) : null;
  if (userId) {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: publicUserSelect });
    if (user) req.user = user;
  }
  next();
};

export const requireAdmin: RequestHandler = (req, _res, next) => {
  if (!req.user) throw Errors.unauthorized();
  if (req.user.role !== 'ADMIN') throw Errors.forbidden();
  next();
};
