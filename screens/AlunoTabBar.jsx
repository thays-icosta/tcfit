import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const TABS = [
  { key: 'inicio', label: 'Início', icon: 'home-outline', iconActive: 'home' },
  { key: 'planner', label: 'Planner', icon: 'calendar-outline', iconActive: 'calendar' },
  { key: 'downloads', label: 'Downloads', icon: 'download-outline', iconActive: 'download' },
  { key: 'comunidade', label: 'Comunidade', icon: 'chatbubbles-outline', iconActive: 'chatbubbles' },
  { key: 'perfil', label: 'Perfil', icon: 'person-outline', iconActive: 'person' },
];

export default function AlunoTabBar({ activeTab, onChange }) {
  return (
    <View style={styles.bar}>
      {TABS.map((t) => {
        const active = activeTab === t.key;
        return (
          <TouchableOpacity key={t.key} style={styles.tab} onPress={() => onChange(t.key)}>
            <Ionicons name={active ? t.iconActive : t.icon} size={22} color={active ? '#f97316' : '#737373'} />
            <Text style={[styles.label, active && styles.labelActive]}>{t.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: '#171717',
    borderTopWidth: 1,
    borderTopColor: '#292524',
    paddingTop: 8,
    paddingBottom: 10,
  },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2 },
  label: { color: '#737373', fontSize: 9, fontWeight: '700' },
  labelActive: { color: '#f97316' },
});
