#!/usr/bin/env node
/**
 * Stepik → PromptLearn Course Importer
 *
 * Конвертирует курс со Stepik в JSON-формат, совместимый с платформой.
 *
 * Использование:
 *   node backend/scripts/stepikImporter.js <Stepik-Course-ID> [--output имя_файла.json]
 *
 * Пример:
 *   node backend/scripts/stepikImporter.js 123456
 *   node backend/scripts/stepikImporter.js 123456 --output my-course.ru.json
 *
 * После конвертации файл сохраняется в backend/db/seed/courses/
 * и автоматически импортируется при следующем запуске сервера.
 *
 * Требования: npm install node-fetch (если Node < 18) или используйте встроенный fetch (Node 18+)
 */

const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// ============================================================
// 1. Конфигурация
// ============================================================

const STEPIK_API_BASE = 'https://stepik.org/api';
const SEED_DIR = path.join(__dirname, '..', 'db', 'seed', 'courses');

// ============================================================
// 2. Stepik API client
// ============================================================

async function stepikFetch(endpoint) {
  const url = `${STEPIK_API_BASE}/${endpoint}`;
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      // Для приватных курсов нужен OAuth-токен.
      // Раскомментируйте и укажите свой токен:
      // 'Authorization': 'Bearer <ваш_токен>'
    },
  });

  if (!response.ok) {
    throw new Error(`Stepik API error ${response.status} for ${url}: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Получить все элементы постранично
 */
async function stepikFetchAll(endpoint, field) {
  const items = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const separator = endpoint.includes('?') ? '&' : '?';
    const data = await stepikFetch(`${endpoint}${separator}page=${page}`);
    const pageItems = data[field] || [];
    items.push(...pageItems);

    const meta = data.meta || {};
    const totalPages = meta.pagination?.pages ?? meta.pages ?? 1;
    hasMore = page < totalPages;
    page++;
  }

  return items;
}

// ============================================================
// 3. Основная логика конвертации
// ============================================================

/**
 * Конвертирует ответы Stepik quiz в формат quiz_questions платформы
 */
function convertQuiz(step) {
  const block = step.block || {};
  const source = block.source || {};
  const options = source.options || [];

  // Определяем, какой это тип шага
  switch (block.name) {
    case 'choice': // Множественный выбор (один правильный)
    case 'single_choice': {
      const isMulti = block.name === 'choice';
      return options.map((opt, idx) => ({
        question_text: opt.text || opt.choices?.[0]?.text || `Вариант ${idx + 1}`,
        options: options.map(o => o.text || o.choices?.[0]?.text || ''),
        correct_index: opt.is_correct ? idx : -1,
        order_index: idx,
      })).filter(q => q.correct_index >= 0);
    }

    case 'free_answer': // Свободный ответ (не проверяется автоматически)
      return [{
        question_text: source.instruction || source.text || 'Ответьте на вопрос',
        options: ['Отправить'],
        correct_index: 0,
        order_index: 0,
      }];

    case 'math': // Математическая задача
      return [{
        question_text: source.text || 'Решите задачу',
        options: source.answers?.[0]?.text
          ? [source.answers[0].text, 'Другой ответ']
          : ['Введите ответ'],
        correct_index: 0,
        order_index: 0,
      }];

    case 'number': // Числовой ответ
      return [{
        question_text: source.text || 'Введите число',
        options: [String(source.epsilon_response || source.answer || ''), ''],
        correct_index: 0,
        order_index: 0,
      }];

    case 'string': // Строковый ответ
      return [{
        question_text: source.text || 'Введите текст',
        options: [source.answer || '', ''],
        correct_index: 0,
        order_index: 0,
      }];

    case 'table': // Таблица
      return [{
        question_text: source.text || 'Заполните таблицу',
        options: source.table_meta?.rows?.length
          ? [source.table_meta.rows.map(r => r.cells?.[0]?.text || '').join(', ')]
          : ['Заполните данные'],
        correct_index: 0,
        order_index: 0,
      }];

    case 'sorting': // Сортировка
      return [{
        question_text: source.text || 'Расставьте в правильном порядке',
        options: source.order ? ['Правильно', 'Неправильно'] : ['Введите порядок'],
        correct_index: 0,
        order_index: 0,
      }];

    default:
      console.log(`   ⚠️  Неизвестный тип quiz: ${block.name}, пропускаем`);
      return [];
  }
}

/**
 * Конвертирует один Stepik step в шаги платформы (steps)
 */
function convertStep(step, stepIndex) {
  const block = step.block || {};
  const source = block.source || {};
  const name = block.name || 'text';
  const steps = [];

  switch (name) {
    case 'text': {
      // Текстовый шаг → theory
      const text = source.text || step.text || step.progress || '';
      // Извлекаем заголовок (первая строка с ## или просто первая строка)
      const lines = text.split('\n').filter(Boolean);
      const title = lines.find(l => l.startsWith('#'))
        ? lines.find(l => l.startsWith('#')).replace(/^#+\s*/, '')
        : `Шаг ${stepIndex + 1}`;

      steps.push({
        step_type: 'theory',
        payload: {
          title: title,
          content: text,
        },
      });
      break;
    }

    case 'video': {
      steps.push({
        step_type: 'video',
        payload: {
          title: source.filename || `Видео ${stepIndex + 1}`,
          url: source.urls?.[0]?.url || source.url || '',
          description: (source.text || '').split('\n').filter(Boolean).slice(0, 2).join('\n'),
        },
      });
      break;
    }

    case 'choice':
    case 'single_choice':
    case 'free_answer':
    case 'math':
    case 'number':
    case 'string':
    case 'table':
    case 'sorting': {
      // Тестовые шаги → в quiz_questions (но платформа хранит их отдельно)
      // Создаём шаг theory с embedded quiz (платформа использует отдельную таблицу course_quiz_questions)
      const text = source.text || '';
      const title = text
        ? text.split('\n').find(l => l.trim().length > 0)?.slice(0, 60) || `Тест ${stepIndex + 1}`
        : `Тест ${stepIndex + 1}`;

      // Quiz-шаги не могут быть напрямую "theory" - для тестов есть отдельный тип
      // Но в платформе quiz — это отдельный шаг test
      steps.push({
        step_type: 'test',
        payload: {
          question: text || source.instruction || 'Вопрос',
          options: (source.options || []).map(o => o.text || o.choices?.[0]?.text || ''),
          correctIndex: (source.options || []).findIndex(o => o.is_correct),
        },
      });
      break;
    }

    case 'dataset': {
      // Датасет (CSV/таблица) → theory
      const csv = source.csv || '';
      steps.push({
        step_type: 'theory',
        payload: {
          title: source.title || `Данные ${stepIndex + 1}`,
          content: csv ? `Данные для анализа:\n\n\`\`\`csv\n${csv}\n\`\`\`` : 'Загрузите данные.',
        },
      });
      break;
    }

    case 'code': {
      // Код → practical
      steps.push({
        step_type: 'practical',
        payload: {
          title: source.instruction || source.text || `Задание ${stepIndex + 1}`,
          description: source.text || source.instruction || 'Напишите код.',
          input_placeholder: 'Введите ваш код...',
        },
      });
      break;
    }

    case 'admin':
    case 'discussion':
    case 'announcement': {
      // Админские/обсуждения — пропускаем
      break;
    }

    default: {
      console.log(`   ⚠️  Неизвестный тип шага: ${name} (step #${step.id || stepIndex})`);
      // Попробуем хотя бы вытащить текст
      const text = source.text || step.text || '';
      if (text) {
        steps.push({
          step_type: 'theory',
          payload: {
            title: `Шаг ${stepIndex + 1}`,
            content: text,
          },
        });
      }
    }
  }

  return steps;
}

