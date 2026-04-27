# Документация проекта PromptLearn / Prompt Academy

---

## 1. Общее описание

**Название:** Prompt Academy (фронтенд, бренд).

**Назначение:** Платформа для обучения промпт-инжинирингу: курсы, практические задания, анализ промптов (в т.ч. через внешний ИИ или эвристики), рейтинг, профиль пользователя, админ-панель.

**Стек:**
- **Backend:** Node.js, Express, SQLite3, JWT, bcrypt, uuid, nodemailer (SMTP-письма).
- **PDF сертификатов:** Playwright (Chromium) — серверная генерация PDF 1:1 по HTML.
- **Frontend:** статический HTML + CSS + vanilla JavaScript (ES modules), без фреймворков.
- **База данных:** один файл SQLite (`database.db` по умолчанию).

---

## 2. Структура проекта

### 2.0. Что означают каталоги (словарик)

Ниже — краткое объяснение, **зачем нужны папки** и как между собой связаны части бекенда/фронтенда.

#### Backend

- **`backend/routes/`**: “карта API”.
  - Здесь объявляются HTTP-маршруты (`GET/POST/PUT/...`) и привязываются к обработчикам из `controllers`.
  - Также здесь подключаются промежуточные проверки (`middleware`), например авторизация.

- **`backend/controllers/`**: бизнес-логика endpoint’ов.
  - Каждый контроллер — набор функций-обработчиков для конкретной области: `auth`, `tasks`, `profile`, `courses`, `admin` и т.д.
  - Контроллеры валидируют входные данные, вызывают `models` (работа с БД), `utils` (вспомогательные функции) и формируют JSON-ответ.

- **`backend/models/`**: слой работы с БД (SQLite).
  - Здесь лежат функции, которые выполняют SQL-запросы (`SELECT/INSERT/UPDATE/DELETE`) и возвращают данные контроллерам.
  - Важно: модели не должны “знать” про HTTP — только про данные и SQL.

- **`backend/middleware/`**: промежуточные обработчики Express.
  - Это функции вида `(req, res, next)`, которые выполняются **до** контроллера.
  - Примеры: проверка JWT (`authMiddleware`), проверка роли админа (`adminMiddleware`), запрет действий до подтверждения email (`requireVerifiedEmail`).

- **`backend/utils/`**: утилиты и интеграции.
  - Вспомогательные модули, которые не относятся напрямую к роутингу/БД: отправка писем (`mailer.js`), работа с AI (`aiAnalyzer.js`) и т.п.

- **`backend/db/`**: инфраструктура SQLite.
  - `db.js` — подключение к файлу базы.
  - `initDB.js` — создание схемы таблиц и “мягкие миграции”.
  - вспомогательные скрипты для разработки (например очистка/сиды).

- **`backend/scripts/`**: одноразовые/админские скрипты, которые запускаются вручную (CLI).
  - Например создание администратора.

#### Frontend

- **`frontend/*.html`**: страницы приложения (статический фронт без сборщика).
  - Переходы между страницами — обычные переходы по URL.

- **`frontend/js/`**: JS-логика страниц (ES modules).
  - `api.js` — единый клиент для вызова бекенда (`/api/...`).
  - Остальные файлы обычно соответствуют страницам (`profile.js` → `profile.html`).

- **`frontend/js/admin/`** и **`frontend/admin/`**: админка.
  - `frontend/admin/*.html` — страницы админки.
  - `frontend/js/admin/*.js` — логика этих страниц (CRUD, конструктор курсов и т.п.).

- **`frontend/styles.css`**: глобальные стили и компоненты UI (кнопки, модалки, навбар, карточки).

