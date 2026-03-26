import {
  apiGetCourse,
  apiGetCourseProgress,
  apiEnrollCourse,
  apiCompleteLesson,
  apiSubmitQuiz,
  apiCheckStepAnswer,
} from './api.js';
import { getAuthState } from './auth.js';
import { showToast } from './ui.js';

function escapeHtml(s) {
  const div = document.createElement('div');
  div.textContent = s ?? '';
  return div.innerHTML;
}

function nl2br(s) {
  return String(s ?? '').replace(/\n/g, '<br>');
}

function renderStepBlock(step, stepIndex, lessonId, courseId) {
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
      const embedUrl = ytWatchMatch ? `https://www.youtube.com/embed/${ytWatchMatch[1]}` : ytBeMatch ? `https://www.youtube.com/embed/${ytBeMatch[1]}` : url;
      inner = `
        <h4 class="lesson-step-title">${escapeHtml(p.title || 'Видео')}</h4>
        ${url ? `<div class="lesson-step-video-wrap"><iframe src="${escapeHtml(embedUrl)}" title="${escapeHtml(p.title || '')}" allowfullscreen></iframe></div>` : ''}
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
    case 'practical':
      inner = `
        <h4 class="lesson-step-title">${escapeHtml(p.title || 'Практическое задание')}</h4>
        <div class="lesson-step-content">${nl2br(p.description || '')}</div>
        <textarea class="lesson-step-practical-input form-input textarea" rows="4" placeholder="${escapeHtml(p.input_placeholder || 'Введите ваш ответ...')}"></textarea>
      `;
      break;
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

function renderLessonSteps(lesson, lessonIndex, courseId, progress, completedSet, onlyStepId = null) {
  const steps = (lesson.steps || []).slice().sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));
  if (!steps.length) return '';
  const stepsHtml = steps.map((s, i) => {
    const block = renderStepBlock(s, i, lesson.id, courseId);
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

document.addEventListener('DOMContentLoaded', async () => {
  const root = document.getElementById('course-root');
  if (!root) return;

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

    const progress = progressRes || { enrolled: false, completedLessonIds: [], totalLessons: 0 };
    const completedSet = new Set(progress.completedLessonIds || []);
    const viewModuleId = getModuleId();
    const viewLessonId = getLessonId();
    const viewStepId = getStepId();

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
        const lessonHasQuiz = hasQuiz(lesson);
        const lessonHasSteps = hasSteps(lesson);
        let completeBtn = '';
        if (!lessonHasSteps) {
          if (progress.enrolled && !isCompleted) {
            completeBtn = lessonHasQuiz
              ? `<button type="button" class="btn btn-outline btn-sm lesson-quiz-trigger" data-lesson-id="${escapeHtml(lesson.id)}">Пройти тест</button>`
              : `<button type="button" class="btn btn-outline btn-sm lesson-complete" data-lesson-id="${escapeHtml(lesson.id)}">Отметить пройденным</button>`;
          } else if (progress.enrolled && isCompleted) {
            completeBtn = '<span class="tag tag-green">Пройден</span>';
          }
        }
        const contentHtml = !lessonHasSteps && lesson.content
          ? `<div class="lesson-content">${escapeHtml(lesson.content)}</div>`
          : '';
        const attHtml = attachmentsHtml(lesson.attachments);
        const quizBlock = !lessonHasSteps && lessonHasQuiz && progress.enrolled && !isCompleted
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
        const stepsHtml = lessonHasSteps ? renderLessonSteps(lesson, i, courseId, progress, completedSet, viewStepId || null) : '';
        return `
        <li class="course-lesson-item" data-lesson-id="${escapeHtml(lesson.id)}">
          <div class="course-lesson-header">
            <span class="stat-label">${escapeHtml(moduleTitle || `Модуль ${moduleIndex}`)}</span>
            <span class="stat-value">${escapeHtml(lesson.title)}</span>
            ${!lessonHasSteps ? completeBtn : ''}
          </div>
          ${contentHtml}
          ${attHtml}
          ${quizBlock}
          ${stepsHtml}
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
          <p class="page-header-meta">${escapeHtml(course.description || '')}</p>
        </div>
        <div class="filters">
          <span class="tag tag-green">${totalLessons} уроков</span>
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

    function updateContentView(moduleId, lessonId, stepId, replace) {
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
        const lessonHasQuiz = hasQuiz(lesson);
        const lessonHasSteps = hasSteps(lesson);
        let completeBtn = '';
        if (!lessonHasSteps) {
          if (progress.enrolled && !isCompleted) {
            completeBtn = lessonHasQuiz
              ? `<button type="button" class="btn btn-outline btn-sm lesson-quiz-trigger" data-lesson-id="${escapeHtml(lesson.id)}">Пройти тест</button>`
              : `<button type="button" class="btn btn-outline btn-sm lesson-complete" data-lesson-id="${escapeHtml(lesson.id)}">Отметить пройденным</button>`;
          } else if (progress.enrolled && isCompleted) {
            completeBtn = '<span class="tag tag-green">Пройден</span>';
          }
        }
        const contentHtml = !lessonHasSteps && lesson.content ? `<div class="lesson-content">${escapeHtml(lesson.content)}</div>` : '';
        const attHtml = attachmentsHtml(lesson.attachments);
        const quizBlock = !lessonHasSteps && lessonHasQuiz && progress.enrolled && !isCompleted ? `
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
        const stepsHtmlNew = lessonHasSteps ? renderLessonSteps(lesson, i, courseId, progress, completedSet, stepId || null) : '';
        return `
          <li class="course-lesson-item" data-lesson-id="${escapeHtml(lesson.id)}">
            <div class="course-lesson-header">
              <span class="stat-label">${escapeHtml(moduleTitle || `Модуль ${moduleIndex}`)}</span>
              <span class="stat-value">${escapeHtml(lesson.title)}</span>
              ${!lessonHasSteps ? completeBtn : ''}
            </div>
            ${contentHtml}
            ${attHtml}
            ${quizBlock}
            ${stepsHtmlNew}
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
          if (blocks[idx + 1]) blocks[idx + 1].style.display = 'block';
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
    }

    root.addEventListener('click', (e) => {
      const link = e.target.closest('a.course-nav-link');
      if (!link || !link.href || (link.getAttribute('href') || '').indexOf(courseId) === -1) return;
      if (!link.closest('.course-layout')) return;
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
      if (btn) btn.replaceWith('<span class="tag tag-green">Пройден</span>');
      if (quizBlock) quizBlock.style.display = 'none';
      const fill = root.querySelector('.progress-bar-fill');
      const valueEl = root.querySelector('.stat-value');
      if (fill && valueEl && totalLessons > 0) {
        const list = root.querySelector('.course-lessons-list');
        const nowCompleted = list ? list.querySelectorAll('.tag-green').length : 0;
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
