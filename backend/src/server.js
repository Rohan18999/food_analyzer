import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import config from './config/env.js';
import routes from './routes/index.js';
import { notFoundHandler, errorHandler } from './middleware/errorHandler.js';
import { logger } from './utils/logger.js';
import { warmupTesseract } from './domain/ocr/tesseractWorker.js';

export function createApp() {
  const app = express();

  app.use(helmet({ crossOriginResourcePolicy: false, crossOriginEmbedderPolicy: false }));
  app.use(cors({ origin: true, credentials: false, methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'], allowedHeaders: ['Content-Type', 'Authorization'] }));
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Root and health probes — Render hits HEAD/GET / and /health
  const rootHandler = (req, res) => {
    res.status(200).json({
      success: true,
      service: 'food-health-analyzer-backend',
      status: 'live',
      version: 'v2',
      timestamp: new Date().toISOString(),
      endpoints: {
        health: '/api/v1/health',
        ready: '/api/v1/health/ready',
        analysis: 'POST /api/v1/analysis',
        foodRecognize: 'POST /api/v1/food/recognize',
        foodAnalyze: 'POST /api/v1/food/analyze',
        supportedFoods: 'GET /api/v1/food/supported-foods',
      },
      docs: 'GET /api/v1/health for detailed status',
    });
  };
  app.get('/', rootHandler);
  app.head('/', (req, res) => res.status(200).end());
  app.get('/health', (req, res) => res.redirect('/api/v1/health/ready'));
  app.get('/api', rootHandler);
  app.get('/api/v1', rootHandler);

  app.use('/api/v1', routes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

export function setServerTimeout(server, ms = 120000) {
  server.setTimeout(ms);
  server.headersTimeout = ms + 5000;
  server.requestTimeout = ms;
}

export function startServer(app) {
  const server = app.listen(config.port, () => {
    logger.info(`Server running on port ${config.port}`, {
      env: config.nodeEnv,
      url: `http://localhost:${config.port}`,
    });
    if (!config.groq.apiKey) {
      logger.warn('GROQ_API_KEY not set — AI explanations will use deterministic fallback. Set it in backend/.env');
    } else {
      logger.info(`Groq configured`, { model: config.groq.model, visionModel: config.groq.visionModel });
    }
    if (!config.mongodbUri) {
      logger.warn('MONGODB_URI not set — RAG retrieval disabled, analyses will run without knowledge base');
    }
    // Warm tesseract in background — avoids 5-15s cold-start penalty on first analysis request (critical for Render free tier)
    setTimeout(() => {
      warmupTesseract().catch(() => {});
    }, 1500);
  });
  setServerTimeout(server, 120000);

  server.on('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      logger.error(`Port ${config.port} is already in use. Stop the existing process or set PORT to another value.`);
      process.exit(1);
    }

    logger.error('Server failed to start', { error: error.message });
    process.exit(1);
  });

  return server;
}