/**
 * Основная функция конвертации курса
 */
async function importFromStepik(courseId) {
  console.log(`\n=== Импорт курса со Stepik (course ID: ${courseId}) ===\n`);

  // 2.1. Получаем информацию о курсе
  console.log('1. Загружаем информацию о курсе...');
  const courseData = await stepikFetch(`courses/${courseId}`);
  const course = courseData.courses?.[0];

  if (!course) {
    throw new Error(`Курс с ID ${courseId} не найден на Stepik`);
  }

  console.log(`   ✅ Название: ${course.title}`);
  console.log(`   👤 Автор: ${course.authors?.[0] || 'неизвестен'}`);
  console.log(`   📝 Описание: ${(course.summary || course.description || '').slice(0, 100)}...`);

  // 2.2. Получаем секции (модули)
  console.log('\n2. Загружаем модули...');

  if (!course.sections || course.sections.length === 0) {
    throw new Error('Курс не содержит секций (модулей). Возможно, курс ещё не опубликован.');
  }

  console.log(`   📁 ID секций: ${course.sections.join(', ')}`);

  // Stepik API использует ids[] вместо ids
  const sectionIdsParam = course.sections.map(id => `ids[]=${id}`).join('&');
  const sectionsData = await stepikFetchAll(`sections?${sectionIdsParam}`, 'sections');
  console.log(`   📁 Найдено модулей: ${sectionsData.length}`);

  // 2.3. Собираем полную структуру
  console.log('\n3. Загружаем уроки и шаги...');
  const modules = [];

  for (const section of sectionsData.sort((a, b) => a.position - b.position)) {
    console.log(`   📁 Модуль: ${section.title}`);

    // Юниты уже есть в section.units - получаем их напрямую по ID
    let unitsData = [];
    if (section.units && section.units.length > 0) {
      const unitIdsParam = section.units.map(id => `ids[]=${id}`).join('&');
      unitsData = await stepikFetchAll(`units?${unitIdsParam}`, 'units');
      unitsData = unitsData.sort((a, b) => a.position - b.position);
    }

    const lessons = [];

    for (const unit of unitsData) {
      const lessonData = await stepikFetch(`lessons/${unit.lesson}`);
      const lesson = lessonData.lessons?.[0];
      if (!lesson) continue;

      console.log(`      📄 ${lesson.title}`);

      // Получаем шаги урока
      const stepsData = await stepikFetchAll(`steps?lesson=${lesson.id}`, 'steps');
      const sortedSteps = stepsData.sort((a, b) => a.position - b.position);

      // Собираем контент из шагов
      const contentParts = [];
      const convertedSteps = [];
      let quizQuestions = [];

      for (const step of sortedSteps) {
        const stepType = step.block?.name || 'text';

        // Конвертируем шаг
        const platformSteps = convertStep(step, step.position - 1);
        convertedSteps.push(...platformSteps);

        // Собираем текст для поля content
        const block = step.block || {};
        const source = block.source || {};
        if (source.text) {
          contentParts.push(source.text);
        }
      }

      // Если нет шагов — хотя бы одно theory вступление
      if (convertedSteps.length === 0) {
        convertedSteps.push({
          step_type: 'theory',
          payload: {
            title: lesson.title,
            content: lesson.text || 'Материалы урока загружаются...',
          },
        });
      }

      lessons.push({
        title: lesson.title,
        content: contentParts.length > 0
          ? contentParts.join('\n\n---\n\n')
          : lesson.text || '',
        steps: convertedSteps,
        quiz_questions: quizQuestions,
      });
    }

    modules.push({
      title: section.title,
      lessons: lessons,
    });
  }

  // 2.4. Формируем итоговый JSON
  console.log('\n4. Формируем итоговый JSON...');
  const result = {
    title: course.title,
    description: course.summary || course.description || '',
    modules: modules,
  };

  return result;
}

