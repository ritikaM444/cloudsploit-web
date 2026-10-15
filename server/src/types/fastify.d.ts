import type { AppConfig } from '../config.ts';
import type { Store } from '../db/index.ts';

declare module 'fastify' {
  interface FastifyInstance {
    config: AppConfig;
    store: Store;
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: { sub: string; email: string; role: string };
    user: { sub: string; email: string; role: string };
  }
}
