import { initNavbar, showToast } from '../ui.js';
import { apiGetProfile } from '../api.js';

const ADMIN_API_BASE = '/api/admin';

function getAdminHeaders() {
  const headers = { 'Content-Type': 'application/json' };
  try {
    const raw = localStorage.getItem('promptlearn_auth');
    if (!raw) return headers;
    const parsed = JSON.parse(raw);
    if (parsed?.token) headers.Authorization = `Bearer ${parsed.token}`;
  } catch (_) {}
  return headers;
}

function getAdminAuthHeaders() {
  const headers = {};
  try {
    const raw = localStorage.getItem('promptlearn_auth');
    if (!raw) return headers;
    const parsed = JSON.parse(raw);
    if (parsed?.token) headers.Authorization = `Bearer ${parsed.token}`;
  } catch (_) {}
  return headers;
}

function getCurrentLessonFromPending() {
  const pending = state.pendingStep;
  if (!pending) return null;
  const modules = getModulesFromState();
  return modules[pending.modIndex]?.lessons?.[pending.lessonIndex] || null;
}

async function uploadVideoForLesson(lessonId, file) {
  const fd = new FormData();
  fd.append('file', file);
  const res = await fetch(`${ADMIN_API_BASE}/lessons/${encodeURIComponent(lessonId)}/videos`, {
    method: 'POST',
    headers: getAdminAuthHeaders(),
    body: fd,
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || 'Ошибка загрузки видео');
  }
  return res.json();
}

async function ensureAdminAccess() {
  try {
    const profile = await apiGetProfile();
    state.profile = profile;
    if (!profile || profile.role !== 'admin') {
      showToast('Доступ разрешён только администраторам.', 'error');
      window.location.href = '/';
      return false;
    }
    return true;
  } catch (e) {
    showToast('Не удалось проверить права доступа.', 'error');
    window.location.href = '/login';
    return false;
  }
}

function escapeHtml(s) {
  const div = document.createElement('div');
  div.textContent = s ?? '';
  return div.innerHTML;
}

const STEP_TYPES = {
  theory: 'Теория',
  video: 'Видео',
  test: 'Тест',
  practical: 'Практическое задание'
};

let state = {
  courses: [],
  currentCourse: null,
  pendingStep: null,
  lessonQuizModal: null,
  profile: null,
  /** Индекс модуля для модалки «Название модуля». */
  pendingModuleIndex: null,
  /** { mode: 'add'|'edit', modIndex: number, lessonIndex?: number } */
  lessonModal: null,
  certificateTemplate: null,
  certificateDraft: null,
};

function getDefaultCertificateTemplateForDraft(courseTitle) {
  // Должно соответствовать дефолту на бэкенде (примерно), чтобы черновик не был пустым.
  return {
    enabled: true,
    title: `Сертификат: ${courseTitle || 'Курс'}`,
    templateHtml: `
      <div class="page">
        <div class="bg"></div>
        <div class="paper">
          <div class="content">
            <div class="top">
              <div class="brand">Prompt <span class="a">Academy</span> <span class="b">Certificate</span></div>
              <div class="meta">
                <div>Серийный №: <strong>{{serial}}</strong></div>
                <div>Дата выдачи: <strong>{{issued_date}}</strong></div>
              </div>
            </div>

            <div class="hero">
              <h1 class="title">Сертификат</h1>
              <p class="subtitle">
                Настоящим сертификатом подтверждается, что {{user_name}} успешно завершил обучение по курсу «{{course_title}}».
              </p>
            </div>

            <div class="name">{{user_name}}</div>
            <div class="course">«{{course_title}}»</div>
            <div class="line"></div>

            <div class="footer">
              <div class="sig">
                <strong>Prompt Academy</strong>
                Обучающая платформа по промпт-инжинирингу
              </div>
              <div class="stamp" aria-label="Печать сервиса">
                <svg viewBox="0 0 200 200" aria-hidden="true">
                  <defs>
                    <path id="ringTop" d="M 100,18 A 82,82 0 0 1 182,100" />
                    <path id="ringBottom" d="M 182,100 A 82,82 0 0 1 100,182 A 82,82 0 0 1 18,100" />
                  </defs>

                  <circle cx="100" cy="100" r="92" class="stroke" fill="none" stroke-width="6" />
                  <circle cx="100" cy="100" r="78" class="stroke2" fill="none" stroke-width="3" />
                  <circle cx="100" cy="100" r="62" class="stroke2 fillSoft" stroke-width="2" />

                  <text font-size="10" class="textRing">
                    <textPath href="#ringTop" startOffset="2%">PROMPT ACADEMY</textPath>
                  </text>
                  <text font-size="10" class="textRing">
                    <textPath href="#ringBottom" startOffset="8%">CERTIFIED • COURSE COMPLETION</textPath>
                  </text>

                  <circle cx="100" cy="100" r="42" class="stroke2" fill="none" stroke-width="2" />
                  <text x="100" y="92" text-anchor="middle" font-size="12" class="textCenter">CERTIFICATE</text>
                  <text x="100" y="112" text-anchor="middle" font-size="10" class="muted">PROMPT ACADEMY</text>
                  <text x="100" y="134" text-anchor="middle" font-size="16" class="stroke" fill="none" stroke-width="0">
                    ★ ★ ★
                  </text>
                </svg>
              </div>
            </div>
          </div>
        </div>
      </div>
    `.trim(),
    templateCss: `
      @page { size: A4 landscape; margin: 0; }
      :root { --ink:#0b1220; --muted:#334155; --accent:#1d4ed8; --accent2:#7c3aed; --paper:#ffffff; --stamp:#0f3b8f; }
      * { box-sizing: border-box; }
      html, body { height: 100%; }
      body { margin:0; background: #fff; font-family: Inter, Arial, sans-serif; color: var(--ink); }

      .page {
        width: 297mm;
        height: 210mm;
        margin: 0;
        background: var(--paper);
        position: relative;
        overflow: hidden;
      }

      .bg {
        position: absolute;
        inset: 0;
        background:
          radial-gradient(1200px 520px at 10% 0%, rgba(29,78,216,.12), transparent 60%),
          radial-gradient(900px 520px at 92% 8%, rgba(124,58,237,.10), transparent 60%),
          radial-gradient(900px 520px at 84% 96%, rgba(29,78,216,.06), transparent 55%);
        pointer-events: none;
      }

      .paper { position: absolute; inset: 0; }

      .content {
        position: relative;
        height: 100%;
        padding: 18mm 20mm;
        display: flex;
        flex-direction: column;
      }

      .top {
        display:flex;
        justify-content:space-between;
        align-items:flex-start;
        gap: 18mm;
      }

      .brand {
        font-weight: 800;
        letter-spacing: .4px;
        font-size: 18px;
      }
      .brand .a { color: var(--accent); }
      .brand .b { color: var(--accent2); }

      .meta {
        text-align:right;
        color: var(--muted);
        font-size: 12px;
        line-height: 1.35;
      }
      .meta strong { color: var(--ink); font-weight: 700; }

      .hero { margin-top: 14mm; }
      .title { font-size: 44px; font-weight: 800; letter-spacing: .2px; margin: 0; }
      .subtitle { margin: 4mm 0 0; font-size: 16px; color: var(--muted); }

      .name { margin-top: 14mm; font-size: 34px; font-weight: 800; letter-spacing: .2px; }
      .course { margin-top: 3mm; font-size: 20px; color: var(--ink); }

      .line {
        margin-top: 8mm;
        height: 1px;
        background: linear-gradient(90deg, rgba(37,99,235,.0), rgba(37,99,235,.35), rgba(124,58,237,.25), rgba(124,58,237,0));
      }

      .footer {
        margin-top: auto;
        display:flex;
        justify-content:space-between;
        align-items:flex-end;
        gap: 12mm;
        padding-top: 10mm;
      }

      .sig { font-size: 12px; color: var(--muted); }
      .sig strong { display:block; color: var(--ink); font-size: 13px; margin-bottom: 3mm; }

      .stamp { width: 42mm; height: 42mm; opacity: .92; }
      .stamp svg { width: 100%; height: 100%; display:block; }
      .stamp .stroke { stroke: rgba(15,59,143,.72); }
      .stamp .stroke2 { stroke: rgba(15,59,143,.35); }
      .stamp .fillSoft { fill: rgba(15,59,143,.06); }
      .stamp .textRing { fill: rgba(15,59,143,.86); font-weight: 700; letter-spacing: .22em; }
      .stamp .textCenter { fill: rgba(15,59,143,.92); font-weight: 800; letter-spacing: .10em; }
      .stamp .muted { fill: rgba(15,59,143,.70); font-weight: 700; letter-spacing: .18em; }

      @media print {
        body { background: #fff; }
        .page { box-shadow: none; }
      }
    `.trim(),
  };
}

