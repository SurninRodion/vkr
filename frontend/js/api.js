const API_BASE = '/api';
const AUTH_STORAGE_KEY = 'promptlearn_auth';

function getStoredToken() {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed?.token || null;
  } catch {
    return null;
  }
}

async function request(path, { method = 'GET', body, withAuth = true } = {}) {
  const headers = {
    'Content-Type': 'application/json',
  };

  if (withAuth) {
    const token = getStoredToken();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }
  }

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    let message = 'API error';
    try {
      const data = await res.json();
      message = data.message || message;
    } catch {
      // ignore
    }
    throw new Error(message);
  }

  if (res.status === 204) return null;
  return res.json();
}

export function normalizeAnalysisToFive(analysis) {
  const src = analysis || {};
  const toFive = (value, fallback = 3) => {
    const v = typeof value === 'number' ? value : fallback;
    const five = Math.max(1, Math.min(5, Math.round((v / 10) * 5)));
    return five;
  };

  return {
    structure: toFive(src.structure),
    clarity: toFive(src.clarity),
    specificity: toFive(src.specificity),
    effectiveness: toFive(src.effectiveness),
  };
}

export async function apiLogin(email, password) {
  return request('/auth/login', {
    method: 'POST',
    body: { email, password },
    withAuth: false,
  });
}

export async function apiRegister(payload) {
  return request('/auth/register', {
    method: 'POST',
    body: payload,
    withAuth: false,
  });
}

export async function apiGetTasks() {
  return request('/tasks', { method: 'GET', withAuth: false });
}

export async function apiGetTask(id) {
  return request(`/tasks/${encodeURIComponent(id)}`, {
    method: 'GET',
    withAuth: false,
  });
}

/** Список id заданий, выполненных текущим пользователем. */
export async function apiGetCompletedTaskIds() {
  const data = await request('/tasks/completed-ids', {
    method: 'GET',
    withAuth: true,
  });
  return data.completedTaskIds || [];
}

/** Результат текущего пользователя по заданию (для просмотра после выполнения). */
export async function apiGetTaskResult(taskId) {
  return request(`/tasks/${encodeURIComponent(taskId)}/result`, {
    method: 'GET',
    withAuth: true,
  });
}

export async function apiSubmitPrompt(promptText) {
  const data = await request('/prompts/analyze', {
    method: 'POST',
    body: { prompt: promptText },
    withAuth: true,
  });

  return {
    response: data.generatedContent || data.aiResponse || '',
    analysis: normalizeAnalysisToFive(data.analysis),
    generatedContent: data.generatedContent || null,
    analysisComment: data.analysis?.aiResponse || null,
  };
}

export async function apiSubmitTaskSolution(taskId, promptText) {
  const data = await request('/tasks/submit', {
    method: 'POST',
    body: { taskId, prompt: promptText },
    withAuth: true,
  });

  return {
    response: data.generatedContent || data.analysis?.aiResponse || data.message || '',
    analysis: normalizeAnalysisToFive(data.analysis),
    generatedContent: data.generatedContent || null,
    analysisComment: data.analysis?.aiResponse || null,
    rawScore: typeof data.score === 'number' ? data.score : null,
    pointsAwarded: typeof data.pointsAwarded === 'number' ? data.pointsAwarded : null,
  };
}

export async function apiGetLeaderboard() {
  return request('/leaderboard', { method: 'GET', withAuth: false });
}

export async function apiGetProfile() {
  return request('/profile', { method: 'GET', withAuth: true });
}

export async function apiUpdateProfile(payload) {
  return request('/profile', {
    method: 'PUT',
    body: payload,
    withAuth: true,
  });
}

// Пока прогресс берём из простого мок-ответа — не персонализированный,
// чтобы не мешать основной логике профиля.
export async function apiGetProgress() {
  return Promise.resolve({
    coursesCompleted: 35,
    tasksCompleted: 20,
  });
}

// ——— Курсы (публичные и для авторизованных) ———

export async function apiGetCourses() {
  return request('/courses', { method: 'GET', withAuth: false });
}

export async function apiGetCourse(id) {
  return request(`/courses/${encodeURIComponent(id)}`, { method: 'GET', withAuth: false });
}

export async function apiEnrollCourse(courseId) {
  return request(`/courses/${encodeURIComponent(courseId)}/enroll`, {
    method: 'POST',
    withAuth: true,
  });
}

export async function apiCompleteLesson(courseId, lessonId) {
  return request(
    `/courses/${encodeURIComponent(courseId)}/lessons/${encodeURIComponent(lessonId)}/complete`,
    { method: 'POST', withAuth: true }
  );
}

export async function apiSubmitQuiz(courseId, lessonId, answers) {
  return request(
    `/courses/${encodeURIComponent(courseId)}/lessons/${encodeURIComponent(lessonId)}/quiz/submit`,
    { method: 'POST', body: { answers }, withAuth: true }
  );
}

export async function apiCheckStepAnswer(courseId, lessonId, stepId, answerIndex) {
  return request(
    `/courses/${encodeURIComponent(courseId)}/lessons/${encodeURIComponent(lessonId)}/steps/${encodeURIComponent(stepId)}/check`,
    { method: 'POST', body: { answer: answerIndex }, withAuth: true }
  );
}

export async function apiGetMyCourses() {
  return request('/profile/courses', { method: 'GET', withAuth: true });
}

export async function apiGetCourseProgress(courseId) {
  return request(`/courses/${encodeURIComponent(courseId)}/progress`, {
    method: 'GET',
    withAuth: true,
  });
}

/** Ответ на практический шаг курса: сохранение + проверка GigaChat (как в «Практике»). */
export async function apiSubmitCoursePractical(courseId, lessonId, stepId, text) {
  const data = await request(
    `/courses/${encodeURIComponent(courseId)}/lessons/${encodeURIComponent(lessonId)}/steps/${encodeURIComponent(stepId)}/practical/submit`,
    { method: 'POST', body: { text }, withAuth: true }
  );
  return {
    submissionText: data.submissionText,
    analysis: normalizeAnalysisToFive(data.analysis),
    analysisRaw: data.analysis,
    analysisComment: data.analysis?.aiResponse || null,
    score: typeof data.score === 'number' ? data.score : null,
  };
}

