import { logout, getAuthState } from './auth.js';
import { openSessionWarningModal, showToast } from './ui.js';

const WARNING_THRESHOLD = 25 * 60 * 1000; 
const LOGOUT_THRESHOLD = 5 * 60 * 1000;   
const CHK_INTERVAL = 30 * 1000;           

let lastActivity = Date.now();
let warningActive = false;
let checkTimer = null;
let logoutTimer = null;

export function resetInactivity() {
  lastActivity = Date.now();
  
  if (warningActive) {
    
  }
}

export function initSessionManager() {
  const { isAuthenticated } = getAuthState();
  if (!isAuthenticated) return;

  const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
  events.forEach(name => {
    document.addEventListener(name, resetInactivity, { passive: true });
  });

  checkTimer = setInterval(checkInactivity, CHK_INTERVAL);
}

function checkInactivity() {
  if (warningActive) return;

  const now = Date.now();
  const inactiveDuration = now - lastActivity;

  if (inactiveDuration >= WARNING_THRESHOLD) {
    showWarning();
  }
}

function showWarning() {
  warningActive = true;
  
  const modal = openSessionWarningModal({
    onExtend: () => {
      resetInactivity();
      warningActive = false;
      if (logoutTimer) clearTimeout(logoutTimer);
    },
    onLogout: () => {
      performLogout();
    },
    timeoutMs: LOGOUT_THRESHOLD
  });

  logoutTimer = setTimeout(() => {
    performLogout('Ваша сессия истекла из-за бездействия.');
  }, LOGOUT_THRESHOLD);
}

function performLogout(message = 'Вы вышли из системы из-за бездействия.') {
  clearInterval(checkTimer);
  if (logoutTimer) clearTimeout(logoutTimer);
  
  logout();
  if (message) {
    
    console.log('[Session] Logout triggered due to inactivity');
  }
}
