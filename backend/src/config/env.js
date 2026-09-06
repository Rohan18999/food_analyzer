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

  groq: {
    apiKey: process.env.GROQ_API_KEY || null,
    // NOTE: Groq retired llama models in 2025. Verified working 2026-09-06: gpt-oss-20b/120b, llama-4-scout-17b-16e-instruct (vision)
    model: process.env.GROQ_MODEL || 'openai/gpt-oss-20b',
    visionModel: process.env.GROQ_VISION_MODEL || 'meta-llama/llama-4-scout-17b-16e-instruct',
    baseUrl: process.env.GROQ_BASE_URL || 'https://api.groq.com/openai/v1',
  },

  rag: {
    topK: parseInt(process.env.RAG_TOP_K || '5', 10),
    knowledgeDir: process.env.KNOWLEDGE_DIR || './knowledge',
  },
};

export default config;
