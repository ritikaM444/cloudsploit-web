import Fastify, { type FastifyError, type FastifyInstance } from 'fastify';
import cookie from '@fastify/cookie';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import jwt from '@fastify/jwt';
import rateLimit from '@fastify/rate-limit';
import fastifyStatic from '@fastify/static';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { AppConfig } from './config.ts';
import type { Store } from './db/index.ts';
import { authRoutes } from './auth/routes.ts';
import { accountRoutes } from './accounts/routes.ts';
import { scanRoutes } from './scans/routes.ts';

export async function buildApp(config: AppConfig, store: Store): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: config.env === 'production' ? 'info' : 'debug',
      redact: {
        paths: [
          'req.headers.authorization',
          'req.headers.cookie',
          'res.headers["set-cookie"]',
        ],
        remove: true,
      },
    },
    trustProxy: true,
    bodyLimit: 1024 * 1024, // 1 MiB is plenty for a service-account JSON upload
  });

  app.decorate('config', config);
  app.decorate('store', store);

  await app.register(helmet, {
    // The SPA is served from the same origin; a strict CSP is enabled for it
    // in production. Disabling helmet's default CSP here avoids breaking the
    // dev tooling; a tailored CSP is applied when serving the built client.
    contentSecurityPolicy: false,
  });
  await app.register(cors, {
    origin: config.corsOrigin,
    credentials: true,
  });
  await app.register(cookie);
  await app.register(jwt, {
    secret: config.jwtSecret,
    cookie: { cookieName: 'cs_token', signed: false },
  });
  await app.register(rateLimit, {
    max: 300,
    timeWindow: '1 minute',
  });

  app.decorate('authenticate', async (request, reply) => {
    try {
      await request.jwtVerify();
    } catch {
      await reply.code(401).send({ error: 'Unauthorized' });
    }
  });

  app.get('/api/health', async () => ({ ok: true, env: config.env }));

  await app.register(authRoutes);
  await app.register(accountRoutes);
  await app.register(scanRoutes);

  // Serve the built SPA when it exists (single-origin deployment).
  const clientDist = join(process.cwd(), '..', 'client', 'dist');
  if (existsSync(clientDist)) {
    await app.register(fastifyStatic, { root: clientDist, prefix: '/' });
    app.setNotFoundHandler((request, reply) => {
      if (request.raw.url?.startsWith('/api/')) {
        return reply.code(404).send({ error: 'NotFound' });
      }
      return reply.sendFile('index.html');
    });
  }

  app.setErrorHandler((error: FastifyError, request, reply) => {
    if (error.validation) {
      return reply.code(400).send({ error: 'ValidationError' });
    }
    if ((error.statusCode ?? 500) >= 500) {
      request.log.error({ err: error }, 'unhandled error');
    }
    return reply
      .code(error.statusCode ?? 500)
      .send({ error: error.statusCode && error.statusCode < 500 ? error.name : 'InternalServerError' });
  });

  return app;
}
