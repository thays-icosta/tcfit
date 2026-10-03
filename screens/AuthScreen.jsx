import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, TextInput, ActivityIndicator, ScrollView, Image, KeyboardAvoidingView, Platform } from 'react-native';
import { supabase } from './supabaseClient';
import ForgotPasswordScreen from './ForgotPasswordScreen';
import { showAlert } from './alertUtils';

const GENDER_ONBOARDING_MAP = { female: 'feminino', feminino: 'feminino', male: 'masculino', masculino: 'masculino' };

export default function AuthScreen({ onAuthenticated, onBack, initialMode, initialRole, initialInviteCode, initialGender }) {
  const [mode, setMode] = useState(initialMode === 'signup' ? 'signup' : 'login');
  const [role, setRole] = useState(initialRole === 'aluno' ? 'aluno' : 'personal');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [inviteCode, setInviteCode] = useState(initialInviteCode || '');
  const [referralCode, setReferralCode] = useState('');
  const [gender, setGender] = useState(GENDER_ONBOARDING_MAP[initialGender] || null);
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
    if (mode === 'signup' && role === 'aluno' && !gender) {
      showAlert('Ops', 'Escolhe seu universo (Feminino ou Masculino) pra gente personalizar sua Home.');
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
        if (referralCode.trim()) metadata.referral_code = referralCode.trim();
        metadata.gender = gender;
      }

      const { data: signUpData, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { data: metadata },
      });
      setLoading(false);
      const alreadyRegistered = /already registered|already exists|user already/i.test(error?.message || '')
        || (!error && signUpData?.user?.identities?.length === 0);
      if (alreadyRegistered) {
        showAlert('E-mail já cadastrado', 'Este e-mail já possui uma conta. Faça login ou recupere sua senha.');
      } else if (error) {
        showAlert('Erro ao cadastrar', 'Não foi possível criar sua conta. Verifique os dados inseridos e tente novamente.');
      } else {
        showAlert('Conta criada com sucesso! 🎉', 'Enviamos um link de confirmação para o seu e-mail. Confirme seu cadastro e acesse o app.', [
          { text: 'Ir para o Login', onPress: () => setMode('login') },
        ]);
      }
    }
  };

  if (showForgotPassword) {
    return <ForgotPasswordScreen onClose={() => setShowForgotPassword(false)} />;
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, styles.webCenterWrap]}
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
          source={require('../assets/images/brand-wordmark.png')}
          style={styles.logo}
          resizeMode="contain"
          accessibilityLabel="TcFit"
        />
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
        <>
          <TextInput
            style={styles.input}
            placeholder="Código de convite do seu personal"
            placeholderTextColor="#525252"
            value={inviteCode}
            onChangeText={setInviteCode}
            autoCapitalize="none"
          />
          <TextInput
            style={styles.input}
            placeholder="Código de indicação de um amigo (opcional)"
            placeholderTextColor="#525252"
            value={referralCode}
            onChangeText={setReferralCode}
            autoCapitalize="characters"
          />

          <Text style={styles.genderLabel}>Escolha seu universo</Text>
          <View style={styles.genderRow}>
            <TouchableOpacity
              style={[styles.genderButton, gender === 'feminino' && styles.genderButtonActiveFeminino]}
              onPress={() => setGender('feminino')}
            >
              <Text style={[styles.genderButtonText, gender === 'feminino' && styles.genderButtonTextActive]}>Universo Feminino</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.genderButton, gender === 'masculino' && styles.genderButtonActiveMasculino]}
              onPress={() => setGender('masculino')}
            >
              <Text style={[styles.genderButtonText, gender === 'masculino' && styles.genderButtonTextActive]}>Universo Masculino</Text>
            </TouchableOpacity>
          </View>
        </>
      )}

      {mode === 'login' && (
        <TouchableOpacity onPress={() => setShowForgotPassword(true)} style={styles.forgotLink}>
          <Text style={styles.forgotLinkText}>Esqueci minha senha</Text>
        </TouchableOpacity>
      )}

      <TouchableOpacity style={styles.submitButton} onPress={handleAuth} disabled={loading}>
        {loading ? (
          <ActivityIndicator color="#08090B" />
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
  container: { flex: 1, backgroundColor: '#08090B' },
  webCenterWrap: Platform.OS === 'web' ? { maxWidth: 440, width: '100%', marginHorizontal: 'auto' } : {},
  backLink: { marginBottom: 20 },
  backLinkText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
  brandBlock: { alignItems: 'center', marginBottom: 8 },
  // brand-wordmark.png is 663x201 (3.3:1) — width/height keep that ratio exactly.
  logo: { width: 200, height: 61, marginBottom: 12 },
  slogan: { color: '#A7AAB0', fontSize: 12, textAlign: 'center', marginTop: 4, fontWeight: '500' },
  tagline: { color: '#A7AAB0', fontSize: 14, textAlign: 'center', marginBottom: 28, marginTop: 20 },
  roleRow: { flexDirection: 'row', backgroundColor: '#121419', borderRadius: 10, padding: 3, marginBottom: 20 },
  roleButton: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 8 },
  roleButtonActive: { backgroundColor: '#FFFFFF' },
  roleButtonText: { color: '#A7AAB0', fontSize: 13, fontWeight: '600' },
  roleButtonTextActive: { color: '#08090B' },
  input: { backgroundColor: '#121419', borderWidth: 1, borderColor: '#292D34', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 14, color: '#FFFFFF', fontSize: 14, marginBottom: 12 },
  genderLabel: { color: '#A7AAB0', fontSize: 12, fontWeight: '600', marginBottom: 8 },
  genderRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  genderButton: { flex: 1, backgroundColor: '#121419', borderWidth: 1, borderColor: '#292D34', borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
  genderButtonActiveFeminino: { borderColor: '#D1D5DB', backgroundColor: 'rgba(255,255,255,0.08)' },
  genderButtonActiveMasculino: { borderColor: '#D1D5DB', backgroundColor: 'rgba(255,255,255,0.08)' },
  genderButtonText: { color: '#A7AAB0', fontSize: 12, fontWeight: '700' },
  genderButtonTextActive: { color: '#FFFFFF' },
  forgotLink: { alignItems: 'flex-end', marginBottom: 16, marginTop: -4 },
  forgotLinkText: { color: '#FFFFFF', fontSize: 12, fontWeight: '600' },
  submitButton: { backgroundColor: '#FFFFFF', borderRadius: 12, paddingVertical: 15, alignItems: 'center', marginTop: 4 },
  submitButtonText: { color: '#08090B', fontSize: 15, fontWeight: '700' },
  switchModeButton: { alignItems: 'center', marginTop: 20 },
  switchModeText: { color: '#A7AAB0', fontSize: 13 },
});