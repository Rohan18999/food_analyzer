import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import config from './config/env.js';
import routes from './routes/index.js';
import { notFoundHandler, errorHandler } from './middleware/errorHandler.js';
import { logger } from './utils/logger.js';

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors());
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));

  app.use('/api/v1', routes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

export function startServer(app) {
  const server = app.listen(config.port, () => {
    logger.info(`Server running on port ${config.port}`, {
      env: config.nodeEnv,
      url: `http://localhost:${config.port}`,
    });
  });

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
