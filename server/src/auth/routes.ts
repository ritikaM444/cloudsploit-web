import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { hashPassword, verifyPassword } from '../security/passwords.ts';
import type { User } from '../types.ts';

const registerSchema = z.object({
  email: z.email().max(254),
  password: z.string().min(10, 'Password must be at least 10 characters').max(200),
});

const loginSchema = z.object({
  email: z.email().max(254),
  password: z.string().min(1).max(200),
});

const passwordSchema = z.object({
  currentPassword: z.string().min(1).max(200),
  newPassword: z.string().min(10, 'Password must be at least 10 characters').max(200),
});

const COOKIE_NAME = 'cs_token';

function toPublic(user: User) {
  return { id: user.id, email: user.email, role: user.role, createdAt: user.created_at };
}

export async function authRoutes(app: FastifyInstance): Promise<void> {
  // Precomputed hash used to equalise timing when an email does not exist,
  // reducing user-enumeration via response timing.
  const dummyHash = await hashPassword('timing-equaliser-value');

  const cookieOptions = {
    httpOnly: true,
    sameSite: 'strict' as const,
    secure: app.config.cookieSecure,
    path: '/',
    maxAge: 7 * 24 * 60 * 60,
  };

  app.post(
    '/api/auth/register',
    { config: { rateLimit: { max: 20, timeWindow: '1 minute' } } },
    async (request, reply) => {
      const parsed = registerSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: 'ValidationError', issues: parsed.error.issues });
      }
      const { email, password } = parsed.data;

      if (app.store.findUserByEmail(email)) {
        return reply.code(409).send({ error: 'EmailAlreadyRegistered' });
      }

      // The first registered user becomes an admin (bootstrapping).
      const role = app.store.countUsers() === 0 ? 'admin' : 'user';
      const user = app.store.createUser(email, await hashPassword(password), role);

      const token = app.jwt.sign({ sub: user.id, email: user.email, role: user.role });
      reply.setCookie(COOKIE_NAME, token, cookieOptions);
      return reply.code(201).send({ user: toPublic(user) });
    },
  );

  app.post(
    '/api/auth/login',
    { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } },
    async (request, reply) => {
      const parsed = loginSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: 'ValidationError' });
      }
      const { email, password } = parsed.data;

      const user = app.store.findUserByEmail(email);
      let ok = false;
      if (user) {
        ok = await verifyPassword(password, user.password_hash);
      } else {
        // Burn equivalent time so missing accounts are not distinguishable.
        await verifyPassword(password, dummyHash);
      }

      if (!user || !ok) {
        return reply.code(401).send({ error: 'InvalidCredentials' });
      }

      const token = app.jwt.sign({ sub: user.id, email: user.email, role: user.role });
      reply.setCookie(COOKIE_NAME, token, cookieOptions);
      return reply.send({ user: toPublic(user) });
    },
  );

  app.post('/api/auth/logout', async (_request, reply) => {
    reply.clearCookie(COOKIE_NAME, { path: '/' });
    return reply.send({ ok: true });
  });

  app.post(
    '/api/auth/password',
    { preHandler: [app.authenticate], config: { rateLimit: { max: 10, timeWindow: '1 minute' } } },
    async (request, reply) => {
      const parsed = passwordSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({ error: 'ValidationError', issues: parsed.error.issues });
      }
      const user = app.store.findUserById(request.user.sub);
      if (!user) return reply.code(401).send({ error: 'Unauthorized' });

      const ok = await verifyPassword(parsed.data.currentPassword, user.password_hash);
      if (!ok) return reply.code(400).send({ error: 'InvalidPassword' });

      app.store.updatePassword(user.id, await hashPassword(parsed.data.newPassword));
      return reply.send({ ok: true });
    },
  );

  app.get('/api/auth/me', { preHandler: [app.authenticate] }, async (request, reply) => {
    const user = app.store.findUserById(request.user.sub);
    if (!user) return reply.code(401).send({ error: 'Unauthorized' });
    return reply.send({ user: toPublic(user) });
  });
}
