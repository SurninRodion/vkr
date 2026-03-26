/**
 * Синхронно в <head>, до первой отрисовки: data-auth + критический CSS в <head>.
 * Внешний styles.css подключается позже — без этого гость/ЛК на кадр «мигают».
 */
(function () {
  var v = '0';
  try {
    var raw = localStorage.getItem('promptlearn_auth');
    if (raw) {
      var s = JSON.parse(raw);
      if (s && s.isAuthenticated) v = '1';
    }
  } catch (e) {}
  document.documentElement.setAttribute('data-auth', v);

  var css =
    'html[data-auth="1"] .navbar-auth-guest,' +
    'html[data-auth="0"] .navbar-auth-user{display:none!important}' +
    'html[data-auth="1"] .navbar-auth-user{display:flex!important;align-items:center;gap:10px}' +
    'html:not([data-auth]) #hero-dashboard,' +
    'html[data-auth="0"] #hero-dashboard{display:none!important}' +
    'html[data-auth="1"] #hero-guest{display:none!important}' +
    'html[data-auth="1"] #hero-dashboard{display:block!important}' +
    'html:not([data-auth]) #hero-guest,' +
    'html[data-auth="0"] #hero-guest{display:block!important}';

  var el = document.createElement('style');
  el.setAttribute('data-auth-critical', '');
  el.textContent = css;
  document.head.appendChild(el);
})();

/**
 * Вызывается инлайн сразу после </header>: меню ЛК до DOMContentLoaded (см. ui.js initNavbar).
 */
(function () {
  function readAuth() {
    try {
      var raw = localStorage.getItem('promptlearn_auth');
      if (!raw) return null;
      var s = JSON.parse(raw);
      if (!s || !s.isAuthenticated) return null;
      return s;
    } catch (e) {
      return null;
    }
  }

  function initials(user) {
    if (!user || !user.name) return 'PL';
    return user.name
      .split(/\s+/)
      .map(function (p) {
        return p[0];
      })
      .join('')
      .slice(0, 2);
  }

  window.promptNavbarUserHydrate = function () {
    var auth = readAuth();
    if (!auth) return;

    var right = document.getElementById('navbar-right');
    if (!right) return;
    var userWrap = right.querySelector('.navbar-auth-user');
    if (!userWrap || userWrap.querySelector('.user-menu')) return;

    var user = auth.user;
    var ini = initials(user);
    var isAdmin = user && user.role === 'admin';
    var adminItem = isAdmin
      ? '<div class="user-menu-item" data-menu="admin">Администрирование<span>Панель администратора</span></div>'
      : '';

    userWrap.innerHTML =
      '<div class="user-menu">' +
      '<button type="button" class="btn btn-outline user-menu-toggle" id="user-menu-toggle">' +
      '<span class="user-avatar">' +
      ini +
      '</span><span>Личный кабинет</span></button>' +
      '<div class="user-menu-dropdown" id="user-menu-dropdown">' +
      '<div class="user-menu-item" data-menu="profile">Профиль<span>Статистика</span></div>' +
      adminItem +
      '<div class="user-menu-item" data-menu="settings">Настройки<span>Скоро</span></div>' +
      '<div class="user-menu-item" data-menu="logout">Выйти</div>' +
      '</div></div>';
  };
})();
