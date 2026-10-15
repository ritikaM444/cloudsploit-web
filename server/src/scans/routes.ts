import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { FindingStatus } from '../types.ts';

const createScanSchema = z.object({
  accountId: z.uuid(),
  plugin: z.string().min(1).max(100).optional(),
  compliance: z.array(z.enum(['hipaa', 'cis', 'cis1', 'cis2', 'pci'])).optional(),
});

const findingsQuerySchema = z.object({
  status: z.enum(['OK', 'WARN', 'FAIL', 'UNKNOWN']).optional(),
  category: z.string().min(1).max(100).optional(),
});

export async function scanRoutes(app: FastifyInstance): Promise<void> {
  app.addHook('preHandler', app.authenticate);

  app.get('/api/scans', async (request, reply) => {
    return reply.send({ scans: app.store.listScans(request.user.sub) });
  });

  app.post('/api/scans', async (request, reply) => {
    const parsed = createScanSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'ValidationError', issues: parsed.error.issues });
    }

    const account = app.store.getAccountRaw(parsed.data.accountId, request.user.sub);
    if (!account) return reply.code(404).send({ error: 'AccountNotFound' });

    const scan = app.store.createScan(request.user.sub, account.id, account.provider, {
      plugin: parsed.data.plugin,
      compliance: parsed.data.compliance,
    });

    return reply.code(202).send({ scan });
  });

  app.get('/api/scans/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const scan = app.store.getScan(id, request.user.sub);
    if (!scan) return reply.code(404).send({ error: 'NotFound' });
    return reply.send({ scan });
  });

  app.get('/api/scans/:id/findings', async (request, reply) => {
    const { id } = request.params as { id: string };
    const scan = app.store.getScan(id, request.user.sub);
    if (!scan) return reply.code(404).send({ error: 'NotFound' });

    const q = findingsQuerySchema.safeParse(request.query);
    if (!q.success) {
      return reply.code(400).send({ error: 'ValidationError', issues: q.error.issues });
    }

    const findings = app.store.listFindings(id, {
      status: q.data.status as FindingStatus | undefined,
      category: q.data.category,
    });
    return reply.send({
      scan,
      summary: {
        total: scan.result_count,
        fail: scan.fail_count,
        warn: scan.warn_count,
        ok: scan.result_count - scan.fail_count - scan.warn_count,
      },
      findings,
    });
  });
}
