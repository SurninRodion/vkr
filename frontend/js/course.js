import {
  apiGetCourse,
  apiGetCourseProgress,
  apiEnrollCourse,
  apiCompleteLesson,
  apiSubmitQuiz,
  apiCheckStepAnswer,
  apiSubmitCoursePractical,
  normalizeAnalysisToFive,
} from './api.js';
import { getAuthState } from './auth.js';
import { pluralRu } from './pluralize.js';
import { showToast } from './ui.js';

function escapeHtml(s) {
  const div = document.createElement('div');
  div.textContent = s ?? '';
  return div.innerHTML;
}

function nl2br(s) {
  return String(s ?? '').replace(/\n/g, '<br>');
}

function buildPracticalMap(progress) {
  const m = new Map();
  (progress.practicalSubmissions || []).forEach((p) => {
    if (p.lessonId && p.stepId) m.set(`${p.lessonId}::${p.stepId}`, p);
  });
  return m;
}

/** Панель с сохранённым ответом и результатом проверки GigaChat (как метрики в «Практике»). */
function renderPracticalFeedbackPanel(saved) {
  if (!saved || !saved.submissionText) return '';
  const a = saved.analysis || {};
  const metrics = normalizeAnalysisToFive(a);
  const comment = escapeHtml(a.aiResponse || '');
  const suggestions = escapeHtml(a.suggestions || '');
  const when = saved.updatedAt
    ? escapeHtml(new Date(saved.updatedAt).toLocaleString('ru-RU'))
    : '';
  return `
    <div class="lesson-practical-feedback-inner">
      ${when ? `<p class="lesson-practical-feedback-meta">Сохранено: ${when}</p>` : ''}
      <div class="lesson-practical-metrics" aria-label="Оценки по ответу">
        <span class="lesson-practical-metric">Ясность: <strong>${metrics.clarity}</strong>/5</span>
        <span class="lesson-practical-metric">Структура: <strong>${metrics.structure}</strong>/5</span>
        <span class="lesson-practical-metric">Конкретика: <strong>${metrics.specificity}</strong>/5</span>
        <span class="lesson-practical-metric">Эффективность: <strong>${metrics.effectiveness}</strong>/5</span>
      </div>
      ${comment ? `<p class="lesson-practical-comment">${comment}</p>` : ''}
      ${suggestions ? `<p class="lesson-practical-suggestions"><span class="lesson-practical-suggestions-label">Рекомендации:</span> ${suggestions}</p>` : ''}
    </div>
  `;
}

function renderStepBlock(step, stepIndex, lessonId, courseId, practicalSaved, progress, isAuthenticated) {
  const p = step.payload || {};
  const stepId = escapeHtml(step.id);
  const type = step.step_type || 'theory';
  let inner = '';
  switch (type) {
    case 'theory':
      inner = `
        <h4 class="lesson-step-title">${escapeHtml(p.title || 'Теория')}</h4>
        <div class="lesson-step-content">${nl2br(p.content || '')}</div>
      `;
      break;
    case 'video': {
      const url = (p.url || '').trim();
      const ytWatchMatch = url.match(new RegExp('youtube\\.com/watch\\?v=([^&]+)'));
      const ytBeMatch = url.match(new RegExp('youtu\\.be/([^?]+)'));
      const embedUrl = ytWatchMatch
        ? `https://www.youtube.com/embed/${ytWatchMatch[1]}`
        : ytBeMatch
          ? `https://www.youtube.com/embed/${ytBeMatch[1]}`
          : url;
      const isFileVideo =
        /^\/uploads\//i.test(url) ||
        /\.(mp4|webm|ogg|mov|m4v)(\?|#|$)/i.test(url);
      inner = `
        <h4 class="lesson-step-title">${escapeHtml(p.title || 'Видео')}</h4>
        ${
          url
            ? isFileVideo
              ? `<div class="lesson-step-video-wrap"><video controls preload="metadata" src="${escapeHtml(url)}"></video></div>`
              : `<div class="lesson-step-video-wrap"><iframe src="${escapeHtml(embedUrl)}" title="${escapeHtml(p.title || '')}" allowfullscreen></iframe></div>`
            : ''
        }
        ${p.description ? `<p class="lesson-step-desc">${nl2br(p.description)}</p>` : ''}
      `;
      break;
    }
    case 'test':
      const options = p.options || [];
      inner = `
        <h4 class="lesson-step-title">Вопрос</h4>
        <p class="lesson-step-question">${escapeHtml(p.question || '')}</p>
        <div class="lesson-step-options" data-step-id="${stepId}">
          ${options.map((opt, oi) => `
            <label class="lesson-step-option-label">
              <input type="radio" name="step-${stepId}" value="${oi}" />
              <span>${escapeHtml(opt)}</span>
            </label>
          `).join('')}
        </div>
        <button type="button" class="btn btn-outline btn-sm lesson-step-check" data-course-id="${escapeHtml(courseId)}" data-lesson-id="${escapeHtml(lessonId)}" data-step-id="${stepId}">Проверить</button>
        <p class="lesson-step-result" data-step-id="${stepId}" style="display:none;"></p>
      `;
      break;
    case 'practical': {
      const feedbackHtml = practicalSaved ? renderPracticalFeedbackPanel(practicalSaved) : '';
      let enrollHint = '';
      if (!isAuthenticated) {
        enrollHint =
          '<p class="muted lesson-practical-hint">Войдите и запишитесь на курс, чтобы отправить ответ на проверку.</p>';
      } else if (!progress.enrolled) {
        enrollHint = '<p class="muted lesson-practical-hint">Запишитесь на курс, чтобы отправить ответ.</p>';
      }
      const hasSubmitted =
        !!(practicalSaved && (practicalSaved.submissionText || practicalSaved.analysis));
      const submitBtn =
        progress.enrolled && isAuthenticated
          ? hasSubmitted
            ? `<button type="button" class="btn btn-outline btn-sm lesson-practical-retry" data-course-id="${escapeHtml(courseId)}" data-lesson-id="${escapeHtml(lessonId)}" data-step-id="${stepId}">Попробовать ещё раз</button>`
            : `<button type="button" class="btn btn-primary btn-sm lesson-practical-submit" data-course-id="${escapeHtml(courseId)}" data-lesson-id="${escapeHtml(lessonId)}" data-step-id="${stepId}">Отправить на проверку</button>`
          : '';
      const taLocked = hasSubmitted ? ' readonly class="lesson-step-practical-input form-input textarea lesson-step-practical-input--locked"' : ' class="lesson-step-practical-input form-input textarea"';
      inner = `
        <div class="lesson-step-practical-wrap">
          <h4 class="lesson-step-title">${escapeHtml(p.title || 'Практическое задание')}</h4>
          <div class="lesson-step-content">${nl2br(p.description || '')}</div>
          <textarea rows="4" placeholder="${escapeHtml(p.input_placeholder || 'Введите ваш ответ...')}"${taLocked}>${escapeHtml(practicalSaved?.submissionText || '')}</textarea>
          <div class="lesson-step-practical-actions">
            ${submitBtn}
            ${enrollHint}
          </div>
          <div class="lesson-step-practical-feedback">${feedbackHtml}</div>
        </div>
      `;
      break;
    }
    default:
      inner = `<div class="lesson-step-content">${escapeHtml(JSON.stringify(p))}</div>`;
  }
  return `
    <div class="lesson-step-block" data-step-index="${stepIndex}" data-step-id="${stepId}">
      <div class="lesson-step-body">${inner}</div>
      <button type="button" class="btn btn-outline btn-sm lesson-step-next" data-step-index="${stepIndex}" style="display:none;">Далее</button>
    </div>
  `;
}

function renderLessonSteps(
  lesson,
  lessonIndex,
  courseId,
  progress,
  completedSet,
  onlyStepId = null,
  practicalMap = null,
  isAuthenticated = false
) {
  const steps = (lesson.steps || []).slice().sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));
  if (!steps.length) return '';
  const map = practicalMap || new Map();
  const stepsHtml = steps.map((s, i) => {
    const saved = map.get(`${lesson.id}::${s.id}`);
    const block = renderStepBlock(s, i, lesson.id, courseId, saved, progress, isAuthenticated);
    if (onlyStepId && s.id !== onlyStepId) {
      return block.replace('<div class="lesson-step-block"', '<div class="lesson-step-block" style="display:none"');
    }
    return block;
  }).join('');
  const isCompleted = completedSet.has(lesson.id);
  const completeBtn = progress.enrolled && !isCompleted
    ? `<button type="button" class="btn btn-outline btn-sm lesson-complete lesson-complete-steps" data-lesson-id="${escapeHtml(lesson.id)}">Отметить урок пройденным</button>`
    : progress.enrolled && isCompleted
      ? '<span class="tag tag-green">Пройден</span>'
      : '';
  return `
    <div class="lesson-steps-container" data-lesson-id="${escapeHtml(lesson.id)}">
      ${stepsHtml}
      <div class="lesson-steps-complete-row" style="margin-top:12px">${completeBtn}</div>
    </div>
  `;
}

