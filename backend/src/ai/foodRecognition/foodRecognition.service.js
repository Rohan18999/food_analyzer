import fs from 'fs';
import config from '../../config/env.js';
import { logger } from '../../utils/logger.js';
import { listFoodNames } from '../../data/nutritionDatabase.js';

const FOOD_LIST_HINT = listFoodNames().slice(0, 60).join(', ');

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

function getVisionConfig() {
  return {
    apiKey: config.openrouter.apiKey,
    baseUrl: config.openrouter.baseUrl,
    model: config.openrouter.visionModel,
    headers: {
      'HTTP-Referer': config.openrouter.siteUrl,
      'X-Title': config.openrouter.appName,
    },
  };
}

export async function recognizeFoodFromImage(imagePath) {
  const visionCfg = getVisionConfig();
  if (!visionCfg.apiKey) {
    throw new Error('OPENROUTER_API_KEY not configured — vision recognition unavailable (https://openrouter.ai/keys)');
  }

  const imageBuffer = fs.readFileSync(imagePath);
  const base64 = imageBuffer.toString('base64');
  const mime = imagePath.toLowerCase().endsWith('.png') ? 'image/png' : imagePath.toLowerCase().endsWith('.webp') ? 'image/webp' : 'image/jpeg';
  const dataUrl = `data:${mime};base64,${base64}`;

  const systemPrompt = `You are a food recognition assistant. Identify foods visible in the image.
Return ONLY a JSON object with a "foods" array. Each entry has "name" and "confidence" (0-1).
Use common names. Prefer names from this list when possible: ${FOOD_LIST_HINT}.
If unsure, still list best guesses with lower confidence. Limit to top 5 foods.
Example: {"foods":[{"name":"Chicken Biryani","confidence":0.91},{"name":"Raita","confidence":0.82}]}`;

  const userText = `Identify all distinct food items in this image. Return JSON with foods array.`;

  async function callVision(withJsonMode) {
    const body = {
      model: visionCfg.model,
      temperature: 0.2,
      max_tokens: 600,
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
    const t = setTimeout(() => controller.abort(), 20000);
    const res = await fetch(`${visionCfg.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${visionCfg.apiKey}`,
        'Content-Type': 'application/json',
        ...visionCfg.headers,
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
      logger.warn('OpenRouter vision json_object rejected, retrying without json mode', { model: visionCfg.model });
      response = await callVision(false);
    }
    if (!response.ok) {
      const errText = await response.text();
      logger.error('OpenRouter vision failed', { status: response.status, text: errText.slice(0, 500) });
      if (response.status === 401) throw new Error('OPENROUTER_API_KEY invalid — check Render Environment / backend/.env');
      if (response.status === 429) throw new Error('OpenRouter rate limit hit — please retry in a few seconds');
      if (response.status === 404) throw new Error(`OpenRouter vision model "${visionCfg.model}" not found — set OPENROUTER_VISION_MODEL=qwen/qwen-2.5-vl-32b-instruct`);
      throw new Error(`Vision request failed: ${response.status} ${errText.slice(0, 300)}`);
    }
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('Empty vision response');

  const parsed = extractJsonObject(content);
  if (!parsed) throw new Error(`Vision model returned non-JSON: ${content.slice(0, 200)}`);
  const foods = Array.isArray(parsed.foods) ? parsed.foods : Array.isArray(parsed) ? parsed : [];

  const normalized = foods
    .map((f) => {
      if (typeof f === 'string') return { name: f, confidence: 0.7 };
      return {
        name: String(f.name || f.food || f.label || '').trim(),
        confidence: typeof f.confidence === 'number' ? Math.min(1, Math.max(0, f.confidence)) : 0.75,
      };
    })
    .filter((f) => f.name)
    .slice(0, 5);

  if (!normalized.length) throw new Error('No foods recognized');

  logger.info('Food recognition complete', { foods: normalized, model: visionCfg.model });
  return normalized;
}

function detectMime(p) { // kept for backward compat if imported elsewhere
  const ext = p.toLowerCase().split('.').pop();
  if (ext === 'png') return 'image/png';
  if (ext === 'webp') return 'image/webp';
  return 'image/jpeg';
}
