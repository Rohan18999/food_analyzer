import mongoose from 'mongoose';
import config from './env.js';

export async function connectDatabase() {
  if (!config.mongodbUri) {
    console.warn('[db] MONGODB_URI not set — running without database persistence');
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
