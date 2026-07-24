import type { FastifyPluginAsync } from 'fastify';

export const pushRoutes: FastifyPluginAsync = async (server) => {
  server.post('/api/push/register', async (request, reply) => {
    const db = server.db;
    const { token, platform } = request.body as { token: string; platform: string };

    if (!token) {
      return reply.code(400).send({ error: 'Token is required' });
    }

    try {
      const stmt = db.prepare(`
        INSERT INTO device_tokens (token, platform, registeredAt)
        VALUES (?, ?, ?)
        ON CONFLICT(token) DO UPDATE SET
          platform = excluded.platform,
          registeredAt = excluded.registeredAt
      `);

      stmt.run(token, platform || 'unknown', new Date().toISOString());

      return { success: true };
    } catch (err) {
      server.log.error(err, 'Failed to register push token');
      return reply.code(500).send({ error: 'Internal Server Error' });
    }
  });
};
