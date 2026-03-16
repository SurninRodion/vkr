const { v4: uuidv4 } = require('uuid');
const { analyzePrompt, generateFromPrompt } = require('../utils/aiAnalyzer');
const { getAllTasks, getTaskById } = require('../models/taskModel');
const { createTaskResult, getResultByUserAndTask, getCompletedTaskIds } = require('../models/resultModel');
const { addPoints } = require('../models/userModel');

async function listTasks(req, res) {
  try {
    console.log('[TaskController] GET /api/tasks');
    const tasks = await getAllTasks();
    return res.json(tasks);
  } catch (err) {
    console.error('[TaskController] Error listing tasks:', err.message);
    return res.status(500).json({ message: 'Ошибка получения заданий' });
  }
}

async function getTask(req, res) {
  try {
    const { id } = req.params;
    console.log('[TaskController] GET /api/tasks/:id', id);
    const task = await getTaskById(id);
    if (!task) {
      return res.status(404).json({ message: 'Задание не найдено' });
    }
    return res.json(task);
  } catch (err) {
    console.error('[TaskController] Error getting task:', err.message);
    return res.status(500).json({ message: 'Ошибка получения задания' });
  }
}

async function submitSolution(req, res) {
  try {
    const { taskId, prompt } = req.body;
    const userId = req.user.id;

    console.log('[TaskController] POST /api/tasks/submit user:', userId, 'task:', taskId);

    if (!taskId || !prompt) {
      return res.status(400).json({ message: 'taskId и prompt обязательны' });
    }

    const existing = await getResultByUserAndTask(userId, taskId);
    if (existing) {
      return res.status(403).json({
        message: 'Задание уже выполнено. Повторная отправка недоступна.',
        code: 'TASK_ALREADY_COMPLETED'
      });
    }

    const task = await getTaskById(taskId);
    if (!task) {
      return res.status(404).json({ message: 'Задание не найдено' });
    }

    // Анализ и генерация только через GigaChat (нейросеть)
    const analysis = await analyzePrompt(prompt);
    if (!analysis || typeof analysis.effectiveness !== 'number') {
      return res.status(503).json({
        message: 'Анализ выполняется только через GigaChat. Проверьте GIGACHAT_CREDENTIALS или повторите позже.'
      });
    }
    console.log('[TaskController] AI analysis result:', analysis);
    const generatedContent = await generateFromPrompt(prompt);
    if (generatedContent) console.log('[TaskController] Generated content length:', generatedContent.length);

    const score =
      typeof analysis.effectiveness === 'number'
        ? Math.max(0, Math.min(10, analysis.effectiveness))
        : 8;

    const resultId = uuidv4();
    const feedbackPayload = { ...analysis, generatedContent: generatedContent || undefined };

    await createTaskResult({
      id: resultId,
      user_id: userId,
      task_id: taskId,
      prompt_text: prompt,
      ai_feedback: JSON.stringify(feedbackPayload),
      score
    });

    await addPoints(userId, task.points);

    return res.status(201).json({
      message: 'Решение отправлено и проанализировано',
      score,
      analysis,
      generatedContent: generatedContent || null,
      pointsAwarded: task.points
    });
  } catch (err) {
    console.error('[TaskController] Error submitting solution:', err.message);
    return res.status(500).json({ message: 'Ошибка отправки решения' });
  }
}

async function getTaskResult(req, res) {
  try {
    const { id: taskId } = req.params;
    const userId = req.user.id;

    const task = await getTaskById(taskId);
    if (!task) {
      return res.status(404).json({ message: 'Задание не найдено' });
    }

    const result = await getResultByUserAndTask(userId, taskId);
    if (!result) {
      return res.status(404).json({ message: 'Результат по этому заданию не найден' });
    }

    let feedback = null;
    if (result.ai_feedback) {
      try {
        feedback = JSON.parse(result.ai_feedback);
      } catch {
        feedback = { aiResponse: result.ai_feedback };
      }
    }

    return res.json({
      id: result.id,
      taskId: result.task_id,
      promptText: result.prompt_text,
      score: result.score,
      createdAt: result.created_at,
      analysis: feedback,
      generatedContent: feedback?.generatedContent || null
    });
  } catch (err) {
    console.error('[TaskController] Error getting task result:', err.message);
    return res.status(500).json({ message: 'Ошибка получения результата' });
  }
}

async function getCompletedTaskIdsHandler(req, res) {
  try {
    const userId = req.user.id;
    const completedTaskIds = await getCompletedTaskIds(userId);
    return res.json({ completedTaskIds });
  } catch (err) {
    console.error('[TaskController] Error getting completed task IDs:', err.message);
    return res.status(500).json({ message: 'Ошибка получения списка выполненных заданий' });
  }
}

module.exports = {
  listTasks,
  getTask,
  submitSolution,
  getTaskResult,
  getCompletedTaskIdsHandler
};

