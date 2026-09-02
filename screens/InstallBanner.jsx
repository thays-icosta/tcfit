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
    <View style={styles.installRow}>
      <Text style={styles.installLabel}>Baixar o app:</Text>
      <TouchableOpacity style={styles.installIconButton} onPress={handleInstallAndroid} hitSlop={6}>
        <Ionicons name="logo-android" size={14} color="#a3a3a3" />
        <Text style={styles.installIconText}>Android</Text>
      </TouchableOpacity>
      <Text style={styles.installDivider}>|</Text>
      <TouchableOpacity style={styles.installIconButton} onPress={() => setShowIosGuide(true)} hitSlop={6}>
        <Ionicons name="logo-apple" size={14} color="#a3a3a3" />
        <Text style={styles.installIconText}>iOS</Text>
      </TouchableOpacity>

      <Modal visible={showIosGuide} transparent animationType="fade" onRequestClose={() => setShowIosGuide(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Adicionar à Tela de Início</Text>
            <Text style={styles.modalSubtitle}>O iPhone não permite baixar apps fora da App Store, mas você pode instalar o TcFit como um app direto pelo Safari:</Text>

            <View style={styles.stepRow}>
              <View style={styles.stepNumber}><Text style={styles.stepNumberText}>1</Text></View>
              <Text style={styles.stepText}>Abra esse site no <Text style={styles.stepBold}>Safari</Text> (precisa ser o Safari, não funciona em outros navegadores no iPhone)</Text>
            </View>
            <View style={styles.stepRow}>
              <View style={styles.stepNumber}><Text style={styles.stepNumberText}>2</Text></View>
              <Text style={styles.stepText}>Toque no ícone de <Text style={styles.stepBold}>Compartilhar</Text> (o quadrado com a seta pra cima) na barra inferior</Text>
            </View>
            <View style={styles.stepRow}>
              <View style={styles.stepNumber}><Text style={styles.stepNumberText}>3</Text></View>
              <Text style={styles.stepText}>Role a lista e toque em <Text style={styles.stepBold}>“Adicionar à Tela de Início”</Text></Text>
            </View>
            <View style={styles.stepRow}>
              <View style={styles.stepNumber}><Text style={styles.stepNumberText}>4</Text></View>
              <Text style={styles.stepText}>Toque em <Text style={styles.stepBold}>“Adicionar”</Text> — pronto, o ícone do TcFit aparece na sua tela como um app de verdade</Text>
            </View>

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
  installRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 20 },
  installLabel: { color: '#525252', fontSize: 11, fontWeight: '600' },
  installIconButton: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  installIconText: { color: '#a3a3a3', fontSize: 11, fontWeight: '700' },
  installDivider: { color: '#292524', fontSize: 11 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(5,6,10,0.75)', justifyContent: 'center', paddingHorizontal: 24 },
  modalCard: {
    backgroundColor: 'rgba(23,23,28,0.85)',
    borderWidth: 1,
    borderColor: 'rgba(249,115,22,0.18)',
    borderRadius: 24,
    padding: 22,
    ...(Platform.OS === 'web' ? { backdropFilter: 'blur(20px)' } : {}),
  },
  modalTitle: { color: '#f5f5f5', fontSize: 16, fontWeight: '800', marginBottom: 8 },
  modalSubtitle: { color: '#a3a3a3', fontSize: 12, lineHeight: 17, marginBottom: 18 },
  stepRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 14 },
  stepNumber: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#f97316', alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  stepNumberText: { color: '#0a0a0a', fontSize: 11, fontWeight: '800' },
  stepText: { color: '#d4d4d4', fontSize: 13, lineHeight: 19, flex: 1 },
  stepBold: { color: '#f5f5f5', fontWeight: '800' },
  modalCloseButton: { backgroundColor: '#f97316', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 6 },
  modalCloseButtonText: { color: '#0a0a0a', fontSize: 14, fontWeight: '800' },
});
