const db = require('./db');

db.run('DELETE FROM achievement_definitions', [], (err) => {
    if (err) {
        console.error('Ошибка при очистке таблицы achievement_definitions:', err.message);
        process.exit(1);
    }
    console.log('Таблица achievement_definitions очищена');
    console.log('Перезапустите сервер, чтобы пересоздать достижения с русскими названиями');
    process.exit(0);
});