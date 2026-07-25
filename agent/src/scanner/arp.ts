// ─── NetWatch Agent — ARP Scanner ────────────────────────────────────────────
// Primary: nmap -sn (ARP ping sweep, needs Admin + Npcap on Windows)
// Fallback: arp -a (reads OS ARP cache, no elevation required)

import os from 'os';
import { spawn, exec } from 'child_process';
import { promisify } from 'util';
import { parseStringPromise } from 'xml2js';
import { logger } from '../logger.js';
import { normaliseMac } from '../network.js';
import type { DiscoveredHost } from '../types.js';

const execAsync = promisify(exec);

// ── nmap XML interfaces ───────────────────────────────────────────────────────

interface NmapAddress {
  $: { addr: string; addrtype: 'ipv4' | 'mac'; vendor?: string };
}

interface NmapHost {
  status: [{ $: { state: 'up' | 'down'; reason: string } }];
  address: NmapAddress[];
  hostnames?: [{ hostname?: [{ $: { name: string; type: string } }] }];
}

interface NmapRun {
  nmaprun: { host?: NmapHost[] };
}

// ── nmap scan ────────────────────────────────────────────────────────────────

/**
 * Run `nmap -sn <subnet> -oX -` and return stdout as a string.
 * Resolves with empty string if nmap exits non-zero (fallback will be used).
 */
function runNmap(subnet: string): Promise<string> {
  return new Promise((resolve) => {
    logger.debug(`[arp] Running: nmap -sn ${subnet} -oX -`);

    // -sn : no port scan (host discovery only)
    // -oX -: XML output to stdout
    const nmap = spawn('nmap', ['-sn', subnet, '-oX', '-'], {
      windowsHide: true,
    });

    let xml = '';
    let stderr = '';

    nmap.stdout.on('data', (chunk: Buffer) => { xml += chunk.toString(); });
    nmap.stderr.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });

    nmap.on('error', (err) => {
      logger.warn(`[arp] nmap not found or failed to start: ${err.message}`);
      resolve('');
    });

    nmap.on('close', (code) => {
      if (code !== 0) {
        logger.warn(`[arp] nmap exited with code ${code}. stderr: ${stderr.slice(0, 200)}`);
        resolve('');
      } else {
        logger.debug(`[arp] nmap completed. stderr: ${stderr.slice(0, 100)}`);
        resolve(xml);
      }
    });
  });
}

/**
 * Parse nmap XML output into a list of discovered hosts.
 * nmap only includes MAC addresses in XML when running as Administrator
 * on the local subnet (ARP mode). Remote-host scans omit the MAC.
 */
async function parseNmapXml(xml: string): Promise<DiscoveredHost[]> {
  if (!xml.trim()) return [];

  try {
    const parsed = await parseStringPromise(xml) as NmapRun;
    const hosts = parsed.nmaprun.host ?? [];

    const results: DiscoveredHost[] = [];

    for (const host of hosts) {
      if (host.status[0].$.state !== 'up') continue;

      const ipAddr = host.address.find((a) => a.$.addrtype === 'ipv4');
      const macAddr = host.address.find((a) => a.$.addrtype === 'mac');

      if (!ipAddr) continue;

      results.push({
        ip: ipAddr.$.addr,
        // MAC may be absent if not running as Admin
        mac: macAddr ? normaliseMac(macAddr.$.addr) : '',
      });
    }

    logger.debug(`[arp] nmap found ${results.length} hosts up`);
    return results;
  } catch (err) {
    logger.warn('[arp] Failed to parse nmap XML', err);
    return [];
  }
}

// ── arp -a fallback ───────────────────────────────────────────────────────────

/**
 * Parse `arp -a` output (Windows).
 * Windows format example:
 *   Interface: 192.168.1.50 --- 0x4
 *     Internet Address      Physical Address      Type
 *     192.168.1.1           aa-bb-cc-dd-ee-ff     dynamic
 */