```
vkr/
├── backend/
│   ├── .env                   # (локально/на сервере) переменные окружения: JWT, SMTP, домен и т.п. (НЕ коммитить)
│   ├── config.js              # Чтение process.env (dotenv), экспорт конфигурации приложения
│   ├── package.json           # Зависимости backend (Express, sqlite3, nodemailer, jwt, bcrypt и т.д.)
│   ├── package-lock.json      # Lockfile npm
│   ├── server.js              # Точка входа Express: CORS, статика frontend, API-роуты, initDB()
│   ├── db/
│   │   ├── db.js              # Подключение к SQLite
│   │   ├── initDB.js          # Создание таблиц + «мягкие миграции» (ALTER TABLE ADD COLUMN)
│   │   └── clearTasks.js      # (утилита) очистка таблицы заданий (для разработки)
│   ├── models/
│   │   ├── userModel.js                # CRUD users: создание, профиль, очки/уровень, роли, last_seen, смена пароля
│   │   ├── taskModel.js                # CRUD tasks (задания)
│   │   ├── resultModel.js              # task_results: сохранение/получение результатов, статистика
│   │   ├── promptModel.js              # prompts: история анализов/генерации в «Лаборатории»
│   │   ├── emailVerificationModel.js   # одноразовые токены подтверждения email (хэш в БД, raw токен в ссылке)
│   │   ├── passwordResetModel.js       # одноразовые токены сброса пароля (TTL, one-time)
│   │   └── rateLimitModel.js           # персистентный rate-limit через SQLite (таблица auth_rate_limits)
│   ├── controllers/
│   │   ├── authController.js         # register/login + email verify/resend + forgot/reset password + отправка писем
│   │   ├── taskController.js         # список/получение задания, submitSolution, результаты, completed ids
│   │   ├── promptController.js       # analyze: анализ и генерация через GigaChat/AI
│   │   ├── profileController.js
│   │   ├── leaderboardController.js
│   │   └── adminController.js # CRUD tasks, prompts, courses, users; stats; import; generate-ai
│   ├── routes/
│   │   ├── authRoutes.js
│   │   ├── taskRoutes.js
│   │   ├── promptRoutes.js
│   │   ├── profileRoutes.js
│   │   ├── leaderboardRoutes.js
│   │   ├── courseRoutes.js
│   │   ├── libraryRoutes.js
│   │   └── adminRoutes.js
│   ├── middleware/
│   │   ├── authMiddleware.js  # JWT → req.user
│   │   ├── adminMiddleware.js # req.user.role === 'admin'
│   │   ├── requireVerifiedEmail.js # блокирует действия до подтверждения email (403 + code EMAIL_NOT_VERIFIED)
│   │   └── uploadMiddleware.js     # multer-конфигурация для загрузок (вложения и видео к урокам)
│   ├── utils/
│   │   ├── aiAnalyzer.js      # Анализ/генерация промпта: GigaChat или эвристики/внешний API
│   │   └── mailer.js          # nodemailer transport + sendMail() (SMTP) + проверка конфигурации
│   └── scripts/
│       └── createAdminUser.js # Создание/обновление админа по email/password
├── frontend/
│   ├── index.html             # Главная
│   ├── login.html             # Вход + модалки «Забыли пароль» и «Новый пароль по ссылке»
│   ├── register.html          # Регистрация
│   ├── courses.html           # Список курсов
│   ├── course.html            # Страница курса (уроки/прогресс)
│   ├── practice.html          # Список заданий и отправка решений
│   ├── library.html           # Библиотека промптов
│   ├── leaderboard.html
│   ├── profile.html
│   ├── lab.html               # Песочница анализа промпта
│   ├── styles.css             # Общие стили
│   ├── js/
│   │   ├── api.js             # Базовый request(); ApiError; api* методы; форматирование retry-after для лимитов
│   │   ├── app.js             # Инициализация UI на страницах (navbar, общие обработчики)
│   │   ├── ui.js              # Навигация/модалки/guest gate, toasts, navbar
│   │   ├── toast.js           # Тост-уведомления
│   │   ├── auth.js            # login/register + модалки forgot/reset password (на login.html)
│   │   ├── auth-head.js       # небольшой скрипт в <head> (гидратация UI авторизации)
│   │   ├── home.js            # логика главной страницы
│   │   ├── tasks.js           # страница практики
│   │   ├── profile.js         # личный кабинет + модалка подтверждения email + resend + обработка verifyToken
│   │   ├── leaderboard.js     # рейтинг
│   │   ├── courses.js         # список курсов
│   │   ├── course.js          # курс/уроки/тесты/практика
│   │   ├── lab.js             # лаборатория анализа промптов
│   │   ├── library.js         # библиотека промптов
│   │   ├── pluralize.js       # склонения (рус.)
│   │   └── admin/
│   │       ├── admin.js
│   │       ├── adminTasks.js, adminPrompts.js, adminUsers.js
│   │       ├── courseBuilder.js      # конструктор курса (админ)
│   │       └── (страницы админки в admin/*.html)
│   └── admin/
│       ├── index.html         # Редирект/дашборд админки
│       ├── dashboard.html, tasks.html, prompts.html, courses.html, users.html
│       └── ...
└── DOCUMENTATION.md           # Этот файл
```

### 2.1. Backend: назначение ключевых файлов

- **`backend/server.js`**: единая точка входа.
  - включает CORS, JSON-parsing;
  - раздаёт статику фронта (`frontend/`) и `backend/uploads/` по `/uploads`;
  - подключает API-роуты `/api/*`;
  - запускает `initDB()`;
  - содержит редирект совместимости для старых ссылок подтверждения: `/verify-email?token=...` → `/profile?verifyToken=...`.

- **`backend/config.js`**: читает переменные окружения из `backend/.env` и экспортирует конфиг.

- **`backend/db/initDB.js`**: создаёт все таблицы (и добавляет новые колонки через `ALTER TABLE ... ADD COLUMN`, чтобы поддерживать уже существующую базу).

