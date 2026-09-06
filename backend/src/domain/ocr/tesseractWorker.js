import { createWorker } from 'tesseract.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { logger } from '../../utils/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let workerPromise = null;
let workerReady = false;
let workerInitError = null;

function ensureCacheDir(cachePath) {
  try {
    fs.mkdirSync(cachePath, { recursive: true });
  } catch {}
}

function resolveTesseractOptions() {
  const cachePath = '/tmp/tesseract-cache';
  ensureCacheDir(cachePath);
  const localDataPath = path.resolve(__dirname, '../../../eng.traineddata');
  const localGzPath = path.resolve(__dirname, '../../../eng.traineddata.gz');
  const hasLocal = fs.existsSync(localDataPath);
  const hasLocalGz = fs.existsSync(localGzPath);
  const opts = {
    cachePath,
    logger: (m) => {
      if (m.status === 'recognizing text') {
        logger.debug('OCR progress', { progress: m.progress });
      } else {
        logger.debug('Tesseract status', { status: m.status, progress: m.progress });
      }
    },
  };
  if (hasLocal) {
    opts.langPath = path.resolve(__dirname, '../../../');
    // Ensure trailing slash for tesseract.js
    if (!opts.langPath.endsWith(path.sep)) opts.langPath += path.sep;
    opts.gzip = false;
    logger.info('Tesseract: using local eng.traineddata', { langPath: opts.langPath, hasLocal, hasLocalGz, cachePath });
  } else if (hasLocalGz) {
    opts.langPath = path.resolve(__dirname, '../../../');
    if (!opts.langPath.endsWith(path.sep)) opts.langPath += path.sep;
    opts.gzip = true;
    logger.info('Tesseract: using local eng.traineddata.gz', { langPath: opts.langPath, cachePath });
  } else {
    logger.warn('Tesseract: local eng.traineddata not found, will download from CDN (requires network)', { checked: [localDataPath, localGzPath], cachePath });
  }
  return opts;
}

export async function getTesseractWorker() {
  if (workerPromise) return workerPromise;
  workerInitError = null;

  workerPromise = (async () => {
    const opts = resolveTesseractOptions();
    // First attempt: with local langPath if available
    try {
      const worker = await Promise.race([
        (async () => {
          const w = await createWorker('eng', 1, opts);
          await w.setParameters({ preserve_interword_spaces: '1' });
          return w;
        })(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Tesseract worker init timeout after 30s — Render free tier CPU may be overloaded or language data download blocked')), 30000)),
      ]);
      workerReady = true;
      logger.info('Tesseract worker ready (cached)');
      return worker;
    } catch (err) {
      logger.warn('Tesseract worker init failed with primary opts, retrying with fallback', { error: err.message, stack: err.stack?.slice(0, 300) });
      // Fallback: if we tried local, retry allowing network download (no langPath, gzip default)
      if (opts.langPath) {
        try {
          const fallbackOpts = {
            cachePath: '/tmp/tesseract-cache',
            logger: opts.logger,
          };
          ensureCacheDir(fallbackOpts.cachePath);
          const worker2 = await Promise.race([
            (async () => {
              const w = await createWorker('eng', 1, fallbackOpts);
              await w.setParameters({ preserve_interword_spaces: '1' });
              return w;
            })(),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Tesseract fallback init timeout after 30s')), 30000)),
          ]);
          workerReady = true;
          logger.info('Tesseract worker ready via fallback (download)');
          return worker2;
        } catch (err2) {
          workerInitError = err2;
          throw err2;
        }
      }
      workerInitError = err;
      throw err;
    }
  })();

  // If promise rejects, reset so next call can retry instead of hanging on rejected promise forever
  workerPromise.catch((err) => {
    workerInitError = err;
    // Keep rejected promise but allow reset on next warmup call after delay
    setTimeout(() => {
      if (workerInitError) {
        workerPromise = null;
        workerReady = false;
      }
    }, 5000);
  });

  return workerPromise;
}

export function getWorkerInitError() {
  return workerInitError;
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
