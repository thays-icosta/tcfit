import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, TextInput, ScrollView, Alert, ActivityIndicator, Switch, Image, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';
import * as ImagePicker from 'expo-image-picker';
import { decode } from 'base64-arraybuffer';
import { supabase } from './supabaseClient';
import PhysicalAssessmentHistoryScreen from './PhysicalAssessmentHistoryScreen';
import VolumeSummaryScreen from './VolumeSummaryScreen';
import WeeklyPeriodizationScreen from './WeeklyPeriodizationScreen';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const TIME_PRESETS = ['06:00', '07:00', '12:00', '18:00', '19:00', '20:00'];
const DELETE_CONFIRM_WORD = 'EXCLUIR';

export default function AlunoProfileScreen({ user, onClose, onLogout }) {
  const [name, setName] = useState('');
  const [weight, setWeight] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showEvolution, setShowEvolution] = useState(false);
  const [showVolume, setShowVolume] = useState(false);
  const [showPeriodization, setShowPeriodization] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [reminderTime, setReminderTime] = useState('18:00');
  const [savingReminder, setSavingReminder] = useState(false);

  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('users')
        .select('name, weight_kg, email, phone, reminder_enabled, reminder_time, avatar_url')
        .eq('id', user.id)
        .single();
      if (data) {
        setName(data.name || '');
        setWeight(data.weight_kg ? String(data.weight_kg) : '');
        setEmail(data.email || '');
        setPhone(data.phone || '');
        setReminderEnabled(data.reminder_enabled || false);
        setReminderTime(data.reminder_time || '18:00');
        setAvatarUrl(data.avatar_url || null);
      }
      setLoading(false);
    })();
  }, [user.id]);

  const handlePickAvatar = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permissão necessária', 'Autorize o acesso às fotos pra escolher uma imagem de perfil.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.5,
        base64: true,
      });

      if (result.canceled) return;

      if (!result.assets || result.assets.length === 0 || !result.assets[0].base64) {
        Alert.alert('Ops', 'Não conseguimos ler os dados dessa imagem. Tenta escolher outra foto.');
        return;
      }

      const base64Data = result.assets[0].base64;

      setUploadingAvatar(true);
      const filePath = `${user.id}.jpg`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, decode(base64Data), { upsert: true, contentType: 'image/jpeg' });
      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage.from('avatars').getPublicUrl(filePath);
      const finalUrl = `${publicUrlData.publicUrl}?t=${Date.now()}`;
      await supabase.from('users').update({ avatar_url: finalUrl }).eq('id', user.id);
      setAvatarUrl(finalUrl);
      Alert.alert('Foto atualizada!', 'Sua foto de perfil foi salva com sucesso.');
    } catch (e) {
      Alert.alert('Erro ao enviar foto', e.message || 'Erro desconhecido');
    }
    setUploadingAvatar(false);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Ops', 'O nome não pode ficar vazio.');
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from('users')
      .update({
        name: name.trim(),
        weight_kg: weight ? Number(weight) : null,
        phone: phone.trim() || null,
      })
      .eq('id', user.id);
    setSaving(false);
    if (error) {
      Alert.alert('Erro', error.message);
    } else {
      Alert.alert('Salvo!', 'Seu perfil foi atualizado.', [{ text: 'OK', onPress: onClose }]);
    }
  };

  const handleToggleReminder = async (value) => {
    setReminderEnabled(value);
    if (!value) {
      await Notifications.cancelAllScheduledNotificationsAsync();
      setSavingReminder(true);
      await supabase.from('users').update({ reminder_enabled: false }).eq('id', user.id);
      setSavingReminder(false);
    }
  };

  const handleSaveReminder = async () => {
    const match = reminderTime.match(/^([01]?\d|2[0-3]):([0-5]\d)$/);
    if (!match) {
      Alert.alert('Ops', 'Digita um horário válido no formato HH:MM (ex: 18:30).');
      return;
    }
    const hour = Number(match[1]);
    const minute = Number(match[2]);

    setSavingReminder(true);

    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== 'granted') {
      setSavingReminder(false);
      Alert.alert('Permissão necessária', 'Pra receber lembretes, autorize notificações pro app nas configurações do celular.');
      return;
    }

    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
      await Notifications.scheduleNotificationAsync({
        content: {
          title: 'Hora de treinar! 💪',
          body: 'Não esquece do seu treino hoje.',
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          hour,
          minute,
        },
      });

      await supabase.from('users').update({
        reminder_enabled: true,
        reminder_time: `${match[1].padStart(2, '0')}:${match[2]}`,
      }).eq('id', user.id);

      setSavingReminder(false);
      Alert.alert('Lembrete ativado!', `Você vai receber um aviso todo dia às ${match[1].padStart(2, '0')}:${match[2]}.`);
    } catch (e) {
      setSavingReminder(false);
      Alert.alert('Erro ao agendar', e.message);
    }
  };

  const handleChangePassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      Alert.alert('Ops', 'A senha precisa ter pelo menos 6 caracteres.');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Ops', 'As senhas não coincidem.');
      return;
    }
    setSavingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setSavingPassword(false);
    if (error) {
      Alert.alert('Erro', error.message);
    } else {
      setShowPasswordModal(false);
      setNewPassword('');
      setConfirmPassword('');
      Alert.alert('Senha alterada!', 'Sua senha foi atualizada com sucesso.');
    }
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Excluir minha conta',
      'Essa ação é permanente. Todos os seus treinos, dietas, avaliações e mensagens serão apagados pra sempre. Tem certeza?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Continuar',
          style: 'destructive',
          onPress: () => {
            setDeleteConfirmText('');
            setShowDeleteConfirmModal(true);
          },
        },
      ]
    );
  };

  const handleFinalDeleteConfirm = async () => {
    if (deleteConfirmText.trim().toUpperCase() !== DELETE_CONFIRM_WORD) return;
    setShowDeleteConfirmModal(false);
    setDeletingAccount(true);
    await Notifications.cancelAllScheduledNotificationsAsync();
    await supabase.storage.from('avatars').remove([`${user.id}.jpg`]);
    const { error } = await supabase.rpc('delete_own_account');
    setDeletingAccount(false);
    if (error) {
      Alert.alert('Erro ao excluir conta', error.message);
    } else {
      await supabase.auth.signOut();
      if (onLogout) onLogout();
    }
  };

  if (showEvolution) {
    return (
      <PhysicalAssessmentHistoryScreen
        studentId={user.id}
        studentName={name || 'Você'}
        onClose={() => setShowEvolution(false)}
      />
    );
  }

  if (showVolume) {
    return (
      <VolumeSummaryScreen
        studentId={user.id}
        studentName={null}
        onClose={() => setShowVolume(false)}
      />
    );
  }

  if (showPeriodization) {
    return (
      <WeeklyPeriodizationScreen
        studentId={user.id}
        studentName={null}
        personalId={null}
        isPersonal={false}
        onClose={() => setShowPeriodization(false)}
      />
    );
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#f97316" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={onClose}>
          <Text style={styles.closeText}>← Voltar</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Meu Perfil</Text>
      </View>

      <View style={styles.avatarBox}>
        <TouchableOpacity onPress={handlePickAvatar} disabled={uploadingAvatar}>
          <View style={styles.avatarCircle}>
            {uploadingAvatar ? (
              <ActivityIndicator color="#f97316" />
            ) : avatarUrl ? (
              <Image key={avatarUrl} source={{ uri: avatarUrl }} style={styles.avatarImage} resizeMode="cover" />
            ) : (
              <Text style={styles.avatarLetter}>{name.charAt(0).toUpperCase() || '?'}</Text>
            )}
          </View>
          <View style={styles.avatarEditBadge}>
            <Text style={styles.avatarEditIcon}>📷</Text>
          </View>
        </TouchableOpacity>
        <Text style={styles.avatarHint}>Toque pra trocar a foto</Text>
      </View>

      <View style={styles.shortcutsGrid}>
        <View style={styles.shortcutsRow}>
          <TouchableOpacity style={[styles.shortcutCard, styles.shortcutCardPurple]} onPress={() => setShowEvolution(true)}>
            <Ionicons name="trending-up-outline" size={24} color="#a855f7" />
            <Text style={styles.shortcutCardText}>Evolução Física</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.shortcutCard, styles.shortcutCardOrange]} onPress={() => setShowVolume(true)}>
            <Ionicons name="barbell-outline" size={24} color="#f97316" />
            <Text style={styles.shortcutCardText}>Resumo Semanal</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={[styles.shortcutCard, styles.shortcutCardPurple, styles.shortcutCardWide]} onPress={() => setShowPeriodization(true)}>
          <Ionicons name="calendar-outline" size={24} color="#a855f7" />
          <Text style={styles.shortcutCardText}>Minha Periodização de Treino</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.reminderCard}>
        <View style={styles.reminderHeader}>
          <View style={styles.reminderTitleRow}>
            <Ionicons name="notifications-outline" size={16} color="#f5f5f5" />
            <Text style={styles.reminderTitle}>Lembrete diário de treino</Text>
          </View>
          <Switch
            value={reminderEnabled}
            onValueChange={handleToggleReminder}
            trackColor={{ false: '#292524', true: '#f97316' }}
            thumbColor="#f5f5f5"
          />
        </View>

        {reminderEnabled && (
          <>
            <Text style={styles.reminderLabel}>Horário (HH:MM)</Text>
            <TextInput
              style={styles.reminderInput}
              placeholder="18:00"
              placeholderTextColor="#525252"
              value={reminderTime}
              onChangeText={setReminderTime}
            />
            <View style={styles.presetRow}>
              {TIME_PRESETS.map((t) => (
                <TouchableOpacity key={t} style={styles.presetChip} onPress={() => setReminderTime(t)}>
                  <Text style={styles.presetChipText}>{t}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TouchableOpacity style={styles.reminderSaveButton} onPress={handleSaveReminder} disabled={savingReminder}>
              {savingReminder ? <ActivityIndicator color="#0a0a0a" size="small" /> : <Text style={styles.reminderSaveButtonText}>Salvar horário</Text>}
            </TouchableOpacity>
          </>
        )}
      </View>

      <View style={styles.formCard}>
        <Text style={styles.label}>Nome</Text>
        <TextInput style={styles.input} placeholder="Seu nome" placeholderTextColor="#525252" value={name} onChangeText={setName} />

        <Text style={styles.label}>E-mail</Text>
        <TextInput style={[styles.input, styles.inputDisabled]} value={email} editable={false} />
        <Text style={styles.helperText}>O e-mail não pode ser alterado por aqui.</Text>

        <Text style={styles.label}>WhatsApp (com DDD)</Text>
        <TextInput
          style={styles.input}
          placeholder="ex: 37998231382"
          placeholderTextColor="#525252"
          keyboardType="phone-pad"
          value={phone}
          onChangeText={setPhone}
        />
        <Text style={styles.helperText}>Usado pelo seu personal pra te lembrar de mensalidades e avisos, se precisar.</Text>

        <Text style={styles.label}>Peso atual (kg)</Text>
        <TextInput
          style={styles.input}
          placeholder="ex: 72.5"
          placeholderTextColor="#525252"
          keyboardType="decimal-pad"
          value={weight}
          onChangeText={setWeight}
        />
        <Text style={styles.helperText}>Usado para calcular calorias reais gastas no treino. Também é atualizado automaticamente quando o personal registra uma avaliação física.</Text>

        <TouchableOpacity style={styles.saveButton} onPress={handleSave} disabled={saving}>
          {saving ? <ActivityIndicator color="#0a0a0a" /> : <Text style={styles.saveButtonText}>Salvar Alterações</Text>}
        </TouchableOpacity>
      </View>

      <View style={styles.securitySection}>
        <Text style={styles.securityTitle}>Segurança</Text>
        <TouchableOpacity style={styles.changePasswordButton} onPress={() => setShowPasswordModal(true)}>
          <Text style={styles.changePasswordButtonText}>Alterar Senha</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.deleteAccountButton} onPress={handleDeleteAccount} disabled={deletingAccount}>
          {deletingAccount ? <ActivityIndicator color="#ef4444" /> : <Text style={styles.deleteAccountButtonText}>🗑️ Excluir minha conta</Text>}
        </TouchableOpacity>
      </View>

      <Modal visible={showPasswordModal} transparent animationType="fade" onRequestClose={() => setShowPasswordModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Alterar Senha</Text>
            <Text style={styles.modalLabel}>Nova senha</Text>
            <TextInput style={styles.modalInput} secureTextEntry value={newPassword} onChangeText={setNewPassword} placeholder="mínimo 6 caracteres" placeholderTextColor="#525252" />
            <Text style={styles.modalLabel}>Confirmar nova senha</Text>
            <TextInput style={styles.modalInput} secureTextEntry value={confirmPassword} onChangeText={setConfirmPassword} placeholder="digite de novo" placeholderTextColor="#525252" />
            <View style={styles.modalButtonRow}>
              <TouchableOpacity style={styles.modalCancelButton} onPress={() => setShowPasswordModal(false)}>
                <Text style={styles.modalCancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalConfirmButton} onPress={handleChangePassword} disabled={savingPassword}>
                {savingPassword ? <ActivityIndicator color="#0a0a0a" size="small" /> : <Text style={styles.modalConfirmButtonText}>Salvar</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showDeleteConfirmModal} transparent animationType="fade" onRequestClose={() => setShowDeleteConfirmModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, styles.deleteModalCard]}>
            <Ionicons name="warning-outline" size={32} color="#ef4444" style={{ alignSelf: 'center', marginBottom: 10 }} />
            <Text style={styles.deleteModalTitle}>Última confirmação</Text>
            <Text style={styles.deleteModalText}>
              Isso vai apagar sua conta, treinos, dietas, avaliações e mensagens pra sempre. Não tem como desfazer.
            </Text>
            <Text style={styles.deleteModalInstruction}>
              Pra confirmar, digite <Text style={styles.deleteModalWord}>{DELETE_CONFIRM_WORD}</Text> abaixo:
            </Text>
            <TextInput
              style={styles.deleteModalInput}
              placeholder={DELETE_CONFIRM_WORD}
              placeholderTextColor="#525252"
              value={deleteConfirmText}
              onChangeText={setDeleteConfirmText}
              autoCapitalize="characters"
            />
            <View style={styles.modalButtonRow}>
              <TouchableOpacity style={styles.modalCancelButton} onPress={() => setShowDeleteConfirmModal(false)}>
                <Text style={styles.modalCancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalConfirmButton, styles.deleteFinalButton, deleteConfirmText.trim().toUpperCase() !== DELETE_CONFIRM_WORD && styles.deleteFinalButtonDisabled]}
                onPress={handleFinalDeleteConfirm}
                disabled={deleteConfirmText.trim().toUpperCase() !== DELETE_CONFIRM_WORD}
              >
                <Text style={styles.deleteFinalButtonText}>Excluir Definitivamente</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a', paddingTop: 50, paddingHorizontal: 16 },
  center: { flex: 1, backgroundColor: '#0a0a0a', alignItems: 'center', justifyContent: 'center' },
  topBar: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  closeText: { color: '#f97316', fontSize: 14, fontWeight: '600' },
  title: { color: '#f5f5f5', fontSize: 16, fontWeight: '700', marginLeft: 16 },
  avatarBox: { alignItems: 'center', marginBottom: 20 },
  avatarCircle: { width: 88, height: 88, borderRadius: 44, backgroundColor: '#171717', borderWidth: 2, borderColor: '#f97316', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarImage: { width: 88, height: 88 },
  avatarLetter: { color: '#f97316', fontSize: 32, fontWeight: '800' },
  avatarEditBadge: { position: 'absolute', bottom: 0, right: 0, width: 28, height: 28, borderRadius: 14, backgroundColor: '#f97316', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#0a0a0a' },
  avatarEditIcon: { fontSize: 12 },
  avatarHint: { color: '#525252', fontSize: 10, marginTop: 8 },
  shortcutsGrid: { gap: 10, marginBottom: 16 },
  shortcutsRow: { flexDirection: 'row', gap: 10 },
  shortcutCard: { flex: 1, borderWidth: 1, borderRadius: 14, paddingVertical: 18, alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 90 },
  shortcutCardWide: { flex: undefined, width: '100%' },
  shortcutCardPurple: { backgroundColor: 'rgba(168,85,247,0.12)', borderColor: '#a855f7' },
  shortcutCardOrange: { backgroundColor: 'rgba(249,115,22,0.12)', borderColor: '#f97316' },
  shortcutCardText: { color: '#f5f5f5', fontSize: 12, fontWeight: '700', textAlign: 'center' },
  reminderCard: { backgroundColor: '#171717', borderWidth: 1, borderColor: '#292524', borderRadius: 12, padding: 14, marginBottom: 16 },
  reminderHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  reminderTitleRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  reminderTitle: { color: '#f5f5f5', fontSize: 13, fontWeight: '700' },
  reminderLabel: { color: '#737373', fontSize: 10, textTransform: 'uppercase', marginBottom: 4, marginTop: 12 },
  reminderInput: { backgroundColor: '#0a0a0a', borderWidth: 1, borderColor: '#292524', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, color: '#f5f5f5', fontSize: 14, textAlign: 'center' },
  presetRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  presetChip: { backgroundColor: '#0a0a0a', borderWidth: 1, borderColor: '#292524', borderRadius: 16, paddingHorizontal: 10, paddingVertical: 5 },
  presetChipText: { color: '#a3a3a3', fontSize: 11, fontWeight: '600' },
  reminderSaveButton: { backgroundColor: '#f97316', borderRadius: 10, paddingVertical: 11, alignItems: 'center', marginTop: 12 },
  reminderSaveButtonText: { color: '#0a0a0a', fontSize: 13, fontWeight: '700' },
  formCard: { backgroundColor: '#171717', borderWidth: 1, borderColor: '#292524', borderRadius: 12, padding: 14 },
  label: { color: '#737373', fontSize: 10, textTransform: 'uppercase', marginBottom: 4, marginTop: 12 },
  input: { backgroundColor: '#0a0a0a', borderWidth: 1, borderColor: '#292524', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 10, color: '#f5f5f5', fontSize: 14 },
  inputDisabled: { color: '#525252' },
  helperText: { color: '#525252', fontSize: 10, marginTop: 4, lineHeight: 14 },
  saveButton: { backgroundColor: '#f97316', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 24 },
  saveButtonText: { color: '#0a0a0a', fontSize: 15, fontWeight: '700' },
  securitySection: { marginTop: 24 },
  securityTitle: { color: '#737373', fontSize: 10, textTransform: 'uppercase', marginBottom: 10 },
  changePasswordButton: { borderWidth: 1, borderColor: '#292524', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginBottom: 10 },
  changePasswordButtonText: { color: '#a3a3a3', fontSize: 13, fontWeight: '700' },
  deleteAccountButton: { borderWidth: 1, borderColor: '#ef4444', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  deleteAccountButtonText: { color: '#ef4444', fontSize: 13, fontWeight: '700' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', paddingHorizontal: 24 },
  modalCard: { backgroundColor: '#171717', borderRadius: 16, padding: 20 },
  modalTitle: { color: '#f5f5f5', fontSize: 16, fontWeight: '800', marginBottom: 12 },
  modalLabel: { color: '#737373', fontSize: 10, textTransform: 'uppercase', marginBottom: 4, marginTop: 8 },
  modalInput: { backgroundColor: '#0a0a0a', borderWidth: 1, borderColor: '#292524', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 10, color: '#f5f5f5', fontSize: 14 },
  modalButtonRow: { flexDirection: 'row', gap: 8, marginTop: 20 },
  modalCancelButton: { flex: 1, backgroundColor: '#0a0a0a', borderWidth: 1, borderColor: '#292524', borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  modalCancelButtonText: { color: '#a3a3a3', fontSize: 13, fontWeight: '600' },
  modalConfirmButton: { flex: 1, backgroundColor: '#f97316', borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  modalConfirmButtonText: { color: '#0a0a0a', fontSize: 13, fontWeight: '700' },
  deleteModalCard: { borderWidth: 1, borderColor: '#ef4444' },
  deleteModalTitle: { color: '#ef4444', fontSize: 16, fontWeight: '800', textAlign: 'center', marginBottom: 10 },
  deleteModalText: { color: '#a3a3a3', fontSize: 12, textAlign: 'center', lineHeight: 18, marginBottom: 14 },
  deleteModalInstruction: { color: '#f5f5f5', fontSize: 12, textAlign: 'center', marginBottom: 10 },
  deleteModalWord: { color: '#ef4444', fontWeight: '800' },
  deleteModalInput: { backgroundColor: '#0a0a0a', borderWidth: 1, borderColor: '#ef4444', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 10, color: '#f5f5f5', fontSize: 14, textAlign: 'center', fontWeight: '700', letterSpacing: 1 },
  deleteFinalButton: { backgroundColor: '#ef4444' },
  deleteFinalButtonDisabled: { backgroundColor: '#3a1414', opacity: 0.5 },
  deleteFinalButtonText: { color: '#f5f5f5', fontSize: 12, fontWeight: '800' },
});