function getCourseId() {
  const params = new URLSearchParams(window.location.search);
  return params.get('id') || '';
}

function getModuleId() {
  const params = new URLSearchParams(window.location.search);
  return params.get('module') || '';
}

function getLessonId() {
  const params = new URLSearchParams(window.location.search);
  return params.get('lesson') || '';
}

function getStepId() {
  const params = new URLSearchParams(window.location.search);
  return params.get('step') || '';
}

function buildCourseUrl(courseId, opts = {}) {
  const u = new URL(window.location.href);
  u.searchParams.set('id', courseId);
  if (opts.module) u.searchParams.set('module', opts.module);
  else u.searchParams.delete('module');
  if (opts.lesson) u.searchParams.set('lesson', opts.lesson);
  else u.searchParams.delete('lesson');
  if (opts.step) u.searchParams.set('step', opts.step);
  else u.searchParams.delete('step');
  return u.pathname + u.search;
}

const STEP_TYPE_LABELS = { theory: 'Теория', video: 'Видео', test: 'Тест', practical: 'Практика' };
function getStepLabel(step) {
  const p = step.payload || {};
  const type = step.step_type || 'theory';
  const label = STEP_TYPE_LABELS[type] || type;
  const title = p.title || p.question || (type === 'theory' ? 'Теория' : type === 'video' ? 'Видео' : type === 'test' ? 'Вопрос' : 'Задание');
  return title ? `${label}: ${typeof title === 'string' && title.length > 40 ? title.slice(0, 40) + '…' : title}` : label;
}

function getModuleParamForEntry(entry) {
  if (!entry) return '';
  const { moduleId, moduleIndex } = entry;
  if (moduleId != null && moduleId !== '') return moduleId;
  return `m${(moduleIndex || 1) - 1}`;
}

function truncateNavLabel(s, max = 40) {
  const t = (s || '').trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

/** Упорядоченные «узлы» курса: шаг урока или урок без шагов. */
function buildCourseSequenceNodes(lessonsListFull) {
  const nodes = [];
  lessonsListFull.forEach((entry) => {
    const { lesson } = entry;
    const moduleParam = getModuleParamForEntry(entry);
    const steps = (lesson.steps || []).slice().sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));
    if (steps.length > 0) {
      steps.forEach((s) => {
        nodes.push({
          type: 'step',
          lessonId: lesson.id,
          stepId: s.id,
          moduleParam,
          shortLabel: getStepLabel(s),
        });
      });
    } else {
      nodes.push({
        type: 'lesson',
        lessonId: lesson.id,
        stepId: null,
        moduleParam,
        shortLabel: lesson.title || 'Урок',
      });
    }
  });
  return nodes;
}

function nodeToUrl(courseId, node) {
  if (node.type === 'step') {
    return buildCourseUrl(courseId, {
      module: node.moduleParam,
      lesson: node.lessonId,
      step: node.stepId,
    });
  }
  return buildCourseUrl(courseId, {
    module: node.moduleParam,
    lesson: node.lessonId,
  });
}

function findSequenceIndex(nodes, lessonId, stepId) {
  if (!lessonId) return -1;
  if (stepId) {
    const i = nodes.findIndex((n) => n.lessonId === lessonId && n.stepId === stepId);
    if (i >= 0) return i;
  }
  return nodes.findIndex((n) => n.lessonId === lessonId);
}

/**
 * Навигация «назад / вперёд» по программе курса в конце карточки урока.
 * @param activeLessonId — текущий урок из URL (пусто: список нескольких уроков на странице).
 * @param activeStepId — текущий шаг из URL.
 */
