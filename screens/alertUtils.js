import { Alert, Platform } from 'react-native';

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
