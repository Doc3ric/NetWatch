import type { Database } from 'better-sqlite3';
import type { FastifyInstance } from 'fastify';

export function startRetentionJob(fastify: FastifyInstance) {
  const db: Database = fastify.db;
  const metricsRetentionDays = parseInt(process.env.NETWATCH_RETENTION_DAYS ?? '30', 10);
  const alertsRetentionDays = 30; // Based on user feedback
  
  // Run once per day (86400000 ms)
  const INTERVAL_MS = 24 * 60 * 60 * 1000;

  const runPrune = () => {
    try {
      fastify.log.info(`[retention] Running daily data prune job...`);
      
      const metricsInfo = db.prepare(`
        DELETE FROM metrics 
        WHERE timestamp < datetime('now', ?)
      `).run(`-${metricsRetentionDays} days`);

      const alertsInfo = db.prepare(`
        DELETE FROM alerts 
        WHERE resolved = 1 AND timestamp < datetime('now', ?)
      `).run(`-${alertsRetentionDays} days`);

      fastify.log.info(`[retention] Pruned ${metricsInfo.changes} old metrics rows and ${alertsInfo.changes} old resolved alerts.`);
    } catch (err) {
      fastify.log.error(`[retention] Failed to run prune job: ${err}`);
    }
  };

  // Run on startup, then periodically
  runPrune();
  setInterval(runPrune, INTERVAL_MS);
}
