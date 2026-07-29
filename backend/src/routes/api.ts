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
    
    // Fetch old name before updating (for activity event)
    const before = db.prepare(`SELECT name FROM devices WHERE id = ?`).get(id) as { name: string } | undefined;
    const info = db.prepare(`UPDATE devices SET name = ? WHERE id = ?`).run(name, id);
    if (info.changes === 0) {
      return reply.code(404).send({ error: 'Device not found' });
    }
    
    // Emit activity event for the live feed
    const crypto = require('crypto');
    fastify.io.emit('activity:event', {
      id: crypto.randomUUID(),
      type: 'device_renamed',
      timestamp: new Date().toISOString(),
      deviceId: id,
      message: `Device renamed: ${before?.name || id} → ${name}`,
      meta: { oldName: before?.name || '', newName: name },
    });
    
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

  // GET /api/alerts/summary - Returns alert counts
  fastify.get('/alerts/summary', async (request, reply) => {
    const db = fastify.db;
    const unresolved = db.prepare(`SELECT COUNT(*) as count FROM alerts WHERE resolved = 0`).get() as { count: number };
    const total = db.prepare(`SELECT COUNT(*) as count FROM alerts`).get() as { count: number };
    return { unresolved: unresolved.count, total: total.count };
  });

  // GET /api/alerts - Alerts list with optional filters
  fastify.get('/alerts', async (request, reply) => {
    const db = fastify.db;
    const { resolved, days, type } = request.query as { resolved?: string, days?: string, type?: string };
    
    let query = `SELECT * FROM alerts WHERE 1=1`;
    const params: any[] = [];
    
    if (resolved === 'false') {
      query += ` AND resolved = 0`;
    } else if (resolved === 'true') {
      query += ` AND resolved = 1`;
    }

    if (days && !isNaN(parseInt(days))) {
      const ms = parseInt(days) * 24 * 60 * 60 * 1000;
      const cutoff = new Date(Date.now() - ms).toISOString();
      query += ` AND timestamp >= ?`;
      params.push(cutoff);
    }

    if (type === 'device') {
      query += ` AND type IN ('new_device', 'device_offline')`;
    } else if (type === 'performance') {
      query += ` AND type IN ('high_latency', 'high_packet_loss')`;
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
    const nowIso = new Date().toISOString();
    fastify.io.emit('network:update', {
      type: 'speedtest_result',
      timestamp: nowIso,
      metrics: { wanPingMs: pingMs || 0, downloadMbps, uploadMbps }
    });

    // Emit activity event for the live feed
    const cryptoMod = require('crypto');
    fastify.io.emit('activity:event', {
      id: cryptoMod.randomUUID(),
      type: 'speedtest_result',
      timestamp: nowIso,
      message: `Speed test: ↓ ${downloadMbps.toFixed(1)} Mbps  ↑ ${uploadMbps.toFixed(1)} Mbps  ping ${Math.round(pingMs || 0)} ms`,
      meta: { downloadMbps, uploadMbps, pingMs: pingMs || 0 },
    });

    return { success: true };
  });

  // GET /api/devices/:id/uptime - 30-day uptime % for a single device
  fastify.get('/devices/:id/uptime', async (request, reply) => {
    const db = fastify.db;
    const { id } = request.params as { id: string };
    const { days = '30' } = request.query as { days?: string };
    const windowDays = Math.min(Math.max(parseInt(days, 10) || 30, 1), 90);

    const device = db.prepare(`SELECT id, status FROM devices WHERE id = ?`).get(id) as { id: string, status: string } | undefined;
    if (!device) return reply.code(404).send({ error: 'Device not found' });

    const windowStart = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);
    const windowMs = windowDays * 24 * 60 * 60 * 1000;
    const now = new Date();

    const rows = db.prepare(
      `SELECT status, timestamp FROM device_status_history WHERE deviceId = ? AND timestamp >= ? ORDER BY timestamp ASC`
    ).all(id, windowStart.toISOString()) as { status: string, timestamp: string }[];

    // Reconstruct online intervals from transition events
    let onlineMs = 0;
    let lastOnline: Date | null = null;

    for (const row of rows) {
      const t = new Date(row.timestamp);
      if (row.status === 'online') {
        lastOnline = t;
      } else if (row.status === 'offline' && lastOnline) {
        onlineMs += t.getTime() - lastOnline.getTime();
        lastOnline = null;
      }
    }
    // If currently online and no closing offline event found
    if (lastOnline && device.status === 'online') {
      onlineMs += now.getTime() - lastOnline.getTime();
    }

    const uptimePct = rows.length === 0 ? null : Math.min(100, (onlineMs / windowMs) * 100);
    return { uptimePct, onlineMs, windowMs, windowDays, hasHistory: rows.length > 0 };
  });

  // GET /api/heatmap - Per-device hourly presence data for heat map
  fastify.get('/heatmap', async (request, reply) => {
    const db = fastify.db;
    const { days = '30' } = request.query as { days?: string };
    const windowDays = Math.min(Math.max(parseInt(days, 10) || 30, 1), 90);
    const windowStart = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);
    const now = new Date();

    const devices = db.prepare(`SELECT id, name, vendor, ip, status FROM devices`).all() as any[];
    const allRows = db.prepare(
      `SELECT deviceId, status, timestamp FROM device_status_history WHERE timestamp >= ? ORDER BY deviceId, timestamp ASC`
    ).all(windowStart.toISOString()) as { deviceId: string, status: string, timestamp: string }[];

    // Group rows by deviceId
    const byDevice: Record<string, { status: string, timestamp: string }[]> = {};
    for (const row of allRows) {
      if (!byDevice[row.deviceId]) byDevice[row.deviceId] = [];
      byDevice[row.deviceId].push(row);
    }

    const aggregate = new Array(24).fill(0); // total online-minutes per hour across all devices
    const aggregate_days = new Array(24).fill(0); // how many device-days contributed per hour

    const deviceHeatmaps = devices.map((dev: any) => {
      const hours = new Array(24).fill(0); // fraction 0.0–1.0 per hour (avg across windowDays)
      const rows = byDevice[dev.id] || [];
      const minutesOnline = new Array(24).fill(0); // accumulated online-minutes per hour bucket
      const minutesTotal = windowDays * 60; // total minutes per hour bucket across the window

      let lastOnline: Date | null = null;
      for (const row of rows) {
        const t = new Date(row.timestamp);
        if (row.status === 'online') {
          lastOnline = t;
        } else if (row.status === 'offline' && lastOnline) {
          // Walk through every minute of this interval and bucket by hour
          accumulateInterval(lastOnline, t, minutesOnline);
          lastOnline = null;
        }
      }
      if (lastOnline && dev.status === 'online') {
        accumulateInterval(lastOnline, now, minutesOnline);
      }

      for (let h = 0; h < 24; h++) {
        hours[h] = minutesTotal > 0 ? Math.min(1, minutesOnline[h] / minutesTotal) : 0;
        aggregate[h] += minutesOnline[h];
        if (minutesOnline[h] > 0) aggregate_days[h] += 1;
      }

      return {
        id: dev.id,
        name: dev.name || dev.vendor || dev.ip,
        ip: dev.ip,
        hours,
        hasHistory: rows.length > 0,
      };
    });

    // Normalize aggregate to average devices online per hour
    const windowMinutesPerHour = windowDays * 60;
    const aggregateNorm = aggregate.map((m: number, h: number) => ({
      hour: h,
      avgMinutesOnline: m / Math.max(1, devices.length),
      presenceFraction: windowMinutesPerHour > 0 ? Math.min(1, m / (devices.length * windowMinutesPerHour)) : 0,
    }));

    return { devices: deviceHeatmaps, aggregate: aggregateNorm, windowDays };
  });

  // GET /api/activity - Historical activity feed (from device_status_history)
  fastify.get('/activity', async (request, reply) => {
    const db = fastify.db;
    const { days = '7' } = request.query as { days?: string };
    const windowDays = Math.min(Math.max(parseInt(days, 10) || 7, 1), 30);
    const windowStart = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);

    // Join device_status_history with devices to get name/ip for display
    const rows = db.prepare(`
      SELECT dsh.id, dsh.deviceId, dsh.status, dsh.timestamp,
             d.name, d.ip, d.vendor
      FROM device_status_history dsh
      LEFT JOIN devices d ON d.id = dsh.deviceId
      WHERE dsh.timestamp >= ?
      ORDER BY dsh.timestamp DESC
      LIMIT 500
    `).all(windowStart.toISOString()) as any[];

    const events = rows.map((row: any) => {
      const vendor = row.vendor && row.vendor !== 'Unknown' ? row.vendor : null;
      const label = row.name && row.name !== row.ip ? row.name : (vendor ? `${row.ip} (${vendor})` : row.ip);
      const type = row.status === 'online' ? 'device_online' : 'device_offline';
      return {
        id: row.id,
        type,
        timestamp: row.timestamp,
        deviceId: row.deviceId,
        deviceIp: row.ip,
        deviceName: row.name,
        message: type === 'device_online'
          ? `${label} came back online`
          : `${label} went offline`,
      };
    });

    return events;
  });
}

// Helper: accumulate online minutes into hour buckets
function accumulateInterval(start: Date, end: Date, minutesOnline: number[]) {
  let cur = new Date(start);
  const endMs = end.getTime();
  while (cur.getTime() < endMs) {
    const h = cur.getUTCHours();
    const nextHour = new Date(cur);
    nextHour.setUTCHours(h + 1, 0, 0, 0);
    const segEnd = nextHour.getTime() < endMs ? nextHour : end;
    minutesOnline[h] += (segEnd.getTime() - cur.getTime()) / 60000;
    cur = segEnd;
  }
}
