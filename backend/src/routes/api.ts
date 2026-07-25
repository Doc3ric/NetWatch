import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import bcrypt from 'bcryptjs';

export async function apiRoutes(fastify: FastifyInstance) {
  
  // POST /api/auth/login - Verify password and issue JWT token
  fastify.post('/auth/login', async (request, reply) => {
    const { password } = request.body as any;
    if (!password) {
      return reply.code(400).send({ error: 'Password is required' });
    }
    
    const settings = fastify.db.prepare('SELECT passwordHash FROM settings WHERE id = 1').get() as any;
    if (!settings || !settings.passwordHash) {
      return reply.code(500).send({ error: 'System not configured properly' });
    }
    
    const isValid = bcrypt.compareSync(password, settings.passwordHash);
    if (!isValid) {
      return reply.code(401).send({ error: 'Invalid password' });
    }
    
    const token = fastify.jwt.sign({ role: 'admin' }, { expiresIn: '7d' });
    reply.setCookie('token', token, {
      path: '/',
      httpOnly: true,
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 // 7 days
    });
    
    return reply.send({ success: true });
  });

  // GET /api/status - Backend health and network summary
  fastify.get('/status', async (request, reply) => {
    const db = fastify.db;
    const totalDevices = db.prepare(`SELECT COUNT(*) as count FROM devices`).get() as { count: number };
    const onlineDevices = db.prepare(`SELECT COUNT(*) as count FROM devices WHERE status = 'online'`).get() as { count: number };
    const settings = db.prepare(`SELECT pollingIntervalSec FROM settings WHERE id = 1`).get() as { pollingIntervalSec: number };
    
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      network: {
        totalDevices: totalDevices.count,
        onlineDevices: onlineDevices.count,
        pollingIntervalSec: settings?.pollingIntervalSec || 30
      }
    };
  });

  // GET /api/settings - Get configuration settings
  fastify.get('/settings', async (request, reply) => {
    const db = fastify.db;
    const settings = db.prepare(`SELECT * FROM settings WHERE id = 1`).get();
    return settings;
  });

  // PATCH /api/settings - Update configuration settings
  fastify.patch('/settings', async (request, reply) => {
    const db = fastify.db;
    const schema = z.object({
      pollingIntervalSec: z.number().min(5).max(300).optional(),
      latencyWarningMs: z.number().min(10).optional(),
      latencyCriticalMs: z.number().min(10).optional(),
      packetLossWarningPct: z.number().min(1).max(100).optional(),
      subnetOverride: z.string().optional()
    });
    
    const parsed = schema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Invalid body' });
    }

    const updates = parsed.data;
    const fields = Object.keys(updates);
    if (fields.length === 0) return { success: true };

    const setClause = fields.map(f => `${f} = @${f}`).join(', ');
    db.prepare(`UPDATE settings SET ${setClause} WHERE id = 1`).run(updates);
    
    return { success: true };
  });

  // GET /api/devices - List of known devices
  fastify.get('/devices', async (request, reply) => {
    const db = fastify.db;
    const devices = db.prepare(`SELECT * FROM devices ORDER BY lastSeen DESC`).all();
    return devices;
  });

  // PATCH /api/devices/:id - Rename a device
  fastify.patch('/devices/:id', async (request, reply) => {
    const db = fastify.db;
    const { id } = request.params as { id: string };
    const schema = z.object({ name: z.string().min(1) });
    
    const parsed = schema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Invalid body' });
    }

    const { name } = parsed.data;
    const info = db.prepare(`UPDATE devices SET name = ? WHERE id = ?`).run(name, id);
    if (info.changes === 0) {
      return reply.code(404).send({ error: 'Device not found' });
    }
    
    return { success: true };
  });

  // GET /api/metrics - Recent metrics history with downsampling
  fastify.get('/metrics', async (request, reply) => {
    const db = fastify.db;
    const { range } = request.query as { range?: string };
    
    // SQLite syntax for grouping by time buckets. 
    // timestamp is ISO-8601 e.g. "2026-07-23T23:36:13.002Z"
    let timeModifier = '-1 hours';
    let bucketExpr = 'timestamp'; // No bucketing for 1h

    if (range === '24h') {
      timeModifier = '-24 hours';
      // Group by 5 minutes: strftime('%Y-%m-%dT%H:', timestamp) || printf('%02d', (cast(strftime('%M', timestamp) as integer) / 5) * 5)
      bucketExpr = `strftime('%Y-%m-%dT%H:', timestamp) || printf('%02d', (CAST(strftime('%M', timestamp) AS INTEGER) / 5) * 5)`;
    } else if (range === '7d') {
      timeModifier = '-7 days';
      // Group by 1 hour
      bucketExpr = `strftime('%Y-%m-%dT%H:00:00Z', timestamp)`;
    } else if (range === '30d') {
      timeModifier = '-30 days';
      // Group by 4 hours
      bucketExpr = `strftime('%Y-%m-%dT', timestamp) || printf('%02d:00:00Z', (CAST(strftime('%H', timestamp) AS INTEGER) / 4) * 4)`;
    } else {
      // Default '1h', raw rows
      timeModifier = '-1 hours';
      bucketExpr = 'timestamp';
    }

    const query = `
      SELECT 
        ${bucketExpr} as bucketTimestamp,
        AVG(pingMs) as pingMs,
        AVG(wanPingMs) as wanPingMs,
        AVG(downloadMbps) as downloadMbps,
        AVG(uploadMbps) as uploadMbps,
        AVG(packetLossPct) as packetLossPct
      FROM metrics
      WHERE timestamp >= datetime('now', ?)
      GROUP BY bucketTimestamp
      ORDER BY bucketTimestamp ASC
    `;

    const rows = db.prepare(query).all(timeModifier);
    
    // Map to expected format
    return rows.map((r: any) => ({
      timestamp: r.bucketTimestamp,
      pingMs: r.pingMs,
      wanPingMs: r.wanPingMs,
      downloadMbps: r.downloadMbps,
      uploadMbps: r.uploadMbps,
      packetLossPct: r.packetLossPct
    }));
  });

  // GET /api/alerts - Alerts list with optional resolved filter
  fastify.get('/alerts', async (request, reply) => {
    const db = fastify.db;
    const { resolved } = request.query as { resolved?: string };
    
    let query = `SELECT * FROM alerts`;
    const params: any[] = [];
    
    if (resolved === 'false') {
      query += ` WHERE resolved = 0`;
    } else if (resolved === 'true') {
      query += ` WHERE resolved = 1`;
    }
    
    query += ` ORDER BY timestamp DESC`;
    
    const alerts = db.prepare(query).all(...params);
    return alerts;
  });

  // PATCH /api/alerts/:id - Mark alert as resolved
  fastify.patch('/alerts/:id', async (request, reply) => {
    const db = fastify.db;
    const { id } = request.params as { id: string };
    const schema = z.object({ resolved: z.boolean() });
    
    const parsed = schema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Invalid body' });
    }

    const { resolved } = parsed.data;
    const resolvedValue = resolved ? 1 : 0;
    
    const info = db.prepare(`UPDATE alerts SET resolved = ? WHERE id = ?`).run(resolvedValue, id);
    if (info.changes === 0) {
      return reply.code(404).send({ error: 'Alert not found' });
    }
    
    return { success: true };
  });

  // POST /api/speedtest/trigger - Signal agent to run speed test
  fastify.post('/speedtest/trigger', async (request, reply) => {
    fastify.io.emit('speedtest:trigger');
    return { success: true };
  });

  // POST /api/speedtest/error - Handle speed test failure
  fastify.post('/speedtest/error', async (request, reply) => {
    const { message } = request.body as { message: string };
    
    // Broadcast the error to connected web clients
    fastify.io.emit('network:error', {
      type: 'speedtest_error',
      message: message || 'Unknown error occurred during speed test'
    });

    return { success: true };
  });

  // POST /api/speedtest/result - Save agent speed test result
  fastify.post('/speedtest/result', async (request, reply) => {
    const db = fastify.db;
    const { pingMs, downloadMbps, uploadMbps } = request.body as any;

    if (downloadMbps === undefined || uploadMbps === undefined) {
      return reply.code(400).send({ error: 'Missing bandwidth data' });
    }

    // Update the most recent metric row, or insert a new one if none exists
    const latest = db.prepare(`SELECT id FROM metrics ORDER BY timestamp DESC LIMIT 1`).get() as { id: string } | undefined;
    
    if (latest) {
      db.prepare(`UPDATE metrics SET wanPingMs = ?, downloadMbps = ?, uploadMbps = ? WHERE id = ?`).run(pingMs || null, downloadMbps, uploadMbps, latest.id);
    } else {
      const crypto = require('crypto');
      db.prepare(`
        INSERT INTO metrics (id, timestamp, wanPingMs, downloadMbps, uploadMbps)
        VALUES (?, ?, ?, ?, ?)
      `).run(crypto.randomUUID(), new Date().toISOString(), pingMs || null, downloadMbps, uploadMbps);
    }

    // Broadcast update so frontend bandwidth chart refreshes
    fastify.io.emit('network:update', {
      type: 'speedtest_result',
      timestamp: new Date().toISOString(),
      metrics: { wanPingMs: pingMs || 0, downloadMbps, uploadMbps }
    });

    return { success: true };
  });
}
