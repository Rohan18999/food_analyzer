import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const config = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3002', 10),
  mongodbUri: process.env.MONGODB_URI || null,
  maxFileSizeMb: parseInt(process.env.MAX_FILE_SIZE_MB || '10', 10),
  uploadDir: process.env.UPLOAD_DIR || './uploads',

  groq: {
    apiKey: process.env.GROQ_API_KEY || null,
    // llama-3.1-8b-instant was retired by Groq in late 2025; use current versatile model
    model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
    visionModel: process.env.GROQ_VISION_MODEL || 'meta-llama/llama-4-scout-17b-16e-instruct',
    baseUrl: process.env.GROQ_BASE_URL || 'https://api.groq.com/openai/v1',
  },

  rag: {
    topK: parseInt(process.env.RAG_TOP_K || '5', 10),
    knowledgeDir: process.env.KNOWLEDGE_DIR || './knowledge',
  },
};

export default config;
