import config from '../../config/env.js';
import { RagAnalysisOutputSchema } from '../schemas/llmOutput.schema.js';

function getActiveConfig(isVision = false) {
  return {
    provider: 'openrouter',
    apiKey: config.openrouter.apiKey,
    baseUrl: config.openrouter.baseUrl,
    model: isVision ? config.openrouter.visionModel : config.openrouter.model,
    siteUrl: config.openrouter.siteUrl,
    appName: config.openrouter.appName,
  };
}

function stripJsonFence(content) {
  return content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
}

function objectToText(value) {
  if (typeof value === 'string') return value;
  if (value == null) return '';
  if (typeof value === 'object') {
    const preferredValue = value.text || value.description || value.reason || value.risk || value.benefit || value.concern || value.point || value.summary;
    if (preferredValue) return objectToText(preferredValue);
    return Object.values(value).map(objectToText).filter(Boolean).join(' ');
  }
  return String(value);
}

function normalizeStringArray(value) {
  if (!Array.isArray(value)) return [];
  return value.map(objectToText).map((item) => item.trim()).filter(Boolean);
}

function normalizeAlternatives(value) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    if (typeof item === 'string') return { name: item, reason: 'Suggested as a healthier alternative.' };
    if (!item || typeof item !== 'object') return null;
    return {
      name: objectToText(item.name || item.product || item.alternative || item.title).trim() || 'Healthier alternative',
      reason: objectToText(item.reason || item.why || item.description || item.benefit).trim() || 'May better fit the nutrition goals for this product.',
    };
  }).filter(Boolean);
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

function getFriendlyError(status, body, provider) {
  if (status === 401) return `${provider} API key invalid or missing (401). Check OPENROUTER_API_KEY in backend/.env / Render Environment`;
  if (status === 403) return `${provider} API access forbidden (403). Check API key permissions.`;
  if (status === 404 && body?.includes('model')) return `${provider} model not found (404). Check OPENROUTER_MODEL / OPENROUTER_VISION_MODEL`;
  if (status === 429) return `${provider} rate limit hit (429). Please retry in a few seconds.`;
  if (body?.includes('json_validate_failed') || body?.includes('failed_generation')) {
    return `${provider} truncated JSON (400): max tokens too low — will auto-retry with larger limit.`;
  }
  if (status >= 500) return `${provider} server error (${status}). Retry shortly.`;
  return `${provider} request failed: ${status} ${body.slice(0, 400)}`;
}

const cache = new Map();
function cacheKey(model, systemPrompt, userPrompt) {
  return `${model}::${systemPrompt.slice(0, 80)}::${userPrompt.slice(0, 400)}`;
}

export async function generateLlmJson({ systemPrompt, userPrompt, modelOverride, isVision = false }) {
  const cfg = getActiveConfig(isVision);
  if (!cfg.apiKey) {
    throw new Error('OPENROUTER_API_KEY is required (https://openrouter.ai/keys)');
  }
  const model = modelOverride || cfg.model;
  const key = cacheKey(model, systemPrompt, userPrompt);
  if (cache.has(key)) return cache.get(key);

  const maxTokensAttempts = [1600, 2200];
  let lastError = null;

  for (let attempt = 0; attempt < maxTokensAttempts.length; attempt++) {
    const maxTokens = maxTokensAttempts[attempt];
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const headers = {
      Authorization: `Bearer ${cfg.apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': cfg.siteUrl,
      'X-Title': cfg.appName,
    };
    const response = await fetch(`${cfg.baseUrl}/chat/completions`, {
      method: 'POST',
      headers,
      signal: controller.signal,
      body: JSON.stringify({
        model,
        temperature: 0.2,
        max_tokens: maxTokens,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt + '\nRespond only with valid JSON. Keep explanation to 3-5 concise sentences, pros/cons 2-3 bullets each, alternatives 2 items.' },
          { role: 'user', content: userPrompt + '\n\nReturn only valid JSON as specified. Keep total output under 1000 tokens.' },
        ],
      }),
    });
    clearTimeout(timeout);

    if (!response.ok) {
      const errorText = await response.text();
      const isTruncation = errorText.includes('json_validate_failed') || errorText.includes('failed_generation');
      if (isTruncation && attempt === 0) {
        lastError = new Error(getFriendlyError(response.status, errorText, cfg.provider));
        continue;
      }
      throw new Error(getFriendlyError(response.status, errorText, cfg.provider));
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error(`${cfg.provider} returned an empty analysis response`);
    try {
      const parsed = JSON.parse(stripJsonFence(content));
      const result = RagAnalysisOutputSchema.parse(normalizeGroqAnalysis(parsed));
      cache.set(key, result);
      setTimeout(() => cache.delete(key), 10 * 60 * 1000);
      return result;
    } catch (parseErr) {
      if (attempt === 0 && String(parseErr.message).includes('JSON')) {
        lastError = parseErr;
        continue;
      }
      throw parseErr;
    }
  }
  throw lastError || new Error(`${getActiveConfig(isVision).provider} JSON generation failed after retries`);
}

// Backward compat
export const generateGroqJson = generateLlmJson;