// ============================================================
// 4. Сохранение и вывод результата
// ============================================================

function saveCourseJson(courseData, outputName) {
  if (!fs.existsSync(SEED_DIR)) {
    fs.mkdirSync(SEED_DIR, { recursive: true });
  }

  const filePath = path.join(SEED_DIR, outputName);
  const json = JSON.stringify(courseData, null, 2);
  fs.writeFileSync(filePath, json, 'utf8');

  console.log(`\n   ✅ Файл сохранён: ${filePath}`);
  console.log(`   📦 Размер: ${(json.length / 1024).toFixed(1)} KB`);

  return filePath;
}

function printSummary(courseData) {
  const totalLessons = courseData.modules.reduce((sum, m) => sum + m.lessons.length, 0);
  const totalSteps = courseData.modules.reduce(
    (sum, m) => sum + m.lessons.reduce((s, l) => s + (l.steps?.length || 0), 0),
    0
  );

  console.log('\n=== 📊 Итог ===');
  console.log(`   Название курса: ${courseData.title}`);
  console.log(`   Модулей: ${courseData.modules.length}`);
  console.log(`   Уроков: ${totalLessons}`);
  console.log(`   Шагов: ${totalSteps}`);
  console.log('');

  // Проверяем, есть ли курс уже в initDB.js
  const seedFileName = path.basename(
    path.join(SEED_DIR, courseData.title.toLowerCase().replace(/[^a-zа-яё0-9]+/g, '-').slice(0, 40) + '.ru.json')
  );
  console.log(`🔗 Файл для импорта: ${seedFileName}`);

  console.log('\n📋 Инструкция по импорту:');
  console.log('   1. Файл уже сохранён в backend/db/seed/courses/');
  console.log('   2. Перезапустите сервер: npm start (или перезапустите process)');
  console.log('   3. Курс создастся автоматически при запуске initDB()');
  console.log('   ИЛИ');
  console.log('   4. Добавьте в backend/db/initDB.js в seedFiles новый курс:');
  console.log('      { file: "' + seedFileName + '", logTitle: "' + courseData.title + '" }');
  console.log('');
  console.log('   ⚠️  Если курс уже существует, он НЕ будет перезаписан');
  console.log('      (проверка по title в initDB.js).');
  console.log('      Чтобы обновить — удалите курс из БД вручную.');
  console.log('');

  // Дополнительно: админ-панель
  console.log('💡 Альтернатива: загрузите JSON через админ-панель:');
  console.log('   /admin/courses → Создать курс → Импорт JSON');
  console.log('');
}

