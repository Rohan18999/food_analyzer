import { z } from 'zod';

export const RagAnalysisOutputSchema = z.object({
  explanation: z.string().describe('Clear health explanation for the product'),
  evidenceBasedRisks: z
    .array(z.string())
    .describe('Evidence-based health risks drawn from the provided context'),
  pros: z.array(z.string()).describe('Positive nutritional aspects'),
  cons: z.array(z.string()).describe('Negative nutritional aspects'),
  alternatives: z
    .array(
      z.object({
        name: z.string(),
        reason: z.string(),
      })
    )
    .describe('Healthier alternative products'),
  citedSourceTitles: z
    .array(z.string())
    .describe('Titles of retrieved sources referenced in the explanation'),
});
