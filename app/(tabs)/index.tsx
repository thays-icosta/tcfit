import React, { useState, useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { useNavigation, useGlobalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import AuthScreen from '../../screens/AuthScreen';
import PersonalHomeScreen from '../../screens/PersonalHomeScreen';
import AlunoHomeScreen from '../../screens/AlunoHomeScreen';
import OnboardingScreen from '../../screens/OnboardingScreen';
import WelcomeScreen from '../../screens/WelcomeScreen';
import PlansScreen from '../../screens/PlansScreen';
import { supabase } from '../../screens/supabaseClient';

export default function HomeTab() {
  const navigation = useNavigation();
  const params = useGlobalSearchParams<{ view?: string }>();
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(null);
  const [authView, setAuthView] = useState('welcome');

  useEffect(() => {
    if (params.view === 'plans' || params.view === 'auth') {
      setAuthView(params.view);
    }
  }, [params.view]);

  useEffect(() => {
    navigation.setOptions({
      tabBarStyle: user ? { backgroundColor: '#121212', borderTopColor: '#121212' } : { display: 'none' },
    });
  }, [navigation, user]);

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
    (async () => {
      const seen = await AsyncStorage.getItem('hasSeenOnboarding');
      setShowOnboarding(seen !== 'true');
    })();

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

  const handleFinishOnboarding = async () => {
    await AsyncStorage.setItem('hasSeenOnboarding', 'true');
    setShowOnboarding(false);
  };

  if (loading || showOnboarding === null) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0a0a0a', alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color="#f97316" />
      </View>
    );
  }

  if (showOnboarding) {
    return <OnboardingScreen onFinish={handleFinishOnboarding} />;
  }

  if (!user) {
    if (authView === 'plans') {
      return <PlansScreen onBack={() => setAuthView('welcome')} onLogin={() => setAuthView('auth')} />;
    }
    if (authView === 'auth') {
      return <AuthScreen onAuthenticated={() => {}} onBack={() => setAuthView('welcome')} />;
    }
    return <WelcomeScreen onExplore={() => setAuthView('plans')} onLogin={() => setAuthView('auth')} />;
  }

  if (role === 'personal') {
    return <PersonalHomeScreen user={user} onLogout={handleLogout} />;
  }

  return <AlunoHomeScreen user={user} onLogout={handleLogout} />;
}