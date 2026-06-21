import { HealthKnowledge } from '../db/schemas/healthKnowledge.schema.js';
import { isDatabaseConnected } from '../config/database.js';

export async function upsertKnowledgeDocument({ title, category, content, embedding }) {
  if (!isDatabaseConnected()) {
    throw new Error('Database connection required for knowledge ingestion');
  }

  const update = { title, category, content };
  if (embedding) update.embedding = embedding;

  return HealthKnowledge.findOneAndUpdate(
    { title, category },
    update,
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
}

export async function countKnowledgeDocuments() {
  if (!isDatabaseConnected()) return 0;
  return HealthKnowledge.countDocuments();
}

export async function findKnowledgeByIds(ids) {
  if (!isDatabaseConnected() || !ids.length) return [];
  return HealthKnowledge.find({ _id: { $in: ids } }).lean();
}

export async function searchKnowledgeDocuments(query, limit = 5) {
  if (!isDatabaseConnected()) return [];

  const terms = tokenizeQuery(query);
  const documents = await HealthKnowledge.find({}, { title: 1, category: 1, content: 1 }).lean();

  return documents
    .map((doc) => ({
      ...doc,
      score: scoreDocument(doc, terms),
    }))
    .filter((doc) => doc.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

function tokenizeQuery(query) {
  const stopWords = new Set([
    'and',
    'the',
    'with',
    'per',
    'serving',
    'product',
    'ingredients',
    'nutrition',
    'facts',
    'total',
  ]);

  return String(query || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((term) => term.length > 2 && !stopWords.has(term));
}

function scoreDocument(doc, terms) {
  if (!terms.length) return 0;

  const title = doc.title.toLowerCase();
  const category = doc.category.toLowerCase();
  const content = doc.content.toLowerCase();

  return terms.reduce((score, term) => {
    let nextScore = score;
    if (title.includes(term)) nextScore += 5;
    if (category.includes(term)) nextScore += 3;
    if (content.includes(term)) nextScore += 1;
    return nextScore;
  }, 0);
}
