import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';

const ACCENT = '#f97316';

// Shared "back nav" header: ← Voltar + title, optional right-side action slot.
// Used by every secondary/admin/detail screen reached via an onClose prop.
export function HeaderBack({ title, titleSlot, onBack, rightSlot, style, backLabel = '← Voltar' }) {
  return (
    <View style={[styles.backBar, style]}>
      <TouchableOpacity onPress={onBack} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
        <Text style={styles.backText}>{backLabel}</Text>
      </TouchableOpacity>
      {titleSlot ? (
        <View style={styles.backTitleSlot}>{titleSlot}</View>
      ) : title ? (
        <Text style={styles.backTitle} numberOfLines={1}>{title}</Text>
      ) : (
        <View style={{ flex: 1 }} />
      )}
      {rightSlot ? <View style={styles.backRight}>{rightSlot}</View> : null}
    </View>
  );
}

// Shared "welcome" header: avatar + eyebrow badge + greeting, optional right-side action slot.
// Used by the two home screens (PersonalHomeScreen, AlunoHomeScreen).
export function HeaderWelcome({ avatarUrl, initial, badge, greeting, onAvatarPress, rightSlot }) {
  return (
    <View style={styles.welcomeBar}>
      <View style={styles.welcomeLeft}>
        <TouchableOpacity onPress={onAvatarPress} disabled={!onAvatarPress}>
          <View style={styles.avatarCircle}>
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={styles.avatarImage} resizeMode="cover" />
            ) : (
              <Text style={styles.avatarLetter}>{initial}</Text>
            )}
          </View>
        </TouchableOpacity>
        <View style={styles.welcomeTextCol}>
          {badge ? <Text style={styles.badge}>{badge}</Text> : null}
          <Text style={styles.greeting} numberOfLines={1}>{greeting}</Text>
        </View>
      </View>
      {rightSlot ? <View>{rightSlot}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  backBar: { flexDirection: 'row', alignItems: 'center', minHeight: 64, marginBottom: 12 },
  backText: { color: ACCENT, fontSize: 14, fontWeight: '600' },
  backTitle: { color: '#f5f5f5', fontSize: 16, fontWeight: '700', marginLeft: 16, flex: 1 },
  backTitleSlot: { flexDirection: 'row', alignItems: 'center', gap: 8, marginLeft: 16, flex: 1 },
  backRight: { flexDirection: 'row', alignItems: 'center', marginLeft: 12 },

  welcomeBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 64, marginBottom: 8 },
  welcomeLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 1 },
  welcomeTextCol: { flexShrink: 1 },
  avatarCircle: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#171717', borderWidth: 1, borderColor: ACCENT, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarImage: { width: 44, height: 44 },
  avatarLetter: { color: ACCENT, fontSize: 16, fontWeight: '800' },
  badge: { color: ACCENT, fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 4 },
  greeting: { color: '#f5f5f5', fontSize: 19, fontWeight: '700' },
});
