import fs from 'fs';
import config from '../../config/env.js';
import { logger } from '../../utils/logger.js';

function getVisionModel() {
  const m = config.groq.visionModel || 'meta-llama/llama-4-scout-17b-16e-instruct';
  if (m === 'qwen/qwen3.6-27b' || m === 'qwen/qwen3-32b') return 'meta-llama/llama-4-scout-17b-16e-instruct';
  return m;
}

function stripJsonFence(content) {
  return content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
}

function extractJsonObject(text) {
  const fenced = stripJsonFence(text);
  try { return JSON.parse(fenced); } catch {}
  const match = text.match(/\{[\s\S]*\}/);
  if (match) {
    try { return JSON.parse(match[0]); } catch {}
  }
  return null;
}

function detectMime(p) {
  const ext = p.toLowerCase().split('.').pop();
  if (ext === 'png') return 'image/png';
  if (ext === 'webp') return 'image/webp';
  return 'image/jpeg';
}

function normalizeValidation(parsed) {
  if (!parsed || typeof parsed !== 'object') return null;
  const isFood = typeof parsed.isFood === 'boolean' ? parsed.isFood : parsed.is_food;
  if (typeof isFood !== 'boolean') return null;
  let confidence = Number(parsed.confidence ?? parsed.conf ?? 0.5);
  if (Number.isNaN(confidence)) confidence = 0.5;
  confidence = Math.min(1, Math.max(0, confidence));
  const rawType = String(parsed.foodType || parsed.food_type || '').toLowerCase();
  let foodType = 'uncertain';
  if (['packaged_food', 'packaged', 'packagedfood'].includes(rawType)) foodType = 'packaged_food';
  else if (['normal_food', 'normal', 'cooked', 'meal', 'fresh_food'].includes(rawType)) foodType = 'normal_food';
  else if (['non_food', 'non-food', 'not_food', 'object', 'nonfood'].includes(rawType)) foodType = 'non_food';
  else if (['uncertain', 'unclear', 'ambiguous'].includes(rawType)) foodType = 'uncertain';
  else {
    // Infer from isFood if type missing
    foodType = isFood ? 'normal_food' : 'non_food';
  }
  // If isFood false but type says packaged/normal, fix to non_food
  if (!isFood && (foodType === 'packaged_food' || foodType === 'normal_food')) foodType = 'non_food';
  if (isFood && foodType === 'non_food') foodType = 'uncertain';
  return {
    isFood,
    confidence,
    foodType,
    reason: String(parsed.reason || parsed.explanation || '').slice(0, 300) || undefined,
  };
}

/**
 * Food Validation — determines if image contains food before expensive OCR/recognition.
 * Reuses existing Groq vision model (no new provider).
 * Threshold logic is applied by caller; this service just returns raw validation.
 */
export async function validateFoodImage(imagePath) {
  if (!config.groq.apiKey) {
    logger.warn('GROQ_API_KEY not set — skipping food validation (allowing as food)');
    return { isFood: true, confidence: 0.5, foodType: 'uncertain', reason: 'No GROQ_API_KEY — validation skipped' };
  }

  const imageBuffer = fs.readFileSync(imagePath);
  // Guard large images — vision payload limit ~4MB base64; we already compress frontend to 900px
  // but backend image is raw upload; if >3MB, the base64 will be >4MB and Groq may reject.
  // We keep as is; sharp preprocessing for OCR is separate, vision uses raw.
  const base64 = imageBuffer.toString('base64');
  const mime = detectMime(imagePath);
  const dataUrl = `data:${mime};base64,${base64}`;

  const systemPrompt = `You are a food validation assistant. Determine if the image contains FOOD.
FOOD = any edible item, packaged food, cooked meal, fruits, vegetables, snacks, biscuits, chips, cereal, drinks, or a food nutrition label/ingredients table.
NON-FOOD = shampoo, soap, detergent, cosmetics, electronics, laptop, phone, shoes, clothes, furniture, documents, tools, random objects, empty/dark/blurred images without recognizable food.

If the image contains BOTH food and non-food objects (e.g., plate of biryani + phone on table), classify as FOOD — food presence is enough.

Respond ONLY with JSON: {"isFood": boolean, "confidence": 0-1, "foodType": "packaged_food"|"normal_food"|"non_food"|"uncertain", "reason": "short reason"}
- packaged_food: food package/box/bottle with label
- normal_food: cooked meal, fruits, plated food
- non_food: clearly not food
- uncertain: blurry, dark, ambiguous, no clear subject

Confidence: 0.9+ high certainty, 0.6-0.75 moderate, <0.6 low. Be calibrated.`;

  const userText = `Is this image food? Classify as packaged_food, normal_food, non_food, or uncertain. Return only JSON.`;

  async function callVision(withJsonMode) {
    const body = {
      model: getVisionModel(),
      temperature: 0.1,
      max_tokens: 300,
      ...(withJsonMode ? { response_format: { type: 'json_object' } } : {}),
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: [
            { type: 'text', text: userText },
            { type: 'image_url', image_url: { url: dataUrl } },
          ],
        },
      ],
    };
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 15000);
    const res = await fetch(`${config.groq.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.groq.apiKey}`,
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
      body: JSON.stringify(body),
    });
    clearTimeout(t);
    return res;
  }

  let response = await callVision(true);
  if (!response.ok) {
    const text = await response.text();
    const isJsonValidate = text.includes('json_validate_failed') || text.includes('Failed to validate JSON') || text.includes('failed_generation');
    if (isJsonValidate) {
      logger.warn('Food validation json_object rejected, retrying without json mode', { model: getVisionModel() });
      response = await callVision(false);
      if (!response.ok) {
        const text2 = await response.text();
        logger.error('Food validation failed after fallback', { status: response.status, text: text2.slice(0, 500) });
        // Fail open: allow food to avoid blocking valid users on transient Groq error
        // Caller can decide; but we return uncertain so caller can ask for clearer image
        if (response.status === 401) throw new Error('Groq API key invalid');
        // For vision errors, return uncertain rather than throwing non-food
        logger.warn('Food validation Groq error, returning uncertain (fail-open)', { status: response.status });
        return { isFood: true, confidence: 0.5, foodType: 'uncertain', reason: 'Vision temporarily unavailable — proceeding as uncertain' };
      }
    } else {
      logger.error('Food validation Groq error', { status: response.status, text: text.slice(0, 500) });
      if (response.status === 401) throw new Error('Groq API key invalid');
      if (response.status === 429) {
        // Rate limit — fail open as uncertain
        return { isFood: true, confidence: 0.5, foodType: 'uncertain', reason: 'Rate limited — proceeding as uncertain' };
      }
      // Fail open
      return { isFood: true, confidence: 0.5, foodType: 'uncertain', reason: 'Validation error — proceeding as uncertain' };
    }
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    logger.warn('Empty validation response, treating as uncertain');
    return { isFood: true, confidence: 0.5, foodType: 'uncertain', reason: 'Empty response' };
  }

  const parsed = extractJsonObject(content);
  const normalized = normalizeValidation(parsed);
  if (!normalized) {
    logger.warn('Food validation returned non-JSON, treating as uncertain', { content: content.slice(0, 300) });
    return { isFood: true, confidence: 0.5, foodType: 'uncertain', reason: 'Non-JSON validation response' };
  }

  logger.info('Food Validation:', { isFood: normalized.isFood, confidence: normalized.confidence, foodType: normalized.foodType, reason: normalized.reason });

  return normalized;
}
