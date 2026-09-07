import mongoose from 'mongoose';
import config from './env.js';

export async function connectDatabase() {
  if (!config.mongodbUri) {
    console.log('[db] MONGODB_URI not set — running without RAG knowledge base (optional). Set MONGODB_URI in Render to enable retrieval.');
    return null;
  }

  try {
    await mongoose.connect(config.mongodbUri);
    console.log('[db] Connected to MongoDB Atlas');
    return mongoose.connection;
  } catch (error) {
    console.error('[db] MongoDB connection failed:', error.message);
    console.warn('[db] Continuing without database persistence');
    return null;
  }
}

export function isDatabaseConnected() {
  return mongoose.connection.readyState === 1;
}
