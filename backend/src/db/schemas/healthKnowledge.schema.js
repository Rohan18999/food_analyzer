import mongoose from 'mongoose';

const healthKnowledgeSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    category: { type: String, required: true },
    content: { type: String, required: true },
    embedding: { type: [Number], default: undefined },
  },
  { timestamps: true }
);

healthKnowledgeSchema.index({ category: 1 });
healthKnowledgeSchema.index({ title: 1, category: 1 }, { unique: true });
healthKnowledgeSchema.index({ title: 'text', category: 'text', content: 'text' });

export const HealthKnowledge = mongoose.model(
  'HealthKnowledge',
  healthKnowledgeSchema,
  'health_knowledge'
);
