// ─── NetWatch Agent — Device Type Heuristics ─────────────────────────────────
// Infers a device type from the vendor name using simple pattern matching.
// This is a best-effort heuristic; devices can be renamed/typed in settings.

import type { DeviceType } from '../types.js';

interface TypeRule {
  type: DeviceType;
  patterns: RegExp[];
}

const TYPE_RULES: TypeRule[] = [
  {
    type: 'router',
    patterns: [
      /\b(router|gateway|cisco|netgear|asus|tp-?link|linksys|ubiquiti|mikrotik|draytek|zyxel|aruba|meraki|huawei.*router|tenda|d-?link|belkin.*router|buffalo)\b/i,
    ],
  },
  {
    type: 'phone',
    patterns: [
      /\b(apple|samsung|oppo|vivo|xiaomi|realme|oneplus|motorola|nokia|huawei|htc|lg electronics|sony mobile|zte)\b/i,
    ],
  },
  {
    type: 'laptop',
    patterns: [
      /\b(intel|dell|hewlett|lenovo|acer|asus|toshiba|razer|microsoft.*surface)\b/i,
    ],
  },
  {
    type: 'tv',
    patterns: [
      /\b(lg|samsung.*tv|sony.*tv|tcl|hisense|vizio|roku|amazon.*fire|nvidia.*shield|android tv)\b/i,
    ],
  },
  {
    type: 'iot',
    patterns: [
      /\b(espressif|raspberry|arduino|particle|tuya|shelly|sonoff|philips.*hue|ring|nest|amazon.*echo|google.*home|belkin|tp-?link.*tapo|meross)\b/i,
    ],
  },
];

export function inferDeviceType(vendor: string): DeviceType {
  if (!vendor || vendor === 'Unknown') return 'unknown';

  for (const rule of TYPE_RULES) {
    for (const pattern of rule.patterns) {
      if (pattern.test(vendor)) return rule.type;
    }
  }

  return 'unknown';
}
