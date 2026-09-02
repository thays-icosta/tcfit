import React, { useState, useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useGlobalSearchParams, useRouter } from 'expo-router';
import AuthScreen from '../../screens/AuthScreen';
import PersonalHomeScreen from '../../screens/PersonalHomeScreen';
import AlunoHomeScreen from '../../screens/AlunoHomeScreen';
import WelcomeScreen from '../../screens/WelcomeScreen';
import { supabase } from '../../screens/supabaseClient';

export default function HomeTab() {
  const router = useRouter();
  const params = useGlobalSearchParams<{ view?: string; mode?: string; role?: string; invite?: string }>();
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authView, setAuthView] = useState('welcome');

  useEffect(() => {
    if (params.view === 'auth') {
      setAuthView('auth');
    }
  }, [params.view]);

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
    return <PersonalHomeScreen user={user} onLogout={handleLogout} />;
  }

  return <AlunoHomeScreen user={user} onLogout={handleLogout} />;
}