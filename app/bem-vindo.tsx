import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, TextInput, ScrollView, ActivityIndicator, Image, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Link, useLocalSearchParams } from 'expo-router';
import { supabase } from '../screens/supabaseClient';
import InstallBanner from '../screens/InstallBanner';
import { showAlert } from '../screens/alertUtils';

const WHATSAPP_NUMBER = '5537998231382';

export default function BemVindoLanding() {
  const params = useLocalSearchParams<{ invite?: string }>();
  const signupHref = params.invite
    ? `/?view=auth&mode=signup&role=aluno&invite=${encodeURIComponent(params.invite)}`
    : '/?view=auth&mode=signup&role=aluno';

  const [leadName, setLeadName] = useState('');
  const [leadPhone, setLeadPhone] = useState('');
  const [sendingLead, setSendingLead] = useState(false);
  const [leadSent, setLeadSent] = useState(false);

  const handleWhatsappDoubt = () => {
    const message = 'Olá! Vi o QR Code do TcFit e fiquei com uma dúvida.';
    Linking.openURL(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`).catch(() => {});
  };

  const handleRequestFreeGuide = async () => {
    if (!leadName.trim() || !leadPhone.trim()) {
      showAlert('Ops', 'Preenche seu nome e WhatsApp pra receber o guia.');
      return;
    }
    setSendingLead(true);
    const { error } = await supabase.from('leads').insert({
      name: leadName.trim(),
      phone: leadPhone.trim(),
      source: 'qrcode_landing',
    });
    setSendingLead(false);
    if (error) {
      showAlert('Erro', error.message);
      return;
    }
    setLeadSent(true);
    const message = `Olá! Sou ${leadName.trim()} e quero receber o treino/guia gratuito de amostra do TcFit.`;
    Linking.openURL(`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`).catch(() => {});
  };

  return (
    <View style={styles.root}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.container}>
        <Image source={require('../assets/images/brand-logo.png')} style={styles.logo} resizeMode="contain" />

        <Text style={styles.heroTitle}>Sua transformação começa aqui</Text>
        <Text style={styles.heroSubtitle}>Plataforma TcFit</Text>
        <Text style={styles.heroText}>Treino, dieta e acompanhamento do seu personal — tudo em um só app.</Text>

        <Link href={signupHref as any} style={styles.ctaButton}>
          <Text style={styles.ctaButtonText}>Criar Conta e Testar Grátis</Text>
        </Link>

        <View style={styles.guideCard}>
          <Ionicons name="gift-outline" size={28} color="#f97316" />
          <Text style={styles.guideTitle}>Treino/Guia Grátis de Amostra</Text>
          <Text style={styles.guideText}>Deixa seu nome e WhatsApp que a gente te manda uma amostra grátis pra você sentir como funciona.</Text>

          {leadSent ? (
            <View style={styles.guideSentBox}>
              <Ionicons name="checkmark-circle-outline" size={20} color="#22c55e" />
              <Text style={styles.guideSentText}>Prontinho! Te chamamos no WhatsApp.</Text>
            </View>
          ) : (
            <>
              <TextInput
                style={styles.guideInput}
                placeholder="Seu nome"
                placeholderTextColor="#525252"
                value={leadName}
                onChangeText={setLeadName}
              />
              <TextInput
                style={styles.guideInput}
                placeholder="Seu WhatsApp (com DDD)"
                placeholderTextColor="#525252"
                keyboardType="phone-pad"
                value={leadPhone}
                onChangeText={setLeadPhone}
              />
              <TouchableOpacity style={styles.guideButton} onPress={handleRequestFreeGuide} disabled={sendingLead}>
                {sendingLead ? <ActivityIndicator color="#0a0a0a" /> : <Text style={styles.guideButtonText}>Quero o Guia Grátis</Text>}
              </TouchableOpacity>
            </>
          )}
        </View>

        <InstallBanner />

        <Link href="/?view=auth" style={styles.loginLink}>
          <Text style={styles.loginLinkText}>Já tenho conta — Entrar</Text>
        </Link>
      </ScrollView>

      <TouchableOpacity style={styles.fab} onPress={handleWhatsappDoubt}>
        <Ionicons name="logo-whatsapp" size={26} color="#0a0a0a" />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0a0a0a' },
  container: { alignItems: 'center', paddingHorizontal: 24, paddingTop: 50, paddingBottom: 60 },
  logo: { width: 90, height: 90, marginBottom: 16 },
  heroTitle: { color: '#f5f5f5', fontSize: 26, fontWeight: '800', textAlign: 'center', lineHeight: 32 },
  heroSubtitle: { color: '#f97316', fontSize: 14, fontWeight: '700', marginTop: 6, letterSpacing: 0.5 },
  heroText: { color: '#a3a3a3', fontSize: 13, textAlign: 'center', marginTop: 10, marginBottom: 24, lineHeight: 19, paddingHorizontal: 8 },
  ctaButton: { backgroundColor: '#f97316', borderRadius: 14, paddingVertical: 17, paddingHorizontal: 28, width: '100%', alignItems: 'center', textAlign: 'center', marginBottom: 28 },
  ctaButtonText: { color: '#0a0a0a', fontSize: 15, fontWeight: '800' },
  guideCard: { width: '100%', backgroundColor: '#171717', borderWidth: 1, borderColor: '#292524', borderRadius: 16, padding: 20, alignItems: 'center', marginBottom: 28 },
  guideTitle: { color: '#f5f5f5', fontSize: 15, fontWeight: '800', marginTop: 10, marginBottom: 6, textAlign: 'center' },
  guideText: { color: '#a3a3a3', fontSize: 12, textAlign: 'center', lineHeight: 17, marginBottom: 16 },
  guideInput: { width: '100%', backgroundColor: '#0a0a0a', borderWidth: 1, borderColor: '#292524', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11, color: '#f5f5f5', fontSize: 14, marginBottom: 10 },
  guideButton: { width: '100%', backgroundColor: '#f97316', borderRadius: 10, paddingVertical: 13, alignItems: 'center', marginTop: 4 },
  guideButtonText: { color: '#0a0a0a', fontSize: 13, fontWeight: '700' },
  guideSentBox: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(34,197,94,0.1)', borderRadius: 10, paddingVertical: 12, paddingHorizontal: 14 },
  guideSentText: { color: '#22c55e', fontSize: 12, fontWeight: '700' },
  loginLink: { marginTop: 4, textAlign: 'center' },
  loginLinkText: { color: '#a3a3a3', fontSize: 12, fontWeight: '600', textDecorationLine: 'underline' },
  fab: { position: 'absolute', right: 20, bottom: 24, width: 56, height: 56, borderRadius: 28, backgroundColor: '#22c55e', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 6 },
});
