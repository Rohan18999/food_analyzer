import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { connectDatabase } from '../src/config/database.js';
import config from '../src/config/env.js';
import { upsertKnowledgeDocument } from '../src/repositories/healthKnowledge.repository.js';
import { isDatabaseConnected } from '../src/config/database.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const KNOWLEDGE_DIR = path.resolve(__dirname, '..', config.rag.knowledgeDir.replace('./', ''));

const SUPPORTED_EXTENSIONS = new Set(['.txt', '.md']);

function titleFromFilename(filename) {
  return filename
    .replace(/\.(txt|md)$/i, '')
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function collectDocuments(baseDir) {
  const documents = [];

  if (!fs.existsSync(baseDir)) {
    throw new Error(`Knowledge directory not found: ${baseDir}`);
  }

  const categories = fs
    .readdirSync(baseDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory());

  for (const categoryEntry of categories) {
    const category = categoryEntry.name;
    const categoryPath = path.join(baseDir, category);

    const files = fs.readdirSync(categoryPath).filter((file) => {
      const ext = path.extname(file).toLowerCase();
      return SUPPORTED_EXTENSIONS.has(ext);
    });

    for (const file of files) {
      const filePath = path.join(categoryPath, file);
      const content = fs.readFileSync(filePath, 'utf-8').trim();

      if (!content) continue;

      documents.push({
        title: titleFromFilename(file),
        category,
        content,
        filePath,
      });
    }
  }

  return documents;
}

async function ingest() {
  if (!config.mongodbUri) {
    console.error('MONGODB_URI is required for knowledge ingestion.');
    process.exit(1);
  }

  await connectDatabase();

  if (!isDatabaseConnected()) {
    console.error('Failed to connect to MongoDB.');
    process.exit(1);
  }

  const documents = collectDocuments(KNOWLEDGE_DIR);

  if (!documents.length) {
    console.log('No documents found to ingest.');
    process.exit(0);
  }

  console.log(`Found ${documents.length} documents in ${KNOWLEDGE_DIR}`);

  let ingested = 0;
  for (const doc of documents) {
    await upsertKnowledgeDocument({
      title: doc.title,
      category: doc.category,
      content: doc.content,
    });
    ingested++;
    console.log(`  - [${doc.category}] ${doc.title}`);
  }

  console.log(`\nIngested ${ingested} documents into health_knowledge collection.`);
  process.exit(0);
}

ingest().catch((error) => {
  console.error('Ingestion failed:', error.message);
  process.exit(1);
});