// ============================================================
// 5. Точка входа
// ============================================================

async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    console.log(`
Stepik → PromptLearn Course Importer
======================================
Использование:
  node backend/scripts/stepikImporter.js <Stepik-Course-ID> [опции]

Аргументы:
  <Stepik-Course-ID>  ID курса на Stepik (число из URL курса)
                       Например: https://stepik.org/course/123456 → ID=123456

Опции:
  --output <имя>      Имя выходного JSON-файла (по умолчанию: автогенерация)
  --help, -h          Показать эту справку

Примеры:
  node backend/scripts/stepikImporter.js 123456
  node backend/scripts/stepikImporter.js 123456 --output prompt-engineering-stepik.ru.json

Примечания:
  - Для публичных курсов токен не нужен.
  - Для приватных курсов укажите OAuth-токен в теле функции stepikFetch().
  - Файл сохраняется в backend/db/seed/courses/ и импортируется при запуске сервера.
    `);
    process.exit(0);
  }

  const courseId = parseInt(args[0], 10);
  if (isNaN(courseId) || courseId <= 0) {
    console.error('❌ Ошибка: укажите числовой ID курса со Stepik');
    process.exit(1);
  }

  // Определяем имя выходного файла
  let outputName = args.find((a, i) => i > 0 && a !== '--output');
  let outputIndex = args.indexOf('--output');
  if (!outputName && outputIndex >= 0 && args[outputIndex + 1]) {
    outputName = args[outputIndex + 1];
  }

  try {
    const courseData = await importFromStepik(courseId);

    // Генерируем имя файла, если не указано
    if (!outputName) {
      const safeName = courseData.title
        .toLowerCase()
        .replace(/[^a-zа-яё0-9]+/g, '-')
        .replace(/^-|-$/g, '')
        .slice(0, 50);
      outputName = `${safeName}.ru.json`;
    }

    if (!outputName.endsWith('.json')) {
      outputName += '.json';
    }

    const filePath = saveCourseJson(courseData, outputName);
    printSummary(courseData);

    console.log(`✅ Готово! Файл: ${filePath}`);
    console.log('   Перезапустите сервер, чтобы импортировать курс в БД.');

  } catch (err) {
    console.error('\n❌ Ошибка импорта:', err.message);
    if (err.message.includes('fetch')) {
      console.error('\n📌 Возможно, не установлен node-fetch. Попробуйте:');
      console.error('   npm install node-fetch');
      console.error('\n   Или используйте Node.js 18+ со встроенным fetch.');
    }
    if (err.message.includes('404')) {
      console.error('\n📌 Курс не найден. Проверьте ID курса.');
      console.error('   ID — это число из URL: https://stepik.org/course/123456');
    }
    process.exit(1);
  }
}

// Запуск (поддержка и require, и CLI)
if (require.main === module) {
  // Проверяем наличие fetch
  if (typeof fetch === 'undefined') {
    console.log('⚠️  Встроенный fetch не найден. Пробуем node-fetch...');
    try {
      const nodeFetch = require('node-fetch');
      globalThis.fetch = nodeFetch;
    } catch (e) {
      console.error('❌ Установите node-fetch: npm install node-fetch');
      console.error('   Или используйте Node.js 18+');
      process.exit(1);
    }
  }
  main();
}

module.exports = { importFromStepik, convertStep, convertQuiz, saveCourseJson };