- **`backend/utils/mailer.js`**: SMTP-отправка писем через `nodemailer`. Проверяет, что SMTP настроен, иначе кидает ошибку `MAIL_NOT_CONFIGURED`.

- **`backend/controllers/authController.js`**: вся логика авторизации и “почтовых” сценариев:
  - `register`, `login`;
  - `verifyEmail`, `resendVerification`;
  - `forgotPassword`, `resetPassword`;
  - формирует ссылки из `APP_BASE_URL` и отправляет письма через `mailer`.

- **`backend/middleware/requireVerifiedEmail.js`**: блокирует действия до подтверждения email. Используется на маршрутах:
  - `/api/prompts/analyze`
  - `/api/tasks/submit`
  - защищённые действия курсов (`enroll`, `complete`, `quiz`, `steps`).

### 2.2. Frontend: назначение ключевых файлов

- **`frontend/login.html`**: форма входа + модалки:
  - “Забыли пароль?” (ввод email → письмо);
  - “Новый пароль” (открывается автоматически при `?resetToken=...`).

- **`frontend/profile.html` + `frontend/js/profile.js`**:
  - личный кабинет;
  - UI статуса email (подтверждён/нет) + кнопка resend;
  - модалка подтверждения email:
    - открывается после регистрации (`/profile?needsEmailVerify=1`);
    - подтверждает по ссылке из письма (`/profile?verifyToken=...`).

- **`frontend/js/api.js`**:
  - единый `request()` для API;
  - выбрасывает `ApiError` с `status` и `retryAfterSeconds` (для лимитов отправки писем);
  - содержит методы `apiResendVerification`, `apiVerifyEmail`, `apiForgotPassword`, `apiResetPassword`.

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
| APP_BASE_URL | Публичный base URL (для ссылок в письмах) | http://localhost:${PORT} |
| SMTP_HOST   | SMTP хост (например `smtp.yandex.ru`) | '' |
| SMTP_PORT   | SMTP порт (обычно 465) | 465 |
| SMTP_SECURE | `true` для TLS (465), `false` для STARTTLS (587) | true |
| SMTP_USER   | Логин SMTP (обычно email) | '' |
| SMTP_PASS   | Пароль SMTP (лучше “пароль приложения”) | '' |
| MAIL_FROM   | Адрес отправителя писем (`"Name <email@...>"`) | SMTP_USER |

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

База — один файл SQLite (`backend/database.db` или путь из `DB_PATH`). Схема создаётся/обновляется в `backend/db/initDB.js`.

Ниже — **все таблицы** и назначение ключевых колонок.

### 4.1. Таблица `users`

Хранит аккаунты пользователей.

- `id` (TEXT, PK): UUID пользователя.
- `email` (TEXT, UNIQUE, NOT NULL): логин пользователя.
- `password_hash` (TEXT, NOT NULL): bcrypt-хэш пароля.
- `name` (TEXT, NOT NULL): отображаемое имя (видно в рейтинге/профиле).
- `role` (TEXT, DEFAULT `'user'`): роль (`user` / `admin`).
- `points` (INTEGER, DEFAULT 0): очки за задания/активности.
- `level` (INTEGER, DEFAULT 1): уровень пользователя.
  - Пересчёт при начислении очков: \(level = 1 + \lfloor points / 500 \rfloor\).
- `created_at` (TEXT, DEFAULT `datetime('now')`): дата регистрации.
- `last_seen_at` (TEXT, nullable): “последняя активность” (обновляется в `authMiddleware`).
- `email_verified_at` (TEXT, nullable): дата подтверждения email. `NULL` = email не подтверждён.

### 4.2. Таблица `email_verification_tokens`

Одноразовые токены подтверждения email. В БД хранится **хэш**, raw-токен — только в ссылке.

- `id` (TEXT, PK): UUID токена.
- `user_id` (TEXT, NOT NULL): ссылка на `users.id`.
- `token_hash` (TEXT, NOT NULL): SHA-256(token) в hex.
- `expires_at` (TEXT, NOT NULL): срок действия (datetime).
- `used_at` (TEXT, nullable): когда токен был использован (one-time).
- `created_at` (TEXT): когда токен создан.

### 4.3. Таблица `password_reset_tokens`

Одноразовые токены сброса пароля (TTL, one-time). Принцип тот же: в БД хранится **хэш**.

- `id` (TEXT, PK): UUID токена.
- `user_id` (TEXT, NOT NULL): ссылка на `users.id`.
- `token_hash` (TEXT, NOT NULL): SHA-256(token) в hex.
- `expires_at` (TEXT, NOT NULL): срок действия (datetime).
- `used_at` (TEXT, nullable): токен использован.
- `created_at` (TEXT): создан.

### 4.4. Таблица `auth_rate_limits`

