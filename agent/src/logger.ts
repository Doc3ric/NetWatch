// ─── NetWatch Agent — Logger ─────────────────────────────────────────────────
type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const COLORS: Record<LogLevel, string> = {
  debug: '\x1b[36m', // cyan
  info:  '\x1b[32m', // green
  warn:  '\x1b[33m', // yellow
  error: '\x1b[31m', // red
};

const RESET = '\x1b[0m';
const DIM   = '\x1b[2m';

let currentLevel: LogLevel = 'info';

export function setLogLevel(level: LogLevel) {
  currentLevel = level;
}

function log(level: LogLevel, message: string, data?: unknown) {
  if (LEVELS[level] < LEVELS[currentLevel]) return;

  const ts = new Date().toISOString();
  const color = COLORS[level];
  const tag = `${color}[${level.toUpperCase().padEnd(5)}]${RESET}`;
  const timestamp = `${DIM}${ts}${RESET}`;

  if (data !== undefined) {
    console.log(`${timestamp} ${tag} ${message}`, data);
  } else {
    console.log(`${timestamp} ${tag} ${message}`);
  }
}

export const logger = {
  debug: (msg: string, data?: unknown) => log('debug', msg, data),
  info:  (msg: string, data?: unknown) => log('info',  msg, data),
  warn:  (msg: string, data?: unknown) => log('warn',  msg, data),
  error: (msg: string, data?: unknown) => log('error', msg, data),
};
