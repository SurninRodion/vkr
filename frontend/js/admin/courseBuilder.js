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

async function ensureAdminAccess() {
  try {
    const profile = await apiGetProfile();
    if (!profile || profile.role !== 'admin') {
      showToast('Доступ разрешён только администраторам.', 'error');
      window.location.href = '../index.html';
      return false;
    }
    return true;
  } catch (e) {
    showToast('Не удалось проверить права доступа.', 'error');
    window.location.href = '../login.html';
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
  pendingStep: null
};

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
      html += `
        <div class="builder-lesson" data-module-index="${modIndex}" data-lesson-index="${lessonIndex}" data-lesson-id="${lessonId}">
          <div class="builder-tree-node builder-tree-node--lesson">
            <span class="builder-tree-icon">📄</span>
            <span class="builder-tree-label">${lessonTitle}</span>
            <div class="builder-node-actions">
              <button type="button" class="btn btn-ghost btn-sm builder-edit-lesson" data-module-index="${modIndex}" data-lesson-index="${lessonIndex}">Изменить</button>
              <button type="button" class="btn btn-ghost btn-sm builder-delete-lesson" data-module-index="${modIndex}" data-lesson-index="${lessonIndex}">Удалить</button>
              <button type="button" class="btn btn-outline btn-sm builder-add-step" data-module-index="${modIndex}" data-lesson-index="${lessonIndex}">Добавить шаг</button>
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
}

function getModulesFromState() {
  return buildVirtualModules(state.currentCourse);
}

function openEditCourseModal() {
  const course = state.currentCourse;
  const title = prompt('Название курса', course?.title || '');
  if (title === null) return;
  if (!state.currentCourse) state.currentCourse = { title: '', description: '', modules: [] };
  state.currentCourse.title = title;
  const desc = prompt('Описание курса', state.currentCourse.description || '');
  if (desc !== null) state.currentCourse.description = desc;
  renderTree();
}

function openEditModuleModal(modIndex) {
  const modules = getModulesFromState();
  const mod = modules[modIndex];
  if (!mod) return;
  const title = prompt('Название модуля', mod.title || '');
  if (title === null) return;
  mod.title = title;
  renderTree();
}

function openEditLessonModal(modIndex, lessonIndex) {
  const modules = getModulesFromState();
  const lesson = modules[modIndex]?.lessons?.[lessonIndex];
  if (!lesson) return;
  const title = prompt('Название урока', lesson.title || '');
  if (title === null) return;
  lesson.title = title;
  const content = prompt('Краткое описание / контент (опционально)', lesson.content || '');
  if (content !== null) lesson.content = content;
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
  const title = prompt('Название урока', '');
  if (!title) return;
  const newLesson = { id: null, title, content: '', order_index: (mod.lessons || []).length, steps: [] };
  if (!mod.lessons) mod.lessons = [];
  mod.lessons.push(newLesson);
  renderTree();
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
          <label class="form-label">URL видео</label>
          <input type="url" class="form-input" id="step-video-url" value="${escapeHtml(payload.url || '')}" placeholder="https://..." />
        </div>
        <div class="form-field">
          <label class="form-label">Описание</label>
          <textarea class="textarea" id="step-video-desc" rows="3">${escapeHtml(payload.description || '')}</textarea>
        </div>
      `;
      break;
    case 'test':
      const options = payload.options || ['', ''];
      const correctIndex = typeof payload.correct_index === 'number' ? payload.correct_index : 0;
      bodyEl.innerHTML = `
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

function saveStepFromModal() {
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
    state.courses = await loadCourses();
    renderCourseSelect(state.courses, newId);
    renderTree();
  } catch (e) {
    showToast(e.message || 'Не удалось сохранить курс.', 'error');
  } finally {
    if (btn) btn.disabled = false;
  }
}

document.getElementById('modal-step-type')?.querySelectorAll('[data-modal-close]').forEach((el) => {
  el.addEventListener('click', () => document.getElementById('modal-step-type').classList.remove('backdrop--visible'));
});

document.getElementById('modal-step-form')?.querySelectorAll('[data-modal-close]').forEach((el) => {
  el.addEventListener('click', () => {
    document.getElementById('modal-step-form').classList.remove('backdrop--visible');
    state.pendingStep = null;
    state.selectedStepType = null;
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