function renderLessonNavRow(courseId, lessonsListFull, itemLessonId, activeLessonId, activeStepId) {
  const nodes = buildCourseSequenceNodes(lessonsListFull);
  if (!nodes.length) return '';
  const overviewUrl = buildCourseUrl(courseId);

  let prevNode = null;
  let nextNode = null;

  if (activeLessonId && itemLessonId === activeLessonId) {
    const curIdx = findSequenceIndex(nodes, activeLessonId, activeStepId || null);
    if (curIdx < 0) return '';
    prevNode = curIdx > 0 ? nodes[curIdx - 1] : null;
    nextNode = curIdx < nodes.length - 1 ? nodes[curIdx + 1] : null;
  } else if (!activeLessonId) {
    const idxs = [];
    nodes.forEach((n, i) => {
      if (n.lessonId === itemLessonId) idxs.push(i);
    });
    if (!idxs.length) return '';
    const start = idxs[0];
    const end = idxs[idxs.length - 1];
    prevNode = start > 0 ? nodes[start - 1] : null;
    nextNode = end < nodes.length - 1 ? nodes[end + 1] : null;
  } else {
    return '';
  }

  const prevUrl = prevNode ? nodeToUrl(courseId, prevNode) : overviewUrl;
  const nextUrl = nextNode ? nodeToUrl(courseId, nextNode) : overviewUrl;
  const prevText = prevNode ? `← ${truncateNavLabel(prevNode.shortLabel)}` : '← Содержание курса';
  const nextText = nextNode ? `${truncateNavLabel(nextNode.shortLabel)} →` : 'Содержание курса →';

  return `
    <nav class="course-lesson-nav" aria-label="Переход к соседним разделам курса">
      <a href="${escapeHtml(prevUrl)}" class="btn btn-outline course-lesson-nav-btn course-nav-link">${escapeHtml(prevText)}</a>
      <a href="${escapeHtml(nextUrl)}" class="btn btn-outline course-lesson-nav-btn course-nav-link">${escapeHtml(nextText)}</a>
    </nav>
  `;
}

