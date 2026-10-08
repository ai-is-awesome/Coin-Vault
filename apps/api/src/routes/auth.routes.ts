import { Router } from 'express';
import { z } from 'zod';
import { parseBody, requireUser } from '../lib/http.js';
import { clearSessionCookie, setSessionCookie } from '../middleware/auth.js';
import type { AuthRateLimiters } from '../middleware/rateLimit.js';
import { login, register, signToken } from '../services/authService.js';

const Email = z.string().trim().toLowerCase().max(254).pipe(z.email('Must be a valid email address'));

const RegisterBody = z.object({
  email: Email,
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    // bcrypt only uses the first 72 bytes; reject longer passwords instead of silently truncating them.
    .refine((p) => Buffer.byteLength(p, 'utf8') <= 72, 'Password must be at most 72 bytes'),
  name: z.string().trim().min(1, 'Name is required').max(80),
});

const LoginBody = z.object({
  email: Email,
  password: z.string().min(1, 'Password is required').max(128),
});

export function createAuthRouter(limiters: AuthRateLimiters) {
  const router = Router();

  router.post('/register', limiters.perClient, async (req, res) => {
    const user = await register(parseBody(RegisterBody, req));
    const token = signToken(user.id);
    setSessionCookie(res, token);
    // The token is also returned for API clients (curl/Postman); the web app relies on the httpOnly cookie.
    res.status(201).json({ user, token });
  });

  router.post('/login', limiters.perClient, limiters.perAccount, async (req, res) => {
    const user = await login(parseBody(LoginBody, req));
    const token = signToken(user.id);
    setSessionCookie(res, token);
    res.json({ user, token });
  });

  router.post('/logout', (_req, res) => {
    clearSessionCookie(res);
    res.status(204).end();
  });

  router.get('/me', (req, res) => {
    res.json({ user: requireUser(req) });
  });

  return router;
}
