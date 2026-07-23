// ─── NetWatch Agent — Ping Scanner ───────────────────────────────────────────
// Uses the OS `ping` command (Windows-aware) via child_process.
// Pings hosts concurrently with a configurable batch size.

import { spawn } from 'child_process';
import { logger } from '../logger.js';
import type { PingResult } from '../types.js';

// ── OS ping wrapper ───────────────────────────────────────────────────────────

/**
 * Ping a single host.
 * Windows:  ping -n <count> -w <timeoutMs> <ip>
 *
 * Returns null pingMs when host is unreachable (100% packet loss).
 */
function pingHost(ip: string, count = 4, timeoutMs = 1000): Promise<PingResult> {
  return new Promise((resolve) => {
    // Windows ping flags: -n count, -w timeout-per-packet-ms
    const args = ['-n', String(count), '-w', String(timeoutMs), ip];
    logger.debug(`[ping] ping ${args.join(' ')}`);

    const proc = spawn('ping', args, { windowsHide: true });
    let output = '';

    proc.stdout.on('data', (chunk: Buffer) => { output += chunk.toString(); });
    proc.stderr.on('data', (chunk: Buffer) => { output += chunk.toString(); });

    proc.on('error', (err) => {
      logger.warn(`[ping] Could not spawn ping for ${ip}: ${err.message}`);
      resolve({ ip, pingMs: null, packetLossPct: 100 });
    });

    proc.on('close', () => {
      resolve(parsePingOutput(ip, output));
    });
  });
}

/**
 * Parse Windows `ping` stdout.
 *
 * Success example:
 *   Packets: Sent = 4, Received = 4, Lost = 0 (0% loss),
 *   Minimum = 1ms, Maximum = 3ms, Average = 2ms
 *
 * Failure example:
 *   Packets: Sent = 4, Received = 0, Lost = 4 (100% loss),
 *   (no RTT line)
 */
function parsePingOutput(ip: string, output: string): PingResult {
  // Match packet statistics line
  const pktMatch = output.match(
    /Packets:\s*Sent\s*=\s*(\d+),\s*Received\s*=\s*(\d+),\s*Lost\s*=\s*(\d+)\s*\((\d+)%\s*loss\)/i
  );

  if (!pktMatch) {
    logger.debug(`[ping] Could not parse packet stats for ${ip}. Output: ${output.slice(0, 150)}`);
    return { ip, pingMs: null, packetLossPct: 100 };
  }

  const packetLossPct = parseInt(pktMatch[4]!, 10);

  // Match RTT line (only present when at least one reply was received)
  const rttMatch = output.match(
    /Minimum\s*=\s*(\d+)ms,\s*Maximum\s*=\s*(\d+)ms,\s*Average\s*=\s*(\d+)ms/i
  );

  const pingMs = rttMatch ? parseInt(rttMatch[3]!, 10) : null;

  return { ip, pingMs, packetLossPct };
}

// ── Batch pinger ─────────────────────────────────────────────────────────────

/**
 * Ping multiple hosts concurrently, in batches to avoid overwhelming the OS.
 * @param ips          List of IP addresses to ping
 * @param batchSize    Max concurrent pings (default 20)
 * @param packetCount  Packets per host (default 4)
 */
export async function pingHosts(
  ips: string[],
  batchSize = 20,
  packetCount = 4
): Promise<PingResult[]> {
  const results: PingResult[] = [];

  for (let i = 0; i < ips.length; i += batchSize) {
    const batch = ips.slice(i, i + batchSize);
    logger.debug(`[ping] Pinging batch ${Math.floor(i / batchSize) + 1}: ${batch.join(', ')}`);

    const batchResults = await Promise.all(
      batch.map((ip) => pingHost(ip, packetCount))
    );

    results.push(...batchResults);
  }

  const reachable = results.filter((r) => r.pingMs !== null).length;
  logger.debug(`[ping] ${reachable}/${ips.length} hosts responded`);

  return results;
}
