import fs from 'fs';
import config from '../../config/env.js';
import { logger } from '../../utils/logger.js';
import { listFoodNames } from '../../data/nutritionDatabase.js';

const VISION_FALLBACKS = [
  'qwen/qwen3.6-27b',
  'qwen/qwen3.8-27b',
];

function getVisionModel() {
  const m = config.groq.visionModel || 'qwen/qwen3.6-27b';
  // Auto-correct retired llama vision models to qwen
  if (m.includes('llama-4') || m.includes('llama-3.2') || m === 'qwen/qwen3.6-27b' || m === 'qwen/qwen3-32b') {
    // Keep qwen as is, map llama to qwen
    if (m.includes('llama')) return 'qwen/qwen3.6-27b';
  }
  return m;
}

function getVisionCandidates() {
  const primary = getVisionModel();
  return [primary, ...VISION_FALLBACKS.filter(c => c !== primary)];
}

const FOOD_LIST_HINT = listFoodNames().slice(0, 60).join(', ');

function stripJsonFence(content) {
  return content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
}

function extractJsonObject(text) {
  const fenced = stripJsonFence(text);
  try { return JSON.parse(fenced); } catch {}
  // Fallback: extract first {...} block
  const match = text.match(/\{[\s\S]*\}/);
  if (match) {
    try { return JSON.parse(match[0]); } catch {}
  }
  return null;
}

export async function recognizeFoodFromImage(imagePath) {
  if (!config.groq.apiKey) {
    throw new Error('GROQ_API_KEY not configured — vision recognition unavailable');
  }

  const imageBuffer = fs.readFileSync(imagePath);
  const base64 = imageBuffer.toString('base64');
  const mime = detectMime(imagePath);

  const dataUrl = `data:${mime};base64,${base64}`;

  const systemPrompt = `You are a food recognition assistant. Identify foods visible in the image.
Return ONLY a JSON object with a "foods" array. Each entry has "name" and "confidence" (0-1).
Use common names. Prefer names from this list when possible: ${FOOD_LIST_HINT}.
If unsure, still list best guesses with lower confidence. Limit to top 5 foods.
Example: {"foods":[{"name":"Chicken Biryani","confidence":0.91},{"name":"Raita","confidence":0.82}]}`;

  const userText = `Identify all distinct food items in this image. Return JSON with foods array.`;

  async function callVision(withJsonMode, model) {
    const body = {
      model,
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

  // Try vision models in order (handles 404 retired + json_object fallback)
  let lastText = '';
  let lastStatus = 0;
  let lastContent = null;
  for (const model of getVisionCandidates()) {
    let response = await callVision(true, model);
    if (!response.ok) {
      const text = await response.text();
      lastText = text;
      lastStatus = response.status;
      const isJsonValidate = text.includes('json_validate_failed') || text.includes('Failed to validate JSON') || text.includes('failed_generation');
      if (isJsonValidate) {
        logger.warn('Groq vision json_object rejected, retrying without json mode', { model });
        response = await callVision(false, model);
        if (!response.ok) {
          const text2 = await response.text();
          lastText = text2;
          lastStatus = response.status;
          if (response.status === 404 && text2.includes('model')) {
            logger.warn('Vision model not found, trying fallback', { tried: model });
            continue;
          }
          logger.warn('Vision failed after json fallback, trying next model', { model, status: response.status });
          continue;
        }
      } else if (response.status === 404 && text.includes('model')) {
        logger.warn('Vision model not found, trying fallback', { tried: model, text: text.slice(0, 200) });
        continue;
      } else if (response.status === 401) {
        throw new Error('Groq API key invalid or missing — set GROQ_API_KEY in backend/.env');
      } else if (response.status === 429) {
        throw new Error('Groq rate limit hit — please retry in a few seconds');
      } else if (!response.ok) {
        logger.warn('Groq vision error, trying next model', { model, status: response.status, text: text.slice(0, 300) });
        continue;
      }
    }
    // response ok here
    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      lastText = 'Empty vision response';
      continue;
    }
    const parsed = extractJsonObject(content);
    if (!parsed) {
      logger.warn('Vision model returned non-JSON, trying next model', { model, content: content.slice(0, 200) });
      lastContent = content;
      continue;
    }
    // success — normalize and return
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
    if (!normalized.length) {
      logger.warn('Vision parsed but no foods, trying next model', { model });
      continue;
    }
    logger.info('Food recognition complete', { foods: normalized, model });
    return normalized;
  }

  // All models failed
  logger.error('Groq vision all models failed', { lastStatus, lastText: lastText.slice(0, 500), lastContent: lastContent?.slice(0, 200) });
  if (lastStatus === 404 || (lastStatus === 400 && lastText.includes('decommissioned'))) throw new Error(`Groq vision model not found or retired (tried ${getVisionCandidates().join(', ')}) — set GROQ_VISION_MODEL=qwen/qwen3.6-27b (see https://console.groq.com/docs/deprecations)`);
  if (lastStatus === 401) throw new Error('Groq API key invalid or missing — set GROQ_API_KEY in backend/.env');
  throw new Error(`Vision request failed: ${lastStatus} ${lastText.slice(0, 300)}`);
}

function detectMime(p) {
  const ext = p.toLowerCase().split('.').pop();
  if (ext === 'png') return 'image/png';
  if (ext === 'webp') return 'image/webp';
  return 'image/jpeg';
}