async function loadCourses() {
  const res = await fetch(`${ADMIN_API_BASE}/courses`, { headers: getAdminHeaders() });
  if (!res.ok) throw new Error('Ошибка загрузки курсов');
  return res.json();
}

function getCourseIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get('id') || '';
}

function setCourseIdInUrl(id) {
  const url = new URL(window.location.href);
  if (id) url.searchParams.set('id', id);
  else url.searchParams.delete('id');
  window.history.replaceState({}, '', url.toString());
}

function renderCourseSelect(courses, selectedId) {
  const sel = document.getElementById('course-select');
  if (!sel) return;
  sel.innerHTML = '<option value="">— Новый курс —</option>';
  (courses || []).forEach((c) => {
    const opt = document.createElement('option');
    opt.value = c.id;
    opt.textContent = c.title || c.id;
    if (c.id === selectedId) opt.selected = true;
    sel.appendChild(opt);
  });
}

function buildVirtualModules(course) {
  if (Array.isArray(course.modules) && course.modules.length > 0) {
    return course.modules;
  }
  const lessons = course.lessons || [];
  if (lessons.length === 0) return [];
  return [{ id: null, title: 'Модуль 1', order_index: 0, lessons }];
}

function renderTree() {
  const root = document.getElementById('builder-root');
  if (!root) return;
  const course = state.currentCourse;
  if (!course) {
    root.innerHTML = '<p class="muted">Выберите курс выше или создайте новый.</p>';
    return;
  }

  const modules = buildVirtualModules(course);
  const courseTitle = escapeHtml(course.title || 'Без названия');
  const courseDesc = escapeHtml(course.description || '');

  let html = `
    <div class="card builder-course-card">
      <div class="builder-course-header">
        <div class="builder-course-info">
          <h2 class="card-title builder-course-title" data-edit="course-title">${courseTitle}</h2>
          <p class="card-description builder-course-desc" data-edit="course-desc">${courseDesc}</p>
        </div>
        <div class="builder-course-actions">
          <button type="button" class="btn btn-ghost btn-sm" id="builder-edit-course">Редактировать курс</button>
          <button type="button" class="btn btn-ghost btn-sm" id="builder-edit-certificate">Сертификат</button>
          ${course.id ? `<button type="button" class="btn btn-outline btn-sm" id="builder-dev-reset-progress">Dev: сбросить прогресс</button>` : ''}
          ${course.id ? `<button type="button" class="btn btn-ghost btn-sm btn-danger" id="builder-delete-course">Удалить курс</button>` : ''}
        </div>
      </div>
      <div class="builder-tree">
        <div class="builder-tree-node builder-tree-node--course">
          <span class="builder-tree-icon">📚</span>
          <span class="builder-tree-label">Курс</span>
        </div>
        <div class="builder-modules">
  `;

  modules.forEach((mod, modIndex) => {
    const modId = mod.id || `virt-${modIndex}`;
    const modTitle = escapeHtml(mod.title || `Модуль ${modIndex + 1}`);
    html += `
      <div class="builder-module" data-module-index="${modIndex}" data-module-id="${modId || ''}">
        <div class="builder-tree-node builder-tree-node--module">
          <span class="builder-tree-icon">📁</span>
          <span class="builder-tree-label">${modTitle}</span>
          <div class="builder-node-actions">
            <button type="button" class="btn btn-ghost btn-sm builder-edit-module" data-module-index="${modIndex}">Изменить</button>
            <button type="button" class="btn btn-ghost btn-sm builder-delete-module" data-module-index="${modIndex}">Удалить</button>
            <button type="button" class="btn btn-outline btn-sm builder-add-lesson" data-module-index="${modIndex}">Добавить урок</button>
          </div>
        </div>
        <div class="builder-lessons">
    `;
    (mod.lessons || []).forEach((lesson, lessonIndex) => {
      const lessonId = lesson.id || '';
      const lessonTitle = escapeHtml(lesson.title || 'Урок');
      const quizCount = Array.isArray(lesson.quiz_questions) ? lesson.quiz_questions.length : 0;
      const quizMeta = quizCount > 0 ? ` · Тест: ${quizCount}` : '';
      html += `
        <div class="builder-lesson" data-module-index="${modIndex}" data-lesson-index="${lessonIndex}" data-lesson-id="${lessonId}">
          <div class="builder-tree-node builder-tree-node--lesson">
            <span class="builder-tree-icon">📄</span>
            <span class="builder-tree-label">${lessonTitle}${escapeHtml(quizMeta)}</span>
            <div class="builder-node-actions">
              <button type="button" class="btn btn-ghost btn-sm builder-edit-lesson" data-module-index="${modIndex}" data-lesson-index="${lessonIndex}">Изменить</button>
              <button type="button" class="btn btn-ghost btn-sm builder-delete-lesson" data-module-index="${modIndex}" data-lesson-index="${lessonIndex}">Удалить</button>
              <button type="button" class="btn btn-outline btn-sm builder-add-step" data-module-index="${modIndex}" data-lesson-index="${lessonIndex}">Добавить шаг</button>
              <button type="button" class="btn btn-outline btn-sm builder-edit-lesson-quiz" data-module-index="${modIndex}" data-lesson-index="${lessonIndex}">Тест урока</button>
            </div>
          </div>
          <div class="builder-steps">
      `;
      (lesson.steps || []).sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0)).forEach((step, stepIndex) => {
        const stepTypeLabel = STEP_TYPES[step.step_type] || step.step_type;
        const stepSummary = getStepSummary(step);
        html += `
          <div class="builder-step" data-module-index="${modIndex}" data-lesson-index="${lessonIndex}" data-step-index="${stepIndex}" data-step-id="${step.id || ''}">
            <div class="builder-tree-node builder-tree-node--step">
              <span class="builder-tree-icon">${getStepIcon(step.step_type)}</span>
              <span class="builder-tree-label">${escapeHtml(stepSummary)}</span>
              <span class="builder-tree-meta">${escapeHtml(stepTypeLabel)}</span>
              <div class="builder-node-actions">
                <button type="button" class="btn btn-ghost btn-sm builder-edit-step" data-module-index="${modIndex}" data-lesson-index="${lessonIndex}" data-step-index="${stepIndex}">Изменить</button>
                <button type="button" class="btn btn-ghost btn-sm builder-delete-step" data-module-index="${modIndex}" data-lesson-index="${lessonIndex}" data-step-index="${stepIndex}">Удалить</button>
                <button type="button" class="btn btn-ghost btn-sm builder-move-step" data-dir="up" data-module-index="${modIndex}" data-lesson-index="${lessonIndex}" data-step-index="${stepIndex}">↑</button>
                <button type="button" class="btn btn-ghost btn-sm builder-move-step" data-dir="down" data-module-index="${modIndex}" data-lesson-index="${lessonIndex}" data-step-index="${stepIndex}">↓</button>
              </div>
            </div>
          </div>
        `;
      });
      html += `
          </div>
        </div>
      `;
    });
    html += `
        </div>
      </div>
    `;
  });

  html += `
        <div class="builder-add-module-row">
          <button type="button" class="btn btn-outline" id="builder-add-module">Добавить модуль</button>
        </div>
      </div>
    </div>
    <div class="builder-save-row">
      <button type="button" class="btn btn-primary" id="builder-save-course">Сохранить курс</button>
    </div>
  `;

  root.innerHTML = html;
  attachTreeListeners();
}

