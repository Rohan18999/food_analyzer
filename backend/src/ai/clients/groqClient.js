// Backward compat — now delegates to unified llmClient (Groq or OpenRouter)
export { generateLlmJson as generateGroqJson } from './llmClient.js';
export { generateLlmJson } from './llmClient.js';
