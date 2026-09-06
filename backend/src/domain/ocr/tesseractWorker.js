import { createWorker } from 'tesseract.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { logger } from '../../utils/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let workerPromise = null;
let workerReady = false;

// Prefer local eng.traineddata bundled at backend/eng.traineddata to avoid
// downloading ~4MB on Render cold start (which adds 5-15s + possible timeout).
function resolveTesseractOptions() {
  const localDataPath = path.resolve(__dirname, '../../../eng.traineddata');
  const localGzPath = path.resolve(__dirname, '../../../eng.traineddata.gz');
  const hasLocal = fs.existsSync(localDataPath) || fs.existsSync(localGzPath);
  // langPath should be directory containing eng.traineddata
  const opts = {
    cachePath: '/tmp/tesseract-cache',
    logger: (m) => {
      if (m.status === 'recognizing text') {
        logger.debug('OCR progress', { progress: m.progress });
      }
    },
  };
  if (hasLocal) {
    // Point langPath to backend root so worker finds ./eng.traineddata without fetch
    opts.langPath = path.resolve(__dirname, '../../../');
    opts.gzip = false;
    logger.info('Tesseract: using local eng.traineddata', { langPath: opts.langPath });
  }
  return opts;
}

export async function getTesseractWorker() {
  if (workerPromise) return workerPromise;

  workerPromise = (async () => {
    const opts = resolveTesseractOptions();
    const worker = await createWorker('eng', 1, opts);
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

export async function warmupTesseract() {
  try {
    const worker = await getTesseractWorker();
    // Worker is single-threaded — dummy recognize would block first real OCR.
    // Just loading the worker + setting params is enough to cut 3-5s off cold start.
    logger.info('Tesseract warmup complete (worker ready, no dummy to avoid blocking)');
    return worker;
  } catch (e) {
    logger.warn('Tesseract warmup failed — will lazy-init on first request', { error: e.message });
    workerPromise = null;
    workerReady = false;
    return null;
  }
}

export function isWorkerReady() {
  return workerReady;
}
