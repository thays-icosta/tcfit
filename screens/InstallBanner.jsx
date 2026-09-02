import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, Linking, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const ANDROID_APK_URL = 'https://github.com/thays-icosta/tcfit/releases/download/v1.0.0-android/tcfit-latest.apk';

function isMobileBrowser() {
  if (typeof navigator === 'undefined' || !navigator.userAgent) return false;
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
}

export default function InstallBanner() {
  const [showIosGuide, setShowIosGuide] = useState(false);

  if (Platform.OS !== 'web' || !isMobileBrowser()) return null;

  const handleInstallAndroid = () => {
    Linking.openURL(ANDROID_APK_URL).catch(() => {});
  };

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>BAIXE NOSSO APP</Text>
      <Text style={styles.sectionSupport}>
        Treinos, nutrição e acompanhamento exclusivo em um só lugar. O aplicativo pensado para a sua rotina, onde e quando quiser.
      </Text>

      <View style={styles.buttonRow}>
        <TouchableOpacity style={styles.installButton} onPress={handleInstallAndroid}>
          <Ionicons name="logo-android" size={18} color="#FFFFFF" />
          <Text style={styles.installButtonText}>Instalar no Android</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.installButton} onPress={() => setShowIosGuide(true)}>
          <Ionicons name="logo-apple" size={18} color="#FFFFFF" />
          <Text style={styles.installButtonText}>Abrir no iPhone</Text>
        </TouchableOpacity>
      </View>

      <Modal visible={showIosGuide} transparent animationType="fade" onRequestClose={() => setShowIosGuide(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalIconCircle}>
              <Ionicons name="share-outline" size={22} color="#E05A17" />
            </View>
            <Text style={styles.modalTitle}>Adicionar à Tela de Início</Text>
            <Text style={styles.modalText}>
              Abra este site no Safari, toque no ícone de Compartilhar e escolha “Adicionar à Tela de Início”. O TcFit aparece na sua tela como um app de verdade.
            </Text>
            <TouchableOpacity style={styles.modalCloseButton} onPress={() => setShowIosGuide(false)}>
              <Text style={styles.modalCloseButtonText}>Entendi</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { alignItems: 'center', marginTop: 36, paddingHorizontal: 12 },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 15 * 0.08,
    textAlign: 'center',
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  sectionSupport: {
    color: '#A1A1AA',
    fontSize: 14,
    textAlign: 'center',
    maxWidth: 400,
    marginBottom: 20,
    lineHeight: 20,
  },
  buttonRow: { flexDirection: 'column', alignItems: 'center', gap: 12 },
  installButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    width: '100%',
    maxWidth: 280,
    height: 48,
    backgroundColor: '#18181B',
    borderWidth: 1,
    borderColor: '#27272A',
    borderRadius: 12,
  },
  installButtonText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(5,6,10,0.75)', justifyContent: 'center', paddingHorizontal: 24 },
  modalCard: {
    backgroundColor: 'rgba(23,23,28,0.9)',
    borderWidth: 1,
    borderColor: 'rgba(224,90,23,0.18)',
    borderRadius: 24,
    padding: 26,
    alignItems: 'center',
    ...(Platform.OS === 'web' ? { backdropFilter: 'blur(20px)' } : {}),
  },
  modalIconCircle: { width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(224,90,23,0.12)', alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  modalTitle: { color: '#f5f5f5', fontSize: 16, fontWeight: '800', marginBottom: 10, textAlign: 'center' },
  modalText: { color: '#a3a3a3', fontSize: 13, lineHeight: 20, textAlign: 'center', marginBottom: 20 },
  modalCloseButton: { backgroundColor: '#E05A17', borderRadius: 12, paddingVertical: 14, paddingHorizontal: 32, alignItems: 'center' },
  modalCloseButtonText: { color: '#000000', fontSize: 14, fontWeight: '800' },
});
