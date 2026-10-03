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
  container: { flex: 1, backgroundColor: '#08090B', alignItems: 'center', justifyContent: 'center', padding: 24 },
  greeting: { color: '#FFFFFF', fontSize: 24, fontWeight: '700', marginBottom: 8 },
  subtitle: { color: '#A7AAB0', fontSize: 14, marginBottom: 32 },
  button: { backgroundColor: '#121419', borderWidth: 1, borderColor: '#292D34', borderRadius: 12, paddingVertical: 12, paddingHorizontal: 32 },
  buttonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
});