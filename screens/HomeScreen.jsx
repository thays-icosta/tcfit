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
  container: { flex: 1, backgroundColor: '#0a0a0a', alignItems: 'center', justifyContent: 'center', padding: 24 },
  greeting: { color: '#f5f5f5', fontSize: 24, fontWeight: '700', marginBottom: 8 },
  subtitle: { color: '#a3a3a3', fontSize: 14, marginBottom: 32 },
  button: { backgroundColor: '#171717', borderWidth: 1, borderColor: '#292524', borderRadius: 12, paddingVertical: 12, paddingHorizontal: 32 },
  buttonText: { color: '#f97316', fontSize: 15, fontWeight: '700' },
});