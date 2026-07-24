// ─── NetWatch Agent — Entry Point ────────────────────────────────────────────
// Orchestrates the scan loop: discover → ping → vendor lookup → log snapshot.
// In Phase 2, the snapshot will be POSTed to the backend instead of console-logged.

import { loadConfig } from './config.js';
import { logger, setLogLevel } from './logger.js';
import { detectSubnet, macToId } from './network.js';
import { discoverHosts } from './scanner/arp.js';
import { pingHosts } from './scanner/ping.js';
import { lookupVendors } from './scanner/oui.js';
import { inferDeviceType } from './scanner/deviceType.js';
import { runSpeedTest } from './speedtest.js';
import { io } from 'socket.io-client';
import type { Device, ScanResult } from './types.js';

// ── Bootstrap ─────────────────────────────────────────────────────────────────

const config = loadConfig();
setLogLevel(config.logLevel);

logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
logger.info('  NetWatch Agent  v0.1.0 — Phase 1');
logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
logger.info(`  Polling interval : ${config.intervalSeconds}s`);
logger.info(`  Subnet (config)  : ${config.subnet ?? '(auto-detect)'}`);
logger.info(`  Backend URL      : ${config.backendUrl}`);
logger.info(`  Log level        : ${config.logLevel}`);
logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

// ── Scan cycle ────────────────────────────────────────────────────────────────

/**
 * One complete scan cycle: discover → ping → vendor → assemble snapshot.
 */
async function runScan(subnet: string): Promise<ScanResult> {
  const timestamp = new Date().toISOString();
  logger.info(`\n▶  Scan cycle started  [${timestamp}]`);

  // 1. Discover active hosts
  const discovered = await discoverHosts(subnet);

  if (discovered.length === 0) {
    logger.warn('No hosts discovered. Check nmap installation or subnet setting.');
    return { timestamp, subnet, devices: [] };
  }

  // 2. Ping all discovered hosts
  const ips = discovered.map((h) => h.ip);
  const pingResults = await pingHosts(ips);
  const pingByIp = new Map(pingResults.map((r) => [r.ip, r]));

  // 3. Batch vendor lookup for all MACs
  const macs = discovered.map((h) => h.mac);
  const vendorByMac = await lookupVendors(macs);

  // 4. Assemble Device + metrics
  const devices = discovered.map((host) => {
    const ping = pingByIp.get(host.ip);
    const vendor = vendorByMac.get(host.mac) ?? 'Unknown';
    const now = new Date().toISOString();

    const device: Device & { pingMs: number | null; packetLossPct: number } = {
      id: host.mac ? macToId(host.mac) : host.ip.replace(/\./g, ''),
      name: host.ip, // default name = IP; can be overridden in settings later
      mac: host.mac,
      ip: host.ip,
      vendor,
      status: ping && ping.pingMs !== null ? 'online' : 'offline',
      firstSeen: now,
      lastSeen: now,
      type: inferDeviceType(vendor),
      pingMs: ping?.pingMs ?? null,
      packetLossPct: ping?.packetLossPct ?? 100,
    };

    return device;
  });

  const online = devices.filter((d) => d.status === 'online').length;
  logger.info(`▶  Scan complete: ${online}/${devices.length} devices online`);

  return { timestamp, subnet, devices };
}

// ── Pretty print ──────────────────────────────────────────────────────────────

