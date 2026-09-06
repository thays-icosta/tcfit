import { Platform } from 'react-native';
import { supabase } from './supabaseClient';

let currentUser = null;

export function setErrorLoggerUser(user) {
  currentUser = user ? { id: user.id, role: user.role } : null;
}

/**
 * @param {string} message
 * @param {{ source?: string, stack?: string, componentStack?: string, extra?: object }} [options]
 */
export function logError(message, { source = 'manual', stack, componentStack, extra } = {}) {
  const row = {
    source,
    message: String(message).slice(0, 2000),
    stack: stack ? String(stack).slice(0, 4000) : null,
    component_stack: componentStack ? String(componentStack).slice(0, 4000) : null,
    url: Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.href : null,
    user_agent: Platform.OS === 'web' && typeof navigator !== 'undefined' ? navigator.userAgent : null,
    user_id: currentUser?.id || null,
    user_role: currentUser?.role || null,
    extra: extra || null,
  };
  supabase.from('error_logs').insert(row).then(({ error }) => {
    if (error) console.log('errorLogger: falha ao registrar erro:', error.message);
  });
}

let installed = false;

export function installGlobalErrorHandlers() {
  if (installed || Platform.OS !== 'web' || typeof window === 'undefined') return;
  installed = true;

  window.addEventListener('error', (event) => {
    logError(event.message || 'window.onerror', {
      source: 'window_onerror',
      stack: event.error?.stack,
    });
  });

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    logError(reason?.message || String(reason) || 'unhandled rejection', {
      source: 'unhandled_rejection',
      stack: reason?.stack,
    });
  });
}
