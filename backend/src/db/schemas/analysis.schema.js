import mongoose from 'mongoose';

const scoreComponentSchema = new mongoose.Schema(
  {
    raw: mongoose.Schema.Types.Mixed,
    penalty: Number,
    bonus: Number,
  },
  { _id: false }
);

const analysisSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
    version: { type: String, default: 'v2' },
    healthScore: { type: Number, required: true },
    verdict: { type: String, required: true },
    scoreBreakdown: {
      sodium: scoreComponentSchema,
      sugar: scoreComponentSchema,
      saturatedFat: scoreComponentSchema,
      ingredientQuality: scoreComponentSchema,
      protein: scoreComponentSchema,
      fiber: scoreComponentSchema,
      baseScore: Number,
      totalPenalties: Number,
      totalBonuses: Number,
      finalScore: Number,
    },
    llmOutput: {
      explanation: String,
      evidenceBasedRisks: [String],
      pros: [String],
      cons: [String],
      alternatives: [
        {
          name: String,
          reason: String,
        },
      ],
    },
    retrievedSources: [
      {
        title: String,
        category: String,
        excerpt: String,
        relevanceScore: Number,
        usedInExplanation: Boolean,
      },
    ],
    ragContext: {
      searchQuery: String,
      retrievedDocIds: [mongoose.Schema.Types.ObjectId],
    },
    extractedData: mongoose.Schema.Types.Mixed,
    processingMetrics: {
      ocrDurationMs: Number,
      scoringDurationMs: Number,
      ragDurationMs: Number,
      totalDurationMs: Number,
    },
    status: {
      type: String,
      enum: ['completed', 'failed'],
      default: 'completed',
    },
    error: {
      code: String,
      message: String,
    },
  },
  { timestamps: true }
);

analysisSchema.index({ createdAt: -1 });

export const Analysis = mongoose.model('Analysis', analysisSchema);
