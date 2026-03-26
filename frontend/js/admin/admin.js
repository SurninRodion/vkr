import { initNavbar, showToast } from '../ui.js';
import { apiGetProfile } from '../api.js';

const ADMIN_API_BASE = '/api/admin';

function getAdminHeaders() {
  const headers = { 'Content-Type': 'application/json' };

  try {
    const raw = localStorage.getItem('promptlearn_auth');
    if (!raw) return headers;
    const parsed = JSON.parse(raw);
    if (parsed?.token) {
      headers.Authorization = `Bearer ${parsed.token}`;
    }
  } catch {
    // ignore parse errors, return headers without auth
  }

  return headers;
}

async function ensureAdminAccess() {
  try {
    const profile = await apiGetProfile();
    if (!profile || profile.role !== 'admin') {
      showToast('Доступ разрешён только администраторам.', 'error');
      window.location.href = '/';
      return false;
    }
    return true;
  } catch (e) {
    console.error(e);
    showToast('Не удалось проверить права доступа.', 'error');
    window.location.href = '/login';
    return false;
  }
}

async function loadDashboardStats() {
  const statsRoot = document.getElementById('admin-stats');
  if (!statsRoot) return;

  try {
    const res = await fetch(`${ADMIN_API_BASE}/stats`, {
      headers: getAdminHeaders()
    });
    if (!res.ok) throw new Error('failed');
    const data = await res.json();

    const map = {
      'stat-total-users': data.totalUsers,
      'stat-total-tasks': data.totalTasks,
      'stat-total-prompts': data.totalPrompts,
      'stat-active-users': data.activeUsers
    };

    Object.entries(map).forEach(([id, value]) => {
      const el = document.getElementById(id);
      if (el) el.textContent = String(value ?? '0');
    });
  } catch (e) {
    console.error(e);
    showToast('Не удалось загрузить статистику.', 'error');
  }
}

async function loadCourses() {
  const body = document.getElementById('admin-courses-body');
  try {
    const res = await fetch(`${ADMIN_API_BASE}/courses`, { headers: getAdminHeaders() });
    if (!res.ok) throw new Error('failed');
    const courses = await res.json();

    if (body) {
      body.innerHTML = '';
      courses.forEach((course) => {
        const tr = document.createElement('tr');
        const lessonsCount = Array.isArray(course.lessons) ? course.lessons.length : 0;
        tr.innerHTML = `
          <td>${escapeHtml(course.title)}</td>
          <td>${escapeHtml(course.description || '')}</td>
          <td>${lessonsCount}</td>
          <td>
            <a href="/admin/course-builder?id=${encodeURIComponent(course.id)}" class="btn btn-outline btn-sm">Конструктор</a>
            <button class="btn btn-ghost" data-action="edit-course" data-id="${course.id}">Редактировать</button>
            <button class="btn btn-ghost" data-action="delete-course" data-id="${course.id}">Удалить</button>
          </td>
        `;
        body.appendChild(tr);
      });

      body.addEventListener('click', async (e) => {
        const btn = e.target.closest('button[data-action]');
        if (!btn) return;
        const id = btn.getAttribute('data-id');
        const action = btn.getAttribute('data-action');
        const resCourses = await fetch(`${ADMIN_API_BASE}/courses`, { headers: getAdminHeaders() });
        const latestCourses = await resCourses.json();
        const course = latestCourses.find((c) => c.id === id);
        if (!course) return;
        if (action === 'edit-course') fillCourseForm(course);
        else if (action === 'delete-course') {
          if (!confirm('Удалить курс и все его уроки?')) return;
          await deleteCourse(id);
          await loadCourses();
        }
      });
    }
    return courses;
  } catch (e) {
    console.error(e);
    showToast('Не удалось загрузить курсы.', 'error');
    return [];
  }
}

function escapeHtml(s) {
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}

function fillCourseForm(course) {
  const titleEl = document.getElementById('course-title');
  const descEl = document.getElementById('course-description');
  const lessonsContainer = document.getElementById('lessons-container');
  const modeEl = document.getElementById('course-form-mode');

  if (!titleEl || !descEl || !lessonsContainer || !modeEl) return;

  titleEl.value = course.title || '';
  descEl.value = course.description || '';
  lessonsContainer.innerHTML = '';

  (course.lessons || []).forEach((lesson, idx) => {
    addLessonRow({
      id: lesson.id,
      title: lesson.title || '',
      content: lesson.content || '',
      order_index: idx,
      attachments: lesson.attachments || [],
      quiz_questions: lesson.quiz_questions || []
    });
  });

  modeEl.textContent = 'Режим: редактирование';
  modeEl.dataset.editId = course.id;
}