Персистентный rate-limit для “почтовых” эндпоинтов (чтобы не спамили письмами и не грузили SMTP).

- `id` (TEXT, PK): UUID записи лимита.
- `scope` (TEXT, NOT NULL): тип лимита, например:
  - `forgot_password:ip`
  - `forgot_password:email`
  - `resend_verification:ip`
  - `resend_verification:email`
- `key` (TEXT, NOT NULL): ключ лимита (IP или email).
- `window_start_ms` (INTEGER, NOT NULL): старт окна (epoch ms).
- `count` (INTEGER, NOT NULL): сколько запросов было в текущем окне.
- `created_at` (TEXT): создана.
- `updated_at` (TEXT): обновлена.
- UNIQUE(`scope`, `key`): одна строка на один ключ в рамках scope.

### 4.5. Таблица `tasks`

Справочник заданий практики.

- `id` (TEXT, PK): UUID задания.
- `title` (TEXT): заголовок.
- `description` (TEXT): описание задания.
- `difficulty` (TEXT): сложность (`easy`/`medium`/`hard`).
- `points` (INTEGER): сколько очков начислить за выполнение.
- `type` (TEXT): тип задания (например `improvement`, `lesson`, `optimization`).

### 4.6. Таблица `task_results`

Результаты выполнения заданий.

- `id` (TEXT, PK): UUID результата.
- `user_id` (TEXT, NOT NULL): пользователь.
- `task_id` (TEXT, NOT NULL): задание.
- `prompt_text` (TEXT, NOT NULL): текст ответа/промпта пользователя.
- `ai_feedback` (TEXT, nullable): JSON-строка с анализом/ответом ИИ.
- `score` (INTEGER, nullable): оценка (обычно на основе `analysis.effectiveness`).
- `created_at` (TEXT): время отправки.

### 4.7. Таблица `prompts`

История “Лаборатории” (анализ промпта/генерация).

- `id` (TEXT, PK): UUID записи.
- `user_id` (TEXT, NOT NULL): пользователь.
- `prompt_text` (TEXT, NOT NULL): исходный промпт.
- `ai_response` (TEXT, nullable): текст ответа/генерации.
- `analysis` (TEXT, nullable): JSON-строка анализа.
- `created_at` (TEXT): время записи.

### 4.8. Таблица `prompt_library`

Админская библиотека промптов (шаблоны и примеры).

- `id` (TEXT, PK)
- `title` (TEXT)
- `category` (TEXT, nullable)
- `description` (TEXT, nullable)
- `example` (TEXT, nullable)
- `analysis` (TEXT, nullable): пояснение/разбор
- `created_at` (TEXT)

### 4.9. Таблицы курсов

#### `courses`
- `id` (TEXT, PK)
- `title` (TEXT)
- `description` (TEXT, nullable)

#### `course_lessons`
- `id` (TEXT, PK)
- `course_id` (TEXT, NOT NULL): ссылка на `courses.id`
- `title` (TEXT)
- `content` (TEXT, nullable): контент урока (теория)
- `order_index` (INTEGER): порядок
- `module_id` (TEXT, nullable): привязка к модулю (`course_modules.id`) — добавляется миграцией

#### `course_enrollments`
Записи пользователя на курс.
- `id` (TEXT, PK)
- `user_id` (TEXT, NOT NULL)
- `course_id` (TEXT, NOT NULL)
- `enrolled_at` (TEXT)
- UNIQUE(`user_id`, `course_id`)

#### `course_lesson_progress`
Отметка “урок пройден”.
- `user_id` (TEXT, PK часть)
- `lesson_id` (TEXT, PK часть)
- `completed_at` (TEXT)

#### `course_lesson_attachments`
Файлы/картинки к урокам (хранятся в `backend/uploads/...`, в таблице — метаданные).
- `id` (TEXT, PK)
- `lesson_id` (TEXT, NOT NULL)
- `file_path` (TEXT, NOT NULL): относительный путь в `backend/uploads`
- `original_name` (TEXT): оригинальное имя
- `mime_type` (TEXT, nullable)
- `order_index` (INTEGER)

#### `course_lesson_videos`
Видеофайлы уроков (загрузки из конструктора для шагов типа `video`).

- `id` (TEXT, PK)
- `lesson_id` (TEXT, NOT NULL)
- `file_path` (TEXT, NOT NULL): относительный путь в `backend/uploads`
- `original_name` (TEXT): оригинальное имя
- `mime_type` (TEXT, nullable)
- `created_at` (TEXT)

#### `course_quiz_questions`
Вопросы теста урока.
- `id` (TEXT, PK)
- `lesson_id` (TEXT, NOT NULL)
- `question_text` (TEXT)
- `options` (TEXT): JSON-массив вариантов
- `correct_index` (INTEGER)
- `order_index` (INTEGER)

