import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, Linking } from 'react-native';

// Embedded, in-app PDF reader — no external browser tab/address bar. Web-only
// (an <iframe> pointed straight at the Storage URL); on native this app is
// PWA-only today, so the fallback just hands off to the OS opener instead of
// pulling in a native PDF-rendering dependency for a path nobody hits.
export default function PdfViewerScreen({ fileUrl, title, onClose }) {
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={styles.backText}>← Voltar</Text>
        </TouchableOpacity>
        {title ? <Text style={styles.title} numberOfLines={1}>{title}</Text> : null}
      </View>
      <View style={{ flex: 1 }}>
        {Platform.OS === 'web' ? (
          <iframe src={fileUrl} style={{ width: '100%', height: '100%', border: 'none', background: '#0a0a0a' }} title={title || 'PDF'} />
        ) : (
          <TouchableOpacity style={styles.fallbackButton} onPress={() => Linking.openURL(fileUrl).catch(() => {})}>
            <Text style={styles.fallbackButtonText}>Abrir arquivo</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingTop: 50, paddingHorizontal: 16, paddingBottom: 14 },
  backText: { color: '#f97316', fontSize: 15, fontWeight: '700' },
  title: { color: '#f5f5f5', fontSize: 14, fontWeight: '700', flex: 1 },
  fallbackButton: { margin: 20, backgroundColor: '#f97316', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  fallbackButtonText: { color: '#0a0a0a', fontSize: 14, fontWeight: '800' },
});
