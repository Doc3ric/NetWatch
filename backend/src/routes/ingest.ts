import type { FastifyInstance } from 'fastify';
import crypto from 'crypto';

export async function ingestRoutes(fastify: FastifyInstance) {
  fastify.post('/ingest', async (request, reply) => {
    const { timestamp, subnet, devices } = request.body as any;

    if (!timestamp || !devices || !Array.isArray(devices)) {
      return reply.code(400).send({ error: 'Invalid payload' });
    }

    const db = fastify.db;
    const settings = db.prepare(`SELECT * FROM settings WHERE id = 1`).get() as any;
    const latencyWarningMs = settings?.latencyWarningMs ?? parseInt(process.env.NETWATCH_LATENCY_THRESHOLD_MS ?? '150', 10);
    const latencyCriticalMs = settings?.latencyCriticalMs ?? 300;
    const packetLossWarningPct = settings?.packetLossWarningPct ?? parseInt(process.env.NETWATCH_PACKET_LOSS_THRESHOLD_PCT ?? '5', 10);

    const transaction = db.transaction(() => {
      const generatedAlerts: any[] = [];
      const createAlert = (type: string, severity: string, message: string, deviceId: string | null = null) => {
        generatedAlerts.push({
          id: crypto.randomUUID(),
          type,
          severity,
          message,
          timestamp,
          resolved: 0,
          deviceId
        });
      };

      // 1. Fetch current online devices
      const currentOnline = db.prepare(`SELECT id, name, vendor, ip FROM devices WHERE status = 'online'`).all() as { id: string, name: string | null, vendor: string | null, ip: string | null }[];
      
      // Merge IP-fallback records into recent MAC-based records
      const sixtyFiveSecondsAgo = new Date(new Date(timestamp).getTime() - 65000).toISOString();
      for (const device of devices) {
        if (!device.mac) {
          const recentMacDevice = db.prepare(`
            SELECT id FROM devices 
            WHERE ip = ? AND mac != '' AND lastSeen >= ?
            ORDER BY lastSeen DESC LIMIT 1
          `).get(device.ip, sixtyFiveSecondsAgo) as { id: string } | undefined;

          if (recentMacDevice) {
            device.id = recentMacDevice.id;
          }
        }
      }

      const incomingIds = new Set(devices.map((d: any) => d.id));

      // Bootstrap: seed an initial 'online' row for any device that is currently online
      // but has zero history records (e.g. devices that were already online before this
      // feature was deployed). This is effectively a one-time migration — the INSERT is
      // skipped on subsequent cycles because rows will already exist.
      for (const onlineDevice of currentOnline) {
        const hasHistory = db.prepare(
          `SELECT id FROM device_status_history WHERE deviceId = ? LIMIT 1`
        ).get(onlineDevice.id);
        if (!hasHistory) {
          db.prepare(`INSERT INTO device_status_history (id, deviceId, status, timestamp) VALUES (?, ?, 'online', ?)`)
            .run(crypto.randomUUID(), onlineDevice.id, timestamp);
        }
      }

      // Check for offline devices — write history AFTER merge, so IDs are always stable MAC-based IDs
      const offlineEvents: { id: string, deviceId: string, ip: string | null, name: string | null }[] = [];
      for (const curr of currentOnline) {
        if (!incomingIds.has(curr.id)) {
          // Transitioned to offline
          const nameOrVendor = curr.name || curr.vendor || '';
          let deviceIdentifier = curr.ip || 'Unknown IP';
          if (nameOrVendor && nameOrVendor !== 'Unknown' && nameOrVendor !== curr.ip) {
            deviceIdentifier += ` (${nameOrVendor})`;
          }
          createAlert('device_offline', 'warning', `${deviceIdentifier} went offline`, curr.id);
          db.prepare(`UPDATE devices SET status = 'offline' WHERE id = ?`).run(curr.id);
          // Record transition in history
          db.prepare(`INSERT INTO device_status_history (id, deviceId, status, timestamp) VALUES (?, ?, 'offline', ?)`)
            .run(crypto.randomUUID(), curr.id, timestamp);
          offlineEvents.push({ id: curr.id, deviceId: curr.id, ip: curr.ip, name: curr.name });
        }
      }

      const upsertDevice = db.prepare(`
        INSERT INTO devices (id, name, mac, ip, vendor, status, firstSeen, lastSeen, type, lastPingMs)
        VALUES (@id, @name, @mac, @ip, @vendor, @status, @firstSeen, @lastSeen, @type, @lastPingMs)
        ON CONFLICT(id) DO UPDATE SET
          name = COALESCE(NULLIF(devices.name, ''), excluded.name),
          ip = excluded.ip,
          vendor = excluded.vendor,
          status = excluded.status,
          lastSeen = excluded.lastSeen,
          type = excluded.type,
          lastPingMs = excluded.lastPingMs
      `);

      let totalPing = 0;
      let totalLoss = 0;
      let pingCount = 0;
      let lossCount = 0;

      const onlineEvents: { deviceId: string, ip: string, name: string, vendor: string, isNew: boolean }[] = [];

      for (const device of devices) {
        // Check if new device (MAC or ID doesn't exist)
        const existing = db.prepare(`SELECT id, status FROM devices WHERE id = ?`).get(device.id) as { id: string, status: string } | undefined;
        const isNew = !existing;
        const wasOffline = existing?.status === 'offline';

        if (isNew) {
          // Use IP as primary identifier, append vendor if known and not generic
          const vendor = device.vendor && device.vendor !== 'Unknown' ? device.vendor : null;
          const label = vendor ? `${device.ip} (${vendor})` : device.ip;
          createAlert('new_device', 'info', `${label} joined the network for the first time`, device.id);
        }

        const deviceData = {
          id: device.id,
          name: device.name,
          mac: device.mac || '',
          ip: device.ip,
          vendor: device.vendor || 'Unknown',
          status: device.status,
          firstSeen: device.firstSeen || timestamp,
          lastSeen: timestamp,
          type: device.type || 'unknown',
          lastPingMs: device.pingMs ?? null,
        };

        upsertDevice.run(deviceData);

        // Write history row for: new devices, and devices coming back online from offline
        if (isNew || wasOffline) {
          db.prepare(`INSERT INTO device_status_history (id, deviceId, status, timestamp) VALUES (?, ?, 'online', ?)`)
            .run(crypto.randomUUID(), device.id, timestamp);
          onlineEvents.push({ deviceId: device.id, ip: device.ip, name: device.name, vendor: device.vendor || '', isNew });
        }

        // Per-device latency & packet loss alerts
        if (device.pingMs !== null && device.pingMs !== undefined) {
          if (device.pingMs > latencyWarningMs) {
            const severity = device.pingMs >= latencyCriticalMs ? 'critical' : 'warning';
            // Deduplicate
            const existing = db.prepare(`SELECT severity FROM alerts WHERE type = 'high_latency' AND deviceId = ? AND resolved = 0 ORDER BY timestamp DESC LIMIT 1`).get(device.id) as { severity: string } | undefined;
            
            if (!existing || (existing.severity === 'warning' && severity === 'critical')) {
              if (existing) {
                // Resolve the warning one since we escalate
                db.prepare(`UPDATE alerts SET resolved = 1 WHERE type = 'high_latency' AND deviceId = ? AND resolved = 0`).run(device.id);
              }
              createAlert('high_latency', severity, `High latency detected: ${Math.round(device.pingMs)}ms`, device.id);
            }
          }
          totalPing += device.pingMs;
          pingCount++;
        }

        if (device.packetLossPct !== null && device.packetLossPct !== undefined) {
          if (device.packetLossPct > packetLossWarningPct) {
            const severity = device.packetLossPct >= packetLossWarningPct * 2 ? 'critical' : 'warning';
            // Deduplicate
            const existing = db.prepare(`SELECT severity FROM alerts WHERE type = 'high_packet_loss' AND deviceId = ? AND resolved = 0 ORDER BY timestamp DESC LIMIT 1`).get(device.id) as { severity: string } | undefined;
            
            if (!existing || (existing.severity === 'warning' && severity === 'critical')) {
              if (existing) {
                db.prepare(`UPDATE alerts SET resolved = 1 WHERE type = 'high_packet_loss' AND deviceId = ? AND resolved = 0`).run(device.id);
              }
              createAlert('high_packet_loss', severity, `High packet loss: ${Math.round(device.packetLossPct)}%`, device.id);
            }
          }
          totalLoss += device.packetLossPct;
          lossCount++;
        }
      }

      const avgPing = pingCount > 0 ? totalPing / pingCount : null;
      const avgLoss = lossCount > 0 ? totalLoss / lossCount : null;
      
      const metricObj = {
        id: crypto.randomUUID(),
        timestamp: timestamp,
        pingMs: avgPing,
        downloadMbps: null, 
        uploadMbps: null,
        packetLossPct: avgLoss
      };

      db.prepare(`
        INSERT INTO metrics (id, timestamp, pingMs, downloadMbps, uploadMbps, packetLossPct)
        VALUES (@id, @timestamp, @pingMs, @downloadMbps, @uploadMbps, @packetLossPct)
      `).run(metricObj);

      // Insert alerts
      const insertAlert = db.prepare(`
        INSERT INTO alerts (id, type, severity, message, timestamp, resolved, deviceId)
        VALUES (@id, @type, @severity, @message, @timestamp, @resolved, @deviceId)
      `);
      for (const alert of generatedAlerts) {
        insertAlert.run(alert);
      }

      // Send Push Notifications for new alerts
      if (generatedAlerts.length > 0) {
        const tokens = db.prepare(`SELECT token FROM device_tokens`).all() as { token: string }[];
        if (tokens.length > 0) {
          const messages = generatedAlerts.map(alert => ({
            to: tokens.map(t => t.token),
            sound: 'default',
            title: `NetWatch Alert: ${alert.severity.toUpperCase()}`,
            body: alert.message,
            data: { alertId: alert.id },
          }));

          fetch('https://exp.host/--/api/v2/push/send', {
            method: 'POST',
            headers: {
              'Accept': 'application/json',
              'Accept-encoding': 'gzip, deflate',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(messages),
          }).then(async (res) => {
            const data = (await res.json()) as any;
            // Handle Expo push ticket errors (e.g., DeviceNotRegistered)
            if (data?.data) {
              data.data.forEach((ticket: any, index: number) => {
                if (ticket.status === 'error' && ticket.details?.error === 'DeviceNotRegistered') {
                  const badToken = tokens[index]?.token; // this assumes mapping, but for simplicity Expo might collapse it if we send an array of tokens in `to`.
                  // Actually, Expo push sends an array of receipts matching the `to` array if messages are flattened.
                  // For robust cleanup, we just log it for now or delete all if any are bad, but let's just log it here for MVP
                  fastify.log.warn(`Push ticket error: ${ticket.message}`);
                }
              });
            }
          }).catch(err => fastify.log.error(err, 'Failed to send push notification'));
        }
      }
      
      return { metric: metricObj, newAlerts: generatedAlerts, onlineEvents, offlineEvents };
    });

    try {
      const { metric, onlineEvents, offlineEvents } = transaction();
      // Fetch latest device list to broadcast
      const allDevices = db.prepare(`SELECT * FROM devices ORDER BY lastSeen DESC`).all();
      
      // Emit socket.io network update
      fastify.io.emit('network:update', {
        timestamp,
        devices: allDevices,
        metrics: metric
      });

      // Emit per-event activity feed events
      for (const ev of offlineEvents) {
        fastify.io.emit('activity:event', {
          id: crypto.randomUUID(),
          type: 'device_offline',
          timestamp,
          deviceId: ev.id,
          deviceIp: ev.ip,
          deviceName: ev.name,
          message: `${ev.ip || 'Unknown'}${ev.name && ev.name !== ev.ip ? ` (${ev.name})` : ''} went offline`,
        });
      }

      for (const ev of onlineEvents) {
        const vendor = ev.vendor && ev.vendor !== 'Unknown' ? ev.vendor : null;
        const label = vendor ? `${ev.ip} (${vendor})` : ev.ip;
        fastify.io.emit('activity:event', {
          id: crypto.randomUUID(),
          type: ev.isNew ? 'new_device' : 'device_online',
          timestamp,
          deviceId: ev.deviceId,
          deviceIp: ev.ip,
          deviceName: ev.name,
          message: ev.isNew
            ? `${label} joined the network for the first time`
            : `${label} came back online`,
        });
      }

      return reply.send({ success: true });
    } catch (err) {
      fastify.log.error(err);
      return reply.code(500).send({ error: 'Database transaction failed' });
    }
  });
}