#### `course_modules`
Модули курса (для группировки уроков).
- `id` (TEXT, PK)
- `course_id` (TEXT, NOT NULL)
- `title` (TEXT)
- `order_index` (INTEGER)

#### `course_lesson_steps`
Шаги урока (теория/видео/тест/практика).
- `id` (TEXT, PK)
- `lesson_id` (TEXT, NOT NULL)
- `step_type` (TEXT): `theory` / `video` / `test` / `practical`
- `order_index` (INTEGER)
- `payload` (TEXT, nullable): JSON-данные шага

#### `course_practical_submissions`
Ответы пользователей на практические шаги уроков (с проверкой ИИ).
- `id` (TEXT, PK)
- `user_id` (TEXT, NOT NULL)
- `course_id` (TEXT, NOT NULL)
- `lesson_id` (TEXT, NOT NULL)
- `step_id` (TEXT, NOT NULL)
- `submission_text` (TEXT, NOT NULL)
- `ai_feedback` (TEXT, nullable): JSON анализ
- `score` (INTEGER, nullable)
- `updated_at` (TEXT)
- UNIQUE(`user_id`, `course_id`, `lesson_id`, `step_id`)

#### `course_certificate_templates`
Шаблон сертификата для конкретного курса (на уровне курса).

- `course_id` (TEXT, PK): ссылка на `courses.id`.
- `enabled` (INTEGER): включена ли выдача сертификата (0/1).
- `title` (TEXT, nullable): заголовок для админки.
- `template_html` (TEXT, nullable): HTML шаблона (с плейсхолдерами).
- `template_css` (TEXT, nullable): CSS шаблона.
- `updated_at` (TEXT): дата обновления.

Плейсхолдеры:
- `{{user_name}}`
- `{{course_title}}`
- `{{issued_date}}`
- `{{serial}}`

#### `course_certificates`
Выданные сертификаты пользователям по курсам. Хранит **снимок** итогового HTML, чтобы сертификат не менялся задним числом при редактировании шаблона.

- `id` (TEXT, PK): UUID сертификата.
- `user_id` (TEXT, NOT NULL): ссылка на `users.id`.
- `course_id` (TEXT, NOT NULL): ссылка на `courses.id`.
- `serial` (TEXT, nullable): серийный номер.
- `issued_at` (TEXT): дата выдачи.
- `rendered_html` (TEXT, NOT NULL): итоговый HTML документа сертификата.
- `meta_json` (TEXT, nullable): JSON с метаданными.
- UNIQUE(`user_id`, `course_id`)

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
| GET | /api/auth/verify-email | Подтверждение email по токену. Query: `token`. Ответ: `{ message }` |
| POST | /api/auth/forgot-password | Запросить письмо сброса пароля. Body: `{ email }`. Ответ всегда “Если email зарегистрирован…” |
| POST | /api/auth/reset-password | Сбросить пароль. Body: `{ token, newPassword }`. Ответ: `{ message }` |
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
| GET | /api/profile/certificates | Сертификаты пользователя (список) |
| GET | /api/profile/certificates/:id/html | HTML конкретного сертификата (только владелец) |
| GET | /api/profile/certificates/:id/pdf | Скачать PDF сертификата (только владелец). PDF генерируется на сервере через Playwright/Chromium |
| PUT | /api/profile | Обновление профиля. Body: `{ name }` и др. |
| GET | /api/courses | Публичный список курсов (id, title, description, lessonsCount) |
| GET | /api/courses/:id | Один курс с уроками (публично) |
| GET | /api/courses/:id/progress | Прогресс по курсу для текущего пользователя |
| POST | /api/courses/:id/enroll | Записаться на курс |
| POST | /api/courses/:courseId/lessons/:lessonId/complete | Отметить урок как пройденный (если у урока нет теста) |
| POST | /api/courses/:courseId/lessons/:lessonId/quiz/submit | Отправить ответы на тест урока. Body: `{ answers: [0, 1, …] }`. При прохождении (≥80%) урок помечается пройденным |
| POST | /api/auth/resend-verification | Повторно отправить письмо подтверждения email (требует JWT) |

#### Требование подтверждения email

Некоторые действия доступны только при `users.email_verified_at IS NOT NULL`:
- `/api/prompts/analyze`
- `/api/tasks/submit`
- защищённые действия курсов (enroll/complete/quiz/steps)

Если email не подтверждён — ответ `403`:
```json
{ "message": "Подтвердите email, чтобы продолжить.", "code": "EMAIL_NOT_VERIFIED" }
```

#### Лимиты отправки писем (rate-limit)

