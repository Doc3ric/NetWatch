import type { Database } from 'better-sqlite3';

export function setupSchema(db: Database) {
  // ── Devices Table ────────────────────────────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS devices (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      mac TEXT NOT NULL,
      ip TEXT NOT NULL,
      vendor TEXT,
      status TEXT NOT NULL CHECK(status IN ('online', 'offline')),
      firstSeen TEXT NOT NULL,
      lastSeen TEXT NOT NULL,
      type TEXT NOT NULL,
      lastPingMs REAL
    );
  `);

  // Index on devices.mac for fast upsert lookups
  db.exec(`CREATE INDEX IF NOT EXISTS idx_devices_mac ON devices(mac);`);

  // ── Metrics Table ────────────────────────────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS metrics (
      id TEXT PRIMARY KEY,
      timestamp TEXT NOT NULL,
      pingMs REAL,
      downloadMbps REAL,
      uploadMbps REAL,
      packetLossPct REAL
    );
  `);

  // Index on metrics.timestamp for retention queries and charting
  db.exec(`CREATE INDEX IF NOT EXISTS idx_metrics_timestamp ON metrics(timestamp);`);

  // ── Device Usage Table ───────────────────────────────────────────────────
  // Note: This table stays empty in Phase 2
  db.exec(`
    CREATE TABLE IF NOT EXISTS device_usage (
      deviceId TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      bytesUsed INTEGER NOT NULL,
      FOREIGN KEY (deviceId) REFERENCES devices(id) ON DELETE CASCADE
    );
  `);

  db.exec(`CREATE INDEX IF NOT EXISTS idx_device_usage_deviceId ON device_usage(deviceId);`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_device_usage_timestamp ON device_usage(timestamp);`);

  // ── Alerts Table ─────────────────────────────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS alerts (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL CHECK(type IN ('new_device', 'device_offline', 'high_latency', 'high_packet_loss', 'isp_downtime')),
      severity TEXT NOT NULL CHECK(severity IN ('info', 'warning', 'critical')),
      message TEXT NOT NULL,
      timestamp TEXT NOT NULL,
      resolved BOOLEAN NOT NULL DEFAULT 0,
      deviceId TEXT,
      FOREIGN KEY (deviceId) REFERENCES devices(id) ON DELETE CASCADE
    );
  `);

  db.exec(`CREATE INDEX IF NOT EXISTS idx_alerts_resolved ON alerts(resolved);`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_alerts_timestamp ON alerts(timestamp);`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_alerts_deviceId ON alerts(deviceId);`);

  // ── Device Tokens Table ──────────────────────────────────────────────────
  db.exec(`
    CREATE TABLE IF NOT EXISTS device_tokens (
      token TEXT PRIMARY KEY,
      platform TEXT,
      registeredAt TEXT NOT NULL
    );
  `);
}