function getStepSummary(step) {
  const p = step.payload || {};
  switch (step.step_type) {
    case 'theory':
      return p.title || 'Теория';
    case 'video':
      return p.title || p.url || 'Видео';
    case 'test':
      return p.question || 'Вопрос теста';
    case 'practical':
      return p.title || 'Практическое задание';
    default:
      return step.step_type || 'Шаг';
  }
}

function getStepIcon(type) {
  switch (type) {
    case 'theory': return '📖';
    case 'video': return '🎬';
    case 'test': return '❓';
    case 'practical': return '✏️';
    default: return '•';
  }
}

function attachTreeListeners() {
  const root = document.getElementById('builder-root');
  if (!root) return;

  root.querySelector('#builder-edit-course')?.addEventListener('click', () => openEditCourseModal());
  root.querySelector('#builder-edit-certificate')?.addEventListener('click', () => openCertificateModal());
  root.querySelector('#builder-dev-reset-progress')?.addEventListener('click', () => devResetCourseProgressConfirm());
  root.querySelector('#builder-delete-course')?.addEventListener('click', () => deleteCourseConfirm());
  root.querySelector('#builder-add-module')?.addEventListener('click', () => addModule());
  root.querySelector('#builder-save-course')?.addEventListener('click', () => saveCourse());

  root.querySelectorAll('.builder-edit-module').forEach((btn) => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.getAttribute('data-module-index'), 10);
      openEditModuleModal(idx);
    });
  });
  root.querySelectorAll('.builder-delete-module').forEach((btn) => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.getAttribute('data-module-index'), 10);
      deleteModule(idx);
    });
  });
  root.querySelectorAll('.builder-add-lesson').forEach((btn) => {
    btn.addEventListener('click', () => {
      const idx = parseInt(btn.getAttribute('data-module-index'), 10);
      addLesson(idx);
    });
  });

  root.querySelectorAll('.builder-edit-lesson').forEach((btn) => {
    btn.addEventListener('click', () => {
      const modIdx = parseInt(btn.getAttribute('data-module-index'), 10);
      const lessonIdx = parseInt(btn.getAttribute('data-lesson-index'), 10);
      openEditLessonModal(modIdx, lessonIdx);
    });
  });
  root.querySelectorAll('.builder-delete-lesson').forEach((btn) => {
    btn.addEventListener('click', () => {
      const modIdx = parseInt(btn.getAttribute('data-module-index'), 10);
      const lessonIdx = parseInt(btn.getAttribute('data-lesson-index'), 10);
      deleteLesson(modIdx, lessonIdx);
    });
  });
  root.querySelectorAll('.builder-add-step').forEach((btn) => {
    btn.addEventListener('click', () => {
      const modIdx = parseInt(btn.getAttribute('data-module-index'), 10);
      const lessonIdx = parseInt(btn.getAttribute('data-lesson-index'), 10);
      openAddStepModal(modIdx, lessonIdx);
    });
  });
  root.querySelectorAll('.builder-edit-lesson-quiz').forEach((btn) => {
    btn.addEventListener('click', () => {
      const modIdx = parseInt(btn.getAttribute('data-module-index'), 10);
      const lessonIdx = parseInt(btn.getAttribute('data-lesson-index'), 10);
      openLessonQuizModal(modIdx, lessonIdx);
    });
  });

  root.querySelectorAll('.builder-edit-step').forEach((btn) => {
    btn.addEventListener('click', () => {
      const modIdx = parseInt(btn.getAttribute('data-module-index'), 10);
      const lessonIdx = parseInt(btn.getAttribute('data-lesson-index'), 10);
      const stepIdx = parseInt(btn.getAttribute('data-step-index'), 10);
      openEditStepModal(modIdx, lessonIdx, stepIdx);
    });
  });
  root.querySelectorAll('.builder-delete-step').forEach((btn) => {
    btn.addEventListener('click', () => {
      const modIdx = parseInt(btn.getAttribute('data-module-index'), 10);
      const lessonIdx = parseInt(btn.getAttribute('data-lesson-index'), 10);
      const stepIdx = parseInt(btn.getAttribute('data-step-index'), 10);
      deleteStep(modIdx, lessonIdx, stepIdx);
    });
  });
  root.querySelectorAll('.builder-move-step').forEach((btn) => {
    btn.addEventListener('click', () => {
      const modIdx = parseInt(btn.getAttribute('data-module-index'), 10);
      const lessonIdx = parseInt(btn.getAttribute('data-lesson-index'), 10);
      const stepIdx = parseInt(btn.getAttribute('data-step-index'), 10);
      const dir = btn.getAttribute('data-dir');
      moveStep(modIdx, lessonIdx, stepIdx, dir);
    });
  });

  // Делегирование кликов внутри модалки "Тест урока"
  const modalBody = document.getElementById('modal-step-form-body');
  if (modalBody && modalBody.dataset.quizBound !== '1') {
    modalBody.dataset.quizBound = '1';
    modalBody.addEventListener('click', (e) => {
      const addQ = e.target.closest('#quiz-q-add');
      const add10 = e.target.closest('#quiz-q-add-10');
      const delQ = e.target.closest('.quiz-q-del');
      const addOpt = e.target.closest('.quiz-opt-add');
      const delOpt = e.target.closest('.quiz-opt-del');

      if (!addQ && !add10 && !delQ && !addOpt && !delOpt) return;
      e.preventDefault();

      const ctx = state.lessonQuizModal;
      if (!ctx) return;
      const modules = getModulesFromState();
      const lesson = modules?.[ctx.modIndex]?.lessons?.[ctx.lessonIndex];
      if (!lesson) return;
      if (!Array.isArray(lesson.quiz_questions)) lesson.quiz_questions = [];

      if (addQ || add10) {
        const toAdd = add10 ? 10 : 1;
        for (let i = 0; i < toAdd; i++) {
          lesson.quiz_questions.push({
            question_text: '',
            options: ['Вариант 1', 'Вариант 2'],
            correct_index: 0,
          });
        }
        modalBody.innerHTML = renderLessonQuizEditor(lesson.quiz_questions);
        return;
      }

      if (delQ) {
        const qi = parseInt(delQ.getAttribute('data-qi'), 10);
        if (!Number.isFinite(qi) || qi < 0) return;
        lesson.quiz_questions.splice(qi, 1);
        modalBody.innerHTML = renderLessonQuizEditor(lesson.quiz_questions);
        return;
      }

      if (addOpt) {
        const qi = parseInt(addOpt.getAttribute('data-qi'), 10);
        const q = lesson.quiz_questions[qi];
        if (!q) return;
        if (!Array.isArray(q.options)) q.options = [];
        q.options.push(`Вариант ${q.options.length + 1}`);
        modalBody.innerHTML = renderLessonQuizEditor(lesson.quiz_questions);
        return;
      }

      if (delOpt) {
        const qi = parseInt(delOpt.getAttribute('data-qi'), 10);
        const oi = parseInt(delOpt.getAttribute('data-oi'), 10);
        const q = lesson.quiz_questions[qi];
        if (!q || !Array.isArray(q.options)) return;
        q.options.splice(oi, 1);
        if (typeof q.correct_index !== 'number') q.correct_index = 0;
        if (q.correct_index >= q.options.length) q.correct_index = Math.max(0, q.options.length - 1);
        modalBody.innerHTML = renderLessonQuizEditor(lesson.quiz_questions);
      }
    });
  }
}

