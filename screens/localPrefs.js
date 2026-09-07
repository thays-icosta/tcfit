import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const isBrowser = typeof window !== 'undefined';

const store = Platform.OS === 'web'
  ? {
      getItem: (key) => Promise.resolve(isBrowser ? window.localStorage.getItem(key) : null),
      setItem: (key, value) => {
        if (isBrowser) window.localStorage.setItem(key, value);
        return Promise.resolve();
      },
    }
  : AsyncStorage;

export async function getJsonPref(key, fallback) {
  try {
    const raw = await store.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

export async function setJsonPref(key, value) {
  try {
    await store.setItem(key, JSON.stringify(value));
  } catch {
    // Best-effort — a failed save just means the collapse state resets next visit.
  }
}