function printSnapshot(result: ScanResult): void {
  const onlineDevices = result.devices.filter((d) => d.status === 'online');
  const offlineDevices = result.devices.filter((d) => d.status === 'offline');

  console.log('\n' + '─'.repeat(80));
  console.log(`  📡 NETWATCH SNAPSHOT  —  ${result.timestamp}`);
  console.log(`  Subnet: ${result.subnet}  │  Total: ${result.devices.length}  │  Online: ${onlineDevices.length}  │  Offline: ${offlineDevices.length}`);
  console.log('─'.repeat(80));

  if (result.devices.length === 0) {
    console.log('  (no devices found)');
    console.log('─'.repeat(80) + '\n');
    return;
  }

  const header = [
    'IP'.padEnd(16),
    'MAC'.padEnd(18),
    'VENDOR'.padEnd(28),
    'TYPE'.padEnd(10),
    'STATUS'.padEnd(9),
    'PING'.padEnd(8),
    'LOSS%',
  ].join('  ');

  console.log('  ' + header);
  console.log('  ' + '·'.repeat(header.length));

  for (const d of result.devices) {
    const statusIcon = d.status === 'online' ? '✅' : '❌';
    const ping = d.pingMs !== null ? `${d.pingMs}ms` : '—';
    const loss = `${d.packetLossPct}%`;

    const row = [
      d.ip.padEnd(16),
      (d.mac || '—').padEnd(18),
      d.vendor.slice(0, 26).padEnd(28),
      d.type.padEnd(10),
      (statusIcon + ' ' + d.status).padEnd(9),
      ping.padEnd(8),
      loss,
    ].join('  ');

    console.log('  ' + row);
  }

  console.log('─'.repeat(80));

  // Also emit the full snapshot as JSON on a single line for piping/parsing
  console.log('\n[JSON SNAPSHOT]');
  console.log(JSON.stringify(result, null, 2));
  console.log();
}

// ── Main loop ─────────────────────────────────────────────────────────────────

async function postSnapshot(result: ScanResult): Promise<void> {
  try {
    const res = await fetch(`${config.backendUrl}/ingest`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(result),
    });

    if (!res.ok) {
      const text = await res.text();
      logger.warn(`[backend] Failed to post snapshot: ${res.status} ${res.statusText} - ${text}`);
    } else {
      logger.debug(`[backend] Snapshot posted successfully`);
    }
  } catch (err: any) {
    logger.warn(`[backend] Error posting snapshot to ${config.backendUrl}: ${err.message}`);
  }
}

async function postSpeedTestResult(result: { downloadMbps: number, uploadMbps: number }): Promise<void> {
  try {
    const res = await fetch(`${config.backendUrl}/api/speedtest/result`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(result),
    });

    if (!res.ok) {
      const text = await res.text();
      logger.warn(`[backend] Failed to post speedtest result: ${res.status} - ${text}`);
    } else {
      logger.debug(`[backend] Speedtest result posted successfully`);
    }
  } catch (err: any) {
    logger.warn(`[backend] Error posting speedtest result: ${err.message}`);
  }
}

async function executeSpeedTestCycle() {
  try {
    const result = await runSpeedTest();
    await postSpeedTestResult(result);
  } catch (err) {
    logger.error('Scheduled speed test failed', err);
  }
}

async function main(): Promise<void> {
  // Resolve subnet: use config or auto-detect
  const subnet = config.subnet ?? detectSubnet();
  logger.info(`Using subnet: ${subnet}`);

  // Initial scan immediately
  try {
    const result = await runScan(subnet);
    printSnapshot(result);
    await postSnapshot(result);
  } catch (err) {
    logger.error('Scan failed', err);
  }

  // Then repeat on interval
  setInterval(async () => {
    try {
      const result = await runScan(subnet);
      printSnapshot(result);
      await postSnapshot(result);
    } catch (err) {
      logger.error('Scan cycle failed', err);
    }
  }, config.intervalSeconds * 1000);

  // Speed test schedule
  setInterval(executeSpeedTestCycle, config.speedtestIntervalMin * 60 * 1000);

  // Socket.io for on-demand triggers
  const socket = io(config.backendUrl.replace('/api', ''));
  socket.on('connect', () => {
    logger.info(`[socket] Connected to backend for triggers`);
  });
  socket.on('speedtest:trigger', () => {
    logger.info(`[socket] Received on-demand speed test trigger!`);
    executeSpeedTestCycle();
  });
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  logger.info('\nShutting down NetWatch agent…');
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info('\nShutting down NetWatch agent…');
  process.exit(0);
});

main().catch((err) => {
  logger.error('Fatal error in main()', err);
  process.exit(1);
});