async function devResetCourseProgressConfirm() {
  const courseId = state.currentCourse?.id;
  if (!courseId) return;
  const defaultEmail = state.profile?.email ? String(state.profile.email) : '';
  const email = prompt('Email пользователя, которому сбросить прогресс по этому курсу:', defaultEmail);
  if (!email) return;
  if (!confirm(`Сбросить прогресс по курсу для ${email}? Это удалит запись на курс, прогресс уроков, практику и сертификат.`)) return;
  try {
    const res = await fetch(`${ADMIN_API_BASE}/courses/${encodeURIComponent(courseId)}/dev/reset-progress`, {
      method: 'POST',
      headers: getAdminHeaders(),
      body: JSON.stringify({ email }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || 'Не удалось сбросить прогресс');
    const d = data.deleted || {};
    showToast(
      `Прогресс сброшен. Уроки: ${d.lesson_progress ?? 0}, практика: ${d.practical_submissions ?? 0}, сертификаты: ${d.certificates ?? 0}, запись: ${d.enrollments ?? 0}.`,
      'success'
    );
  } catch (e) {
    showToast(e.message || 'Ошибка сброса прогресса', 'error');
  }
}

function getCertificateModalEls() {
  return {
    backdrop: document.getElementById('modal-edit-certificate'),
    enabled: document.getElementById('builder-certificate-enabled'),
    title: document.getElementById('builder-certificate-title'),
    html: document.getElementById('builder-certificate-html'),
    css: document.getElementById('builder-certificate-css'),
    preview: document.getElementById('builder-certificate-preview'),
    applyBtn: document.getElementById('builder-certificate-apply'),
    resetBtn: document.getElementById('builder-certificate-reset'),
    reissueBtn: document.getElementById('builder-certificate-reissue'),
  };
}

async function fetchCertificateTemplate(courseId) {
  const res = await fetch(`${ADMIN_API_BASE}/courses/${encodeURIComponent(courseId)}/certificate-template`, {
    method: 'GET',
    headers: getAdminHeaders(),
  });
  if (!res.ok) throw new Error('Ошибка загрузки шаблона сертификата');
  return res.json();
}

async function saveCertificateTemplate(courseId, payload) {
  const res = await fetch(`${ADMIN_API_BASE}/courses/${encodeURIComponent(courseId)}/certificate-template`, {
    method: 'PUT',
    headers: getAdminHeaders(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || 'Ошибка сохранения шаблона сертификата');
  }
  return true;
}

async function resetCertificateTemplate(courseId) {
  const res = await fetch(`${ADMIN_API_BASE}/courses/${encodeURIComponent(courseId)}/certificate-template/reset`, {
    method: 'POST',
    headers: getAdminHeaders(),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || 'Ошибка сброса шаблона сертификата');
  }
  return true;
}

async function reissueCertificatesForCourse(courseId) {
  const res = await fetch(`${ADMIN_API_BASE}/courses/${encodeURIComponent(courseId)}/certificates/reissue`, {
    method: 'POST',
    headers: getAdminHeaders(),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.message || 'Ошибка перевыпуска сертификатов');
  }
  return res.json().catch(() => ({}));
}

function buildCertificatePreviewDoc({ templateHtml, templateCss }, { userName, courseTitle, issuedDate, serial }) {
  const esc = (s) =>
    String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  const safe = {
    user_name: esc(userName),
    course_title: esc(courseTitle),
    issued_date: esc(issuedDate),
    serial: esc(serial),
  };
  const body = String(templateHtml || '')
    .replace(/\{\{\s*user_name\s*\}\}/g, safe.user_name)
    .replace(/\{\{\s*course_title\s*\}\}/g, safe.course_title)
    .replace(/\{\{\s*issued_date\s*\}\}/g, safe.issued_date)
    .replace(/\{\{\s*serial\s*\}\}/g, safe.serial);
  return `<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet" />
  <style>${String(templateCss || '')}</style>
</head>
<body>${body}</body>
</html>`;
}

function openCertificateModal() {
  const course = state.currentCourse;
  const els = getCertificateModalEls();
  if (!els.backdrop || !els.enabled || !els.title || !els.html || !els.css || !els.preview) return;

  const show = async () => {
    els.backdrop.classList.add('backdrop--visible');
    els.backdrop.setAttribute('aria-hidden', 'false');
  };

  const fill = (tpl) => {
    const t = tpl || state.certificateDraft || state.certificateTemplate || {};
    els.enabled.checked = Boolean(t.enabled);
    els.title.value = t.title || '';
    els.html.value = t.templateHtml || '';
    els.css.value = t.templateCss || '';
    updateCertificatePreview();
  };

  const load = async () => {
    if (!course?.id) {
      showToast('Сначала сохраните курс, чтобы привязать шаблон сертификата.', 'error');
      state.certificateDraft =
        state.certificateDraft || getDefaultCertificateTemplateForDraft(course?.title || '');
      fill(state.certificateDraft);
      await show();
      return;
    }
    try {
      const tpl = await fetchCertificateTemplate(course.id);
      state.certificateTemplate = tpl;
      state.certificateDraft = null;
      fill(tpl);
      await show();

      if (els.resetBtn && !els.resetBtn.dataset.bound) {
        els.resetBtn.dataset.bound = '1';
        els.resetBtn.addEventListener('click', async () => {
          if (!confirm('Сбросить шаблон сертификата на значения по умолчанию?')) return;
          try {
            await resetCertificateTemplate(course.id);
            const fresh = await fetchCertificateTemplate(course.id);
            state.certificateTemplate = fresh;
            fill(fresh);
            showToast('Шаблон сброшен.', 'success');
          } catch (e) {
            showToast(e.message || 'Не удалось сбросить шаблон.', 'error');
          }
        });
      }

      if (els.reissueBtn && !els.reissueBtn.dataset.bound) {
        els.reissueBtn.dataset.bound = '1';
        els.reissueBtn.addEventListener('click', async () => {
          if (!confirm('Перевыпустить все уже выданные сертификаты этого курса (обновить дизайн)?')) return;
          try {
            const result = await reissueCertificatesForCourse(course.id);
            showToast(`Готово: обновлено ${result.updated ?? 0}, ошибок ${result.failed ?? 0}.`, 'success');
          } catch (e) {
            showToast(e.message || 'Не удалось перевыпустить сертификаты.', 'error');
          }
        });
      }
    } catch (e) {
      showToast(e.message || 'Не удалось загрузить шаблон.', 'error');
    }
  };
  load();
}

function closeCertificateModal() {
  const els = getCertificateModalEls();
  if (!els.backdrop) return;
  els.backdrop.classList.remove('backdrop--visible');
  els.backdrop.setAttribute('aria-hidden', 'true');
}

function collectCertificateModal() {
  const els = getCertificateModalEls();
  if (!els.enabled || !els.title || !els.html || !els.css) return null;
  return {
    enabled: els.enabled.checked,
    title: els.title.value.trim(),
    templateHtml: els.html.value,
    templateCss: els.css.value,
  };
}

function updateCertificatePreview() {
  const els = getCertificateModalEls();
  const draft = collectCertificateModal();
  if (!els.preview || !draft) return;
  const courseTitle = state.currentCourse?.title || 'Курс';
  const doc = buildCertificatePreviewDoc(draft, {
    userName: 'Иван Иванов',
    courseTitle,
    issuedDate: new Date().toLocaleDateString('ru-RU'),
    serial: 'DEMO-12345',
  });
  els.preview.srcdoc = doc;
}

function getModulesFromState() {
  return buildVirtualModules(state.currentCourse);
}

function ensureModulesMaterialized() {
  if (!state.currentCourse) return;
  if (!state.currentCourse.modules) {
    const virtual = buildVirtualModules(state.currentCourse);
    state.currentCourse.modules = virtual.map((m) => ({ ...m, lessons: [...(m.lessons || [])] }));
  }
}

function closeEditCourseModal() {
  const backdrop = document.getElementById('modal-edit-course');
  if (!backdrop) return;
  backdrop.classList.remove('backdrop--visible');
  backdrop.setAttribute('aria-hidden', 'true');
}

function openEditCourseModal() {
  const course = state.currentCourse;
  if (!course) return;
  const titleIn = document.getElementById('builder-edit-course-title-input');
  const descIn = document.getElementById('builder-edit-course-desc-input');
  const backdrop = document.getElementById('modal-edit-course');
  if (!titleIn || !descIn || !backdrop) return;
  titleIn.value = course.title || '';
  descIn.value = course.description || '';
  backdrop.classList.add('backdrop--visible');
  backdrop.setAttribute('aria-hidden', 'false');
  setTimeout(() => titleIn.focus(), 0);
}

function applyEditCourseModal() {
  if (!state.currentCourse) state.currentCourse = { title: '', description: '', modules: [] };
  const titleIn = document.getElementById('builder-edit-course-title-input');
  const descIn = document.getElementById('builder-edit-course-desc-input');
  if (!titleIn || !descIn) return;
  state.currentCourse.title = titleIn.value.trim() || '';
  state.currentCourse.description = descIn.value.trim() || '';
  closeEditCourseModal();
  renderTree();
}

function closeEditModuleModal() {
  const backdrop = document.getElementById('modal-edit-module');
  if (!backdrop) return;
  backdrop.classList.remove('backdrop--visible');
  backdrop.setAttribute('aria-hidden', 'true');
  state.pendingModuleIndex = null;
}

function openEditModuleModal(modIndex) {
  const modules = getModulesFromState();
  const mod = modules[modIndex];
  if (!mod) return;
  const titleIn = document.getElementById('builder-module-title-input');
  const backdrop = document.getElementById('modal-edit-module');
  if (!titleIn || !backdrop) return;
  state.pendingModuleIndex = modIndex;
  titleIn.value = mod.title || '';
  backdrop.classList.add('backdrop--visible');
  backdrop.setAttribute('aria-hidden', 'false');
  setTimeout(() => titleIn.focus(), 0);
}

function applyEditModuleModal() {
  if (state.pendingModuleIndex == null) return;
  ensureModulesMaterialized();
  const mod = state.currentCourse.modules[state.pendingModuleIndex];
  if (!mod) {
    closeEditModuleModal();
    return;
  }
  const titleIn = document.getElementById('builder-module-title-input');
  if (!titleIn) return;
  const title = titleIn.value.trim();
  mod.title = title || mod.title;
  closeEditModuleModal();
  renderTree();
}

function closeEditLessonModal() {
  const backdrop = document.getElementById('modal-edit-lesson');
  if (!backdrop) return;
  backdrop.classList.remove('backdrop--visible');
  backdrop.setAttribute('aria-hidden', 'true');
  state.lessonModal = null;
}

function openEditLessonModal(modIndex, lessonIndex) {
  const modules = getModulesFromState();
  const lesson = modules[modIndex]?.lessons?.[lessonIndex];
  if (!lesson) return;
  const titleIn = document.getElementById('builder-lesson-title-input');
  const contentIn = document.getElementById('builder-lesson-content-input');
  const heading = document.getElementById('modal-edit-lesson-heading');
  const backdrop = document.getElementById('modal-edit-lesson');
  if (!titleIn || !contentIn || !heading || !backdrop) return;
  state.lessonModal = { mode: 'edit', modIndex, lessonIndex };
  heading.textContent = 'Редактировать урок';
  titleIn.value = lesson.title || '';
  contentIn.value = lesson.content || '';
  backdrop.classList.add('backdrop--visible');
  backdrop.setAttribute('aria-hidden', 'false');
  setTimeout(() => titleIn.focus(), 0);
}

function applyEditLessonModal() {
  const ctx = state.lessonModal;
  if (!ctx) return;
  const titleIn = document.getElementById('builder-lesson-title-input');
  const contentIn = document.getElementById('builder-lesson-content-input');
  if (!titleIn || !contentIn) return;
  const title = titleIn.value.trim();
  const content = contentIn.value.trim();
  if (!title) {
    showToast('Укажите название урока.', 'error');
    return;
  }
  ensureModulesMaterialized();
  const mod = state.currentCourse.modules[ctx.modIndex];
  if (!mod) {
    closeEditLessonModal();
    return;
  }
  if (ctx.mode === 'add') {
    const newLesson = {
      id: null,
      title,
      content,
      order_index: (mod.lessons || []).length,
      steps: [],
      quiz_questions: [],
      quiz_required: 1
    };
    if (!mod.lessons) mod.lessons = [];
    mod.lessons.push(newLesson);
  } else {
    const lesson = mod.lessons?.[ctx.lessonIndex];
    if (!lesson) {
      closeEditLessonModal();
      return;
    }
    lesson.title = title;
    lesson.content = content;
  }
  closeEditLessonModal();
  renderTree();
}

function addModule() {
  if (!state.currentCourse.modules) {
    const virtual = buildVirtualModules(state.currentCourse);
    state.currentCourse.modules = virtual.map((m) => ({ ...m, lessons: [...(m.lessons || [])] }));
  }
  const newMod = { id: null, title: `Модуль ${state.currentCourse.modules.length + 1}`, order_index: state.currentCourse.modules.length, lessons: [] };
  state.currentCourse.modules.push(newMod);
  renderTree();
}

function deleteModule(modIndex) {
  if (!confirm('Удалить модуль и все его уроки?')) return;
  if (!state.currentCourse.modules) {
    const virtual = buildVirtualModules(state.currentCourse);
    state.currentCourse.modules = virtual.map((m) => ({ ...m, lessons: [...(m.lessons || [])] }));
  }
  state.currentCourse.modules.splice(modIndex, 1);
  renderTree();
}

function addLesson(modIndex) {
  const modules = getModulesFromState();
  const mod = modules[modIndex];
  if (!mod) return;
  const titleIn = document.getElementById('builder-lesson-title-input');
  const contentIn = document.getElementById('builder-lesson-content-input');
  const heading = document.getElementById('modal-edit-lesson-heading');
  const backdrop = document.getElementById('modal-edit-lesson');
  if (!titleIn || !contentIn || !heading || !backdrop) return;
  state.lessonModal = { mode: 'add', modIndex };
  heading.textContent = 'Новый урок';
  titleIn.value = '';
  contentIn.value = '';
  backdrop.classList.add('backdrop--visible');
  backdrop.setAttribute('aria-hidden', 'false');
  setTimeout(() => titleIn.focus(), 0);
}

function deleteLesson(modIndex, lessonIndex) {
  if (!confirm('Удалить урок и все его шаги?')) return;
  const modules = getModulesFromState();
  const mod = modules[modIndex];
  if (!mod?.lessons) return;
  mod.lessons.splice(lessonIndex, 1);
  renderTree();
}

function deleteStep(modIndex, lessonIndex, stepIndex) {
  const modules = getModulesFromState();
  const lesson = modules[modIndex]?.lessons?.[lessonIndex];
  if (!lesson?.steps) return;
  lesson.steps.splice(stepIndex, 1);
  renderTree();
}

function moveStep(modIndex, lessonIndex, stepIndex, dir) {
  const modules = getModulesFromState();
  const lesson = modules[modIndex]?.lessons?.[lessonIndex];
  const steps = lesson?.steps || [];
  const newIdx = dir === 'up' ? stepIndex - 1 : stepIndex + 1;
  if (newIdx < 0 || newIdx >= steps.length) return;
  [steps[stepIndex], steps[newIdx]] = [steps[newIdx], steps[stepIndex]];
  steps.forEach((s, i) => { s.order_index = i; });
  renderTree();
}

function openAddStepModal(modIndex, lessonIndex) {
  state.pendingStep = { modIndex, lessonIndex, stepIndex: -1, step: null };
  document.getElementById('modal-step-type').classList.add('backdrop--visible');
}

function openEditStepModal(modIndex, lessonIndex, stepIndex) {
  const modules = getModulesFromState();
  const step = modules[modIndex]?.lessons?.[lessonIndex]?.steps?.[stepIndex];
  if (!step) return;
  state.pendingStep = { modIndex, lessonIndex, stepIndex, step: { ...step, payload: { ...(step.payload || {}) } } };
  openStepFormForType(step.step_type, step.payload || {});
  document.getElementById('modal-step-type').classList.remove('backdrop--visible');
  document.getElementById('modal-step-form').classList.add('backdrop--visible');
}

function openStepFormForType(stepType, payload) {
  const titleEl = document.getElementById('modal-step-form-title');
  const bodyEl = document.getElementById('modal-step-form-body');
  if (!bodyEl) return;
  titleEl.textContent = STEP_TYPES[stepType] || stepType;

  switch (stepType) {
    case 'theory':
      bodyEl.innerHTML = `
        <div class="form-field">
          <label class="form-label">Заголовок</label>
          <input type="text" class="form-input" id="step-theory-title" value="${escapeHtml(payload.title || '')}" />
        </div>
        <div class="form-field">
          <label class="form-label">Текстовый контент (можно Markdown)</label>
          <textarea class="textarea" id="step-theory-content" rows="6">${escapeHtml(payload.content || '')}</textarea>
        </div>
      `;
      break;
    case 'video':
      bodyEl.innerHTML = `
        <div class="form-field">
          <label class="form-label">Название видео</label>
          <input type="text" class="form-input" id="step-video-title" value="${escapeHtml(payload.title || '')}" />
        </div>
        <div class="form-field">
          <label class="form-label">Видеофайл (загрузка на сервер)</label>
          <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
            <input type="file" class="form-input" id="step-video-file" accept="video/*" />
            <button type="button" class="btn btn-outline btn-sm" id="step-video-upload-btn">Загрузить</button>
            <span class="muted" id="step-video-upload-status" style="font-size:12px;"></span>
          </div>
          <div class="muted" style="font-size:12px;margin-top:6px;">
            Подсказка: чтобы загрузка работала, урок должен быть уже сохранён (у него должен быть id).
          </div>
        </div>
        <div class="form-field">
          <label class="form-label">URL видео</label>
          <input type="url" class="form-input" id="step-video-url" value="${escapeHtml(payload.url || '')}" placeholder="https://..." />
        </div>
        <div class="form-field" id="step-video-preview-wrap" style="display:none;">
          <label class="form-label">Предпросмотр</label>
          <video id="step-video-preview" controls preload="metadata" style="width:100%;max-height:360px;border-radius:12px;background:#000;"></video>
        </div>
        <div class="form-field">
          <label class="form-label">Описание</label>
          <textarea class="textarea" id="step-video-desc" rows="3">${escapeHtml(payload.description || '')}</textarea>
        </div>
      `;
      (function bindVideoUploadUi() {
        const urlInput = bodyEl.querySelector('#step-video-url');
        const previewWrap = bodyEl.querySelector('#step-video-preview-wrap');
        const preview = bodyEl.querySelector('#step-video-preview');
        const fileInput = bodyEl.querySelector('#step-video-file');
        const btn = bodyEl.querySelector('#step-video-upload-btn');
        const status = bodyEl.querySelector('#step-video-upload-status');

        const updatePreview = () => {
          const url = (urlInput?.value || '').trim();
          const isFileVideo =
            /^\/uploads\//i.test(url) ||
            /\.(mp4|webm|ogg|mov|m4v)(\?|#|$)/i.test(url);
          if (url && isFileVideo) {
            previewWrap.style.display = 'block';
            preview.src = url;
          } else {
            previewWrap.style.display = 'none';
            preview.removeAttribute('src');
            preview.load?.();
          }
        };

        urlInput?.addEventListener('input', updatePreview);
        updatePreview();

        btn?.addEventListener('click', async () => {
          const file = fileInput?.files?.[0];
          if (!file) {
            showToast('Выберите видеофайл для загрузки.', 'error');
            return;
          }
          const lesson = getCurrentLessonFromPending();
          if (!lesson?.id) {
            showToast('Сначала сохраните курс (чтобы у урока появился id), затем загрузите видео.', 'error');
            return;
          }
          btn.disabled = true;
          if (status) status.textContent = 'Загрузка…';
          try {
            const data = await uploadVideoForLesson(lesson.id, file);
            if (urlInput) urlInput.value = data.url || '';
            if (status) status.textContent = 'Готово';
            showToast('Видео загружено.', 'success');
            updatePreview();
          } catch (e) {
            if (status) status.textContent = '';
            showToast(e.message || 'Не удалось загрузить видео.', 'error');
          } finally {
            btn.disabled = false;
          }
        });
      })();
      break;
    case 'test':
      const options = payload.options || ['', ''];
      const correctIndex = typeof payload.correct_index === 'number' ? payload.correct_index : 0;
      const isLessonQuiz = !!payload.__lesson_quiz;
      const quizRequired = payload.__quiz_required !== undefined ? !!payload.__quiz_required : true;
      bodyEl.innerHTML = `
        <div class="form-field">
          <label class="form-label" style="display:flex;gap:10px;align-items:center;">
            <input type="checkbox" id="step-test-is-lesson-quiz" ${isLessonQuiz ? 'checked' : ''} />
            Закрепляющий тест урока (несколько вопросов, результат в %)
          </label>
          <div class="muted" style="font-size:12px;margin-top:6px;">
            Если включено — этот «шаг» сохранит тест в урок (как квиз) и он будет считаться процентами с подсветкой ответов.
          </div>
        </div>
        <div class="form-field" id="step-lesson-quiz-required-wrap" style="${isLessonQuiz ? '' : 'display:none;'}">
          <label class="form-label" style="display:flex;gap:10px;align-items:center;">
            <input type="checkbox" id="step-lesson-quiz-required" ${quizRequired ? 'checked' : ''} />
            Тест обязателен для завершения урока
          </label>
        </div>
        <div class="form-field" id="step-lesson-quiz-editor-wrap" style="${isLessonQuiz ? '' : 'display:none;'}"></div>
        <hr style="margin:12px 0; border:none; border-top:1px solid rgba(148,163,184,0.25);" />
        <div class="form-field">
          <label class="form-label">Вопрос</label>
          <input type="text" class="form-input" id="step-test-question" value="${escapeHtml(payload.question || '')}" />
        </div>
        <div class="form-field">
          <label class="form-label">Варианты ответов (минимум 2)</label>
          <div id="step-test-options">
            ${options.map((opt, i) => `
              <label style="display:flex;align-items:center;gap:8px;margin:6px 0">
                <input type="radio" name="step-test-correct" value="${i}" ${i === correctIndex ? 'checked' : ''} />
                <input type="text" class="form-input step-test-opt" value="${escapeHtml(opt)}" placeholder="Вариант ${i + 1}" style="flex:1" />
              </label>
            `).join('')}
          </div>
          <button type="button" class="btn btn-ghost btn-sm" id="step-test-add-opt">Добавить вариант</button>
        </div>
      `;

      (function bindLessonQuizToggle() {
        const cb = bodyEl.querySelector('#step-test-is-lesson-quiz');
        const reqWrap = bodyEl.querySelector('#step-lesson-quiz-required-wrap');
        const quizWrap = bodyEl.querySelector('#step-lesson-quiz-editor-wrap');
        if (!cb || !reqWrap || !quizWrap) return;
        const ensureEditor = () => {
          if (!state.pendingStep) return;
          const { modIndex, lessonIndex } = state.pendingStep;
          const modules = getModulesFromState();
          const lesson = modules?.[modIndex]?.lessons?.[lessonIndex];
          if (!lesson) return;
          if (!Array.isArray(lesson.quiz_questions)) lesson.quiz_questions = [];
          quizWrap.innerHTML = renderLessonQuizEditor(lesson.quiz_questions);
        };
        const apply = () => {
          const on = cb.checked;
          reqWrap.style.display = on ? '' : 'none';
          quizWrap.style.display = on ? '' : 'none';
          if (on) ensureEditor();
        };
        cb.addEventListener('change', apply);
        apply();
      })();

      bodyEl.querySelector('#step-test-add-opt')?.addEventListener('click', () => {
        const container = bodyEl.querySelector('#step-test-options');
        const idx = container.querySelectorAll('.step-test-opt').length;
        const label = document.createElement('label');
        label.style.cssText = 'display:flex;align-items:center;gap:8px;margin:6px 0';
        label.innerHTML = `
          <input type="radio" name="step-test-correct" value="${idx}" />
          <input type="text" class="form-input step-test-opt" placeholder="Вариант ${idx + 1}" style="flex:1" />
        `;
        container.appendChild(label);
      });
      break;
    case 'practical':
      bodyEl.innerHTML = `
        <div class="form-field">
          <label class="form-label">Название задания</label>
          <input type="text" class="form-input" id="step-practical-title" value="${escapeHtml(payload.title || '')}" />
        </div>
        <div class="form-field">
          <label class="form-label">Описание задания</label>
          <textarea class="textarea" id="step-practical-desc" rows="4">${escapeHtml(payload.description || '')}</textarea>
        </div>
        <div class="form-field">
          <label class="form-label">Подсказка для поля ввода (опционально)</label>
          <input type="text" class="form-input" id="step-practical-placeholder" value="${escapeHtml(payload.input_placeholder || '')}" placeholder="Введите ваш ответ..." />
        </div>
      `;
      break;
    default:
      bodyEl.innerHTML = '<p class="muted">Неизвестный тип шага.</p>';
  }
}

function collectStepPayload(stepType) {
  const bodyEl = document.getElementById('modal-step-form-body');
  if (!bodyEl) return {};
  switch (stepType) {
    case 'theory':
      return {
        title: bodyEl.querySelector('#step-theory-title')?.value?.trim() || '',
        content: bodyEl.querySelector('#step-theory-content')?.value?.trim() || ''
      };
    case 'video':
      return {
        title: bodyEl.querySelector('#step-video-title')?.value?.trim() || '',
        url: bodyEl.querySelector('#step-video-url')?.value?.trim() || '',
        description: bodyEl.querySelector('#step-video-desc')?.value?.trim() || ''
      };
    case 'test': {
      const isLessonQuiz = !!bodyEl.querySelector('#step-test-is-lesson-quiz')?.checked;
      if (isLessonQuiz) {
        // Для закрепляющего теста: payload шага не используем, данные сохраняем в lesson.quiz_questions
        // и отметку обязательности — в lesson.quiz_required.
        return { __lesson_quiz: true };
      }
      const question = bodyEl.querySelector('#step-test-question')?.value?.trim() || '';
      const optInputs = bodyEl.querySelectorAll('.step-test-opt');
      const options = Array.from(optInputs).map((inp) => inp.value.trim()).filter(Boolean);
      const correctRadio = bodyEl.querySelector('input[name="step-test-correct"]:checked');
      const correct_index = correctRadio ? parseInt(correctRadio.value, 10) : 0;
      if (options.length < 2) {
        showToast('Нужно минимум 2 варианта ответа.', 'error');
        return null;
      }
      return { question, options, correct_index };
    }
    case 'practical':
      return {
        title: bodyEl.querySelector('#step-practical-title')?.value?.trim() || '',
        description: bodyEl.querySelector('#step-practical-desc')?.value?.trim() || '',
        input_placeholder: bodyEl.querySelector('#step-practical-placeholder')?.value?.trim() || ''
      };
    default:
      return {};
  }
}

function openLessonQuizModal(modIndex, lessonIndex) {
  const modules = getModulesFromState();
  const lesson = modules?.[modIndex]?.lessons?.[lessonIndex];
  if (!lesson) return;
  if (!Array.isArray(lesson.quiz_questions)) lesson.quiz_questions = [];
  state.lessonQuizModal = { modIndex, lessonIndex };
  const bodyEl = document.getElementById('modal-step-form-body');
  const titleEl = document.getElementById('modal-step-form-title');
  if (!bodyEl) return;
  if (titleEl) titleEl.textContent = 'Тест урока (закрепляющий)';
  bodyEl.innerHTML = renderLessonQuizEditor(lesson.quiz_questions);
  document.getElementById('modal-step-form')?.classList.add('backdrop--visible');
}

function renderLessonQuizEditor(questions) {
  const safe = Array.isArray(questions) ? questions : [];
  const qHtml = safe.map((q, qi) => {
    const opts = Array.isArray(q.options) ? q.options : [];
    const correct = typeof q.correct_index === 'number' ? q.correct_index : 0;
    return `
      <div class="card" style="padding:12px; margin-bottom:10px" data-quiz-q="${qi}">
        <div class="form-field">
          <label class="form-label">Вопрос ${qi + 1}</label>
          <input type="text" class="form-input quiz-q-text" value="${escapeHtml(q.question_text || '')}" placeholder="Текст вопроса" />
        </div>
        <div class="form-field">
          <label class="form-label">Варианты (минимум 2). Отметьте правильный.</label>
          <div class="quiz-q-options">
            ${opts.map((opt, oi) => `
              <div style="display:flex; gap:10px; align-items:center; margin-bottom:6px" data-quiz-opt="${oi}">
                <input type="radio" name="quiz-correct-${qi}" value="${oi}" ${oi === correct ? 'checked' : ''} />
                <input type="text" class="form-input quiz-opt-text" value="${escapeHtml(opt)}" placeholder="Вариант ${oi + 1}" />
                <button type="button" class="btn btn-ghost btn-sm quiz-opt-del" data-qi="${qi}" data-oi="${oi}">Удалить</button>
              </div>
            `).join('')}
          </div>
          <button type="button" class="btn btn-outline btn-sm quiz-opt-add" data-qi="${qi}">Добавить вариант</button>
        </div>
        <div style="display:flex; gap:10px; align-items:center;">
          <button type="button" class="btn btn-ghost btn-sm quiz-q-del" data-qi="${qi}">Удалить вопрос</button>
        </div>
      </div>
    `;
  }).join('');

  return `
    <div id="lesson-quiz-editor">
      <p class="muted" style="margin-top:0;">
        Это закрепляющий тест урока. Он проходится в конце урока и считается в процентах.
      </p>
      ${qHtml || '<p class="muted">Вопросов пока нет.</p>'}
      <div style="display:flex; gap:10px; flex-wrap:wrap; align-items:center;">
        <button type="button" class="btn btn-outline" id="quiz-q-add">Добавить вопрос</button>
        <button type="button" class="btn btn-outline" id="quiz-q-add-10">Добавить шаблон на 10 вопросов</button>
      </div>
    </div>
  `;
}

function collectLessonQuizFromModal() {
  const bodyEl = document.getElementById('modal-step-form-body');
  if (!bodyEl) return [];
  const qCards = bodyEl.querySelectorAll('[data-quiz-q]');
  const result = [];
  qCards.forEach((card, qi) => {
    const question_text = card.querySelector('.quiz-q-text')?.value?.trim() || '';
    const optInputs = card.querySelectorAll('.quiz-opt-text');
    const options = Array.from(optInputs).map((inp) => inp.value.trim()).filter(Boolean);
    const correctRadio = card.querySelector(`input[name="quiz-correct-${qi}"]:checked`);
    const correct_index = correctRadio ? parseInt(correctRadio.value, 10) : 0;
    if (!question_text) return;
    if (options.length < 2) return;
    result.push({ question_text, options, correct_index });
  });
  return result;
}

function saveStepFromModal() {
  if (state.lessonQuizModal) {
    const ctx = state.lessonQuizModal;
    const modules = getModulesFromState();
    const lesson = modules?.[ctx.modIndex]?.lessons?.[ctx.lessonIndex];
    if (!lesson) return;
    const questions = collectLessonQuizFromModal();
    lesson.quiz_questions = questions;
    state.lessonQuizModal = null;
    document.getElementById('modal-step-form')?.classList.remove('backdrop--visible');
    renderTree();
    showToast('Тест урока сохранён.', 'success');
    return;
  }

  const pending = state.pendingStep;
  if (!pending) return;
  const stepType = pending.step?.step_type || state.selectedStepType;
  if (!stepType) return;
  const payload = collectStepPayload(stepType);
  if (payload === null) return;

  const modules = getModulesFromState();
  const mod = modules[pending.modIndex];
  const lesson = mod?.lessons?.[pending.lessonIndex];
  if (!lesson) return;
  if (!lesson.steps) lesson.steps = [];

  // Особый случай: через "Добавить шаг → Тест" создаём закрепляющий тест урока (quiz_questions).
  if (stepType === 'test' && payload && payload.__lesson_quiz) {
    if (!Array.isArray(lesson.quiz_questions)) lesson.quiz_questions = [];
    const requiredCb = document.getElementById('modal-step-form-body')?.querySelector('#step-lesson-quiz-required');
    lesson.quiz_required = requiredCb && requiredCb.checked ? 1 : 0;
    // Ничего не добавляем в lesson.steps — это именно тест урока.
    document.getElementById('modal-step-form')?.classList.remove('backdrop--visible');
    state.pendingStep = null;
    state.selectedStepType = null;
    renderTree();
    showToast('Тест урока сохранён.', 'success');
    return;
  }

  const orderIndex = pending.stepIndex >= 0 ? pending.stepIndex : lesson.steps.length;
  if (pending.stepIndex >= 0) {
    lesson.steps[pending.stepIndex] = {
      ...pending.step,
      step_type: stepType,
      order_index: orderIndex,
      payload
    };
  } else {
    lesson.steps.push({
      id: null,
      step_type: stepType,
      order_index: orderIndex,
      payload
    });
  }
  document.getElementById('modal-step-form').classList.remove('backdrop--visible');
  state.pendingStep = null;
  state.selectedStepType = null;
  renderTree();
  showToast('Шаг сохранён.', 'success');
}

function deleteCourseConfirm() {
  if (!state.currentCourse?.id) return;
  if (!confirm('Удалить этот курс безвозвратно?')) return;
  (async () => {
    try {
      const res = await fetch(`${ADMIN_API_BASE}/courses/${encodeURIComponent(state.currentCourse.id)}`, {
        method: 'DELETE',
        headers: getAdminHeaders()
      });
      if (res.ok || res.status === 204) {
        showToast('Курс удалён.', 'success');
        state.currentCourse = null;
        setCourseIdInUrl('');
        const courses = await loadCourses();
        state.courses = courses;
        renderCourseSelect(courses, '');
        renderTree();
      } else {
        showToast('Не удалось удалить курс.', 'error');
      }
    } catch (e) {
      showToast('Ошибка удаления.', 'error');
    }
  })();
}

async function saveCourse() {
  const course = state.currentCourse;
  if (!course) return;
  const modules = getModulesFromState();
  const payload = {
    title: course.title || 'Без названия',
    description: course.description || '',
    modules: modules.map((mod, mi) => ({
      id: mod.id || undefined,
      title: mod.title || `Модуль ${mi + 1}`,
      order_index: mi,
      lessons: (mod.lessons || []).map((les, li) => ({
        id: les.id || undefined,
        title: les.title || '',
        content: les.content || '',
        order_index: li,
        quiz_required: typeof les.quiz_required === 'number' ? les.quiz_required : (les.quiz_required ? 1 : 0),
        quiz_questions: Array.isArray(les.quiz_questions) ? les.quiz_questions : [],
        steps: (les.steps || []).map((s, si) => ({
          id: s.id || undefined,
          step_type: s.step_type,
          order_index: si,
          payload: s.payload || {}
        }))
      }))
    }))
  };

  const btn = document.getElementById('builder-save-course');
  if (btn) btn.disabled = true;
  try {
    const method = course.id ? 'PUT' : 'POST';
    const url = course.id ? `${ADMIN_API_BASE}/courses/${encodeURIComponent(course.id)}` : `${ADMIN_API_BASE}/courses`;
    const res = await fetch(url, {
      method,
      headers: getAdminHeaders(),
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.message || 'Ошибка сохранения');
    }
    const data = await res.json().catch(() => ({}));
    const newId = data.id || course.id;
    showToast('Курс сохранён.', 'success');
    state.currentCourse = { ...data, id: newId };
    if (newId) setCourseIdInUrl(newId);

    // Если шаблон сертификата редактировали до сохранения курса — сохраним его сейчас
    if (
      newId &&
      state.certificateDraft &&
      (String(state.certificateDraft.templateHtml || '').trim() ||
        String(state.certificateDraft.templateCss || '').trim())
    ) {
      try {
        await saveCertificateTemplate(newId, state.certificateDraft);
        state.certificateDraft = null;
        state.certificateTemplate = await fetchCertificateTemplate(newId).catch(() => null);
        showToast('Шаблон сертификата сохранён.', 'success');
      } catch (e) {
        showToast(e.message || 'Не удалось сохранить шаблон сертификата.', 'error');
      }
    }

    state.courses = await loadCourses();
    renderCourseSelect(state.courses, newId);
    renderTree();
  } catch (e) {
    showToast(e.message || 'Не удалось сохранить курс.', 'error');
  } finally {
    if (btn) btn.disabled = false;
  }
}

const modalCertificate = document.getElementById('modal-edit-certificate');
modalCertificate?.addEventListener('click', (e) => {
  if (e.target === modalCertificate || e.target.closest('[data-modal-certificate-close]')) {
    closeCertificateModal();
  }
});
// Живой предпросмотр, чтобы не перегружать интерфейс кнопками
['builder-certificate-enabled', 'builder-certificate-title', 'builder-certificate-html', 'builder-certificate-css'].forEach((id) => {
  const el = document.getElementById(id);
  if (!el) return;
  el.addEventListener('input', () => {
    clearTimeout(window.__certPreviewT);
    window.__certPreviewT = setTimeout(updateCertificatePreview, 250);
  });
  el.addEventListener('change', () => {
    clearTimeout(window.__certPreviewT);
    window.__certPreviewT = setTimeout(updateCertificatePreview, 250);
  });
});
document.getElementById('builder-certificate-apply')?.addEventListener('click', async () => {
  const courseId = state.currentCourse?.id;
  const draft = collectCertificateModal();
  if (!draft) return;
  if (!courseId) {
    state.certificateDraft = draft;
    showToast('Сохраните курс — и шаблон применится.', 'success');
    closeCertificateModal();
    return;
  }
  try {
    await saveCertificateTemplate(courseId, draft);
    state.certificateTemplate = await fetchCertificateTemplate(courseId).catch(() => null);
    showToast('Шаблон сертификата сохранён.', 'success');
    closeCertificateModal();
  } catch (e) {
    showToast(e.message || 'Не удалось сохранить шаблон сертификата.', 'error');
  }
});

const modalEditCourse = document.getElementById('modal-edit-course');
modalEditCourse?.addEventListener('click', (e) => {
  if (e.target === modalEditCourse || e.target.closest('[data-modal-edit-course-close]')) {
    closeEditCourseModal();
  }
});
document.getElementById('modal-edit-course-apply')?.addEventListener('click', applyEditCourseModal);

const modalEditModule = document.getElementById('modal-edit-module');
modalEditModule?.addEventListener('click', (e) => {
  if (e.target === modalEditModule || e.target.closest('[data-modal-module-close]')) {
    closeEditModuleModal();
  }
});
document.getElementById('modal-edit-module-apply')?.addEventListener('click', applyEditModuleModal);

const modalEditLesson = document.getElementById('modal-edit-lesson');
modalEditLesson?.addEventListener('click', (e) => {
  if (e.target === modalEditLesson || e.target.closest('[data-modal-lesson-close]')) {
    closeEditLessonModal();
  }
});
document.getElementById('modal-edit-lesson-apply')?.addEventListener('click', applyEditLessonModal);

document.getElementById('modal-step-type')?.querySelectorAll('[data-modal-close]').forEach((el) => {
  el.addEventListener('click', () => document.getElementById('modal-step-type').classList.remove('backdrop--visible'));
});

document.getElementById('modal-step-form')?.querySelectorAll('[data-modal-close]').forEach((el) => {
  el.addEventListener('click', () => {
    document.getElementById('modal-step-form').classList.remove('backdrop--visible');
    state.pendingStep = null;
    state.selectedStepType = null;
    state.lessonQuizModal = null;
  });
});

document.getElementById('modal-step-save')?.addEventListener('click', saveStepFromModal);

document.getElementById('modal-step-type')?.querySelectorAll('.step-type-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    const type = btn.getAttribute('data-type');
    state.selectedStepType = type;
    document.getElementById('modal-step-type').classList.remove('backdrop--visible');
    openStepFormForType(type, {});
    document.getElementById('modal-step-form').classList.add('backdrop--visible');
  });
});

document.addEventListener('DOMContentLoaded', async () => {
  initNavbar();
  const ok = await ensureAdminAccess();
  if (!ok) return;

  const courses = await loadCourses();
  state.courses = courses;
  const idFromUrl = getCourseIdFromUrl();
  renderCourseSelect(courses, idFromUrl);

  if (idFromUrl) {
    const course = courses.find((c) => c.id === idFromUrl);
    if (course) state.currentCourse = course;
  }

  document.getElementById('course-select')?.addEventListener('change', (e) => {
    const id = e.target.value;
    if (!id) {
      state.currentCourse = null;
      renderTree();
      return;
    }
    const course = state.courses.find((c) => c.id === id);
    if (course) {
      state.currentCourse = course;
      setCourseIdInUrl(id);
      renderTree();
    }
  });

  document.getElementById('builder-new-course')?.addEventListener('click', () => {
    state.currentCourse = { title: 'Новый курс', description: '', modules: [], lessons: [] };
    setCourseIdInUrl('');
    document.getElementById('course-select').value = '';
    renderTree();
  });

  renderTree();
});
