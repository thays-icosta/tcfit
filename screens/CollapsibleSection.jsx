import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, LayoutAnimation, Platform, UIManager } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export function animateNextLayout() {
  LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
}

export default function CollapsibleSection({ title, headerRight, collapsed, onToggle, children, style }) {
  return (
    <View style={style}>
      <TouchableOpacity style={styles.header} onPress={onToggle} activeOpacity={0.7}>
        <Text style={styles.title}>{title}</Text>
        <View style={styles.headerRight}>
          {headerRight}
          <Ionicons name={collapsed ? 'chevron-down-outline' : 'chevron-up-outline'} size={18} color="#737373" />
        </View>
      </TouchableOpacity>
      {!collapsed && children}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { color: '#f5f5f5', fontSize: 14, fontWeight: '700', flexShrink: 1 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