async function parseArpTable(): Promise<DiscoveredHost[]> {
  try {
    logger.debug('[arp] Falling back to arp -a');
    const { stdout } = await execAsync('arp -a', { timeout: 5000, windowsHide: true });
    const entries: DiscoveredHost[] = [];

    for (const line of stdout.split('\n')) {
      // Match lines like: "  192.168.1.1    aa-bb-cc-dd-ee-ff    dynamic"
      const match = line.match(
        /^\s*([\d.]+)\s+([0-9a-fA-F]{2}[-:][0-9a-fA-F]{2}[-:][0-9a-fA-F]{2}[-:][0-9a-fA-F]{2}[-:][0-9a-fA-F]{2}[-:][0-9a-fA-F]{2})\s+(dynamic|static)/
      );

      if (!match) continue;

      const ip = match[1]!;
      const mac = normaliseMac(match[2]!.replace(/-/g, ':'));

      // Skip broadcast, multicast (224.0.0.0/4 and 239.x.x.x), and link-local (169.254.x)
      if (ip.endsWith('.255')) continue;
      if (mac === 'FF:FF:FF:FF:FF:FF') continue;
      const firstOctet = parseInt(ip.split('.')[0] ?? '0', 10);
      if (firstOctet >= 224) continue;                  // multicast range
      if (ip.startsWith('169.254.')) continue;          // link-local

      entries.push({ ip, mac });
    }

    logger.debug(`[arp] arp -a found ${entries.length} entries`);
    return entries;
  } catch (err) {
    logger.warn('[arp] arp -a failed', err);
    return [];
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Discover all active hosts on the given subnet.
 *
 * Strategy:
 * 1. Run `nmap -sn <subnet>` for active discovery (sends probes to each host).
 * 2. Merge results with `arp -a` to fill in any missing MACs.
 *
 * Returns a deduplicated list keyed by IP address.
 */
export async function discoverHosts(subnet: string): Promise<DiscoveredHost[]> {
  logger.info(`[arp] Starting discovery on ${subnet}`);

  // Build a map of our own interface IPs → MACs so we can self-resolve
  const selfMacByIp = new Map<string, string>();
  for (const addrs of Object.values(os.networkInterfaces())) {
    for (const addr of addrs ?? []) {
      if (addr.family === 'IPv4' && !addr.internal && addr.mac) {
        selfMacByIp.set(addr.address, normaliseMac(addr.mac));
      }
    }
  }

  // Run nmap and arp -a concurrently
  const [nmapXml, arpEntries] = await Promise.all([
    runNmap(subnet),
    parseArpTable(),
  ]);

  const nmapHosts = await parseNmapXml(nmapXml);

  // Build a map keyed by IP for merging
  const byIp = new Map<string, DiscoveredHost>();

  // nmap results first (active discovery is more reliable for "is it up?")
  for (const host of nmapHosts) {
    // If this IP is one of our own interfaces and nmap couldn't get the MAC,
    // fill it in from os.networkInterfaces() — nmap can't ARP-resolve itself.
    const selfMac = selfMacByIp.get(host.ip);
    byIp.set(host.ip, {
      ...host,
      mac: host.mac || selfMac || '',
    });
  }

  // Merge ARP table: fills in MACs for nmap entries that lacked them,
  // and adds any hosts only visible in the ARP cache.
  for (const entry of arpEntries) {
    const existing = byIp.get(entry.ip);
    if (!existing) {
      // Host only in ARP cache — treat as up (was recently online)
      byIp.set(entry.ip, entry);
    } else if (!existing.mac && entry.mac) {
      // Fill in the missing MAC from ARP cache
      byIp.set(entry.ip, { ...existing, mac: entry.mac });
    }
  }

  const results = Array.from(byIp.values()).filter((h) => h.ip !== '');
  logger.info(`[arp] Discovery complete: ${results.length} hosts found`);
  return results;
}
