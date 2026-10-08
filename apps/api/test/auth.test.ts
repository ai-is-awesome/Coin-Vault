import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { prisma } from '../src/db/prisma.js';
import { app, signUp } from './helpers.js';

describe('auth', () => {
  it('registers a user with an empty wallet and a session cookie', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'New.Player@Test.dev', password: 'Password123!', name: 'New Player' })
      .expect(201);

    expect(res.body.user).toMatchObject({ email: 'new.player@test.dev', name: 'New Player', role: 'USER' });
    expect(res.body.user.passwordHash).toBeUndefined();
    expect(res.headers['set-cookie']?.[0]).toMatch(/cv_session=.+HttpOnly/i);

    const wallet = await prisma.wallet.findUniqueOrThrow({ where: { userId: res.body.user.id } });
    expect(wallet.balance).toBe(0);
  });

  it('rejects duplicate emails case-insensitively', async () => {
    await signUp({ email: 'dupe@test.dev' });
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'DUPE@test.dev', password: 'Password123!', name: 'Again' })
      .expect(409);
    expect(res.body.error.code).toBe('EMAIL_TAKEN');
  });

  it('validates registration input', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'not-an-email', password: 'short', name: '' })
      .expect(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details.map((d: { path: string }) => d.path).sort()).toEqual(['email', 'name', 'password']);
  });

  it('logs in with a cookie or bearer token and returns the current user', async () => {
    const { user, password } = await signUp({ email: 'login@test.dev' });

    const agent = request.agent(app);
    const login = await agent.post('/api/auth/login').send({ email: 'login@test.dev', password }).expect(200);
    expect(login.body.user.id).toBe(user.id);

    const viaCookie = await agent.get('/api/auth/me').expect(200);
    expect(viaCookie.body.user.email).toBe('login@test.dev');

    const viaBearer = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${login.body.token}`)
      .expect(200);
    expect(viaBearer.body.user.id).toBe(user.id);
  });

  it('rejects bad credentials without revealing which part was wrong', async () => {
    await signUp({ email: 'creds@test.dev' });
    const wrongPassword = await request(app)
      .post('/api/auth/login')
      .send({ email: 'creds@test.dev', password: 'nope' })
      .expect(401);
    const unknownEmail = await request(app)
      .post('/api/auth/login')
      .send({ email: 'ghost@test.dev', password: 'nope' })
      .expect(401);
    expect(wrongPassword.body.error).toEqual(unknownEmail.body.error);
  });

  it('requires authentication for private routes and an admin role for admin routes', async () => {
    await request(app).get('/api/wallet').expect(401);
    await request(app).get('/api/auth/me').set('Authorization', 'Bearer not-a-token').expect(401);

    const { agent } = await signUp();
    const res = await agent.get('/api/admin/users').expect(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('logs out by clearing the cookie', async () => {
    const { agent } = await signUp();
    await agent.post('/api/auth/logout').expect(204);
    await agent.get('/api/auth/me').expect(401);
  });
});
