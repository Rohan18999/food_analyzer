import config from '../../config/env.js';
import { RagAnalysisOutputSchema } from '../schemas/llmOutput.schema.js';

function stripJsonFence(content) {
  return content
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
}

function objectToText(value) {
  if (typeof value === 'string') return value;
  if (value == null) return '';

  if (typeof value === 'object') {
    const preferredValue =
      value.text ||
      value.description ||
      value.reason ||
      value.risk ||
      value.benefit ||
      value.concern ||
      value.point ||
      value.summary;

    if (preferredValue) return objectToText(preferredValue);

    return Object.values(value)
      .map(objectToText)
      .filter(Boolean)
      .join(' ');
  }

  return String(value);
}

function normalizeStringArray(value) {
  if (!Array.isArray(value)) return [];
  return value.map(objectToText).map((item) => item.trim()).filter(Boolean);
}

function normalizeAlternatives(value) {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      if (typeof item === 'string') {
        return {
          name: item,
          reason: 'Suggested as a healthier alternative.',
        };
      }

      if (!item || typeof item !== 'object') return null;

      return {
        name: objectToText(item.name || item.product || item.alternative || item.title).trim() || 'Healthier alternative',
        reason: objectToText(item.reason || item.why || item.description || item.benefit).trim() || 'May better fit the nutrition goals for this product.',
      };
    })
    .filter(Boolean);
}

function normalizeGroqAnalysis(parsed) {
  return {
    explanation: objectToText(parsed.explanation).trim() || 'No explanation returned.',
    evidenceBasedRisks: normalizeStringArray(parsed.evidenceBasedRisks),
    pros: normalizeStringArray(parsed.pros),
    cons: normalizeStringArray(parsed.cons),
    alternatives: normalizeAlternatives(parsed.alternatives),
    citedSourceTitles: normalizeStringArray(parsed.citedSourceTitles),
  };
}

export async function generateGroqJson({ systemPrompt, userPrompt }) {
  if (!config.groq.apiKey) {
    throw new Error('GROQ_API_KEY is required for Groq analysis');
  }

  const response = await fetch(`${config.groq.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.groq.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: config.groq.model,
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Groq request failed: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error('Groq returned an empty analysis response');
  }

  const parsed = JSON.parse(stripJsonFence(content));
  return RagAnalysisOutputSchema.parse(normalizeGroqAnalysis(parsed));
}
