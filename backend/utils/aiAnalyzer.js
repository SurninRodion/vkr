const https = require('https');
const {
  GIGACHAT_CREDENTIALS,
  GIGACHAT_SCOPE,
  GIGACHAT_MODEL
} = require('../config');

const SYSTEM_PROMPT = `Ты — эксперт по оценке промптов для ИИ. Проанализируй присланный пользователем промпт и ответь строго одним JSON-объектом без комментариев и markdown, в таком виде:
{"clarity": число 1-10, "structure": число 1-10, "specificity": число 1-10, "effectiveness": число 1-10, "suggestions": "строка с рекомендациями по улучшению", "aiResponse": "краткий развёрнутый комментарий для пользователя"}
Оцени: ясность (clarity), структурированность (structure), конкретность (specificity), общую эффективность (effectiveness). В suggestions перечисли 1-3 конкретных совета. В aiResponse — понятный итог анализа на русском.`;

function normalizeScore(value) {
  const n = Number(value);
  if (Number.isNaN(n)) return 6;
  return Math.max(1, Math.min(10, Math.round(n)));
}

function parseGigaChatResponse(text) {
  if (!text || typeof text !== 'string') return null;
  let raw = text.trim();
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (jsonMatch) raw = jsonMatch[0];
  try {
    const data = JSON.parse(raw);
    if (typeof data !== 'object' || data === null) return null;
    return {
      clarity: normalizeScore(data.clarity),
      structure: normalizeScore(data.structure),
      specificity: normalizeScore(data.specificity),
      effectiveness: normalizeScore(data.effectiveness),
      suggestions: typeof data.suggestions === 'string' ? data.suggestions : '',
      aiResponse:
        typeof data.aiResponse === 'string'
          ? data.aiResponse
          : (data.suggestions || '') || 'Анализ выполнен.'
    };
  } catch (_) {
    return null;
  }
}

async function callGigaChat(prompt) {
  if (!GIGACHAT_CREDENTIALS) return null;

  try {
    const GigaChatModule = require('gigachat');
    const GigaChat = GigaChatModule.default || GigaChatModule;
    const httpsAgent = new https.Agent({ rejectUnauthorized: false });

    const client = new GigaChat({
      credentials: GIGACHAT_CREDENTIALS,
      scope: GIGACHAT_SCOPE,
      model: GIGACHAT_MODEL,
      timeout: 60,
      httpsAgent
    });

    console.log('[AI] Calling GigaChat API for prompt analysis');
    const response = await client.chat({
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: prompt || '' }
      ]
    });

    const content =
      response?.choices?.[0]?.message?.content ||
      response?.choices?.[0]?.content;
    if (!content) {
      console.error('[AI] GigaChat returned empty content');
      return null;
    }

    const parsed = parseGigaChatResponse(content);
    if (parsed) {
      console.log('[AI] GigaChat analysis OK');
      return parsed;
    }
    console.warn('[AI] GigaChat response could not be parsed as JSON, using raw as aiResponse');
    return {
      clarity: 6,
      structure: 6,
      specificity: 6,
      effectiveness: 6,
      suggestions: '',
      aiResponse: content
    };
  } catch (err) {
    console.error('[AI] GigaChat error:', err.message);
    return null;
  }
}

function isRateLimitError(err) {
  const msg = (err && err.message) ? String(err.message) : '';
  return msg.includes('429') || msg.includes('Too Many Requests');
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function generateFromPrompt(prompt) {
  if (!GIGACHAT_CREDENTIALS || !prompt || !prompt.trim()) return null;

  const doGenerate = async () => {
    const GigaChatModule = require('gigachat');
    const GigaChat = GigaChatModule.default || GigaChatModule;
    const httpsAgent = new https.Agent({ rejectUnauthorized: false });

    const client = new GigaChat({
      credentials: GIGACHAT_CREDENTIALS,
      scope: GIGACHAT_SCOPE,
      model: GIGACHAT_MODEL,
      timeout: 90,
      httpsAgent
    });

    const response = await client.chat({
      messages: [{ role: 'user', content: prompt.trim() }]
    });

    const content =
      response?.choices?.[0]?.message?.content ||
      response?.choices?.[0]?.content;
    if (content && typeof content === 'string') {
      return content.trim();
    }
    return null;
  };

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      console.log('[AI] GigaChat generation (user prompt)', attempt > 1 ? '(retry)' : '');
      const content = await doGenerate();
      if (content) {
        console.log('[AI] GigaChat generation OK');
        return content;
      }
      return null;
    } catch (err) {
      console.error('[AI] GigaChat generation error:', err.message);
      if (attempt === 1 && isRateLimitError(err)) {
        console.log('[AI] Rate limit (429), retry in 4s...');
        await sleep(4000);
        continue;
      }
      return null;
    }
  }
  return null;
}

async function analyzePrompt(prompt) {
  console.log('[AI] Analyze prompt:', prompt ? prompt.slice(0, 80) + (prompt.length > 80 ? '...' : '') : '');

  const giga = await callGigaChat(prompt);
  if (giga && typeof giga === 'object') {
    console.log('[AI] Using GigaChat analysis');
    return giga;
  }

  console.log('[AI] GigaChat недоступен — анализ только через нейросеть');
  return null;
}

module.exports = {
  analyzePrompt,
  generateFromPrompt
};
