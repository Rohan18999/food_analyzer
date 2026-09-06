import { createWorker } from 'tesseract.js';
import { logger } from '../../utils/logger.js';

let workerPromise = null;
let workerReady = false;

export async function getTesseractWorker() {
  if (workerPromise) return workerPromise;

  workerPromise = (async () => {
    const worker = await createWorker('eng', 1, {
      // Use /tmp on Render (writable) and local ./tmp
      cachePath: '/tmp/tesseract-cache',
      logger: (m) => {
        if (m.status === 'recognizing text') {
          logger.debug('OCR progress', { progress: m.progress });
        }
      },
    });
    // Warm up: set parameters that improve nutrition label accuracy
    await worker.setParameters({
      preserve_interword_spaces: '1',
    });
    workerReady = true;
    logger.info('Tesseract worker ready (cached)');
    return worker;
  })();

  return workerPromise;
}

export function isWorkerReady() {
  return workerReady;
}
