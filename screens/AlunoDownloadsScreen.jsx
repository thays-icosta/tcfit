import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from './supabaseClient';
import { hasAccessByLevel } from './accessLevel';

export default function AlunoDownloadsScreen({ studentId, personalId }) {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      if (!personalId) {
        setLoading(false);
        return;
      }
      const [{ data: myRow }, { data: productRows }, { data: grantRows }] = await Promise.all([
        supabase.from('users').select('access_level').eq('id', studentId).single(),
        supabase.from('products').select('*').eq('personal_id', personalId).eq('active', true),
        supabase.from('product_grants').select('product_id').eq('student_id', studentId),
      ]);

      const level = myRow?.access_level || 'plataforma_base';
      const grantedIds = new Set((grantRows || []).map((g) => g.product_id));
      const unlocked = (productRows || [])
        .filter((p) => p.pdf_url || (p.delivery_type === 'arquivo' && p.delivery_value))
        .filter((p) => grantedIds.has(p.id) || hasAccessByLevel(level, p.required_access_level));
      setFiles(unlocked);
      setLoading(false);
    })();
  }, [studentId, personalId]);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Downloads</Text>
      <Text style={styles.subtitle}>Arquivos e e-books que você já desbloqueou.</Text>

      {loading ? (
        <ActivityIndicator color="#f97316" style={{ marginTop: 20 }} />
      ) : files.length === 0 ? (
        <Text style={styles.emptyText}>Nenhum arquivo desbloqueado ainda. Veja em “Conteúdos e Produtos” na Home o que tem disponível.</Text>
      ) : (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 30 }}>
          {files.map((f) => {
            const fileUrl = f.pdf_url || f.delivery_value;
            return (
              <TouchableOpacity key={f.id} style={styles.fileRow} onPress={() => Linking.openURL(fileUrl).catch(() => {})}>
                <Ionicons name={fileUrl.toLowerCase().includes('.pdf') ? 'document-text-outline' : 'link-outline'} size={20} color="#f97316" />
                <Text style={styles.fileName} numberOfLines={1}>{f.name}</Text>
                <Ionicons name="download-outline" size={18} color="#737373" />
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a', padding: 24, paddingTop: 60 },
  title: { color: '#f5f5f5', fontSize: 20, fontWeight: '700', marginBottom: 6 },
  subtitle: { color: '#737373', fontSize: 12, marginBottom: 20 },
  emptyText: { color: '#525252', fontSize: 13, textAlign: 'center', marginTop: 30, lineHeight: 19 },
  fileRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#171717', borderWidth: 1, borderColor: '#292524', borderRadius: 12, padding: 14, marginBottom: 10 },
  fileName: { flex: 1, color: '#f5f5f5', fontSize: 13, fontWeight: '600' },
});
