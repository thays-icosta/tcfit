import { Alert, Platform } from 'react-native';

// Turns a supabase.functions.invoke() {error, data} pair into a message a
// personal/aluno can actually act on, and always logs the raw error so it
// shows up in the browser console for debugging.
export function describeFunctionError(error, data, fallback) {
  if (error) {
    console.error('Edge Function invoke error:', error, 'data:', data);
    if (error.name === 'FunctionsFetchError') {
      return 'Não conseguimos falar com o servidor de IA agora. Verifique sua internet e tente novamente em instantes.';
    }
    if (error.context?.status === 401) {
      return 'Sua sessão expirou. Saia e entre novamente pra continuar.';
    }
  }
  return data?.error || error?.message || fallback;
}

// React Native Web's Alert.alert is a no-op stub — it never shows anything,
// and callback buttons never fire. This wraps it with the exact same
// signature so it's a drop-in replacement everywhere in the app.
export function showAlert(title, message, buttons) {
  if (Platform.OS !== 'web') {
    Alert.alert(title, message, buttons);
    return;
  }

  if (!buttons || buttons.length === 0) {
    window.alert(message ? `${title}\n\n${message}` : title);
    return;
  }

  const cancelButton = buttons.find((b) => b.style === 'cancel');
  const actionButtons = buttons.filter((b) => b.style !== 'cancel');

  if (actionButtons.length <= 1 && !cancelButton) {
    // A single non-cancel button is a plain acknowledgement, not a choice —
    // window.confirm would add a phantom Cancel that doesn't belong here.
    window.alert(message ? `${title}\n\n${message}` : title);
    actionButtons[0]?.onPress?.();
    return;
  }

  if (actionButtons.length <= 1) {
    const ok = window.confirm(message ? `${title}\n\n${message}` : title);
    if (ok) actionButtons[0]?.onPress?.();
    else cancelButton?.onPress?.();
    return;
  }

  // 3+ choices: no clean browser-native equivalent, so fall back to a
  // numbered prompt rather than silently doing nothing.
  const choice = window.prompt(
    `${title}${message ? `\n${message}` : ''}\n\n` +
      actionButtons.map((b, i) => `${i + 1} — ${b.text}`).join('\n') +
      '\n\n(deixe em branco pra cancelar)'
  );
  const index = Number(choice) - 1;
  if (choice && actionButtons[index]) actionButtons[index].onPress?.();
  else cancelButton?.onPress?.();
}
