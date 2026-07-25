import speedTest from 'speedtest-net';
import { logger } from './logger.js';
import childProcess from 'child_process';

// Patch spawn to completely hide the terminal window on Windows PM2
const originalSpawn = childProcess.spawn;
(childProcess as any).spawn = function(command: string, args: any[], options: any) {
  if (options) {
    options.windowsHide = true;
    // THIS is the flag that actually stops the terminal window from flashing/popping up on Windows
    options.detached = true; 
  }
  return originalSpawn.apply(this, arguments as any);
};

export async function runSpeedTest() {
  logger.info('\n▶  Speed test started...');
  try {
    const result = await speedTest({ acceptLicense: true, acceptGdpr: true });
    
    // Result bandwidth is in bytes per second. Convert to Mbps.
    const downloadMbps = (result.download.bandwidth * 8) / 1000000;
    const uploadMbps = (result.upload.bandwidth * 8) / 1000000;
    const pingMs = result.ping?.latency || 0;
    
    logger.info(`▶  Speed test complete: Ping ${pingMs} ms, DL ${downloadMbps.toFixed(2)} Mbps, UL ${uploadMbps.toFixed(2)} Mbps`);
    
    return {
      pingMs,
      downloadMbps,
      uploadMbps
    };
  } catch (err: any) {
    logger.error('Speed test failed', err);
    throw err;
  }
}