function addLessonRow(data = {}) {
  const container = document.getElementById('lessons-container');
  if (!container) return;

  const id = data.id || '';
  const title = data.title ?? '';
  const content = data.content ?? '';
  const attachments = data.attachments || [];
  const quizQuestions = data.quiz_questions || [];

  const wrapper = document.createElement('div');
  wrapper.className = 'panel lesson-panel';
  wrapper.style.marginBottom = '12px';
  if (id) wrapper.dataset.lessonId = id;

  const attachmentsHtml =
    id &&
    `
    <div class="form-field lesson-attachments">
      <label class="form-label">Файлы и изображения</label>
      <div class="attachments-list" data-lesson-id="${id}"></div>
      <input type="file" class="attachment-upload-input" accept="image/*,.pdf,.doc,.docx,.txt,.zip" data-lesson-id="${id}" style="margin-top:6px" />
      <button type="button" class="btn btn-ghost btn-sm upload-trigger" data-lesson-id="${id}" style="margin-top:4px">Загрузить файл</button>
    </div>
  `;

  const quizHtml = `
    <div class="form-field lesson-quiz">
      <label class="form-label">Закрепляющий тест (урок будет завершён только после прохождения)</label>
      <div class="quiz-questions-list"></div>
      <button type="button" class="btn btn-ghost btn-sm add-quiz-question">Добавить вопрос</button>
    </div>
  `;

  wrapper.innerHTML = `
    <div class="form-field">
      <label class="form-label">Название урока</label>
      <input type="text" class="form-input lesson-title" value="${escapeHtml(title)}" />
    </div>
    <div class="form-field">
      <label class="form-label">Контент урока</label>
      <textarea class="textarea lesson-content" rows="2">${escapeHtml(content)}</textarea>
    </div>
    ${attachmentsHtml || ''}
    ${quizHtml}
    <button type="button" class="btn btn-ghost" data-action="remove-lesson" style="margin-top: 8px">Удалить урок</button>
  `;

  const attList = wrapper.querySelector('.attachments-list');
  if (attList && id) {
    attachments.forEach((a) => renderAttachmentRow(attList, a, id));
    const fileInput = wrapper.querySelector('.attachment-upload-input');
    const uploadBtn = wrapper.querySelector('.upload-trigger');
    if (uploadBtn && fileInput) {
      uploadBtn.addEventListener('click', () => fileInput.click());
      fileInput.addEventListener('change', () => uploadAttachment(id, fileInput, attList));
    }
  }

  const quizList = wrapper.querySelector('.quiz-questions-list');
  quizQuestions.forEach((q) => addQuizQuestionRow(quizList, q));
  wrapper.querySelector('.add-quiz-question')?.addEventListener('click', () => addQuizQuestionRow(quizList));

  wrapper.querySelector('[data-action="remove-lesson"]')?.addEventListener('click', () => wrapper.remove());

  container.appendChild(wrapper);
}

function renderAttachmentRow(container, att, lessonId) {
  const div = document.createElement('div');
  div.className = 'attachment-row';
  div.dataset.attId = att.id;
  const isImg = (att.mime_type || '').startsWith('image/');
  div.innerHTML = `
    ${isImg ? `<img src="${escapeHtml(att.url)}" alt="" style="max-height:40px;margin-right:8px;" />` : ''}
    <a href="${escapeHtml(att.url)}" target="_blank" rel="noopener">${escapeHtml(att.original_name)}</a>
    <button type="button" class="btn btn-ghost btn-sm delete-attachment" data-att-id="${att.id}">Удалить</button>
  `;
  div.querySelector('.delete-attachment')?.addEventListener('click', async () => {
    try {
      const res = await fetch(`${ADMIN_API_BASE}/attachments/${encodeURIComponent(att.id)}`, {
        method: 'DELETE',
        headers: getAdminHeaders()
      });
      if (res.ok) div.remove();
      else showToast('Не удалось удалить вложение.', 'error');
    } catch (e) {
      showToast('Ошибка удаления.', 'error');
    }
  });
  container.appendChild(div);
}

