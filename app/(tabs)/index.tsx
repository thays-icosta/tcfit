import React, { useState, useEffect } from 'react';
import { View, ActivityIndicator, Platform } from 'react-native';
import { useGlobalSearchParams, useRouter } from 'expo-router';
import * as Notifications from 'expo-notifications';
import * as Updates from 'expo-updates';
import AuthScreen from '../../screens/AuthScreen';
import PersonalHomeScreen from '../../screens/PersonalHomeScreen';
import AlunoHomeScreen from '../../screens/AlunoHomeScreen';
import WelcomeScreen from '../../screens/WelcomeScreen';
import { supabase } from '../../screens/supabaseClient';
import { registerPushToken, extractChatTarget } from '../../screens/pushNotifications';

export default function HomeTab() {
  const router = useRouter();
  const params = useGlobalSearchParams<{ view?: string; mode?: string; role?: string; invite?: string }>();
  const [user, setUser] = useState<{ id: string; email?: string; name?: string } | null>(null);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authView, setAuthView] = useState('welcome');
  const [chatTarget, setChatTarget] = useState<{ personalId: string | null; studentId: string | null } | null>(null);

  useEffect(() => {
    if (params.view === 'auth') {
      setAuthView('auth');
    }
  }, [params.view]);

  // By default an OTA update only downloads in the background on launch and
  // renders on the *next* one — actively checking, fetching and reloading here
  // means a fresh install shows the latest bundle the very first time it's opened.
  useEffect(() => {
    if (Platform.OS === 'web' || __DEV__) return;
    (async () => {
      try {
        const result = await Updates.checkForUpdateAsync();
        if (result.isAvailable) {
          await Updates.fetchUpdateAsync();
          await Updates.reloadAsync();
        }
      } catch (e) {
        console.log('update check failed', (e as Error)?.message);
      }
    })();
  }, []);

  const loadProfile = async (sessionUser) => {
    const { data, error } = await supabase
      .from('users')
      .select('name, role')
      .eq('id', sessionUser.id)
      .single();

    if (error) {
      console.log('ERRO AO BUSCAR PERFIL:', error.message);
    }
    console.log('DADO RECEBIDO:', JSON.stringify(data));

    setUser({ id: sessionUser.id, email: sessionUser.email, name: data?.name || sessionUser.email });
    setRole(data?.role || 'aluno');
  };

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) await loadProfile(session.user);
      setLoading(false);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        await loadProfile(session.user);
      } else if (_event === 'SIGNED_OUT') {
        setUser(null);
        setRole(null);
        setAuthView('welcome');
      } else {
        setUser(null);
        setRole(null);
      }
    });

    return () => authListener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (user?.id) registerPushToken(user.id);
  }, [user?.id]);

  useEffect(() => {
    if (Platform.OS === 'web') return;

    Notifications.getLastNotificationResponseAsync().then((response) => {
      const target = extractChatTarget(response);
      if (target) setChatTarget(target);
    }).catch(() => {});

    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      const target = extractChatTarget(response);
      if (target) setChatTarget(target);
    });

    return () => subscription.remove();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0a0a0a', alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color="#f97316" />
      </View>
    );
  }

  if (!user) {
    if (authView === 'auth') {
      return (
        <AuthScreen
          onAuthenticated={() => {}}
          onBack={() => setAuthView('welcome')}
          initialMode={params.mode}
          initialRole={params.role}
          initialInviteCode={params.invite}
        />
      );
    }
    return (
      <WelcomeScreen
        onLogin={() => setAuthView('auth')}
        onSignup={(personalId) => router.push(`/?view=auth&mode=signup&role=aluno${personalId ? `&invite=${personalId}` : ''}`)}
        scrollToPlansOnMount={params.view === 'plans'}
      />
    );
  }

  if (role === 'personal') {
    return (
      <PersonalHomeScreen
        user={user}
        onLogout={handleLogout}
        initialChatStudentId={chatTarget?.studentId || null}
        onConsumeInitialChat={() => setChatTarget(null)}
      />
    );
  }

  return (
    <AlunoHomeScreen
      user={user}
      onLogout={handleLogout}
      openChatOnMount={!!chatTarget}
      onConsumeInitialChat={() => setChatTarget(null)}
    />
  );
}