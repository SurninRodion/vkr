import { logout, getAuthState } from './auth.js';
import { openSessionWarningModal, showToast } from './ui.js';

// Intervals in milliseconds
const WARNING_THRESHOLD = 25 * 60 * 1000; // 25 minutes until warning modal
const LOGOUT_THRESHOLD = 5 * 60 * 1000;   // 5 minutes grace period after modal appears
const CHK_INTERVAL = 30 * 1000;           // Check every 30 seconds

let lastActivity = Date.now();
let warningActive = false;
let checkTimer = null;
let logoutTimer = null;

/** 
 * Resets the inactivity timer. 
 * Called on user interactions (mouse, keyboard, etc.)
 */
export function resetInactivity() {
  lastActivity = Date.now();
  
  if (warningActive) {
    // If the modal was open, it should be closed by the "Extend" button 
    // which calls this function or a specific extension handler.
  }
}

/** 
 * Starts the inactivity tracking. 
 */
export function initSessionManager() {
  const { isAuthenticated } = getAuthState();
  if (!isAuthenticated) return;

  // Track events
  const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
  events.forEach(name => {
    document.addEventListener(name, resetInactivity, { passive: true });
  });

  // Periodically check inactivity
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
  
  // Open the modal via UI module
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

  // Set hard logout timer
  logoutTimer = setTimeout(() => {
    performLogout('Ваша сессия истекла из-за бездействия.');
  }, LOGOUT_THRESHOLD);
}

function performLogout(message = 'Вы вышли из системы из-за бездействия.') {
  clearInterval(checkTimer);
  if (logoutTimer) clearTimeout(logoutTimer);
  
  logout();
  if (message) {
    // showToast is usually called inside logout, but we can override or add context
    console.log('[Session] Logout triggered due to inactivity');
  }
}
