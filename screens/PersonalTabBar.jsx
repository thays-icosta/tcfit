import React, { useEffect, useRef } from 'react';
import { View, TouchableOpacity, Text, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const ACTIVE_COLOR = '#f97316';
const INACTIVE_COLOR = '#666666';

const TABS = [
  { key: 'inicio', label: 'Início', icon: 'home-outline', iconActive: 'home' },
  { key: 'treinos', label: 'Treinos', icon: 'barbell-outline', iconActive: 'barbell' },
  { key: 'nutricao', label: 'Nutrição', icon: 'nutrition-outline', iconActive: 'nutrition' },
  { key: 'alunos', label: 'Alunos', icon: 'people-outline', iconActive: 'people' },
  { key: 'perfil', label: 'Perfil', icon: 'person-outline', iconActive: 'person' },
];

function TabIcon({ tab, active, onPress }) {
  const scale = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.spring(scale, { toValue: active ? 1.12 : 1, friction: 6, tension: 140, useNativeDriver: true }).start();
  }, [active, scale]);
  return (
    <TouchableOpacity style={styles.tab} onPress={onPress} activeOpacity={0.7}>
      <Animated.View style={{ transform: [{ scale }] }}>
        <Ionicons name={active ? tab.iconActive : tab.icon} size={22} color={active ? ACTIVE_COLOR : INACTIVE_COLOR} />
      </Animated.View>
      <Text style={[styles.label, active && styles.labelActive]}>{tab.label}</Text>
      <View style={[styles.dot, active && styles.dotActive]} />
    </TouchableOpacity>
  );
}

export default function PersonalTabBar({ activeTab, onChange }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 10) }]}>
      {TABS.map((t) => (
        <TabIcon key={t.key} tab={t} active={activeTab === t.key} onPress={() => onChange(t.key)} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: '#171717',
    borderTopWidth: 1,
    borderTopColor: '#292524',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingTop: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 12,
  },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  label: { color: '#666666', fontSize: 10, fontWeight: '600', marginTop: 3 },
  labelActive: { color: '#f97316' },
  dot: { width: 4, height: 4, borderRadius: 2, marginTop: 4, backgroundColor: 'transparent' },
  dotActive: { backgroundColor: '#f97316' },
});