document.addEventListener('DOMContentLoaded', async () => {
  const root = document.getElementById('course-root');
  if (!root) return;

  function syncProgramSidebarHeight() {
    const sidebar = root.querySelector('.course-nav-sidebar');
    const content = root.querySelector('.profile-main');
    if (!sidebar || !content) return;
    const h = Math.max(240, Math.round(content.getBoundingClientRect().height || 0));
    sidebar.style.setProperty('--course-nav-max-h', `${h}px`);
  }

  const courseId = getCourseId();
  if (!courseId) {
    root.innerHTML = '<p class="muted">Курс не выбран. <a href="/courses">Перейти к списку курсов</a></p>';
    document.title = 'Курс — Prompt Academy';
    return;
  }

  try {
    const { isAuthenticated } = getAuthState();
    const [course, progressRes] = await Promise.all([
      apiGetCourse(courseId),
      isAuthenticated ? apiGetCourseProgress(courseId).catch(() => null) : Promise.resolve(null),
    ]);

    let progress = {
      enrolled: false,
      completedLessonIds: [],
      totalLessons: 0,
      practicalSubmissions: [],
      ...(progressRes || {}),
    };
    const completedSet = new Set(progress.completedLessonIds || []);
    const practicalMap = buildPracticalMap(progress);
    let viewModuleId = getModuleId();
    let viewLessonId = getLessonId();
    let viewStepId = getStepId();

    const modulesForNav = (course.modules && course.modules.length > 0)
      ? course.modules
      : [{ id: null, title: 'Модуль 1', lessons: course.lessons || [] }];

    const lessonsListForCount = (course.modules && course.modules.length > 0)
      ? course.modules.flatMap((mod) => mod.lessons || [])
      : course.lessons || [];
    const totalLessons = lessonsListForCount.length;
    const completedCount = progress.completedLessonIds?.length || 0;
    const progressPercent = totalLessons > 0 ? Math.round((completedCount / totalLessons) * 100) : 0;

    const baseUrl = buildCourseUrl(courseId);
    const navModulesHtml = modulesForNav.map((mod, mi) => {
      const modId = mod.id || `m${mi}`;
      const modUrl = buildCourseUrl(courseId, { module: mod.id || modId });
      const modTitle = escapeHtml(mod.title || `Модуль ${mi + 1}`);
      const lessons = mod.lessons || [];
      const lessonsNavHtml = lessons.map((les, li) => {
        const lessonUrl = buildCourseUrl(courseId, { lesson: les.id });
        const steps = (les.steps || []).slice().sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));
        const stepsNavHtml = steps.map((s) => {
          const stepUrl = buildCourseUrl(courseId, { lesson: les.id, step: s.id });
          return `<li class="course-nav-step"><a href="${escapeHtml(stepUrl)}" class="course-nav-link course-nav-link--step">${escapeHtml(getStepLabel(s))}</a></li>`;
        }).join('');
        return `
          <li class="course-nav-lesson">
            <a href="${escapeHtml(lessonUrl)}" class="course-nav-link course-nav-link--lesson">${escapeHtml(les.title || `Урок ${li + 1}`)}</a>
            ${steps.length ? `<ul class="course-nav-steps">${stepsNavHtml}</ul>` : ''}
          </li>
        `;
      }).join('');
      return `
        <li class="course-nav-module">
          <a href="${escapeHtml(modUrl)}" class="course-nav-link course-nav-link--module">${modTitle}</a>
          <ul class="course-nav-lessons">${lessonsNavHtml}</ul>
        </li>
      `;
    }).join('');

    const courseNavSidebar = `
      <nav class="course-nav-sidebar" aria-label="Навигация по курсу">
        <h2 class="course-nav-title">Программа</h2>
        <a href="${escapeHtml(baseUrl)}" class="course-nav-link course-nav-link--all">Содержание и описание</a>
        <ul class="course-nav-modules">
          ${navModulesHtml}
        </ul>
      </nav>
    `;

    const lessonsListFull = (course.modules && course.modules.length > 0)
      ? course.modules.flatMap((mod, mi) => (mod.lessons || []).map((l) => ({ lesson: l, moduleIndex: mi + 1, moduleId: mod.id, moduleTitle: mod.title || `Модуль ${mi + 1}` })))
      : (course.lessons || []).map((lesson, i) => ({ lesson, moduleIndex: i + 1, moduleId: null, moduleTitle: `Модуль ${i + 1}` }));

    function computeAllowedLessonIds() {
      if (!progress.enrolled) return new Set();
      const ordered = lessonsListFull.map((x) => x.lesson?.id).filter(Boolean);
      if (!ordered.length) return new Set();
      const firstNotDone = ordered.find((id) => !completedSet.has(id)) || null;
      const allowUpTo = firstNotDone ? ordered.indexOf(firstNotDone) : ordered.length - 1;
      const allowed = new Set();
      ordered.forEach((id, idx) => {
        if (idx <= allowUpTo) allowed.add(id);
      });
      return allowed;
    }

    function pickNextAllowedLessonId() {
      const ordered = lessonsListFull.map((x) => x.lesson?.id).filter(Boolean);
      if (!ordered.length) return '';
      return ordered.find((id) => !completedSet.has(id)) || ordered[0] || '';
    }

    // Гейт: пока пользователь НЕ записан на курс — показываем только обзор.
    if (!progress.enrolled) {
      viewModuleId = '';
      viewLessonId = '';
      viewStepId = '';
    }

    let allowedLessonIds = computeAllowedLessonIds();

    let lessonsList = lessonsListFull;
    if (viewLessonId) {
      lessonsList = lessonsList.filter(({ lesson }) => lesson.id === viewLessonId);
    } else if (viewModuleId) {
      const modIndex = viewModuleId.match(/^m(\d+)$/)?.[1];
      lessonsList = lessonsList.filter(({ moduleId, moduleIndex }) =>
        String(moduleId) === String(viewModuleId) || (modIndex != null && moduleIndex === parseInt(modIndex, 10) + 1)
      );
    }

    const currentModule = viewLessonId && lessonsList.length ? lessonsList[0] : (viewModuleId && lessonsList.length ? lessonsList[0] : null);
    function buildBreadcrumb(moduleId, lessonId, stepId, mod, lessList) {
      const parts = [`<a href="${escapeHtml(baseUrl)}" class="course-breadcrumb-link">${escapeHtml(course.title)}</a>`];
      if (mod?.moduleTitle) {
        const modUrl = buildCourseUrl(courseId, { module: mod.moduleId || `m${(mod.moduleIndex || 1) - 1}` });
        parts.push(`<a href="${escapeHtml(modUrl)}" class="course-breadcrumb-link">${escapeHtml(mod.moduleTitle)}</a>`);
      }
      if (lessonId && lessList?.length) {
        parts.push(`<span class="course-breadcrumb-current">${escapeHtml(lessList[0].lesson.title)}</span>`);
      } else if (moduleId && mod) {
        parts.push(`<span class="course-breadcrumb-current">${escapeHtml(mod.moduleTitle)}</span>`);
      }
      return parts.length > 1 ? `<nav class="course-breadcrumb" aria-label="Хлебные крошки">${parts.join(' <span class="course-breadcrumb-sep">›</span> ')}</nav>` : '';
    }
    const breadcrumbHtml = buildBreadcrumb(viewModuleId, viewLessonId, viewStepId, currentModule, lessonsList);

    document.title = viewLessonId && lessonsList.length
      ? `${lessonsList[0].lesson.title} — ${course.title} — Prompt Academy`
      : viewModuleId
        ? `${currentModule?.moduleTitle || 'Модуль'} — ${course.title} — Prompt Academy`
        : `${course.title} — Prompt Academy`;

    const progressBlock =
      progress.enrolled && totalLessons > 0
        ? `
      <div class="stat-row">
        <span class="stat-label">Прогресс по курсу</span>
        <span class="stat-value">${progressPercent}%</span>
      </div>
      <div class="progress-bar-track" style="margin: 10px 0 16px">
        <div class="progress-bar-fill" style="transform: scaleX(${progressPercent / 100})"></div>
      </div>
    `
        : '';

    const hasQuiz = (lesson) => Array.isArray(lesson.quiz) && lesson.quiz.length > 0;
    const hasSteps = (lesson) => Array.isArray(lesson.steps) && lesson.steps.length > 0;
    const attachmentsHtml = (attachments) => {
      if (!attachments?.length) return '';
      return `
        <div class="lesson-attachments">
          ${attachments
            .map((a) => {
              const isImg = (a.mime_type || '').startsWith('image/');
              if (isImg) return `<img src="${escapeHtml(a.url)}" alt="${escapeHtml(a.original_name)}" class="lesson-attachment-img" loading="lazy" />`;
              return `<a href="${escapeHtml(a.url)}" target="_blank" rel="noopener" class="lesson-attachment-link">${escapeHtml(a.original_name)}</a>`;
            })
            .join('')}
        </div>
      `;
    };

    const lessonsHtml = lessonsList
      .map(({ lesson, moduleIndex, moduleTitle }, i) => {
        const isCompleted = completedSet.has(lesson.id);
        const isLocked = !progress.enrolled || (allowedLessonIds.size && !allowedLessonIds.has(lesson.id));
        const lessonHasQuiz = hasQuiz(lesson);
        const lessonHasSteps = hasSteps(lesson);
        let completeBtn = '';
        if (!isLocked && !lessonHasSteps) {
          if (progress.enrolled && !isCompleted) {
            completeBtn = lessonHasQuiz
              ? `<button type="button" class="btn btn-outline btn-sm lesson-quiz-trigger" data-lesson-id="${escapeHtml(lesson.id)}">Пройти тест</button>`
              : `<button type="button" class="btn btn-outline btn-sm lesson-complete" data-lesson-id="${escapeHtml(lesson.id)}">Отметить пройденным</button>`;
          } else if (progress.enrolled && isCompleted) {
            completeBtn = '<span class="tag tag-green">Пройден</span>';
          }
        }
        const lockedHintHtml = isLocked
          ? `<p class="course-lesson-locked-hint">🔒 Этот урок откроется последовательно после прохождения предыдущих.</p>`
          : '';
        const contentHtml = !isLocked && !lessonHasSteps && lesson.content
          ? `<div class="lesson-content">${escapeHtml(lesson.content)}</div>`
          : '';
        const attHtml = !isLocked ? attachmentsHtml(lesson.attachments) : '';
        const quizBlock = !isLocked && !lessonHasSteps && lessonHasQuiz && progress.enrolled && !isCompleted
            ? `
          <div class="lesson-quiz-block" data-lesson-id="${escapeHtml(lesson.id)}" style="display:none;">
            <div class="quiz-questions">
              ${(lesson.quiz || [])
                .map(
                  (q, qi) => `
                <div class="quiz-q" data-q-index="${qi}">
                  <div class="quiz-q-text">${escapeHtml(q.question_text)}</div>
                  <div class="quiz-options">
                    ${(q.options || [])
                      .map(
                        (opt, oi) => `
                      <label class="quiz-option-label">
                        <input type="radio" name="quiz-${escapeHtml(lesson.id)}-${qi}" value="${oi}" />
                        <span>${escapeHtml(opt)}</span>
                      </label>
                    `
                      )
                      .join('')}
                  </div>
                </div>
              `
                )
                .join('')}
            </div>
            <button type="button" class="btn btn-primary btn-sm quiz-submit" data-lesson-id="${escapeHtml(lesson.id)}">Отправить ответы</button>
          </div>
        `
            : '';
        const stepsHtml = !isLocked && lessonHasSteps
          ? renderLessonSteps(
              lesson,
              i,
              courseId,
              progress,
              completedSet,
              viewStepId || null,
              practicalMap,
              isAuthenticated
            )
          : '';
        const navHtml = !isLocked
          ? renderLessonNavRow(courseId, lessonsListFull, lesson.id, viewLessonId, viewStepId)
          : '';
        return `
        <li class="course-lesson-item${isLocked ? ' course-lesson-item--locked' : ''}" data-lesson-id="${escapeHtml(lesson.id)}">
          <div class="course-lesson-header">
            <span class="stat-label">${escapeHtml(moduleTitle || `Модуль ${moduleIndex}`)}</span>
            <span class="stat-value">${escapeHtml(lesson.title)}</span>
            ${isLocked ? '<span class="tag">🔒 Закрыт</span>' : (!lessonHasSteps ? completeBtn : '')}
          </div>
          ${lockedHintHtml}
          ${contentHtml}
          ${attHtml}
          ${quizBlock}
          ${stepsHtml}
          ${navHtml}
        </li>
      `;
      })
      .join('');

    const isOverview = !viewModuleId && !viewLessonId;
    const overviewHtml = `
      <div class="course-overview-description card">
        <h2 class="section-title" style="font-size: 18px; margin-top: 0">О курсе</h2>
        <div class="lesson-content">${nl2br(course.description || 'Описание курса отсутствует.')}</div>
      </div>
      <div class="course-overview-toc card">
        <h2 class="section-title" style="font-size: 18px">Содержание курса</h2>
        <p class="card-description">Выберите модуль или урок в меню слева, чтобы открыть материал.</p>
        <ul class="course-overview-modules">
          ${modulesForNav.map((mod, mi) => {
            const modId = mod.id || `m${mi}`;
            const modUrl = buildCourseUrl(courseId, { module: mod.id || modId });
            const modTitle = escapeHtml(mod.title || `Модуль ${mi + 1}`);
            const lessons = mod.lessons || [];
            const lessonsListItems = lessons.map((les) => {
              const lessonUrl = buildCourseUrl(courseId, { lesson: les.id });
              return `<li><a href="${escapeHtml(lessonUrl)}" class="course-nav-link">${escapeHtml(les.title || 'Урок')}</a></li>`;
            }).join('');
            return `<li class="course-overview-module"><strong><a href="${escapeHtml(modUrl)}" class="course-nav-link">${modTitle}</a></strong><ul>${lessonsListItems}</ul></li>`;
          }).join('')}
        </ul>
      </div>
    `;

    const sectionTitle = isOverview
      ? 'Содержание и описание'
      : viewLessonId && lessonsList.length
        ? lessonsList[0].lesson.title
        : viewModuleId
          ? (currentModule?.moduleTitle || 'Модуль')
          : 'Содержание курса';

    const dynamicContentHtml = isOverview
      ? progressBlock + overviewHtml
      : progressBlock + `
          <div class="section-header" style="margin-top: 8px">
            <h2 class="section-title" style="font-size: 18px">${escapeHtml(sectionTitle)}</h2>
          </div>
          <div class="card course-lessons-card">
            <ul class="course-lessons-list">
              ${lessonsHtml}
            </ul>
          </div>
        `;

    root.innerHTML = `
      <div class="page-header">
        <div>
          <h1 class="page-title">${escapeHtml(course.title)}</h1>
        </div>
        <div class="filters">
          <span class="tag tag-green">${totalLessons} ${pluralRu(totalLessons, ['урок', 'урока', 'уроков'])}</span>
          ${
            isAuthenticated && !progress.enrolled
              ? `<button type="button" class="btn btn-primary btn-sm" id="course-enroll-btn">Записаться на курс</button>`
              : ''
          }
        </div>
      </div>

      <div class="course-layout">
        <aside class="course-nav-wrap">
          ${courseNavSidebar}
        </aside>
        <div class="course-content-wrap">
          <div id="course-breadcrumb-wrap">${breadcrumbHtml}</div>
          <div class="profile-layout profile-layout--course">
            <div class="profile-main">
              <div id="course-dynamic-content">
                ${dynamicContentHtml}
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    // Sidebar should match content window height; overflow scrolls inside.
    syncProgramSidebarHeight();
    window.addEventListener('resize', () => syncProgramSidebarHeight());
    applySequentialLocksToProgram();

    const enrollBtn = root.querySelector('#course-enroll-btn');
    if (enrollBtn) {
      enrollBtn.addEventListener('click', async () => {
        enrollBtn.disabled = true;
        try {
          await apiEnrollCourse(courseId);
          showToast('Вы записаны на курс.', 'success');
          window.location.reload();
        } catch (e) {
          showToast(e.message || 'Не удалось записаться.', 'error');
          enrollBtn.disabled = false;
        }
      });
    }

    function setActiveNavLink() {
      const current = window.location.pathname + (window.location.search || '');
      root.querySelectorAll('.course-nav-wrap .course-nav-link').forEach((a) => {
        try {
          const linkPath = a.href ? new URL(a.href).pathname + (new URL(a.href).search || '') : '';
          a.classList.toggle('course-nav-link--active', linkPath === current);
        } catch (_) {}
      });
    }

    function applySequentialLocksToProgram() {
      const allLinks = root.querySelectorAll('.course-nav-wrap a.course-nav-link');
      allLinks.forEach((a) => {
        const href = a.getAttribute('href') || '';
        if (!href) return;
        let locked = false;
        try {
          const u = new URL(href, window.location.href);
          const lid = u.searchParams.get('lesson') || '';
          const isOverview = !u.searchParams.get('module') && !lid;
          if (isOverview) locked = false;
          else if (!progress.enrolled) locked = true;
          else if (lid && !allowedLessonIds.has(lid)) locked = true;
        } catch (_) {}

        if (locked) {
          a.dataset.locked = '1';
          a.setAttribute('aria-disabled', 'true');
          a.setAttribute('tabindex', '-1');
          a.classList.add('course-nav-link--locked');
        } else {
          a.removeAttribute('data-locked');
          a.removeAttribute('aria-disabled');
          a.removeAttribute('tabindex');
          a.classList.remove('course-nav-link--locked');
        }
      });
    }

    function updateContentView(moduleId, lessonId, stepId, replace) {
      // Гейт (не записан) — всегда только обзор
      if (!progress.enrolled) {
        moduleId = '';
        lessonId = '';
        stepId = '';
      } else if (lessonId && !allowedLessonIds.has(lessonId)) {
        // Последовательное открытие: редиректим на ближайший доступный урок
        const nextAllowed = pickNextAllowedLessonId();
        moduleId = '';
        lessonId = nextAllowed || '';
        stepId = '';
      }

      let list = lessonsListFull;
      if (lessonId) list = list.filter(({ lesson }) => lesson.id === lessonId);
      else if (moduleId) {
        const modIndex = moduleId.match(/^m(\d+)$/)?.[1];
        list = list.filter(({ moduleId: mid, moduleIndex }) =>
          String(mid) === String(moduleId) || (modIndex != null && moduleIndex === parseInt(modIndex, 10) + 1)
        );
      }
      const curMod = list.length ? list[0] : null;
      const isOverview = !moduleId && !lessonId;
      document.title = lessonId && list.length
        ? `${list[0].lesson.title} — ${course.title} — Prompt Academy`
        : moduleId
          ? `${curMod?.moduleTitle || 'Модуль'} — ${course.title} — Prompt Academy`
          : `${course.title} — Prompt Academy`;
      const newUrl = buildCourseUrl(courseId, { module: moduleId || undefined, lesson: lessonId || undefined, step: stepId || undefined });
      if (replace) {
        window.history.replaceState({ moduleId, lessonId, stepId }, '', newUrl);
      } else {
        window.history.pushState({ moduleId, lessonId, stepId }, '', newUrl);
      }
      const breadcrumbHtmlNew = buildBreadcrumb(moduleId, lessonId, stepId, curMod, list);
      const breadcrumbWrap = document.getElementById('course-breadcrumb-wrap');
      if (breadcrumbWrap) breadcrumbWrap.innerHTML = breadcrumbHtmlNew;
      setActiveNavLink();
      applySequentialLocksToProgram();

      const sectionTitleNew = isOverview
        ? 'Содержание и описание'
        : list.length ? list[0].lesson.title : (curMod?.moduleTitle || 'Модуль');
      const overviewHtmlNew = `
        <div class="course-overview-description card">
          <h2 class="section-title" style="font-size: 18px; margin-top: 0">О курсе</h2>
          <div class="lesson-content">${nl2br(course.description || 'Описание курса отсутствует.')}</div>
        </div>
        <div class="course-overview-toc card">
          <h2 class="section-title" style="font-size: 18px">Содержание курса</h2>
          <p class="card-description">Выберите модуль или урок в меню слева, чтобы открыть материал.</p>
          <ul class="course-overview-modules">
            ${modulesForNav.map((mod, mi) => {
              const modId = mod.id || `m${mi}`;
              const modUrl = buildCourseUrl(courseId, { module: mod.id || modId });
              const modTitle = escapeHtml(mod.title || `Модуль ${mi + 1}`);
              const lessons = mod.lessons || [];
              const items = lessons.map((les) => {
                const lessonUrl = buildCourseUrl(courseId, { lesson: les.id });
                return `<li><a href="${escapeHtml(lessonUrl)}" class="course-nav-link">${escapeHtml(les.title || 'Урок')}</a></li>`;
              }).join('');
              return `<li class="course-overview-module"><strong><a href="${escapeHtml(modUrl)}" class="course-nav-link">${modTitle}</a></strong><ul>${items}</ul></li>`;
            }).join('')}
          </ul>
        </div>
      `;
      const lessonsHtmlNew = list.map(({ lesson, moduleIndex, moduleTitle }, i) => {
        const isCompleted = completedSet.has(lesson.id);
        const isLocked = !progress.enrolled || (allowedLessonIds.size && !allowedLessonIds.has(lesson.id));
        const lessonHasQuiz = hasQuiz(lesson);
        const lessonHasSteps = hasSteps(lesson);
        let completeBtn = '';
        if (!isLocked && !lessonHasSteps) {
          if (progress.enrolled && !isCompleted) {
            completeBtn = lessonHasQuiz
              ? `<button type="button" class="btn btn-outline btn-sm lesson-quiz-trigger" data-lesson-id="${escapeHtml(lesson.id)}">Пройти тест</button>`
              : `<button type="button" class="btn btn-outline btn-sm lesson-complete" data-lesson-id="${escapeHtml(lesson.id)}">Отметить пройденным</button>`;
          } else if (progress.enrolled && isCompleted) {
            completeBtn = '<span class="tag tag-green">Пройден</span>';
          }
        }
        const lockedHintHtml = isLocked
          ? `<p class="course-lesson-locked-hint">🔒 Этот урок откроется последовательно после прохождения предыдущих.</p>`
          : '';
        const contentHtml = !isLocked && !lessonHasSteps && lesson.content ? `<div class="lesson-content">${escapeHtml(lesson.content)}</div>` : '';
        const attHtml = !isLocked ? attachmentsHtml(lesson.attachments) : '';
        const quizBlock = !isLocked && !lessonHasSteps && lessonHasQuiz && progress.enrolled && !isCompleted ? `
          <div class="lesson-quiz-block" data-lesson-id="${escapeHtml(lesson.id)}" style="display:none;">
            <div class="quiz-questions">
              ${(lesson.quiz || []).map((q, qi) => `
                <div class="quiz-q" data-q-index="${qi}">
                  <div class="quiz-q-text">${escapeHtml(q.question_text)}</div>
                  <div class="quiz-options">
                    ${(q.options || []).map((opt, oi) => `
                      <label class="quiz-option-label">
                        <input type="radio" name="quiz-${escapeHtml(lesson.id)}-${qi}" value="${oi}" />
                        <span>${escapeHtml(opt)}</span>
                      </label>
                    `).join('')}
                  </div>
                </div>
              `).join('')}
            </div>
            <button type="button" class="btn btn-primary btn-sm quiz-submit" data-lesson-id="${escapeHtml(lesson.id)}">Отправить ответы</button>
          </div>
        ` : '';
        const practicalMapNav = buildPracticalMap(progress);
        const stepsHtmlNew = !isLocked && lessonHasSteps
          ? renderLessonSteps(
              lesson,
              i,
              courseId,
              progress,
              completedSet,
              stepId || null,
              practicalMapNav,
              isAuthenticated
            )
          : '';
        const navHtmlNew = !isLocked ? renderLessonNavRow(courseId, lessonsListFull, lesson.id, lessonId, stepId) : '';
        return `
          <li class="course-lesson-item${isLocked ? ' course-lesson-item--locked' : ''}" data-lesson-id="${escapeHtml(lesson.id)}">
            <div class="course-lesson-header">
              <span class="stat-label">${escapeHtml(moduleTitle || `Модуль ${moduleIndex}`)}</span>
              <span class="stat-value">${escapeHtml(lesson.title)}</span>
              ${isLocked ? '<span class="tag">🔒 Закрыт</span>' : (!lessonHasSteps ? completeBtn : '')}
            </div>
            ${lockedHintHtml}
            ${contentHtml}
            ${attHtml}
            ${quizBlock}
            ${stepsHtmlNew}
            ${navHtmlNew}
          </li>
        `;
      }).join('');

      const contentHtmlNew = isOverview
        ? progressBlock + overviewHtmlNew
        : progressBlock + `
          <div class="section-header" style="margin-top: 8px">
            <h2 class="section-title" style="font-size: 18px">${escapeHtml(sectionTitleNew)}</h2>
          </div>
          <div class="card course-lessons-card">
            <ul class="course-lessons-list">
              ${lessonsHtmlNew}
            </ul>
          </div>
        `;
      const contentEl = document.getElementById('course-dynamic-content');
      if (contentEl) contentEl.innerHTML = contentHtmlNew;
      initStepsVisibility();
      attachContentListeners();
      syncProgramSidebarHeight();
    }

    function refreshLessonNavs() {
      const lid = getLessonId();
      const sid = getStepId();
      root.querySelectorAll('.course-lesson-item').forEach((item) => {
        const itemLessonId = item.getAttribute('data-lesson-id');
        const nav = item.querySelector('.course-lesson-nav');
        if (!nav) return;
        const newHtml = renderLessonNavRow(courseId, lessonsListFull, itemLessonId, lid, sid);
        if (newHtml) {
          nav.outerHTML = newHtml;
        } else {
          nav.remove();
        }
      });
    }

    function attachContentListeners() {
      root.querySelectorAll('.lesson-step-next').forEach((btn) => {
        btn.addEventListener('click', () => {
          const block = btn.closest('.lesson-step-block');
          const container = block?.closest('.lesson-steps-container');
          if (!container) return;
          const blocks = container.querySelectorAll('.lesson-step-block');
          const idx = Array.from(blocks).indexOf(block);
          block.style.display = 'none';
          if (blocks[idx + 1]) {
            blocks[idx + 1].style.display = 'block';
            const lessonId = container.getAttribute('data-lesson-id');
            const entry = lessonsListFull.find(({ lesson }) => lesson.id === lessonId);
            const modParam = entry ? getModuleParamForEntry(entry) : '';
            const nextStepId = blocks[idx + 1].getAttribute('data-step-id');
            if (lessonId && nextStepId) {
              const url = buildCourseUrl(courseId, { module: modParam, lesson: lessonId, step: nextStepId });
              window.history.replaceState({ moduleId: modParam, lessonId, stepId: nextStepId }, '', url);
              setActiveNavLink();
              refreshLessonNavs();
            }
          }
        });
      });
      root.querySelectorAll('.lesson-step-check').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const stepId = btn.getAttribute('data-step-id');
          const lessonId = btn.getAttribute('data-lesson-id');
          const courseIdParam = btn.getAttribute('data-course-id');
          if (!stepId || !lessonId || !courseIdParam) return;
          const optionsWrap = btn.closest('.lesson-step-block')?.querySelector('.lesson-step-options');
          const radio = optionsWrap?.querySelector('input[type="radio"]:checked');
          if (!radio) { showToast('Выберите вариант ответа.', 'error'); return; }
          btn.disabled = true;
          try {
            const result = await apiCheckStepAnswer(courseIdParam, lessonId, stepId, parseInt(radio.value, 10));
            const resultEl = btn.closest('.lesson-step-block')?.querySelector(`.lesson-step-result[data-step-id="${stepId}"]`);
            if (resultEl) {
              resultEl.style.display = 'block';
              resultEl.textContent = result.correct ? 'Верно!' : 'Неверно. Попробуйте ещё раз.';
              resultEl.style.color = result.correct ? 'var(--color-success, #059669)' : 'var(--color-error, #b91c1c)';
            }
            if (result.correct) {
              btn.style.display = 'none';
              const nextBtn = btn.closest('.lesson-step-block')?.querySelector('.lesson-step-next');
              if (nextBtn) nextBtn.style.display = 'inline-block';
            }
          } catch (e) { showToast(e.message || 'Ошибка проверки.', 'error'); }
          finally { btn.disabled = false; }
        });
      });
      root.querySelectorAll('.lesson-complete-steps, .lesson-complete').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const lessonId = btn.getAttribute('data-lesson-id');
          if (!lessonId) return;
          btn.disabled = true;
          try {
            await apiCompleteLesson(courseId, lessonId);
            showToast('Урок отмечен как пройденный.', 'success');
            markLessonComplete(lessonId);
          } catch (e) {
            showToast(e.message || 'Ошибка сохранения.', 'error');
            btn.disabled = false;
          }
        });
      });
      root.querySelectorAll('.lesson-quiz-trigger').forEach((btn) => {
        btn.addEventListener('click', () => {
          const lessonId = btn.getAttribute('data-lesson-id');
          const block = root.querySelector(`.lesson-quiz-block[data-lesson-id="${lessonId}"]`);
          if (block) block.style.display = block.style.display === 'none' ? 'block' : 'none';
        });
      });
      root.querySelectorAll('.quiz-submit').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const lessonId = btn.getAttribute('data-lesson-id');
          const block = root.querySelector(`.lesson-quiz-block[data-lesson-id="${lessonId}"]`);
          if (!block) return;
          const questions = block.querySelectorAll('.quiz-q');
          const answers = [];
          questions.forEach((qEl) => {
            const radio = qEl.querySelector('input[type="radio"]:checked');
            answers.push(radio ? parseInt(radio.value, 10) : -1);
          });
          if (answers.some((a) => a < 0)) { showToast('Ответьте на все вопросы.', 'error'); return; }
          btn.disabled = true;
          try {
            const result = await apiSubmitQuiz(courseId, lessonId, answers);
            if (result.passed) {
              showToast(result.message || 'Тест пройден. Урок завершён.', 'success');
              markLessonComplete(lessonId);
            } else {
              showToast(result.message || `Порог не достигнут (${result.score}%).`, 'error');
              btn.disabled = false;
            }
          } catch (e) { showToast(e.message || 'Ошибка отправки.', 'error'); btn.disabled = false; }
        });
      });
      attachPracticalStepListenersOnce();
    }

    function attachPracticalStepListenersOnce() {
      if (root.dataset.practicalStepBound === '1') return;
      root.dataset.practicalStepBound = '1';

      root.addEventListener('click', async (e) => {
        const retryBtn = e.target.closest('.lesson-practical-retry');
        if (retryBtn) {
          e.preventDefault();
          const wrap = retryBtn.closest('.lesson-step-practical-wrap');
          const ta = wrap?.querySelector('.lesson-step-practical-input');
          if (ta) {
            ta.readOnly = false;
            ta.removeAttribute('readonly');
            ta.classList.remove('lesson-step-practical-input--locked');
            ta.focus();
          }
          retryBtn.textContent = 'Отправить на проверку';
          retryBtn.classList.remove('lesson-practical-retry', 'btn-outline');
          retryBtn.classList.add('lesson-practical-submit', 'btn-primary');
          return;
        }

        const btn = e.target.closest('.lesson-practical-submit');
        if (!btn || !root.contains(btn)) return;

        const lessonId = btn.getAttribute('data-lesson-id');
        const practicalStepId = btn.getAttribute('data-step-id');
        const wrap = btn.closest('.lesson-step-practical-wrap');
        const ta = wrap?.querySelector('.lesson-step-practical-input');
        const text = (ta?.value || '').trim();
        if (!text) {
          showToast('Введите ответ.', 'error');
          return;
        }
        btn.disabled = true;
        try {
          const result = await apiSubmitCoursePractical(courseId, lessonId, practicalStepId, text);
          const feedbackEl = wrap?.querySelector('.lesson-step-practical-feedback');
          if (feedbackEl) {
            const savedLike = {
              submissionText: result.submissionText,
              analysis: result.analysisRaw,
              score: result.score,
              updatedAt: new Date().toISOString(),
            };
            feedbackEl.innerHTML = renderPracticalFeedbackPanel(savedLike);
          }
          if (ta) {
            ta.readOnly = true;
            ta.classList.add('lesson-step-practical-input--locked');
          }
          btn.textContent = 'Попробовать ещё раз';
          btn.classList.remove('lesson-practical-submit', 'btn-primary');
          btn.classList.add('lesson-practical-retry', 'btn-outline');

          progress.practicalSubmissions = progress.practicalSubmissions || [];
          const idx = progress.practicalSubmissions.findIndex(
            (p) => p.lessonId === lessonId && p.stepId === practicalStepId
          );
          const entry = {
            lessonId,
            stepId: practicalStepId,
            submissionText: result.submissionText,
            analysis: result.analysisRaw,
            score: result.score,
            updatedAt: new Date().toISOString(),
          };
          if (idx >= 0) progress.practicalSubmissions[idx] = entry;
          else progress.practicalSubmissions.push(entry);
          showToast('Ответ сохранён и проверен.', 'success');
        } catch (err) {
          showToast(err.message || 'Не удалось отправить ответ.', 'error');
        } finally {
          btn.disabled = false;
        }
      });
    }

    root.addEventListener('click', (e) => {
      const link = e.target.closest('a.course-nav-link');
      if (!link || !link.href || (link.getAttribute('href') || '').indexOf(courseId) === -1) return;
      if (!link.closest('.course-layout')) return;
      if (link.dataset.locked === '1') {
        e.preventDefault();
        showToast(
          progress.enrolled
            ? 'Раздел откроется после прохождения предыдущих уроков.'
            : 'Запишитесь на курс, чтобы открыть материалы.',
          'error'
        );
        return;
      }
      e.preventDefault();
      const url = new URL(link.href, window.location.href);
      const mid = url.searchParams.get('module') || '';
      const lid = url.searchParams.get('lesson') || '';
      const sid = url.searchParams.get('step') || '';
      updateContentView(mid, lid, sid);
    });

    window.addEventListener('popstate', () => {
      const mid = getModuleId();
      const lid = getLessonId();
      const sid = getStepId();
      updateContentView(mid, lid, sid, true);
    });

    setActiveNavLink();
    window.history.replaceState(
      { moduleId: viewModuleId, lessonId: viewLessonId, stepId: viewStepId },
      '',
      window.location.pathname + window.location.search
    );

    function markLessonComplete(lessonId) {
      const item = root.querySelector(`.course-lesson-item[data-lesson-id="${lessonId}"]`);
      if (!item) return;
      const btn = item.querySelector('.lesson-complete, .lesson-quiz-trigger');
      const quizBlock = item.querySelector('.lesson-quiz-block');
      if (btn) {
        const tag = document.createElement('span');
        tag.className = 'tag tag-green';
        tag.textContent = 'Пройден';
        btn.replaceWith(tag);
      }
      if (quizBlock) quizBlock.style.display = 'none';

      completedSet.add(lessonId);
      progress.completedLessonIds = Array.from(completedSet);
      allowedLessonIds = computeAllowedLessonIds();
      applySequentialLocksToProgram();

      const fill = root.querySelector('.progress-bar-fill');
      const valueEl = root.querySelector('.stat-value');
      if (fill && valueEl && totalLessons > 0) {
        const nowCompleted = completedSet.size;
        const newPercent = Math.round((nowCompleted / totalLessons) * 100);
        fill.style.transform = `scaleX(${newPercent / 100})`;
        valueEl.textContent = `${newPercent}%`;
      }
    }

    function initStepsVisibility() {
      root.querySelectorAll('.lesson-steps-container').forEach((container) => {
        const blocks = container.querySelectorAll('.lesson-step-block');
        const hasFiltered = Array.from(blocks).some((b) => b.style.display === 'none');
        if (hasFiltered) return;
        blocks.forEach((block, idx) => {
          block.style.display = idx === 0 ? 'block' : 'none';
        });
      });
    }
    initStepsVisibility();
    attachContentListeners();
  } catch (e) {
    console.error(e);
    root.innerHTML = '<p class="muted">Курс не найден или ошибка загрузки. <a href="/courses">К списку курсов</a></p>';
  }
});