async function uploadAttachment(lessonId, fileInput, attList) {
  const file = fileInput.files?.[0];
  if (!file) return;
  const formData = new FormData();
  formData.append('file', file);
  try {
    const res = await fetch(`${ADMIN_API_BASE}/lessons/${encodeURIComponent(lessonId)}/attachments`, {
      method: 'POST',
      headers: { Authorization: getAdminHeaders().Authorization },
      body: formData
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.message || 'Ошибка загрузки');
    renderAttachmentRow(attList, { id: data.id, url: data.url, original_name: data.original_name, mime_type: file.type }, lessonId);
    showToast('Файл загружен.', 'success');
  } catch (e) {
    showToast(e.message || 'Не удалось загрузить файл.', 'error');
  }
  fileInput.value = '';
}

function addQuizQuestionRow(container, data = {}) {
  if (!container) return;
  const questionText = data.question_text ?? '';
  const options = data.options || ['', '', '', ''];
  const correctIndex = data.correct_index ?? 0;

  const wrap = document.createElement('div');
  wrap.className = 'quiz-question-row';
  wrap.innerHTML = `
    <div class="form-field">
      <input type="text" class="form-input quiz-question-text" placeholder="Текст вопроса" value="${escapeHtml(questionText)}" />
    </div>
    <div class="quiz-options">
      ${options
        .map(
          (opt, i) => `
        <label style="display:flex;align-items:center;gap:6px;margin:4px 0">
          <input type="radio" name="quiz-correct-${Date.now()}-${Math.random().toString(36).slice(2)}" class="quiz-correct" value="${i}" ${i === correctIndex ? 'checked' : ''} />
          <input type="text" class="form-input quiz-option" value="${escapeHtml(opt)}" placeholder="Вариант ${i + 1}" style="flex:1" />
        </label>
      `
        )
        .join('')}
    </div>
    <button type="button" class="btn btn-ghost btn-sm remove-quiz-question">Удалить вопрос</button>
  `;
  wrap.querySelector('.remove-quiz-question')?.addEventListener('click', () => wrap.remove());
  container.appendChild(wrap);
}

async function saveCourse(e) {
  e.preventDefault();

  const titleEl = document.getElementById('course-title');
  const descEl = document.getElementById('course-description');
  const modeEl = document.getElementById('course-form-mode');
  const submitBtn = document.getElementById('course-submit');

  if (!titleEl || !modeEl || !submitBtn) return;

  const lessonsNodes = document.querySelectorAll('#lessons-container .lesson-panel');
  const lessons = Array.from(lessonsNodes).map((node, index) => {
    const title = node.querySelector('.lesson-title')?.value || '';
    const content = node.querySelector('.lesson-content')?.value || '';
    const lessonId = node.dataset.lessonId || null;
    const quizRows = node.querySelectorAll('.quiz-question-row');
    const quiz_questions = [];
    quizRows.forEach((row) => {
      const question_text = row.querySelector('.quiz-question-text')?.value?.trim() || '';
      const optionInputs = row.querySelectorAll('.quiz-option');
      const options = Array.from(optionInputs).map((inp) => inp.value.trim()).filter(Boolean);
      const checked = row.querySelector('.quiz-correct:checked');
      const correct_index = checked ? parseInt(checked.value, 10) : 0;
      if (question_text && options.length >= 2) {
        quiz_questions.push({ question_text, options, correct_index });
      }
    });
    return {
      id: lessonId || undefined,
      title,
      content,
      order_index: index,
      quiz_questions: quiz_questions.length ? quiz_questions : undefined
    };
  });

  const payload = {
    title: titleEl.value,
    description: descEl?.value || '',
    lessons
  };

  submitBtn.classList.add('disabled');

  try {
    const editId = modeEl.dataset.editId;
    const method = editId ? 'PUT' : 'POST';
    const url = editId
      ? `${ADMIN_API_BASE}/courses/${encodeURIComponent(editId)}`
      : `${ADMIN_API_BASE}/courses`;

    const res = await fetch(url, {
      method,
      headers: getAdminHeaders(),
      body: JSON.stringify(payload)
    });

    if (!res.ok) throw new Error('failed');

    const data = await res.json().catch(() => ({}));
    showToast('Курс сохранён.', 'success');
    resetCourseForm();
    const courses = await loadCourses();
    const savedId = data.id || editId;
    const course = Array.isArray(courses) ? courses.find((c) => c.id === savedId) : null;
    if (course) fillCourseForm(course);
  } catch (e) {
    console.error(e);
    showToast('Не удалось сохранить курс.', 'error');
  } finally {
    submitBtn.classList.remove('disabled');
  }
}

function resetCourseForm() {
  const titleEl = document.getElementById('course-title');
  const descEl = document.getElementById('course-description');
  const lessonsContainer = document.getElementById('lessons-container');
  const modeEl = document.getElementById('course-form-mode');

  if (titleEl) titleEl.value = '';
  if (descEl) descEl.value = '';
  if (lessonsContainer) lessonsContainer.innerHTML = '';
  if (modeEl) {
    modeEl.textContent = 'Режим: создание';
    delete modeEl.dataset.editId;
  }
}

async function deleteCourse(id) {
  try {
    const res = await fetch(`${ADMIN_API_BASE}/courses/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: getAdminHeaders()
    });
    if (!res.ok && res.status !== 204) {
      throw new Error('failed');
    }
    showToast('Курс удалён.', 'success');
  } catch (e) {
    console.error(e);
    showToast('Не удалось удалить курс.', 'error');
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  initNavbar();

  const ok = await ensureAdminAccess();
  if (!ok) return;

  if (document.getElementById('admin-stats')) {
    loadDashboardStats();
  }

  if (document.getElementById('admin-courses-body')) {
    loadCourses();

    const addLessonBtn = document.getElementById('add-lesson-btn');
    if (addLessonBtn) {
      addLessonBtn.addEventListener('click', () => addLessonRow());
    }

    const courseForm = document.getElementById('course-form');
    const resetBtn = document.getElementById('course-reset');
    if (courseForm) {
      courseForm.addEventListener('submit', saveCourse);
    }
    if (resetBtn) {
      resetBtn.addEventListener('click', resetCourseForm);
    }
  }
});

