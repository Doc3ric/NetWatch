// ─── NetWatch Agent — Configuration Loader ──────────────────────────────────
import 'dotenv/config';
import type { AgentConfig } from './types.js';



function parseLogLevel(val: string | undefined): AgentConfig['logLevel'] {
  const levels = ['debug', 'info', 'warn', 'error'] as const;
  return levels.includes(val as AgentConfig['logLevel'])
    ? (val as AgentConfig['logLevel'])
    : 'info';
}

export function loadConfig(): AgentConfig {
  const intervalSeconds = parseInt(process.env.NETWATCH_INTERVAL ?? '30', 10);
  const subnetRaw = (process.env.NETWATCH_SUBNET ?? '').trim();
  const backendUrl = process.env.BACKEND_URL ?? 'http://localhost:3000';
  const speedtestIntervalMin = parseInt(process.env.NETWATCH_SPEEDTEST_INTERVAL_MIN ?? '30', 10);

  return {
    intervalSeconds: isNaN(intervalSeconds) || intervalSeconds < 5 ? 30 : intervalSeconds,
    subnet: subnetRaw.length > 0 ? subnetRaw : null,
    logLevel: parseLogLevel(process.env.LOG_LEVEL),
    backendUrl,
    speedtestIntervalMin: isNaN(speedtestIntervalMin) || speedtestIntervalMin < 1 ? 30 : speedtestIntervalMin,
  };
}
