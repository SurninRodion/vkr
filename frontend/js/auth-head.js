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
