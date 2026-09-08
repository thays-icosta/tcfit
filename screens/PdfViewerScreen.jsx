import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// Mobile browsers (iOS Safari/Chrome in particular) don't reliably render a
// PDF embedded in an <iframe> — the built-in PDF plugin often renders at its
// own intrinsic size instead of fitting the iframe box, which shows up as the
// document squished into a sliver near the bottom of the screen. Opening the
// same URL as a top-level navigation instead lets the OS's own full-screen
// PDF viewer take over correctly, so mobile (native app or mobile web) always
// gets the "open externally" button; only desktop web gets the inline iframe.
const isMobileWeb = Platform.OS === 'web' && typeof navigator !== 'undefined' && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent || '');
const useInlineViewer = Platform.OS === 'web' && !isMobileWeb;

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
        {useInlineViewer ? (
          <iframe src={fileUrl} style={{ width: '100%', height: '100%', border: 'none', background: '#0F0F12' }} title={title || 'PDF'} />
        ) : (
          <View style={styles.fallbackWrap}>
            <Ionicons name="document-text-outline" size={40} color="#FF6B00" />
            <Text style={styles.fallbackText}>Esse guia abre melhor no visualizador do seu celular.</Text>
            <TouchableOpacity style={styles.fallbackButton} onPress={() => Linking.openURL(fileUrl).catch(() => {})}>
              <Text style={styles.fallbackButtonText}>Abrir Guia</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F0F12' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingTop: 50, paddingHorizontal: 16, paddingBottom: 14 },
  backText: { color: '#FF6B00', fontSize: 15, fontWeight: '700' },
  title: { color: '#F5F5F7', fontSize: 14, fontWeight: '700', flex: 1 },
  fallbackWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 30 },
  fallbackText: { color: '#a3a3a3', fontSize: 13, textAlign: 'center', marginTop: 14, marginBottom: 20, lineHeight: 19 },
  fallbackButton: { backgroundColor: '#FF6B00', borderRadius: 12, paddingVertical: 14, paddingHorizontal: 28, alignItems: 'center' },
  fallbackButtonText: { color: '#0F0F12', fontSize: 14, fontWeight: '800' },
});
