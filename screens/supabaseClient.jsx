import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const isBrowser = typeof window !== 'undefined';

const webStorage = {
  getItem: (key) => Promise.resolve(isBrowser ? window.localStorage.getItem(key) : null),
  setItem: (key, value) => {
    if (isBrowser) window.localStorage.setItem(key, value);
    return Promise.resolve();
  },
  removeItem: (key) => {
    if (isBrowser) window.localStorage.removeItem(key);
    return Promise.resolve();
  },
};

export const supabase = createClient(
  'https://hcsoaqeqqussszgjfhnb.supabase.co',
  'sb_publishable_H8Zjfra3ScVEXSd4WI__xw_Hq1m8q-o',
  {
    auth: {
      storage: Platform.OS === 'web' ? webStorage : AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  }
);
