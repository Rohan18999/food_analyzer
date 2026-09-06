import fs from 'fs';
import config from '../../config/env.js';
import { logger } from '../../utils/logger.js';

const VISION_FALLBACKS = [
  'qwen/qwen3.6-27b',
  'qwen/qwen3.8-27b',
];

function getVisionModel() {
  const m = config.groq.visionModel || 'qwen/qwen3.6-27b';
  if (m.includes('llama-4') || m.includes('llama-3.2')) return 'qwen/qwen3.6-27b';
  return m;
}

function getVisionCandidates() {
  const primary = getVisionModel();
  const uniq = [primary, ...VISION_FALLBACKS.filter(c => c !== primary)];
  return uniq;
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

  async function callVision(withJsonMode, model) {
    const body = {
      model,
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

  // Try vision models in order; handle 404 retired + json_object fallback
  let lastText = '';
  let lastStatus = 0;
  for (const model of getVisionCandidates()) {
    let response = await callVision(true, model);
    if (response.ok) {
      // success
      const dataOk = await response.json();
      const contentOk = dataOk.choices?.[0]?.message?.content;
      if (contentOk) {
        const parsedOk = extractJsonObject(contentOk);
        const normOk = normalizeValidation(parsedOk);
        if (normOk) {
          logger.info('Food Validation:', { isFood: normOk.isFood, confidence: normOk.confidence, foodType: normOk.foodType, model });
          return normOk;
        }
      }
      // if parsing failed but response ok, try without json mode
      response = await callVision(false, model);
      if (response.ok) {
        const data2 = await response.json();
        const content2 = data2.choices?.[0]?.message?.content;
        const parsed2 = extractJsonObject(content2 || '');
        const norm2 = normalizeValidation(parsed2);
        if (norm2) {
          logger.info('Food Validation (fallback json):', { isFood: norm2.isFood, confidence: norm2.confidence, foodType: norm2.foodType, model });
          return norm2;
        }
      }
      // model succeeded but parsing still failed — fail open as uncertain
      logger.warn('Food validation model responded but non-JSON, treating as uncertain', { model });
      return { isFood: true, confidence: 0.5, foodType: 'uncertain', reason: 'Non-JSON validation response' };
    }
    const text = await response.text();
    lastText = text;
    lastStatus = response.status;
    const isJsonValidate = text.includes('json_validate_failed') || text.includes('Failed to validate JSON') || text.includes('failed_generation');
    if (isJsonValidate) {
      logger.warn('Food validation json_object rejected, retrying without json mode', { model });
      const retry = await callVision(false, model);
      if (retry.ok) {
        const dataR = await retry.json();
        const contentR = dataR.choices?.[0]?.message?.content;
        const parsedR = extractJsonObject(contentR || '');
        const normR = normalizeValidation(parsedR);
        if (normR) {
          logger.info('Food Validation (json fallback):', { isFood: normR.isFood, confidence: normR.confidence, foodType: normR.foodType, model });
          return normR;
        }
      } else {
        const t2 = await retry.text();
        lastText = t2;
        lastStatus = retry.status;
      }
      continue; // try next model
    }
    if (response.status === 401) throw new Error('Groq API key invalid');
    if (response.status === 404 && text.includes('model')) {
      logger.warn('Vision model not found, trying fallback', { tried: model, text: text.slice(0, 200) });
      continue; // try next candidate
    }
    if (response.status === 429) {
      return { isFood: true, confidence: 0.5, foodType: 'uncertain', reason: 'Rate limited — proceeding as uncertain' };
    }
    // other error — try next model
    logger.warn('Food validation error, trying next model', { model, status: response.status, text: text.slice(0, 300) });
    continue;
  }

  // All vision models failed — fail open as uncertain, caller will allow packaged/normal to proceed
  logger.error('Food validation all vision models failed, failing open as uncertain', { lastStatus, lastText: lastText.slice(0, 500) });
  if (lastStatus === 401) throw new Error('Groq API key invalid');
  return { isFood: true, confidence: 0.5, foodType: 'uncertain', reason: 'Vision temporarily unavailable — proceeding as uncertain' };
}
