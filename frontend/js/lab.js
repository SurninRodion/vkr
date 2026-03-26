import {
  apiSubmitPrompt,
  apiGetTask,
  apiSubmitTaskSolution,
  apiGetTaskResult,
  normalizeAnalysisToFive
} from './api.js';
import { enforceLabAccess, showToast } from './ui.js';
import { getAuthState } from './auth.js';

function scoreToLabel(score) {
  if (score >= 5) return { text: 'Отлично', className: 'analysis-score analysis-score--good' };
  if (score >= 4) return { text: 'Хорошо', className: 'analysis-score analysis-score--good' };
  if (score >= 3) return { text: 'Средне', className: 'analysis-score analysis-score--avg' };
  if (score >= 2) return { text: 'Слабовато', className: 'analysis-score analysis-score--bad' };
  return { text: 'Низко', className: 'analysis-score analysis-score--bad' };
}

document.addEventListener('DOMContentLoaded', async () => {
  const promptInput = document.getElementById('prompt-input');
  const generateBtn = document.getElementById('generate-btn');
  const outputEl = document.getElementById('ai-output');
  const analysisRoot = document.getElementById('prompt-analysis');
  const loaderEl = document.getElementById('lab-loader');
  const promptHintEl = document.getElementById('prompt-hint');
  const analysisCommentWrap = document.getElementById('analysis-comment-wrap');
  const analysisCommentEl = document.getElementById('analysis-comment');
  const labFooter = document.querySelector('.panel-footer');

  if (!promptInput || !generateBtn || !outputEl || !analysisRoot) return;

  const params = new URLSearchParams(window.location.search);
  const taskId = params.get('taskId') || null;
  const urlPrompt = params.get('prompt');
  if (!taskId && urlPrompt) {
    try {
      promptInput.value = decodeURIComponent(urlPrompt);
    } catch {
      promptInput.value = urlPrompt;
    }
  }
  let currentTask = null;
  let isCompletedView = false;
  const { isAuthenticated } = getAuthState();

  if (taskId) {
    try {
      currentTask = await apiGetTask(taskId);
      const titleEl = document.querySelector('.panel-title');
      const subtitleEl = document.querySelector('.panel-subtitle');
      if (titleEl && currentTask?.title) {
        titleEl.textContent = `Задание: ${currentTask.title}`;
      }
      if (subtitleEl && currentTask?.description) {
        subtitleEl.textContent = currentTask.description;
      }

      if (isAuthenticated) {
        try {
          const result = await apiGetTaskResult(taskId);
          isCompletedView = true;
          promptInput.value = result.promptText || '';
          promptInput.readOnly = true;
          promptInput.classList.add('textarea--readonly');
          outputEl.textContent = result.generatedContent || result.analysis?.aiResponse || 'Нет сохранённого ответа.';
          outputEl.classList.remove('ai-output-empty');

          const metrics = normalizeAnalysisToFive(result.analysis);
          Object.entries(metrics).forEach(([name, score]) => {
            const targetEl = analysisRoot.querySelector(`[data-metric="${name}"]`);
            if (!targetEl) return;
            const label = scoreToLabel(score);
            targetEl.textContent = `${score}/5 · ${label.text}`;
            targetEl.className = label.className;
          });

          if (result.analysis?.aiResponse && result.generatedContent && analysisCommentWrap && analysisCommentEl) {
            analysisCommentWrap.classList.remove('hidden');
            analysisCommentEl.textContent = result.analysis.aiResponse;
          }

          generateBtn.classList.add('hidden');
          if (promptHintEl) {
            promptHintEl.textContent = 'Задание выполнено. Результат сохранён.';
          }
          if (labFooter) {
            const doneBadge = document.createElement('span');
            doneBadge.className = 'lab-done-badge';
            doneBadge.textContent = 'Задание выполнено';
            labFooter.insertBefore(doneBadge, labFooter.firstChild);
          }
          showToast('Просмотр результата выполнения задания.', 'info');
        } catch (err) {
          if (err.message && err.message.includes('Результат по этому заданию не найден')) {
            showToast(`Вы решаете задание «${currentTask?.title || 'задание'}».`, 'info');
          } else {
            console.error(err);
            showToast('Не удалось загрузить результат.', 'error');
          }
        }
      } else {
        showToast(`Вы решаете задание «${currentTask?.title || 'задание'}». Войдите, чтобы отправить решение.`, 'info');
      }
    } catch (err) {
      console.error(err);
      showToast('Не удалось загрузить задание. Попробуйте ещё раз или выберите его заново.', 'error');
    }
  }

  if (!isCompletedView) {
    enforceLabAccess(generateBtn, promptHintEl);
  }

  generateBtn.addEventListener('click', async () => {
    if (isCompletedView) return;
    const { isAuthenticated } = getAuthState();
    if (!isAuthenticated) return;

    const value = promptInput.value.trim();
    if (!value) {
      showToast('Сначала напишите промпт.', 'error');
      return;
    }

    generateBtn.classList.add('disabled');
    loaderEl?.classList.remove('hidden');
    outputEl.classList.remove('ai-output-empty');
    outputEl.textContent = 'ИИ анализирует промпт...';

    try {
      const result = taskId ? await apiSubmitTaskSolution(taskId, value) : await apiSubmitPrompt(value);
      // Результат генерации (объяснение, план урока и т.д.) или комментарий оценки
      const mainText = result.response || 'Нет ответа от модели.';
      if (!result.generatedContent && result.analysisComment) {
        outputEl.textContent = 'Ответ нейросети по промпту не получен (возможен лимит запросов). Показана только оценка промпта.\n\n' + mainText;
      } else {
        outputEl.textContent = mainText;
      }

      if (analysisCommentWrap && analysisCommentEl) {
        if (result.analysisComment && result.generatedContent) {
          analysisCommentWrap.classList.remove('hidden');
          analysisCommentEl.textContent = result.analysisComment;
        } else {
          analysisCommentWrap.classList.add('hidden');
          analysisCommentEl.textContent = '';
        }
      }

      const metrics = result.analysis;
      Object.entries(metrics).forEach(([name, score]) => {
        const targetEl = analysisRoot.querySelector(`[data-metric="${name}"]`);
        if (!targetEl) return;
        const label = scoreToLabel(score);
        targetEl.textContent = `${score}/5 · ${label.text}`;
        targetEl.className = label.className;
      });

      if (taskId && result.pointsAwarded) {
        showToast(
          `Задание выполнено. Вы получили +${result.pointsAwarded} очков, результат учтён в рейтинге.`,
          'success'
        );
        isCompletedView = true;
        promptInput.readOnly = true;
        promptInput.classList.add('textarea--readonly');
        generateBtn.classList.add('hidden');
        if (promptHintEl) promptHintEl.textContent = 'Задание выполнено. Результат сохранён.';
        if (labFooter) {
          const doneBadge = document.createElement('span');
          doneBadge.className = 'lab-done-badge';
          doneBadge.textContent = 'Задание выполнено';
          labFooter.insertBefore(doneBadge, labFooter.firstChild);
        }
      }
    } catch (err) {
      console.error(err);
      const msg = err.message || '';
      const isAlreadyDone = msg.includes('Задание уже выполнено') || msg.includes('TASK_ALREADY_COMPLETED');
      showToast(isAlreadyDone ? 'Задание уже выполнено. Повторная отправка недоступна.' : 'Не удалось получить ответ. Попробуйте ещё раз.', 'error');
    } finally {
      generateBtn.classList.remove('disabled');
      loaderEl?.classList.add('hidden');
    }
  });
});


