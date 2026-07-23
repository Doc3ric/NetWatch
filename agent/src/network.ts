// ─── NetWatch Agent — Network Utilities ─────────────────────────────────────
import os from 'os';
import { logger } from './logger.js';

/** Convert an IPv4 address + prefix length to CIDR notation, e.g. "192.168.1.0/24" */
function toCidr(ip: string, netmask: string): string {
  const maskParts = netmask.split('.').map(Number);
  const bits = maskParts.reduce((acc, part) => {
    let n = part;
    let count = 0;
    while (n > 0) {
      count += n & 1;
      n >>= 1;
    }
    return acc + count;
  }, 0);

  // Zero out the host bits to get the network address
  const ipParts = ip.split('.').map(Number);
  const networkParts = ipParts.map((part, i) => part & maskParts[i]!);
  return `${networkParts.join('.')}/` + bits;
}

/**
 * Auto-detect the primary LAN subnet from the host's active network interfaces.
 * Returns the first private-range (RFC-1918) IPv4 interface found, excluding loopback.
 * Falls back to "192.168.1.0/24" if nothing useful is found.
 */
export function detectSubnet(): string {
  const ifaces = os.networkInterfaces();

  for (const [name, addrs] of Object.entries(ifaces)) {
    if (!addrs) continue;
    // Skip loopback
    if (name.toLowerCase().includes('loopback') || name === 'lo') continue;

    for (const addr of addrs) {
      if (addr.family !== 'IPv4' || addr.internal) continue;
      const ip = addr.address;

      // Only consider RFC-1918 private ranges
      if (
        ip.startsWith('10.') ||
        ip.startsWith('192.168.') ||
        /^172\.(1[6-9]|2\d|3[01])\./.test(ip)
      ) {
        const cidr = toCidr(ip, addr.netmask);
        logger.debug(`Auto-detected subnet from interface "${name}": ${cidr}`);
        return cidr;
      }
    }
  }

  logger.warn('Could not auto-detect subnet — falling back to 192.168.1.0/24');
  return '192.168.1.0/24';
}

/** Normalise a MAC address to uppercase colon-separated format: AA:BB:CC:DD:EE:FF */
export function normaliseMac(raw: string): string {
  // Remove all non-hex characters and split into pairs
  const hex = raw.replace(/[^0-9a-fA-F]/g, '');
  if (hex.length !== 12) return raw.toUpperCase(); // passthrough if unexpected
  return hex.match(/.{2}/g)!.join(':').toUpperCase();
}

/** Derive a short stable ID from a MAC address (first 8 chars of hex without colons) */
export function macToId(mac: string): string {
  return mac.replace(/:/g, '').slice(0, 8).toLowerCase();
}
