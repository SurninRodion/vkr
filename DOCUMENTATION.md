# Документация проекта PromptLearn / Prompt Academy

Документация по текущему варианту разработки для работы в других нейросетевых сервисах и продолжения разработки.

---

## 1. Общее описание

**Название:** PromptLearn (бэкенд) / Prompt Academy (фронтенд, бренд).

**Назначение:** Платформа для обучения промпт-инжинирингу: курсы, практические задания, анализ промптов (в т.ч. через внешний ИИ или эвристики), рейтинг, профиль пользователя, админ-панель.

**Стек:**
- **Backend:** Node.js, Express, SQLite3, JWT, bcrypt, uuid.
- **Frontend:** статический HTML + CSS + vanilla JavaScript (ES modules), без фреймворков.
- **База данных:** один файл SQLite (`database.db` по умолчанию).

---

## 2. Структура проекта

```
vkr_test/
├── backend/
│   ├── config.js              # PORT, JWT_SECRET, DB_PATH, AI_API_*, CORS_ORIGIN
│   ├── server.js              # Точка входа Express, статика frontend, API-роуты
│   ├── db/
│   │   ├── db.js              # Подключение к SQLite
│   │   └── initDB.js          # Создание таблиц и сиды заданий
│   ├── models/
│   │   ├── userModel.js       # users, лидерборд, роли
│   │   ├── taskModel.js       # tasks
│   │   ├── resultModel.js     # task_results
│   │   └── promptModel.js     # prompts (история анализа)
│   ├── controllers/
│   │   ├── authController.js  # register, login
│   │   ├── taskController.js  # listTasks, getTask, submitSolution
│   │   ├── promptController.js# analyze
│   │   ├── profileController.js
│   │   ├── leaderboardController.js
│   │   └── adminController.js # CRUD tasks, prompts, courses, users; stats; import; generate-ai
│   ├── routes/
│   │   ├── authRoutes.js
│   │   ├── taskRoutes.js
│   │   ├── promptRoutes.js
│   │   ├── profileRoutes.js
│   │   ├── leaderboardRoutes.js
│   │   └── adminRoutes.js
│   ├── middleware/
│   │   ├── authMiddleware.js  # JWT → req.user
│   │   └── adminMiddleware.js # req.user.role === 'admin'
│   ├── utils/
│   │   └── aiAnalyzer.js      # Анализ промпта: внешний API или эвристики
│   └── scripts/
│       └── createAdminUser.js # Создание/обновление админа по email/password
├── frontend/
│   ├── index.html             # Главная
│   ├── login.html, register.html
│   ├── courses.html, course.html
│   ├── practice.html         # Список заданий и отправка решений
│   ├── library.html           # Библиотека промптов
│   ├── leaderboard.html
│   ├── profile.html
│   ├── lab.html               # Песочница анализа промпта
│   ├── styles.css             # Общие стили
│   ├── js/
│   │   ├── api.js             # Базовый request(), все api* функции
│   │   ├── ui.js              # Навигация, модалки, авторизация в UI
│   │   ├── tasks.js, profile.js, leaderboard.js, lab.js
│   │   └── admin/
│   │       ├── admin.js
│   │       ├── adminTasks.js, adminPrompts.js, adminUsers.js
│   │       └── (страницы админки в admin/*.html)
│   └── admin/
│       ├── index.html         # Редирект/дашборд админки
│       ├── dashboard.html, tasks.html, prompts.html, courses.html, users.html
│       └── ...
└── DOCUMENTATION.md           # Этот файл
```

---

## 3. Конфигурация и окружение

Файл `backend/config.js` читает переменные из `process.env` (через `dotenv` из `.env` в корне `backend/`).

| Переменная   | Описание                          | По умолчанию                    |
|-------------|------------------------------------|----------------------------------|
| PORT        | Порт сервера                      | 5000                             |
| JWT_SECRET  | Секрет для подписи JWT            | dev_jwt_secret_change_me         |
| DB_PATH     | Путь к файлу SQLite               | path.join(__dirname, 'database.db') |
| AI_API_URL  | URL внешнего API для анализа промптов | '' (пусто = только эвристики) |
| AI_API_KEY  | Ключ для внешнего AI API          | ''                               |
| CORS_ORIGIN | Разрешённый origin для CORS       | http://localhost:5500            |

**Запуск:**
- Из корня проекта: в папке `backend` выполнить `npm install`, затем `npm start` (или `npm run dev` с nodemon).
- Фронтенд раздаётся самим Express из `frontend/` (`express.static`), т.е. приложение доступно по `http://localhost:PORT` (например 5000).

**Инициализация БД:**  
`node backend/db/initDB.js` или скрипт `npm run initdb` из папки backend. Таблицы создаются при первом запуске `server.js` (вызов `initDB()`).

**Создание админа:**  
`node backend/scripts/createAdminUser.js [email] [password] [name]`  
По умолчанию: email `admin@promptlearn.local`, password `admin123`, name `Admin`. Если пользователь есть — ему выставляется роль `admin`.

---

## 4. База данных (SQLite)

Основные таблицы (из `initDB.js` и кода):

