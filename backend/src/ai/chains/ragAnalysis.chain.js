import { RAG_SYSTEM_PROMPT, RAG_USER_PROMPT } from '../prompts/ragAnalysis.prompt.js';
import { MongoKeywordRetriever } from '../retrievers/mongoKeywordRetriever.js';
import { buildSearchQuery, formatRetrievedContext } from '../queryBuilder.js';
import { generateGroqJson } from '../clients/groqClient.js';
import config from '../../config/env.js';
import { isDatabaseConnected } from '../../config/database.js';

/**
 * Run the full RAG pipeline:
 * Product JSON → search query → keyword retrieval → Groq analysis
 */
export async function runRagAnalysisChain({ product, healthScore, verdict, scoreBreakdown }) {
  const searchQuery = buildSearchQuery(product);
  let retrievedDocs = [];
  // Skip DB retrieval when Mongo not configured — saves ~200ms on Render free tier
  if (isDatabaseConnected()) {
    const retriever = new MongoKeywordRetriever({ topK: config.rag.topK });
    retrievedDocs = await retriever.invoke(searchQuery);
  }

  const retrievedContext = formatRetrievedContext(
    retrievedDocs.map((doc) => ({
      title: doc.metadata.title,
      category: doc.metadata.category,
      content: doc.pageContent,
      score: doc.metadata.score,
    }))
  );

  const productJson = JSON.stringify(
    {
      productName: product.productName,
      ingredients: product.ingredients,
      nutritionFacts: product.nutritionFacts,
      scoreBreakdown,
    },
    null,
    2
  );

  const userPrompt = RAG_USER_PROMPT
    .replace('{retrieved_documents}', retrievedContext)
    .replace('{product_json}', productJson)
    .replace('{health_score}', String(healthScore))
    .replace('{verdict}', verdict);

  const llmOutput = await generateGroqJson({
    systemPrompt: RAG_SYSTEM_PROMPT,
    userPrompt,
  });

  const retrievedSources = retrievedDocs.map((doc) => ({
    title: doc.metadata.title,
    category: doc.metadata.category,
    excerpt: doc.pageContent.slice(0, 250),
    relevanceScore: doc.metadata.score ?? null,
    usedInExplanation: llmOutput.citedSourceTitles?.includes(doc.metadata.title) ?? false,
  }));

  return {
    searchQuery,
    llmOutput: {
      explanation: llmOutput.explanation,
      evidenceBasedRisks: llmOutput.evidenceBasedRisks,
      pros: llmOutput.pros,
      cons: llmOutput.cons,
      alternatives: llmOutput.alternatives,
    },
    retrievedSources,
    retrievedDocIds: retrievedDocs.map((doc) => doc.metadata.id).filter(Boolean),
  };
}
