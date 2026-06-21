import { BaseRetriever } from '@langchain/core/retrievers';
import { Document } from '@langchain/core/documents';
import { searchKnowledgeDocuments } from '../../repositories/healthKnowledge.repository.js';

export class MongoKeywordRetriever extends BaseRetriever {
  constructor(options = {}) {
    super();
    this.topK = options.topK ?? 5;
  }

  get lc_namespace() {
    return ['food_health_analyzer', 'retrievers', 'mongo_keyword'];
  }

  async _getRelevantDocuments(query) {
    const results = await searchKnowledgeDocuments(query, this.topK);

    return results.map(
      (doc) =>
        new Document({
          pageContent: doc.content,
          metadata: {
            id: doc._id?.toString(),
            title: doc.title,
            category: doc.category,
            score: doc.score,
          },
        })
    );
  }
}
