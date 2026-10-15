import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { encryptSecret } from '../security/crypto.ts';
import { PROVIDER_IDS, getProvider } from '../providers/index.ts';

const createAccountSchema = z.object({
  name: z.string().min(1).max(100),
  provider: z.enum(PROVIDER_IDS),
  // Accept either an uploaded JSON object or a JSON string.
  credentials: z.union([z.string(), z.record(z.string(), z.unknown())]),
});

export async function accountRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', app.authenticate);

  app.get('/api/accounts', async (request, reply) => {
    return reply.send({ accounts: app.store.listAccounts(request.user.sub) });
  });

  app.post('/api/accounts', async (request, reply) => {
    const parsed = createAccountSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'ValidationError', issues: parsed.error.issues });
    }

    const definition = getProvider(parsed.data.provider);
    if (!definition) {
      return reply.code(400).send({ error: 'UnsupportedProvider' });
    }

    let credentials: Record<string, unknown>;
    let identifier: string | null;
    try {
      ({ credentials, identifier } = definition.parse(parsed.data.credentials));
    } catch (err) {
      return reply.code(400).send({
        error: 'InvalidCredentials',
        message: err instanceof Error ? err.message : 'Invalid credentials',
      });
    }

    // Never store plaintext credentials: encrypt with AES-256-GCM.
    const ciphertext = encryptSecret(JSON.stringify(credentials), app.config.masterKey);
    const account = app.store.createAccount(
      request.user.sub,
      definition.id,
      parsed.data.name,
      identifier,
      ciphertext,
    );

    return reply.code(201).send({
      account: {
        id: account.id,
        provider: account.provider,
        name: account.name,
        projectId: account.project_id,
        createdAt: account.created_at,
      },
    });
  });

  app.delete('/api/accounts/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const deleted = app.store.deleteAccount(id, request.user.sub);
    if (!deleted) return reply.code(404).send({ error: 'NotFound' });
    return reply.send({ ok: true });
  });
}
