import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, TextInput, ActivityIndicator } from 'react-native';
import { supabase } from './supabaseClient';
import { showAlert } from './alertUtils';

export default function ForgotPasswordScreen({ onClose }) {
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSendReset = async () => {
    if (!email.trim() || !email.includes('@')) {
      showAlert('Ops', 'Digita um e-mail válido.');
      return;
    }
    setSending(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
    setSending(false);
    if (error) {
      console.error('Erro ao enviar e-mail de redefinição:', error);
      showAlert('Ops', 'Não foi possível enviar o e-mail de redefinição agora. Confere o e-mail digitado e tenta de novo.');
    } else {
      setSent(true);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={onClose}>
          <Text style={styles.closeText}>← Voltar pro login</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.title}>Esqueci minha senha</Text>

      {sent ? (
        <View style={styles.sentBox}>
          <Text style={styles.sentText}>
            Se esse e-mail estiver cadastrado, você vai receber um link pra criar uma nova senha. Confere sua caixa de entrada (e o spam).
          </Text>
          <TouchableOpacity style={styles.backButton} onPress={onClose}>
            <Text style={styles.backButtonText}>Voltar pro login</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <Text style={styles.subtitle}>Digite o e-mail da sua conta. Vamos mandar um link pra você criar uma senha nova.</Text>
          <TextInput
            style={styles.input}
            placeholder="seu@email.com"
            placeholderTextColor="#525252"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />
          <TouchableOpacity style={styles.sendButton} onPress={handleSendReset} disabled={sending}>
            {sending ? <ActivityIndicator color="#08090B" /> : <Text style={styles.sendButtonText}>Enviar link de recuperação</Text>}
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#08090B', paddingTop: 60, paddingHorizontal: 24 },
  topBar: { marginBottom: 30 },
  closeText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
  title: { color: '#FFFFFF', fontSize: 24, fontWeight: '800', marginBottom: 10 },
  subtitle: { color: '#A7AAB0', fontSize: 13, marginBottom: 24, lineHeight: 19 },
  input: { backgroundColor: '#121419', borderWidth: 1, borderColor: '#292D34', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 14, color: '#FFFFFF', fontSize: 14, marginBottom: 16 },
  sendButton: { backgroundColor: '#FFFFFF', borderRadius: 12, paddingVertical: 15, alignItems: 'center' },
  sendButtonText: { color: '#08090B', fontSize: 15, fontWeight: '700' },
  sentBox: { backgroundColor: '#121419', borderWidth: 1, borderColor: '#22c55e', borderRadius: 12, padding: 18, marginTop: 20 },
  sentText: { color: '#A7AAB0', fontSize: 13, lineHeight: 20, marginBottom: 16 },
  backButton: { backgroundColor: 'rgba(34,197,94,0.12)', borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  backButtonText: { color: '#22c55e', fontSize: 13, fontWeight: '700' },
});