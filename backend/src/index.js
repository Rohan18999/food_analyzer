import { connectDatabase } from './config/database.js';
import { createApp, startServer } from './server.js';

async function main() {
  await connectDatabase();

  const app = createApp();
  startServer(app);
}

main().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
