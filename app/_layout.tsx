import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import Head from 'expo-router/head';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, Platform } from 'react-native';
import { useFonts, PlusJakartaSans_400Regular, PlusJakartaSans_700Bold } from '@expo-google-fonts/plus-jakarta-sans';
import 'react-native-reanimated';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { useColorScheme } from '@/hooks/use-color-scheme';

export const unstable_settings = {
  anchor: '(tabs)',
};

let globalFontApplied = false;

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [fontsLoaded] = useFonts({ PlusJakartaSans_400Regular, PlusJakartaSans_700Bold });

  if (fontsLoaded && !globalFontApplied && Platform.OS === 'web') {
    globalFontApplied = true;
    // React Native Web renders every <Text> as a [dir="auto"] element and gives it its own
    // r-fontFamily-* class only when a screen sets fontFamily explicitly. This rule supplies
    // the project default without an !important war: it only matches text that has no such
    // class, so any screen's explicit fontFamily still wins.
    const style = document.createElement('style');
    style.textContent = `
      [dir="auto"]:not([class*="r-fontFamily-"]) { font-family: 'PlusJakartaSans_400Regular', sans-serif; }
      body { -webkit-font-smoothing: antialiased; }
    `;
    document.head.appendChild(style);
  }

  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0a0a0a', alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color="#f97316" />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <Head>
          <title>TcFit</title>
        </Head>
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal' }} />
        </Stack>
        <StatusBar style="auto" />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
