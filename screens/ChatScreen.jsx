import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, TextInput, FlatList, ActivityIndicator, KeyboardAvoidingView, Platform, Image } from 'react-native';
import { supabase } from './supabaseClient';
import { HeaderBack } from './Header';

export default function ChatScreen({ personalId, studentId, currentUserId, otherName, otherAvatarUrl, initialMessage, onClose }) {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState(initialMessage || '');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const listRef = useRef(null);

  const loadMessages = async () => {
    const { data } = await supabase
      .from('messages')
      .select('*')
      .eq('personal_id', personalId)
      .eq('student_id', studentId)
      .order('created_at', { ascending: true });
    setMessages(data || []);
    setLoading(false);

    await supabase
      .from('messages')
      .update({ read: true })
      .eq('personal_id', personalId)
      .eq('student_id', studentId)
      .neq('sender_id', currentUserId)
      .eq('read', false);
  };

  useEffect(() => {
    loadMessages();

    const channel = supabase
      .channel(`chat-${personalId}-${studentId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `student_id=eq.${studentId}` },
        (payload) => {
          setMessages((prev) => {
            if (prev.some((m) => m.id === payload.new.id)) return prev;
            return [...prev, payload.new];
          });
          if (payload.new.sender_id !== currentUserId) {
            supabase.from('messages').update({ read: true }).eq('id', payload.new.id).then(() => {});
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [personalId, studentId]);

  useEffect(() => {
    if (initialMessage) {
      setNewMessage(initialMessage);
    }
  }, [initialMessage]);

  const handleSend = async () => {
    if (!newMessage.trim() || sending) return;
    const content = newMessage.trim();
    setNewMessage('');
    setSending(true);

    const { data, error } = await supabase
      .from('messages')
      .insert({ personal_id: personalId, student_id: studentId, sender_id: currentUserId, content })
      .select()
      .single();

    setSending(false);
    if (!error && data) {
      setMessages((prev) => {
        if (prev.some((m) => m.id === data.id)) return prev;
        return [...prev, data];
      });
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    }
  };

  const formatTime = (iso) => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={0}>
      <HeaderBack
        onBack={onClose}
        style={{ paddingHorizontal: 16 }}
        titleSlot={
          <>
            <View style={styles.avatarCircle}>
              {otherAvatarUrl ? (
                <Image source={{ uri: otherAvatarUrl }} style={styles.avatarImage} />
              ) : (
                <Text style={styles.avatarLetter}>{otherName?.charAt(0).toUpperCase() || '?'}</Text>
              )}
            </View>
            <Text style={styles.title} numberOfLines={1}>{otherName}</Text>
          </>
        }
      />

      {loading ? (
        <ActivityIndicator color="#FF6B00" style={{ marginTop: 30 }} />
      ) : (
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(item) => item.id}
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 16 }}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
          ListEmptyComponent={<Text style={styles.emptyText}>Nenhuma mensagem ainda. Diga oi! 👋</Text>}
          renderItem={({ item }) => {
            const isOwn = item.sender_id === currentUserId;
            return (
              <View style={[styles.bubbleRow, isOwn ? styles.bubbleRowOwn : styles.bubbleRowOther]}>
                <View style={[styles.bubble, isOwn ? styles.bubbleOwn : styles.bubbleOther]}>
                  <Text style={[styles.bubbleText, isOwn && styles.bubbleTextOwn]}>{item.content}</Text>
                  <Text style={[styles.bubbleTime, isOwn && styles.bubbleTimeOwn]}>{formatTime(item.created_at)}</Text>
                </View>
              </View>
            );
          }}
        />
      )}

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          placeholder="Digite uma mensagem..."
          placeholderTextColor="#525252"
          value={newMessage}
          onChangeText={setNewMessage}
          multiline
        />
        <TouchableOpacity style={styles.sendButton} onPress={handleSend} disabled={sending || !newMessage.trim()}>
          {sending ? <ActivityIndicator color="#0F0F12" size="small" /> : <Text style={styles.sendButtonText}>➤</Text>}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F0F12', paddingTop: 50 },
  avatarCircle: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#1C1C22', borderWidth: 1, borderColor: '#2B2B36', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarImage: { width: 32, height: 32 },
  avatarLetter: { color: '#FF6B00', fontSize: 13, fontWeight: '800' },
  title: { color: '#F5F5F7', fontSize: 16, fontWeight: '700', flexShrink: 1 },
  emptyText: { color: '#525252', fontSize: 13, textAlign: 'center', marginTop: 40 },
  bubbleRow: { flexDirection: 'row', marginBottom: 10 },
  bubbleRowOwn: { justifyContent: 'flex-end' },
  bubbleRowOther: { justifyContent: 'flex-start' },
  bubble: { maxWidth: '78%', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10 },
  bubbleOwn: { backgroundColor: '#FF6B00', borderBottomRightRadius: 4 },
  bubbleOther: { backgroundColor: '#1C1C22', borderBottomLeftRadius: 4, borderWidth: 1, borderColor: '#2B2B36' },
  bubbleText: { color: '#F5F5F7', fontSize: 14 },
  bubbleTextOwn: { color: '#0F0F12' },
  bubbleTime: { color: '#525252', fontSize: 9, marginTop: 4, textAlign: 'right' },
  bubbleTimeOwn: { color: 'rgba(10,10,10,0.6)' },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', padding: 12, gap: 8, borderTopWidth: 1, borderTopColor: '#1C1C22' },
  input: { flex: 1, backgroundColor: '#1C1C22', borderWidth: 1, borderColor: '#2B2B36', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, color: '#F5F5F7', fontSize: 14, maxHeight: 100 },
  sendButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#FF6B00', alignItems: 'center', justifyContent: 'center' },
  sendButtonText: { color: '#0F0F12', fontSize: 18, fontWeight: '800' },
});