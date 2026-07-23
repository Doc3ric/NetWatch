// ─── NetWatch Agent — Shared Types ──────────────────────────────────────────

export type DeviceStatus = 'online' | 'offline';

export type DeviceType =
  | 'router'
  | 'phone'
  | 'laptop'
  | 'desktop'
  | 'tv'
  | 'iot'
  | 'unknown';

/** A network device discovered during a scan cycle */
export interface Device {
  id: string;           // derived: sha1(mac) truncated to 8 chars
  name: string;         // display name (editable in settings later)
  mac: string;          // normalised uppercase colon-separated, e.g. AA:BB:CC:DD:EE:FF
  ip: string;           // current IPv4 address
  vendor: string;       // OUI vendor name, e.g. "Apple Inc."
  status: DeviceStatus;
  firstSeen: string;    // ISO 8601
  lastSeen: string;     // ISO 8601
  type: DeviceType;
}

/** Raw result from ARP/nmap discovery (before vendor lookup) */
export interface DiscoveredHost {
  ip: string;
  mac: string;
}

/** Ping result for a single host */
export interface PingResult {
  ip: string;
  pingMs: number | null;  // null = host unreachable
  packetLossPct: number;  // 0–100
}

/** Full snapshot of a single scan cycle */
export interface ScanResult {
  timestamp: string;       // ISO 8601
  subnet: string;          // e.g. "192.168.1.0/24"
  devices: Array<Device & { pingMs: number | null; packetLossPct: number }>;
}

/** Agent runtime configuration */
export interface AgentConfig {
  intervalSeconds: number;
  subnet: string | null;   // null = auto-detect
  logLevel: 'debug' | 'info' | 'warn' | 'error';
}
