import { apiGetMyCertificateHtml, apiDownloadMyCertificatePdf } from './api.js';
import { getAuthState } from './auth.js';
import { showToast } from './ui.js';

function getCertificateId() {
  const params = new URLSearchParams(window.location.search);
  return params.get('id') || '';
}

function injectViewerScale(htmlString) {
  const html = String(htmlString || '');
  if (!html) return html;
  const injectedStyle = `
    <style>
      html, body { margin: 0; padding: 0; overflow: hidden; }
      body { display:flex; align-items:center; justify-content:center; background:#ffffff; }
      .page { transform-origin: top left; box-shadow: 0 20px 70px rgba(15, 23, 42, 0.18); }
    </style>
  `.trim();
  const injectedScript = `
    <script>
      (function () {
        function fit() {
          var page = document.querySelector('.page');
          if (!page) return;
          page.style.transform = '';
          var pr = page.getBoundingClientRect();
          var vw = window.innerWidth;
          var vh = window.innerHeight;
          if (!pr.width || !pr.height) return;
          var s = Math.min(vw / pr.width, vh / pr.height);
          if (!isFinite(s) || s <= 0) s = 1;
          page.style.transform = 'scale(' + s.toFixed(4) + ')';
        }
        window.addEventListener('resize', fit);
        if (document.fonts && document.fonts.ready) {
          document.fonts.ready.then(fit).catch(fit);
        }
        setTimeout(fit, 0);
      })();
    </script>
  `.trim();
  if (html.includes('</head>')) {
    return html.replace('</head>', injectedStyle + '\n</head>').replace('</body>', injectedScript + '\n</body>');
  }
  return html + '\n' + injectedStyle + '\n' + injectedScript;
}

document.addEventListener('DOMContentLoaded', async () => {
  const { isAuthenticated } = getAuthState();
  const id = getCertificateId();
  const frame = document.getElementById('cert-frame');
  const status = document.getElementById('cert-status');
  const btnDownload = document.getElementById('cert-download-pdf');

  if (!frame || !status) return;
  if (!id) {
    status.textContent = 'Не указан сертификат.';
    return;
  }
  if (!isAuthenticated) {
    status.textContent = 'Требуется авторизация.';
    showToast('Войдите, чтобы открыть сертификат.', 'error');
    return;
  }

  try {
    const html = await apiGetMyCertificateHtml(id);
    frame.srcdoc = injectViewerScale(html);
    status.style.display = 'none';

    if (btnDownload) {
      btnDownload.style.display = '';
      btnDownload.addEventListener('click', async () => {
        try {
          btnDownload.disabled = true;
          btnDownload.textContent = 'Скачиваем…';
          const { blob, filename } = await apiDownloadMyCertificatePdf(id);
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = filename;
          document.body.appendChild(a);
          a.click();
          a.remove();
          setTimeout(() => URL.revokeObjectURL(url), 1000);
        } catch (e) {
          showToast(e?.message || 'Не удалось скачать PDF.', 'error');
        } finally {
          btnDownload.disabled = false;
          btnDownload.textContent = 'Скачать PDF';
        }
      });
    }
  } catch (e) {
    status.textContent = e?.message || 'Не удалось загрузить сертификат.';
    showToast(status.textContent, 'error');
  }
});

