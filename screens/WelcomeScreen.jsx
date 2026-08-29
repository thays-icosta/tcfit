import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image, Platform, Linking, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const ANDROID_APK_URL = 'https://expo.dev/artifacts/eas/5QoXnBD_OkS2B8xqN_dmjlzahh2boTA54JmrbAYXa4o.apk';

export default function WelcomeScreen({ onExplore, onLogin }) {
  const [showIosGuide, setShowIosGuide] = useState(false);

  const handleInstallAndroid = () => {
    Linking.openURL(ANDROID_APK_URL).catch(() => {});
  };

  return (
    <View style={styles.container}>
      <View style={styles.centerBlock}>
        <Image
          source={require('../assets/images/brand-logo.png')}
          style={styles.logo}
          resizeMode="contain"
        />
        <Text style={styles.appName}>TcFit</Text>
        <Text style={styles.slogan}>Sua plataforma exclusiva de treino e saúde</Text>
      </View>

      <View style={styles.buttonsBlock}>
        {Platform.OS === 'web' && (
          <View style={styles.installBlock}>
            <Text style={styles.installTitle}>Instalar o app</Text>
            <TouchableOpacity style={styles.installButton} onPress={handleInstallAndroid}>
              <Ionicons name="logo-android" size={18} color="#f5f5f5" />
              <Text style={styles.installButtonText}>Instalar no Android (Download APK)</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.installButton} onPress={() => setShowIosGuide(true)}>
              <Ionicons name="logo-apple" size={18} color="#f5f5f5" />
              <Text style={styles.installButtonText}>Abrir no iPhone (Adicionar à Tela de Início)</Text>
            </TouchableOpacity>
          </View>
        )}

        <TouchableOpacity style={styles.exploreButton} onPress={onExplore}>
          <Ionicons name="storefront-outline" size={18} color="#0a0a0a" />
          <Text style={styles.exploreButtonText}>Conhecer Protocolos & Consultoria</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.loginButton} onPress={onLogin}>
          <Text style={styles.loginButtonText}>Já tenho conta (Entrar)</Text>
        </TouchableOpacity>
      </View>

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
  container: { flex: 1, backgroundColor: '#0a0a0a', justifyContent: 'space-between', paddingVertical: 80, paddingHorizontal: 32 },
  centerBlock: { alignItems: 'center', marginTop: 40 },
  logo: { width: 140, height: 140, marginBottom: 12 },
  appName: { color: '#f5f5f5', fontSize: 32, fontWeight: '800', letterSpacing: 0.5 },
  slogan: { color: '#a3a3a3', fontSize: 13, marginTop: 8, textAlign: 'center', paddingHorizontal: 20 },
  buttonsBlock: { width: '100%' },
  installBlock: { marginBottom: 20 },
  installTitle: { color: '#737373', fontSize: 10, textTransform: 'uppercase', marginBottom: 8, textAlign: 'center' },
  installButton: { flexDirection: 'row', gap: 8, backgroundColor: '#171717', borderWidth: 1, borderColor: '#292524', borderRadius: 12, paddingVertical: 13, alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  installButtonText: { color: '#f5f5f5', fontSize: 13, fontWeight: '700' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', paddingHorizontal: 24 },
  modalCard: { backgroundColor: '#171717', borderRadius: 16, padding: 22 },
  modalTitle: { color: '#f5f5f5', fontSize: 16, fontWeight: '800', marginBottom: 8 },
  modalSubtitle: { color: '#a3a3a3', fontSize: 12, lineHeight: 17, marginBottom: 18 },
  stepRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 14 },
  stepNumber: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#f97316', alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  stepNumberText: { color: '#0a0a0a', fontSize: 11, fontWeight: '800' },
  stepText: { color: '#d4d4d4', fontSize: 13, lineHeight: 19, flex: 1 },
  stepBold: { color: '#f5f5f5', fontWeight: '800' },
  modalCloseButton: { backgroundColor: '#f97316', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 6 },
  modalCloseButtonText: { color: '#0a0a0a', fontSize: 14, fontWeight: '800' },
  exploreButton: { flexDirection: 'row', gap: 8, backgroundColor: '#f97316', borderRadius: 14, paddingVertical: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  exploreButtonText: { color: '#0a0a0a', fontSize: 14, fontWeight: '800' },
  loginButton: { borderWidth: 1, borderColor: '#292524', borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  loginButtonText: { color: '#f5f5f5', fontSize: 14, fontWeight: '700' },
});