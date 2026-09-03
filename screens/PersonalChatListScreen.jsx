import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Image } from 'react-native';
import { supabase } from './supabaseClient';
import ChatScreen from './ChatScreen';
import { HeaderBack } from './Header';

export default function PersonalChatListScreen({ personalId, onClose, initialStudentId, onConsumeInitialStudent }) {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openChatWith, setOpenChatWith] = useState(null);

  const loadConversations = async () => {
    const { data: studentRows } = await supabase
      .from('users')
      .select('id, name, avatar_url')
      .eq('personal_id', personalId)
      .eq('role', 'aluno');

    const { data: allMessages } = await supabase
      .from('messages')
      .select('student_id, sender_id, content, read, created_at')
      .eq('personal_id', personalId)
      .order('created_at', { ascending: false });

    const byStudent = {};
    (allMessages || []).forEach((m) => {
      if (!byStudent[m.student_id]) {
        byStudent[m.student_id] = { lastMessage: m, unreadCount: 0 };
      }
      if (m.sender_id !== personalId && !m.read) {
        byStudent[m.student_id].unreadCount += 1;
      }
    });

    const enriched = (studentRows || []).map((s) => ({
      ...s,
      lastMessage: byStudent[s.id]?.lastMessage || null,
      unreadCount: byStudent[s.id]?.unreadCount || 0,
    }));

    enriched.sort((a, b) => {
      if (!a.lastMessage && !b.lastMessage) return 0;
      if (!a.lastMessage) return 1;
      if (!b.lastMessage) return -1;
      return new Date(b.lastMessage.created_at) - new Date(a.lastMessage.created_at);
    });

    setStudents(enriched);
    setLoading(false);
  };

  useEffect(() => {
    loadConversations();
  }, [personalId]);

  useEffect(() => {
    if (!initialStudentId || students.length === 0) return;
    const match = students.find((s) => s.id === initialStudentId);
    if (match) {
      setOpenChatWith(match);
      onConsumeInitialStudent?.();
    }
  }, [initialStudentId, students]);

  if (openChatWith) {
    return (
      <ChatScreen
        personalId={personalId}
        studentId={openChatWith.id}
        currentUserId={personalId}
        otherName={openChatWith.name}
        otherAvatarUrl={openChatWith.avatar_url}
        onClose={() => {
          setOpenChatWith(null);
          loadConversations();
        }}
      />
    );
  }

  return (
    <View style={styles.container}>
      <HeaderBack title="Mensagens" onBack={onClose} />

      {loading ? (
        <ActivityIndicator color="#f97316" style={{ marginTop: 30 }} />
      ) : students.length === 0 ? (
        <Text style={styles.emptyText}>Convide alunos pra começar a trocar mensagens.</Text>
      ) : (
        <ScrollView style={{ flex: 1 }}>
          {students.map((s) => (
            <TouchableOpacity key={s.id} style={styles.row} onPress={() => setOpenChatWith(s)}>
              <View style={styles.avatarCircle}>
                {s.avatar_url ? (
                  <Image source={{ uri: s.avatar_url }} style={styles.avatarImage} />
                ) : (
                  <Text style={styles.avatarLetter}>{s.name?.charAt(0).toUpperCase() || '?'}</Text>
                )}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{s.name}</Text>
                <Text style={styles.preview} numberOfLines={1}>
                  {s.lastMessage ? s.lastMessage.content : 'Nenhuma mensagem ainda'}
                </Text>
              </View>
              {s.unreadCount > 0 && (
                <View style={styles.unreadBadge}>
                  <Text style={styles.unreadBadgeText}>{s.unreadCount}</Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a', paddingTop: 50, paddingHorizontal: 16 },
  emptyText: { color: '#525252', fontSize: 13, textAlign: 'center', marginTop: 30 },
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#171717', borderWidth: 1, borderColor: '#292524', borderRadius: 12, padding: 12, marginBottom: 8 },
  avatarCircle: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#0a0a0a', borderWidth: 1, borderColor: '#292524', alignItems: 'center', justifyContent: 'center', marginRight: 12, overflow: 'hidden' },
  avatarImage: { width: 44, height: 44 },
  avatarLetter: { color: '#f97316', fontSize: 17, fontWeight: '800' },
  name: { color: '#f5f5f5', fontSize: 14, fontWeight: '700' },
  preview: { color: '#737373', fontSize: 12, marginTop: 2 },
  unreadBadge: { backgroundColor: '#f97316', borderRadius: 12, minWidth: 22, height: 22, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  unreadBadgeText: { color: '#0a0a0a', fontSize: 11, fontWeight: '800' },
});