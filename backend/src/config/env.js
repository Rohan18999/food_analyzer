import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

function resolveMongoUri(raw) {
  if (!raw) return null;
  const uri = raw.trim();
  // Treat placeholder/example values as not configured to avoid ENOTFOUND noise on Render
  if (
    uri.includes('user:password') ||
    uri.includes('cluster.mongodb.net/food_health_analyzer') && uri.includes('mongodb+srv://user') ||
    uri === 'mongodb+srv://user:password@cluster.mongodb.net/food_health_analyzer'
  ) {
    return null;
  }
  return uri;
}

const config = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3002', 10),
  mongodbUri: resolveMongoUri(process.env.MONGODB_URI),
  maxFileSizeMb: parseInt(process.env.MAX_FILE_SIZE_MB || '10', 10),
  uploadDir: process.env.UPLOAD_DIR || './uploads',

  // OpenRouter only — Groq removed (Option A). Valid IDs 2026-09: openai/gpt-4o-mini for text (cheap JSON), qwen/qwen3-vl-32b-instruct for vision
  openrouter: {
    apiKey: process.env.OPENROUTER_API_KEY || null,
    model: process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini',
    visionModel: process.env.OPENROUTER_VISION_MODEL || 'qwen/qwen3-vl-32b-instruct',
    baseUrl: process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1',
    siteUrl: process.env.OPENROUTER_SITE_URL || 'https://foodanalyzer-five.vercel.app',
    appName: process.env.OPENROUTER_APP_NAME || 'AI Food Health Analyzer',
  },

  rag: {
    topK: parseInt(process.env.RAG_TOP_K || '5', 10),
    knowledgeDir: process.env.KNOWLEDGE_DIR || './knowledge',
  },
};

export default config;
