import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import InstallBanner from './InstallBanner';

export default function WelcomeScreen({ onExplore, onLogin }) {
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
        <InstallBanner />

        <TouchableOpacity style={styles.exploreButton} onPress={onExplore}>
          <Ionicons name="storefront-outline" size={18} color="#0a0a0a" />
          <Text style={styles.exploreButtonText}>Conhecer Protocolos & Consultoria</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.loginButton} onPress={onLogin}>
          <Text style={styles.loginButtonText}>Já tenho conta (Entrar)</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
    justifyContent: 'space-between',
    paddingVertical: 80,
    paddingHorizontal: 32,
    ...(Platform.OS === 'web' ? { maxWidth: 440, width: '100%', marginHorizontal: 'auto' } : {}),
  },
  centerBlock: { alignItems: 'center', marginTop: 40 },
  logo: { width: 140, height: 140, marginBottom: 12 },
  appName: { color: '#f5f5f5', fontSize: 32, fontWeight: '800', letterSpacing: 0.5 },
  slogan: { color: '#a3a3a3', fontSize: 13, marginTop: 8, textAlign: 'center', paddingHorizontal: 20 },
  buttonsBlock: { width: '100%' },
  exploreButton: { flexDirection: 'row', gap: 8, backgroundColor: '#f97316', borderRadius: 14, paddingVertical: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  exploreButtonText: { color: '#0a0a0a', fontSize: 14, fontWeight: '800' },
  loginButton: { borderWidth: 1, borderColor: '#292524', borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  loginButtonText: { color: '#f5f5f5', fontSize: 14, fontWeight: '700' },
});
