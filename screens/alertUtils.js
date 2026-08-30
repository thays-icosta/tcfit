import { Alert, Platform } from 'react-native';

// React Native Web's Alert.alert is a no-op stub — it never shows anything.
// This wraps it so simple messages still reach the user on web.
export function showAlert(title, message) {
  if (Platform.OS === 'web') {
    window.alert(message ? `${title}\n\n${message}` : title);
    return;
  }
  Alert.alert(title, message);
}