Для `forgot-password` и `resend-verification` включён персистентный rate-limit (SQLite). При превышении возвращается `429`:
- JSON содержит `retryAfterSeconds`
- также устанавливается HTTP заголовок `Retry-After`

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
| GET | /api/admin/courses/:id/certificate-template | Получить шаблон сертификата курса (если шаблона нет — создаётся дефолтный) |
| PUT | /api/admin/courses/:id/certificate-template | Сохранить шаблон сертификата курса |
| POST | /api/admin/lessons/:lessonId/attachments | Загрузка файла к уроку (multipart, поле `file`) |
| POST | /api/admin/lessons/:lessonId/videos | Загрузка видео к уроку (multipart, поле `file`). Возвращает `{ id, url, original_name, mime_type }` |
| DELETE | /api/admin/attachments/:id | Удаление вложения |
| GET | /api/admin/users | Список пользователей |
| PUT | /api/admin/users/:id | Смена роли и т.д. (updateUserRole) |
| DELETE | /api/admin/users/:id | Удаление пользователя |

#### Видео в курсах (шаг `video`)

Шаги уроков хранятся в таблице `course_lesson_steps`. Для `step_type = "video"` используется `payload`:
- `payload.title` — заголовок
- `payload.url` — ссылка на видео
- `payload.description` — описание (опционально)

Поддерживаются два сценария:
- **Загруженный файл**: через админский endpoint `POST /api/admin/lessons/:lessonId/videos` (multipart `file`).
  - Сервер сохраняет файл в `backend/uploads/...` и возвращает `url` вида **`/uploads/...`**
  - Этот URL сохраняется в `payload.url`
  - На странице урока (`frontend/js/course.js`) такой URL отображается встроенным плеером: `<video controls>`
- **Внешняя ссылка (например YouTube)**: можно вручную указать в `payload.url`
  - На странице урока такая ссылка отображается через `<iframe>` (embed для YouTube)

Примечания:
- Загрузка видео работает только для уже сохранённого урока (нужен `lessonId`).
- Ограничения загрузки видео задаются в `backend/middleware/uploadMiddleware.js` (`uploadVideoSingle`): размер и список расширений.

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
  - Сертификат: `certificate.html` (просмотр одного сертификата)
  - Лаборатория (анализ промпта): `lab.html`
  - Админка: `admin/dashboard.html`, `admin/tasks.html`, `admin/prompts.html`, `admin/courses.html`, `admin/users.html` и т.д.

### 7.1. Почта и пользовательские сценарии

### 7.2. Сертификаты курсов

- **Автовыдача сертификата**: когда пользователь проходит все уроки курса (100% прогресс), сервер создаёт запись в `course_certificates` (HTML “замораживается” в `rendered_html`).
- **Шаблон по умолчанию**: при создании нового курса через админку сразу сохраняется дефолтный шаблон в `course_certificate_templates`.
- **Профиль**: сертификаты доступны в `profile.html` и открываются в модальном окне.
- **Скачивание PDF**: выполняется через `GET /api/profile/certificates/:id/pdf`. PDF генерируется на сервере через Playwright/Chromium, чтобы гарантировать корректную вёрстку и стили.

- **Подтверждение email**
  - При регистрации бэкенд отправляет письмо со ссылкой на `/profile?verifyToken=...`.
  - После регистрации фронт редиректит на `/profile?needsEmailVerify=1` и показывает модалку с инструкциями.
  - Переход по ссылке из письма открывает профиль и автоматически подтверждает email (модалка “подтверждаем…” → “готово”).

- **Забыли пароль**
  - На `login.html` есть кнопка “Забыли пароль?” → модалка ввода email.
  - Письмо содержит ссылку на `/login?resetToken=...`.
  - Страница входа автоматически открывает модалку “Новый пароль”, отправляет `POST /api/auth/reset-password`.

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

## 9. Развёртывание на удалённом сервере

Ниже — типовой сценарий, когда **домен и хостинг уже настроены** (DNS указывает на сервер, при необходимости SSL включён на стороне панели или веб-сервера). Остаётся установить Node.js, загрузить код и запустить один процесс Express, который отдаёт и API, и статический фронтенд.

### 9.1. Что должно быть на сервере

- **Node.js** версии, совместимой с проектом (LTS 18.x или 20.x обычно достаточно).
- Доступ по **SSH** (или деплой через панель хостинга с тем же набором шагов).
- Открытый **порт** для приложения (часто внутренний, например `5000`, а снаружи 80/443 обслуживает nginx/Apache — см. ниже).

### 9.2. Загрузка кода

В каталог на сервере (например `/var/www/promptlearn` или `~/apps/promptlearn`):

- клонировать репозиторий: `git clone <url> && cd <папка-проекта>`, **или**
- скопировать архив проекта и распаковать.

Структура должна сохраниться: корень содержит папки `backend/` и `frontend/`.

### 9.3. Зависимости и переменные окружения

```bash
cd backend
npm install --production
```

Если включено скачивание PDF сертификатов (по умолчанию включено), установите Chromium для Playwright:

