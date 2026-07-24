import speedTest from 'speedtest-net';
import { logger } from './logger.js';

export async function runSpeedTest() {
  logger.info('\n▶  Speed test started...');
  try {
    const result = await speedTest({ acceptLicense: true, acceptGdpr: true });
    
    // Result bandwidth is in bytes per second. Convert to Mbps.
    const downloadMbps = (result.download.bandwidth * 8) / 1000000;
    const uploadMbps = (result.upload.bandwidth * 8) / 1000000;
    
    logger.info(`▶  Speed test complete: DL ${downloadMbps.toFixed(2)} Mbps, UL ${uploadMbps.toFixed(2)} Mbps`);
    
    return {
      downloadMbps,
      uploadMbps
    };
  } catch (err: any) {
    logger.error('Speed test failed', err);
    throw err;
  }
}
