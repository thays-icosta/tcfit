import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

export default function HomeScreen({ user, onLogout }) {
  return (
    <View style={styles.container}>
      <Text style={styles.greeting}>Olá, {user?.name || 'atleta'}! 👋</Text>
      <Text style={styles.subtitle}>Você está logado no NutriTreino.</Text>

      <TouchableOpacity style={styles.button} onPress={onLogout}>
        <Text style={styles.buttonText}>Sair</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F0F12', alignItems: 'center', justifyContent: 'center', padding: 24 },
  greeting: { color: '#F5F5F7', fontSize: 24, fontWeight: '700', marginBottom: 8 },
  subtitle: { color: '#a3a3a3', fontSize: 14, marginBottom: 32 },
  button: { backgroundColor: '#1C1C22', borderWidth: 1, borderColor: '#2B2B36', borderRadius: 12, paddingVertical: 12, paddingHorizontal: 32 },
  buttonText: { color: '#FF6B00', fontSize: 15, fontWeight: '700' },
});