import fs from 'fs';
import config from '../../config/env.js';
import { logger } from '../../utils/logger.js';
import { listFoodNames } from '../../data/nutritionDatabase.js';

function getVisionModel() {
  return config.groq.visionModel || 'meta-llama/llama-4-scout-17b-16e-instruct';
}

const FOOD_LIST_HINT = listFoodNames().slice(0, 60).join(', ');

function stripJsonFence(content) {
  return content.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
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

  const body = {
    model: getVisionModel(),
    temperature: 0.2,
    max_tokens: 800,
    response_format: { type: 'json_object' },
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

  const response = await fetch(`${config.groq.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.groq.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const text = await response.text();
    logger.error('Groq vision failed', { status: response.status, text: text.slice(0, 500) });
    if (response.status === 401) throw new Error('Groq API key invalid or missing — set GROQ_API_KEY in backend/.env');
    if (response.status === 404 && text.includes('model')) throw new Error(`Groq vision model "${getVisionModel()}" not found or retired — try GROQ_VISION_MODEL=meta-llama/llama-4-scout-17b-16e-instruct or meta-llama/llama-4-maverick-17b-128e-instruct`);
    if (response.status === 429) throw new Error('Groq rate limit hit — please retry in a few seconds');
    throw new Error(`Vision request failed: ${response.status} ${text.slice(0, 300)}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('Empty vision response');

  const parsed = JSON.parse(stripJsonFence(content));
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

  logger.info('Food recognition complete', { foods: normalized, model: getVisionModel() });

  return normalized;
}

function detectMime(p) {
  const ext = p.toLowerCase().split('.').pop();
  if (ext === 'png') return 'image/png';
  if (ext === 'webp') return 'image/webp';
  return 'image/jpeg';
}