- **users**  
  `id` (TEXT PK), `email` (UNIQUE), `password_hash`, `name`, `role` (DEFAULT 'user'), `points`, `level`, `created_at`.

- **tasks**  
  `id` (TEXT PK), `title`, `description`, `difficulty`, `points`, `type`.  
  Типы заданий: например `improvement`, `lesson`, `optimization`. Сложность: `easy`, `medium`, `hard`.

- **task_results**  
  `id`, `user_id`, `task_id`, `prompt_text`, `ai_feedback` (JSON текст), `score`, `created_at`.

- **prompts**  
  `id`, `user_id`, `prompt_text`, `ai_response`, `analysis` (JSON текст), `created_at`.  
  История анализа промптов (лаборатория и т.п.).

- **prompt_library**  
  `id`, `title`, `category`, `description`, `example`, `analysis`, `created_at`.  
  Админская библиотека промптов.

- **courses**  
  `id`, `title`, `description`.

- **course_lessons**  
  `id`, `course_id`, `title`, `content`, `order_index`.

- **course_enrollments**  
  `id`, `user_id`, `course_id`, `enrolled_at`. Уникальная пара (user_id, course_id).

- **course_lesson_progress**  
  `user_id`, `lesson_id`, `completed_at`. Прогресс пользователя по урокам (отметка «пройден»).

- **course_lesson_attachments**  
  `id`, `lesson_id`, `file_path`, `original_name`, `mime_type`, `order_index`. Файлы и изображения к уроку (каталог `backend/uploads/courses/<lessonId>/`).

- **course_quiz_questions**  
  `id`, `lesson_id`, `question_text`, `options` (JSON), `correct_index`, `order_index`. Вопросы закрепляющего теста; урок считается пройденным только после прохождения теста (порог 80%).

Уровень пользователя пересчитывается при начислении очков: `level = 1 + (points / 500)`.

---

## 5. API

Базовый URL: `/api`. Все ответы с ошибкой — JSON с полем `message` (строка). Успешные ответы — JSON (кроме 204).

### Авторизация

- В запросах, требующих авторизации, заголовок:  
  `Authorization: Bearer <JWT>`
- Токен на фронтенде хранится в `localStorage` под ключом `promptlearn_auth` в виде объекта `{ token: "..." }` (см. `frontend/js/api.js`: `getStoredToken()`).

### 5.1. Публичные маршруты

| Метод | Путь | Описание |
|-------|------|----------|
| GET | /api/health | Health-check: `{ status, message }` |
| POST | /api/auth/register | Регистрация. Body: `{ email, password, name }`. Ответ: `{ token, user }` |
| POST | /api/auth/login | Вход. Body: `{ email, password }`. Ответ: `{ token, user }` |
| GET | /api/tasks | Список всех заданий (массив объектов task) |
| GET | /api/tasks/:id | Одно задание по id |
| GET | /api/leaderboard | Топ пользователей по очкам (массив: id, name, email, points, level) |

### 5.2. С авторизацией (JWT)

| Метод | Путь | Описание |
|-------|------|----------|
| POST | /api/prompts/analyze | Анализ промпта. Body: `{ prompt }`. Ответ: `{ aiResponse, analysis }` |
| POST | /api/tasks/submit | Отправка решения по заданию. Body: `{ taskId, prompt }`. Ответ: `{ message, score, analysis, pointsAwarded }` |
| GET | /api/profile | Профиль текущего пользователя |
| GET | /api/profile/courses | Курсы пользователя с прогрессом (мои курсы) |
| PUT | /api/profile | Обновление профиля. Body: `{ name }` и др. |
| GET | /api/courses | Публичный список курсов (id, title, description, lessonsCount) |
| GET | /api/courses/:id | Один курс с уроками (публично) |
| GET | /api/courses/:id/progress | Прогресс по курсу для текущего пользователя |
| POST | /api/courses/:id/enroll | Записаться на курс |
| POST | /api/courses/:courseId/lessons/:lessonId/complete | Отметить урок как пройденный (если у урока нет теста) |
| POST | /api/courses/:courseId/lessons/:lessonId/quiz/submit | Отправить ответы на тест урока. Body: `{ answers: [0, 1, …] }`. При прохождении (≥80%) урок помечается пройденным |

### 5.3. Админ (JWT + role === 'admin')

Все маршруты под префиксом `/api/admin`, после `authMiddleware` и `adminMiddleware`.

| Метод | Путь | Описание |
|-------|------|----------|
| GET | /api/admin/stats | Статистика: totalUsers, totalTasks, totalPrompts, activeUsers |
| GET/POST | /api/admin/tasks | Список заданий / создание задания. POST body: title, description, difficulty, points, type |
| PUT/DELETE | /api/admin/tasks/:id | Обновление / удаление задания |
| POST | /api/admin/import/tasks | Импорт заданий (тело — массив объектов заданий) |
| POST | /api/admin/tasks/generate-ai | Генерация заданий через ИИ (используется aiAnalyzer/логика в adminController) |
| GET/POST | /api/admin/prompts | Библиотека промптов: список / создание |
| PUT/DELETE | /api/admin/prompts/:id | Обновление / удаление записи библиотеки |
| GET/POST | /api/admin/courses | Курсы: список / создание (уроки с id сохраняются при редактировании) |
| PUT/DELETE | /api/admin/courses/:id | Обновление / удаление курса |
| POST | /api/admin/lessons/:lessonId/attachments | Загрузка файла к уроку (multipart, поле `file`) |
| DELETE | /api/admin/attachments/:id | Удаление вложения |
| GET | /api/admin/users | Список пользователей |
| PUT | /api/admin/users/:id | Смена роли и т.д. (updateUserRole) |
| DELETE | /api/admin/users/:id | Удаление пользователя |

