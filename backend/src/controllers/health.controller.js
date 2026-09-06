import { isDatabaseConnected } from '../config/database.js';
import config from '../config/env.js';
import { countKnowledgeDocuments } from '../repositories/healthKnowledge.repository.js';
import { isWorkerReady, warmupTesseract } from '../domain/ocr/tesseractWorker.js';

export async function getHealth(req, res) {
  res.status(200).json({
    success: true,
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
}

export async function getReady(req, res) {
  const dbConnected = isDatabaseConnected();
  let knowledgeDocCount = 0;

  if (dbConnected) {
    try {
      knowledgeDocCount = await countKnowledgeDocuments();
    } catch {
      knowledgeDocCount = 0;
    }
  }

  // Trigger OCR warmup if not ready — fire-and-forget so /ready stays fast,
  // but next analysis will be quicker (warms WASM on Render)
  if (!isWorkerReady()) {
    warmupTesseract().catch(() => {});
  }

  res.status(200).json({
    success: true,
    status: 'ready',
    services: {
      database: dbConnected ? 'connected' : 'not_configured',
      ocr: isWorkerReady() ? 'ready' : 'warming',
      scoring: 'available',
      groq: config.groq.apiKey ? 'configured' : 'not_configured',
      retrieval: dbConnected && knowledgeDocCount > 0 ? 'ready' : 'not_ready',
      knowledgeDocuments: knowledgeDocCount,
    },
    timestamp: new Date().toISOString(),
  });
}