```bash
cd backend
npx playwright install chromium
```

Создайте файл **`backend/.env`** (не коммитьте его в git). Минимум для продакшена:

| Переменная    | Значение |
|---------------|----------|
| `PORT`        | Порт, на котором слушает Node (например `5000`), если прокси не передаёт порт иначе. |
| `JWT_SECRET`  | Длинная случайная строка; **обязательно смените** относительно значения по умолчанию. |
| `CORS_ORIGIN` | Публичный URL сайта с протоколом, например `https://ваш-домен.ru`. Должен совпадать с тем, по какому адресу пользователи открывают приложение в браузере (включая `https` и без лишнего слэша в конце, если иначе не настроено). |
| `DB_PATH`     | По желанию: абсолютный путь к файлу SQLite, если не хотите хранить `database.db` внутри `backend/`. |

При необходимости задайте также `AI_API_URL`, `AI_API_KEY` или переменные GigaChat — по аналогии с локальной разработкой (см. раздел 3).

Инициализация БД при первом запуске сервера выполняется автоматически; при необходимости можно отдельно выполнить `npm run initdb` из папки `backend`.

Создание администратора на сервере:

```bash
cd backend
node scripts/createAdminUser.js ваш@email.ru НадёжныйПароль "Имя Админа"
```

### 9.4. Запуск вручную (проверка)

```bash
cd backend
npm start
```

Проверьте с сервера: `curl -s http://127.0.0.1:5000/api/health` (подставьте свой `PORT`). В браузере сайт должен открываться по вашему домену только после настройки прокси (следующий подраздел) или если хостинг пробрасывает трафик на этот порт напрямую.

### 9.5. Постоянная работа (PM2 или systemd)

Чтобы процесс переживал перезагрузку и падения, используйте **PM2** или **systemd**.

**Пример PM2** (после `npm install -g pm2`):

```bash
cd /путь/к/проекту/backend
pm2 start server.js --name promptlearn
pm2 save
pm2 startup   # один раз — следуйте подсказкам для автозапуска
```

Рабочая директория должна быть `backend/`, чтобы находились `.env`, `database.db` и относительные пути к `frontend/` в `server.js`.

### 9.6. Прокси (nginx) и HTTPS

Если перед Node стоит **nginx**: виртуальный хост слушает 443, SSL выдаётся certbot’ом или панелью хостинга; в `location /` задаётся прокси на приложение, например:

```nginx
location / {
    proxy_pass http://127.0.0.1:5000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

Порт `5000` замените на ваш `PORT`. Загрузка файлов в админке (курсы) использует те же лимиты тела запроса — при больших вложениях при необходимости увеличьте `client_max_body_size` в nginx.

### 9.7. Обновление и резервное копирование

- Краткое обновление на уже настроенном сервере: см. **пошаговый цикл в п. 9.8**.
- **Резервная копия:** периодически копируйте файл SQLite (`backend/database.db` или путь из `DB_PATH`) и каталог `backend/uploads/`, если используются вложения к урокам. Перед каждым `git pull` на продакшене имеет смысл делать копию БД (ниже в 9.8).

### 9.8. Выкладка изменений с локальной машины на удалённый сервер (пошагово)

Ниже — полный цикл: вы правите код **локально**, затем переносите его на **VPS**, где уже клонирован репозиторий, настроены `backend/.env`, PM2 и nginx.

#### На локальной машине (разработка)
*****************************************************************
1. **Проверьте работу** приложения локально: `cd backend`, `npm install` при необходимости, `npm start` — откройте в браузере `http://localhost:<PORT>` и убедитесь, что фронт и API ведут себя ожидаемо.
2. **Зафиксируйте изменения в git** (не коммитьте секреты и не добавляйте в индекс `backend/.env`):
   ```bash
   git status
   git add --all
   git commit -m "Краткое описание изменений"
   ```
3. **Отправьте коммит в общий удалённый репозиторий** (GitHub / GitLab и т.д.):
   ```bash
   git push origin main
   ```
   (или имя вашей ветки вместо `main`; на сервере должна быть та же ветка.)

**Важно:** не рассчитывайте, что на продакшене «обновятся данные» в SQLite только из репозитория. Файл **`database.db`** на сервере — это **рабочая база** пользователей и контента; он обычно **не заменяется** при `git pull` (и не должен перезаписываться коммитом с разработческой машины). Новые **схемы** таблиц подхватываются при старте сервера через `initDB`. Наполнение курсов/заданий на проде — через админку или отдельные скрипты.

#### На удалённом сервере (SSH)

Подключитесь к серверу (`ssh user@хост`) и перейдите в **корень клона** проекта (там лежат папки `backend/` и `frontend/`), например:

```bash
cd ~/vkr
```

