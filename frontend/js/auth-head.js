/* Синхронно, до отрисовки body: выставляет data-auth на <html> из localStorage — без мигания UI. */
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
})();
