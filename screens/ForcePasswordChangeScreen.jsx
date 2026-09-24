import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from './supabaseClient';
import { showAlert } from './alertUtils';

// Shown once, instead of AlunoHomeScreen, when the aluno's account was
// created directly by the personal with a temporary password
// (users.must_change_password) — forces a real password before letting
// them into the app, per the Cadastro Direto flow.
export default function ForcePasswordChangeScreen({ user, onDone, onLogout }) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!password || password.length < 6) {
      showAlert('Ops', 'A senha precisa ter pelo menos 6 caracteres.');
      return;
    }
    if (password !== confirmPassword) {
      showAlert('Ops', 'As senhas não coincidem.');
      return;
    }
    setSaving(true);
    const { error: authError } = await supabase.auth.updateUser({ password });
    if (authError) {
      setSaving(false);
      console.error('Erro ao trocar senha temporária:', authError);
      showAlert('Ops', 'Não foi possível salvar sua nova senha agora. Tenta de novo em instantes.');
      return;
    }
    const { error: flagError } = await supabase.from('users').update({ must_change_password: false }).eq('id', user.id);
    setSaving(false);
    if (flagError) {
      console.error('Erro ao limpar must_change_password:', flagError);
      // The password itself already changed successfully — don't block the
      // aluno over this housekeeping update failing.
    }
    onDone();
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.card}>
        <View style={styles.iconCircle}>
          <Ionicons name="lock-closed" size={26} color="#FF6B00" />
        </View>
        <Text style={styles.welcome}>Bem-vindo ao TCFit, {user?.name?.split(' ')[0] || ''}!</Text>
        <Text style={styles.subtitle}>Seu personal já preparou seu espaço. Por segurança, crie sua nova senha antes de continuar.</Text>

        <Text style={styles.label}>Nova senha</Text>
        <TextInput
          style={styles.input}
          placeholder="mínimo 6 caracteres"
          placeholderTextColor="#525252"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
        />

        <Text style={styles.label}>Confirmar nova senha</Text>
        <TextInput
          style={styles.input}
          placeholder="repete a senha"
          placeholderTextColor="#525252"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry
          autoCapitalize="none"
        />

        <TouchableOpacity style={styles.saveButton} onPress={handleSave} disabled={saving}>
          {saving ? <ActivityIndicator color="#0F0F12" /> : <Text style={styles.saveButtonText}>Salvar e continuar</Text>}
        </TouchableOpacity>

        {onLogout && (
          <TouchableOpacity style={styles.logoutButton} onPress={onLogout} disabled={saving}>
            <Text style={styles.logoutButtonText}>Sair</Text>
          </TouchableOpacity>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F0F12', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  card: { width: '100%', maxWidth: 400 },
  iconCircle: { width: 60, height: 60, borderRadius: 30, backgroundColor: 'rgba(255,107,0,0.12)', borderWidth: 1, borderColor: '#FF6B00', alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: 18 },
  welcome: { color: '#F5F5F7', fontSize: 20, fontWeight: '800', textAlign: 'center', marginBottom: 8 },
  subtitle: { color: '#a3a3a3', fontSize: 13, textAlign: 'center', lineHeight: 19, marginBottom: 28 },
  label: { color: '#737373', fontSize: 10, textTransform: 'uppercase', marginBottom: 6, marginTop: 12 },
  input: { backgroundColor: '#1C1C22', borderWidth: 1, borderColor: '#2B2B36', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, color: '#F5F5F7', fontSize: 14 },
  saveButton: { backgroundColor: '#FF6B00', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 24 },
  saveButtonText: { color: '#0F0F12', fontSize: 15, fontWeight: '700' },
  logoutButton: { paddingVertical: 14, alignItems: 'center', marginTop: 8 },
  logoutButtonText: { color: '#525252', fontSize: 12, fontWeight: '600' },
});