4. **Проверьте состояние git** (чтобы увидеть отставание от `origin` и лишние локальные правки):
   ```bash
   git fetch origin
   git status
   git log -1 --oneline
   ```
   Если видите **`Your branch is behind 'origin/main'`**, нужно подтянуть коммиты (шаг 6).  
   Папка **`node_modules/`** в репозитории **не отслеживается** (см. `.gitignore`); после `git pull` на сервере не должно быть тысяч «изменённых» файлов в `node_modules`. Если на старом клоне они ещё числились в индексе — один раз выполните `git pull`, затем при необходимости `rm -rf backend/node_modules && cd backend && npm install --production`.

5. **Перед обновлением кода — резервная копия базы** (обязательно, если на сервере есть реальные пользователи и данные):
   ```bash
   cp backend/database.db ~/database.db.backup-$(date +%Y%m%d-%H%M)
   ```

6. **Подтянуть новый код** с `origin`. Предпочтительно быстрая перемотка без лишнего merge-коммита:
   ```bash
   
   ```
   Если `git` ругается из‑за **локальных изменений** в отслеживаемых файлах:
   - для **`backend/database.db`**: временно уберите файл из пути мешающих изменений, например  
     `git stash push -m "prod-db" -- backend/database.db`, затем снова `git pull --ff-only origin main`, затем `git stash pop` (при конфликте восстановите БД из бэкапа из шага 5).
   - для **`backend/node_modules`** (только если у вас ещё старая история с отслеживаемым `node_modules`): удалите папку из индекса на машине разработки и закоммитьте `.gitignore` (как в репозитории сейчас), либо на сервере перед `pull` временно переименуйте `backend/node_modules`, затем после `pull` выполните шаг 7.

7. **Установите зависимости на сервере** (всегда в каталоге `backend` на **Linux**; не копируйте `node_modules` с Windows):
   ```bash
   cd backend
   npm install --production
   ```
   Если после обновления процесс в PM2 падает с ошибкой **`invalid ELF header`** / **`ERR_DLOPEN_FAILED`** у `node_sqlite3.node` — нативный модуль **sqlite3** собран не под эту ОС. Надёжное исправление:
   ```bash
   cd ~/vkr/backend
   rm -rf node_modules
   npm install --production
   ```
   Либо точечно: `rm -rf node_modules/sqlite3 && npm install sqlite3 --production`.

8. **Перезапустите приложение** (имя процесса посмотрите в `pm2 list` — у вас может быть `promptlearn`, `promptacademy` и т.д.):
   ```bash
   pm2 restart <имя_процесса>
   pm2 status
   ```
   Убедитесь, что статус **`online`**, а не **`errored`**.

9. **Проверка без браузера** (подставьте порт из `PORT` в `backend/.env`, часто `5000`):
   ```bash
   curl -sS http://127.0.0.1:5000/api/health
   ```
   Должен вернуться JSON со статусом `ok`. Если **connection refused** — Node не слушает порт (см. `pm2 logs`).

10. **Проверка снаружи:** откройте сайт по домену. Если видите старую версию страницы — сделайте **жёсткое обновление** (Ctrl+F5) или проверьте в режиме инкогнито (кэш браузера). Если **502 Bad Gateway** от nginx — приложение не запущено или nginx смотрит на **другой порт**, чем `PORT` в `.env`; сверьте `proxy_pass` в конфиге nginx с `curl` на `127.0.0.1:<PORT>`.

#### Краткий чеклист одной строкой

```text
локально: commit → push → на сервере: cd проект → бэкап database.db → git pull --ff-only → cd backend → npm install --production → pm2 restart → curl /api/health
```

---

## 10. Краткая шпаргалка для нейросетевых сервисов

- **Что это:** образовательная платформа по промпт-инжинирингу (Node/Express + SQLite + статический фронт).
- **Запуск:** `cd backend && npm install && npm start`; открыть в браузере `http://localhost:5000`.
- **Сервер (VPS/хостинг):** см. раздел 9 — `.env` (`JWT_SECRET`, `CORS_ORIGIN=https://…`), PM2/systemd, nginx перед Node; выкладка правок с локальной машины — п. **9.8**.
- **БД:** SQLite, путь в `config.DB_PATH`; схема создаётся в `db/initDB.js`.
- **Админ:** создать скриптом `createAdminUser.js`; все админ-действия через `/api/admin/*` с JWT и ролью `admin`.
- **Анализ промпта:** логика в `utils/aiAnalyzer.js`; при наличии `AI_API_URL` и `AI_API_KEY` — внешний POST `{ prompt }`, иначе эвристики.
- **Фронт:** HTML/CSS/JS в `frontend/`; API-вызовы в `frontend/js/api.js`; токен в `localStorage` под ключом `promptlearn_auth`.

Этого достаточно, чтобы понимать структуру, API, БД и конфигурацию при доработке проекта в других средах и нейросетевых сервисах.