Формат полей заданий (tasks): `id`, `title`, `description`, `difficulty`, `points`, `type`. При создании `id` генерируется на бэкенде (uuid).

---

## 6. Анализ промптов (ИИ и эвристики)

Модуль: `backend/utils/aiAnalyzer.js`.

- **analyzePrompt(prompt)** — основная функция, возвращает объект анализа.
- Если в конфиге заданы `AI_API_URL` и `AI_API_KEY`, вызывается внешний API:
  - Запрос: `POST` на `AI_API_URL`, заголовок `Authorization: Bearer <AI_API_KEY>`, body: `{ prompt }`.
  - Ожидается JSON-ответ, который целиком считается результатом анализа (должен содержать поля вроде `aiResponse`, `clarity`, `structure`, `specificity`, `effectiveness`, `suggestions` при необходимости).
- Если внешний API не настроен или не вернул объект — используется **эвристический анализ** `buildHeuristicAnalysis(prompt)`:
  - Учитывает длину текста, наличие примеров (например|example|e.g.), нумерованных шагов.
  - Возвращает: `clarity`, `structure`, `specificity`, `effectiveness` (числа до 10), `suggestions` (строка), `aiResponse` (строка с рекомендациями).

На фронтенде в `api.js` есть `normalizeAnalysisToFive(analysis)` — переводит числовые оценки (например 1–10) в шкалу 1–5 для отображения.

---

## 7. Фронтенд

- **Точка входа:** раздача статики из `frontend/` (корень сайта — `index.html`).
- **Язык интерфейса:** русский.
- **Стили:** один файл `frontend/styles.css`.
- **Скрипты:** ES-модули; базовый слой — `api.js` (все запросы к API), `ui.js` (навигация, кнопки входа/профиля, модалки). Страницы подключают нужные модули (tasks.js, lab.js, profile.js, leaderboard.js, admin/*.js).
- **Авторизация в UI:** при успешном логине/регистрации в `localStorage` сохраняется объект с `token` (ключ `promptlearn_auth`). Кнопки «Войти»/«Профиль» и отображение контента зависят от наличия токена (обработчики в ui.js и на страницах).
- **Страницы:**
  - Главная: `index.html`
  - Авторизация: `login.html`, `register.html`
  - Курсы: `courses.html`, `course.html`
  - Практика (задания): `practice.html`
  - Библиотека: `library.html`
  - Рейтинг: `leaderboard.html`
  - Профиль: `profile.html`
  - Лаборатория (анализ промпта): `lab.html`
  - Админка: `admin/dashboard.html`, `admin/tasks.html`, `admin/prompts.html`, `admin/courses.html`, `admin/users.html` и т.д.

Админ-страницы доступны по путям вида `/admin/...`; проверка роли выполняется при запросах к `/api/admin/*`.

---

## 8. Важные соглашения для доработки

- Сообщения пользователю и логи на бэкенде — на **русском** (например: «Требуется авторизация», «Задание не найдено»).
- Идентификаторы сущностей — **UUID** (пакет `uuid`, v4).
- Пароли: хеширование **bcrypt** (в authController — 10 раундов).
- JWT: в payload — `id`, `email`, `role`; срок жизни — 7 дней.
- При отправке решения по заданию пользователю начисляются очки задания (`task.points`), результат сохраняется в `task_results`, анализ вызывается через `analyzePrompt` (внешний ИИ или эвристики).
- Бэкенд не использует TypeScript; фронтенд — без сборщика (чистый JS и HTML/CSS).

---

## 9. Краткая шпаргалка для нейросетевых сервисов

- **Что это:** образовательная платформа по промпт-инжинирингу (Node/Express + SQLite + статический фронт).
- **Запуск:** `cd backend && npm install && npm start`; открыть в браузере `http://localhost:5000`.
- **БД:** SQLite, путь в `config.DB_PATH`; схема создаётся в `db/initDB.js`.
- **Админ:** создать скриптом `createAdminUser.js`; все админ-действия через `/api/admin/*` с JWT и ролью `admin`.
- **Анализ промпта:** логика в `utils/aiAnalyzer.js`; при наличии `AI_API_URL` и `AI_API_KEY` — внешний POST `{ prompt }`, иначе эвристики.
- **Фронт:** HTML/CSS/JS в `frontend/`; API-вызовы в `frontend/js/api.js`; токен в `localStorage` под ключом `promptlearn_auth`.

Этого достаточно, чтобы понимать структуру, API, БД и конфигурацию при доработке проекта в других средах и нейросетевых сервисах.
