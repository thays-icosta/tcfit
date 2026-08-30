import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, TextInput, Alert, ActivityIndicator, ScrollView, Image, KeyboardAvoidingView, Platform } from 'react-native';
import { supabase } from './supabaseClient';
import ForgotPasswordScreen from './ForgotPasswordScreen';
import { showAlert } from './alertUtils';

export default function AuthScreen({ onAuthenticated, onBack }) {
  const [mode, setMode] = useState('login');
  const [role, setRole] = useState('personal');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);

  const handleAuth = async () => {
    if (!email.trim() || !password.trim()) {
      showAlert('Ops', 'Preenche e-mail e senha.');
      return;
    }
    if (mode === 'signup' && !name.trim()) {
      showAlert('Ops', 'Preenche seu nome.');
      return;
    }
    if (mode === 'signup' && role === 'aluno' && !inviteCode.trim()) {
      showAlert('Ops', 'Preenche o código de convite do seu personal.');
      return;
    }

    setLoading(true);

    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      setLoading(false);
      if (error) {
        showAlert('Erro ao entrar', error.message);
      } else {
        onAuthenticated();
      }
    } else {
      const metadata = {
        name: name.trim(),
        role,
      };
      if (role === 'aluno') {
        metadata.personal_id = inviteCode.trim();
      }

      const { error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { data: metadata },
      });
      setLoading(false);
      if (error) {
        showAlert('Erro ao cadastrar', error.message);
      } else {
        showAlert('Conta criada!', 'Verifica seu e-mail se precisar confirmar, e depois faz login.', [
          { text: 'OK', onPress: () => setMode('login') },
        ]);
      }
    }
  };

  if (showForgotPassword) {
    return <ForgotPasswordScreen onClose={() => setShowForgotPassword(false)} />;
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 24 }}
      keyboardShouldPersistTaps="handled"
    >
      {onBack && (
        <TouchableOpacity onPress={onBack} style={styles.backLink}>
          <Text style={styles.backLinkText}>← Voltar</Text>
        </TouchableOpacity>
      )}

      <View style={styles.brandBlock}>
        <Image
          source={require('../assets/images/brand-logo.png')}
          style={styles.logo}
          resizeMode="contain"
        />
        <Text style={styles.appName}>TcFit</Text>
        <Text style={styles.slogan}>— Sua plataforma exclusiva de treino e saúde</Text>
      </View>

      <Text style={styles.tagline}>{mode === 'login' ? 'Entra na sua conta' : 'Cria sua conta'}</Text>

      <View style={styles.roleRow}>
        <TouchableOpacity
          style={[styles.roleButton, role === 'personal' && styles.roleButtonActive]}
          onPress={() => setRole('personal')}
        >
          <Text style={[styles.roleButtonText, role === 'personal' && styles.roleButtonTextActive]}>Personal</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.roleButton, role === 'aluno' && styles.roleButtonActive]}
          onPress={() => setRole('aluno')}
        >
          <Text style={[styles.roleButtonText, role === 'aluno' && styles.roleButtonTextActive]}>Aluno</Text>
        </TouchableOpacity>
      </View>

      {mode === 'signup' && (
        <TextInput
          style={styles.input}
          placeholder="Seu nome"
          placeholderTextColor="#525252"
          value={name}
          onChangeText={setName}
        />
      )}

      <TextInput
        style={styles.input}
        placeholder="E-mail"
        placeholderTextColor="#525252"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
      />

      <TextInput
        style={styles.input}
        placeholder="Senha"
        placeholderTextColor="#525252"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />

      {mode === 'signup' && role === 'aluno' && (
        <TextInput
          style={styles.input}
          placeholder="Código de convite do seu personal"
          placeholderTextColor="#525252"
          value={inviteCode}
          onChangeText={setInviteCode}
          autoCapitalize="none"
        />
      )}

      {mode === 'login' && (
        <TouchableOpacity onPress={() => setShowForgotPassword(true)} style={styles.forgotLink}>
          <Text style={styles.forgotLinkText}>Esqueci minha senha</Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity style={styles.submitButton} onPress={handleAuth} disabled={loading}>
        {loading ? (
          <ActivityIndicator color="#0a0a0a" />
        ) : (
          <Text style={styles.submitButtonText}>{mode === 'login' ? 'Entrar' : 'Criar conta'}</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity onPress={() => setMode(mode === 'login' ? 'signup' : 'login')} style={styles.switchModeButton}>
        <Text style={styles.switchModeText}>
          {mode === 'login' ? 'Não tem conta? Cria uma' : 'Já tem conta? Entra'}
        </Text>
      </TouchableOpacity>
    </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  backLink: { marginBottom: 20 },
  backLinkText: { color: '#f97316', fontSize: 14, fontWeight: '600' },
  brandBlock: { alignItems: 'center', marginBottom: 8 },
  logo: { width: 110, height: 110, marginBottom: 4 },
  appName: { color: '#f97316', fontSize: 36, fontWeight: '800', textAlign: 'center', letterSpacing: 0.5 },
  slogan: { color: '#a3a3a3', fontSize: 12, textAlign: 'center', marginTop: 4, fontWeight: '500' },
  tagline: { color: '#a3a3a3', fontSize: 14, textAlign: 'center', marginBottom: 28, marginTop: 20 },
  roleRow: { flexDirection: 'row', backgroundColor: '#171717', borderRadius: 10, padding: 3, marginBottom: 20 },
  roleButton: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8 },
  roleButtonActive: { backgroundColor: '#f97316' },
  roleButtonText: { color: '#a3a3a3', fontSize: 13, fontWeight: '600' },
  roleButtonTextActive: { color: '#0a0a0a' },
  input: { backgroundColor: '#171717', borderWidth: 1, borderColor: '#292524', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 14, color: '#f5f5f5', fontSize: 14, marginBottom: 12 },
  forgotLink: { alignItems: 'flex-end', marginBottom: 16, marginTop: -4 },
  forgotLinkText: { color: '#f97316', fontSize: 12, fontWeight: '600' },
  submitButton: { backgroundColor: '#f97316', borderRadius: 12, paddingVertical: 15, alignItems: 'center', marginTop: 4 },
  submitButtonText: { color: '#0a0a0a', fontSize: 15, fontWeight: '700' },
  switchModeButton: { alignItems: 'center', marginTop: 20 },
  switchModeText: { color: '#a3a3a3', fontSize: 13 },
});