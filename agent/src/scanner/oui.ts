// ─── NetWatch Agent — OUI Vendor Lookup ──────────────────────────────────────
// Uses the 'mac-oui-lookup' npm package for offline, zero-API vendor resolution.
// The package bundles the IEEE OUI database (~50k entries) with the install.
//
// We wrap it in a thin module so the rest of the agent never imports
// mac-oui-lookup directly, making it easy to swap out later.

import { logger } from '../logger.js';

// mac-oui-lookup is a CJS module; we import its named export.
// The package exposes: getVendor(mac: string): string | undefined
let getVendorFn: ((mac: string) => string | undefined) | null = null;

async function ensureLoaded(): Promise<void> {
  if (getVendorFn) return;

  try {
    // Dynamic import works with both ESM and CJS interop
    const mod = await import('mac-oui-lookup');
    // The package exports either a default or named 'getVendor'
    getVendorFn =
      (mod as unknown as { getVendor?: (mac: string) => string }).getVendor ??
      (mod as unknown as { default?: { getVendor: (mac: string) => string } }).default
        ?.getVendor ??
      null;

    if (!getVendorFn) {
      throw new Error('mac-oui-lookup: could not find getVendor export');
    }

    logger.debug('[oui] mac-oui-lookup loaded successfully');
  } catch (err) {
    logger.warn('[oui] mac-oui-lookup not available — vendor lookup disabled', err);
  }
}

/**
 * Look up the IEEE OUI vendor name for a given MAC address.
 * Accepts any common MAC format: AA:BB:CC:DD:EE:FF, AA-BB-CC-DD-EE-FF, etc.
 *
 * Returns "Unknown" if the MAC is not in the database or the package is unavailable.
 */
export async function lookupVendor(mac: string): Promise<string> {
  await ensureLoaded();

  if (!getVendorFn || !mac || mac === '') return 'Unknown';

  try {
    const vendor = getVendorFn(mac);
    return vendor ?? 'Unknown';
  } catch {
    return 'Unknown';
  }
}

/**
 * Batch vendor lookup — resolves all MACs in one call, skipping empties.
 * Returns a Map<mac, vendorName>.
 */
export async function lookupVendors(
  macs: string[]
): Promise<Map<string, string>> {
  await ensureLoaded();

  const result = new Map<string, string>();
  for (const mac of macs) {
    if (!mac) {
      result.set(mac, 'Unknown');
      continue;
    }
    result.set(mac, await lookupVendor(mac));
  }
  return result;
}
