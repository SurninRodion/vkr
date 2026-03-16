const { v4: uuidv4 } = require('uuid');
const { analyzePrompt, generateFromPrompt } = require('../utils/aiAnalyzer');
const { createPrompt } = require('../models/promptModel');

async function analyze(req, res) {
  try {
    const { prompt } = req.body;
    const userId = req.user.id;

    console.log('[PromptController] POST /api/prompts/analyze user:', userId);

    if (!prompt) {
      return res.status(400).json({ message: 'prompt обязателен' });
    }

    // Анализ и генерация только через GigaChat (нейросеть)
    const analysis = await analyzePrompt(prompt);
    if (!analysis || typeof analysis.effectiveness !== 'number') {
      return res.status(503).json({
        message: 'Анализ выполняется только через GigaChat. Проверьте GIGACHAT_CREDENTIALS или повторите позже.'
      });
    }
    console.log('[PromptController] AI analysis result:', analysis);
    const generatedContent = await generateFromPrompt(prompt);
    if (generatedContent) console.log('[PromptController] Generated content length:', generatedContent.length);

    const id = uuidv4();

    await createPrompt({
      id,
      user_id: userId,
      prompt_text: prompt,
      ai_response: (generatedContent || analysis.aiResponse) || '',
      analysis: JSON.stringify(analysis)
    });

    return res.status(201).json({
      aiResponse: analysis.aiResponse || '',
      analysis,
      generatedContent: generatedContent || null
    });
  } catch (err) {
    console.error('[PromptController] Error analyzing prompt:', err.message);
    return res.status(500).json({ message: 'Ошибка анализа промпта' });
  }
}

module.exports = {
  analyze
};

