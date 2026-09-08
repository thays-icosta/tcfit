import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, TextInput, ScrollView, ActivityIndicator, Switch, Image, Modal, Share } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as ImagePicker from 'expo-image-picker';
import { decode } from 'base64-arraybuffer';
import { supabase } from './supabaseClient';
import VolumeSummaryScreen from './VolumeSummaryScreen';
import WeeklyPeriodizationScreen from './WeeklyPeriodizationScreen';
import AnamneseFormScreen from './AnamneseFormScreen';
import UpgradeLockModal from './UpgradeLockModal';
import { showAlert } from './alertUtils';
import { HeaderBack } from './Header';
import { registerPushToken } from './pushNotifications';

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
  const [showVolume, setShowVolume] = useState(false);
  const [showPeriodization, setShowPeriodization] = useState(false);
  const [showAnamnese, setShowAnamnese] = useState(false);
  const [personalId, setPersonalId] = useState(null);
  const [accessLevel, setAccessLevel] = useState('plataforma_base');
  const [personalName, setPersonalName] = useState(null);
  const [personalPhone, setPersonalPhone] = useState(null);
  const [lockModalFeature, setLockModalFeature] = useState(null);
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
  const [referralCode, setReferralCode] = useState(null);
  const [justCopiedReferral, setJustCopiedReferral] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('users')
        .select('name, weight_kg, email, phone, reminder_enabled, reminder_time, avatar_url, personal_id, access_level, referral_code')
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
        setPersonalId(data.personal_id || null);
        setAccessLevel(data.access_level || 'plataforma_base');
        setReferralCode(data.referral_code || null);

        if (data.personal_id) {
          const { data: personalRow } = await supabase.from('users').select('name, phone').eq('id', data.personal_id).single();
          setPersonalName(personalRow?.name || null);
          setPersonalPhone(personalRow?.phone || null);
        }
      }
      setLoading(false);
    })();
  }, [user.id]);

  const handlePickAvatar = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        showAlert('Permissão necessária', 'Autorize o acesso às fotos pra escolher uma imagem de perfil.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.5,
        base64: true,
      });

      if (result.canceled) return;

      if (!result.assets || result.assets.length === 0 || !result.assets[0].base64) {
        showAlert('Ops', 'Não conseguimos ler os dados dessa imagem. Tenta escolher outra foto.');
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
      showAlert('Foto atualizada!', 'Sua foto de perfil foi salva com sucesso.');
    } catch (e) {
      showAlert('Erro ao enviar foto', e.message || 'Erro desconhecido');
    }
    setUploadingAvatar(false);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      showAlert('Ops', 'O nome não pode ficar vazio.');
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
      showAlert('Erro', error.message);
    } else {
      showAlert('Salvo!', 'Seu perfil foi atualizado.', [{ text: 'OK', onPress: onClose }]);
    }
  };

  const handleCopyReferral = async () => {
    if (!referralCode) return;
    await Clipboard.setStringAsync(referralCode);
    setJustCopiedReferral(true);
    setTimeout(() => setJustCopiedReferral(false), 2000);
  };

  const handleShareReferral = async () => {
    if (!referralCode) return;
    try {
      await Share.share({
        message: `Vem treinar comigo no TcFit! Usa meu código de indicação ${referralCode} no cadastro — a gente ganha desconto quando você assinar a consultoria 💪`,
      });
    } catch {
      showAlert('Erro', 'Não foi possível abrir o compartilhamento.');
    }
  };

  const handleToggleReminder = async (value) => {
    setReminderEnabled(value);
    if (!value) {
      setSavingReminder(true);
      await supabase.from('users').update({ reminder_enabled: false }).eq('id', user.id);
      setSavingReminder(false);
    }
  };

  const handleSaveReminder = async () => {
    const match = reminderTime.match(/^([01]?\d|2[0-3]):([0-5]\d)$/);
    if (!match) {
      showAlert('Ops', 'Digita um horário válido no formato HH:MM (ex: 18:30).');
      return;
    }

    setSavingReminder(true);

    try {
      // Lembretes agora são enviados pelo servidor (push), não mais agendados
      // localmente no aparelho — isso garante o funcionamento no PWA. Isso só
      // exige que o navegador tenha uma inscrição de push salva.
      await registerPushToken(user.id);
      const { data: pushRow } = await supabase
        .from('users')
        .select('web_push_subscription, expo_push_token')
        .eq('id', user.id)
        .single();

      if (!pushRow?.web_push_subscription && !pushRow?.expo_push_token) {
        setSavingReminder(false);
        showAlert('Permissão necessária', 'Pra receber lembretes, autorize notificações quando o navegador pedir e tente salvar de novo.');
        return;
      }

      const time = `${match[1].padStart(2, '0')}:${match[2]}`;
      await supabase.from('users').update({ reminder_enabled: true, reminder_time: time }).eq('id', user.id);

      setSavingReminder(false);
      showAlert('Lembrete ativado!', `Você vai receber um aviso todo dia às ${time}.`);
    } catch (e) {
      setSavingReminder(false);
      showAlert('Erro ao agendar', e.message);
    }
  };

  const handleChangePassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      showAlert('Ops', 'A senha precisa ter pelo menos 6 caracteres.');
      return;
    }
    if (newPassword !== confirmPassword) {
      showAlert('Ops', 'As senhas não coincidem.');
      return;
    }
    setSavingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setSavingPassword(false);
    if (error) {
      showAlert('Erro', error.message);
    } else {
      setShowPasswordModal(false);
      setNewPassword('');
      setConfirmPassword('');
      showAlert('Senha alterada!', 'Sua senha foi atualizada com sucesso.');
    }
  };

  const handleDeleteAccount = () => {
    showAlert(
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
    await supabase.storage.from('avatars').remove([`${user.id}.jpg`]);
    const { error } = await supabase.rpc('delete_own_account');
    setDeletingAccount(false);
    if (error) {
      showAlert('Erro ao excluir conta', error.message);
    } else {
      await supabase.auth.signOut();
      if (onLogout) onLogout();
    }
  };

  if (showAnamnese) {
    return (
      <AnamneseFormScreen
        studentId={user.id}
        personalId={personalId}
        accessLevel={accessLevel}
        personalName={personalName}
        personalPhone={personalPhone}
        onClose={() => setShowAnamnese(false)}
        onComplete={() => setShowAnamnese(false)}
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
        <ActivityIndicator color="#FF6B00" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 40 }}>
      <HeaderBack title="Meu Perfil" onBack={onClose} />

      <View style={styles.avatarBox}>
        <TouchableOpacity onPress={handlePickAvatar} disabled={uploadingAvatar}>
          <View style={styles.avatarCircle}>
            {uploadingAvatar ? (
              <ActivityIndicator color="#FF6B00" />
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
        <TouchableOpacity style={[styles.shortcutCard, styles.shortcutCardOrange, styles.shortcutCardWide]} onPress={() => setShowVolume(true)}>
          <Ionicons name="barbell-outline" size={24} color="#FF6B00" />
          <Text style={styles.shortcutCardText}>Meu Histórico de Treinos</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.shortcutCard, styles.shortcutCardPurple, styles.shortcutCardWide]} onPress={() => setShowPeriodization(true)}>
          <Ionicons name="calendar-outline" size={24} color="#a855f7" />
          <Text style={styles.shortcutCardText}>Minha Periodização de Treino</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.shortcutCard, styles.shortcutCardOrange, styles.shortcutCardWide]} onPress={() => setShowAnamnese(true)}>
          <Ionicons name="clipboard-outline" size={24} color="#FF6B00" />
          <Text style={styles.shortcutCardText}>Minha Anamnese</Text>
        </TouchableOpacity>
      </View>

      {referralCode && (
        <View style={styles.referralCard}>
          <Text style={styles.referralTitle}>🎁 Indique e Ganhe</Text>
          <Text style={styles.referralSubtitle}>Compartilhe seu código com um amigo. Quando ele assinar a consultoria, vocês dois saem ganhando.</Text>
          <View style={styles.referralCodeRow}>
            <Text style={styles.referralCodeText}>{referralCode}</Text>
            <TouchableOpacity style={styles.referralCopyButton} onPress={handleCopyReferral}>
              <Text style={styles.referralCopyButtonText}>{justCopiedReferral ? 'Copiado!' : 'Copiar'}</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={styles.referralShareButton} onPress={handleShareReferral}>
            <Ionicons name="share-social-outline" size={14} color="#FF6B00" />
            <Text style={styles.referralShareButtonText}>Compartilhar código</Text>
          </TouchableOpacity>
        </View>
      )}

      {accessLevel !== 'consultoria_vip' && (
        <TouchableOpacity style={styles.upsellBanner} onPress={() => setLockModalFeature('a Consultoria Individualizada')}>
          <Ionicons name="star-outline" size={16} color="#FF6B00" />
          <Text style={styles.upsellBannerText}>Quer um treino 100% personalizado{personalName ? ` feito por ${personalName}` : ''}? Fazer Upgrade para Consultoria</Text>
        </TouchableOpacity>
      )}

      <View style={styles.reminderCard}>
        <View style={styles.reminderHeader}>
          <View style={styles.reminderTitleRow}>
            <Ionicons name="notifications-outline" size={16} color="#F5F5F7" />
            <Text style={styles.reminderTitle}>Lembrete diário de treino</Text>
          </View>
          <Switch
            value={reminderEnabled}
            onValueChange={handleToggleReminder}
            trackColor={{ false: '#2B2B36', true: '#FF6B00' }}
            thumbColor="#F5F5F7"
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
              {savingReminder ? <ActivityIndicator color="#0F0F12" size="small" /> : <Text style={styles.reminderSaveButtonText}>Salvar horário</Text>}
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
          {saving ? <ActivityIndicator color="#0F0F12" /> : <Text style={styles.saveButtonText}>Salvar Alterações</Text>}
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
                {savingPassword ? <ActivityIndicator color="#0F0F12" size="small" /> : <Text style={styles.modalConfirmButtonText}>Salvar</Text>}
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

      <UpgradeLockModal
        visible={!!lockModalFeature}
        onClose={() => setLockModalFeature(null)}
        personalName={personalName}
        personalPhone={personalPhone}
        featureLabel={lockModalFeature || ''}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F0F12', paddingTop: 50, paddingHorizontal: 16 },
  center: { flex: 1, backgroundColor: '#0F0F12', alignItems: 'center', justifyContent: 'center' },
  avatarBox: { alignItems: 'center', marginBottom: 20 },
  avatarCircle: { width: 88, height: 88, borderRadius: 44, backgroundColor: '#1C1C22', borderWidth: 2, borderColor: '#FF6B00', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarImage: { width: 88, height: 88 },
  avatarLetter: { color: '#FF6B00', fontSize: 32, fontWeight: '800' },
  avatarEditBadge: { position: 'absolute', bottom: 0, right: 0, width: 28, height: 28, borderRadius: 14, backgroundColor: '#FF6B00', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#0F0F12' },
  avatarEditIcon: { fontSize: 12 },
  avatarHint: { color: '#525252', fontSize: 10, marginTop: 8 },
  shortcutsGrid: { gap: 10, marginBottom: 16 },
  referralCard: { backgroundColor: '#1C1C22', borderWidth: 1, borderColor: '#FF6B00', borderRadius: 14, padding: 16, marginBottom: 16 },
  referralTitle: { color: '#F5F5F7', fontSize: 14, fontWeight: '800' },
  referralSubtitle: { color: '#a3a3a3', fontSize: 11, marginTop: 6, marginBottom: 14, lineHeight: 16 },
  referralCodeRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#0F0F12', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12 },
  referralCodeText: { flex: 1, color: '#FF6B00', fontSize: 18, fontWeight: '800', letterSpacing: 2 },
  referralCopyButton: { backgroundColor: '#FF6B00', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  referralCopyButtonText: { color: '#0F0F12', fontSize: 11, fontWeight: '700' },
  referralShareButton: { flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', marginTop: 10, paddingVertical: 8 },
  referralShareButtonText: { color: '#FF6B00', fontSize: 12, fontWeight: '700' },
  upsellBanner: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: 'rgba(255,107,0,0.08)', borderWidth: 1, borderColor: '#2B2B36', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 16 },
  upsellBannerText: { flex: 1, color: '#a3a3a3', fontSize: 11, fontWeight: '600', lineHeight: 16 },
  shortcutCard: { flex: 1, borderWidth: 1, borderRadius: 14, paddingVertical: 18, alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 90, position: 'relative' },
  shortcutCardWide: { flex: undefined, width: '100%' },
  shortcutCardPurple: { backgroundColor: 'rgba(168,85,247,0.12)', borderColor: '#a855f7' },
  shortcutCardOrange: { backgroundColor: 'rgba(255,107,0,0.12)', borderColor: '#FF6B00' },
  shortcutCardText: { color: '#F5F5F7', fontSize: 12, fontWeight: '700', textAlign: 'center' },
  reminderCard: { backgroundColor: '#1C1C22', borderWidth: 1, borderColor: '#2B2B36', borderRadius: 12, padding: 14, marginBottom: 16 },
  reminderHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  reminderTitleRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  reminderTitle: { color: '#F5F5F7', fontSize: 13, fontWeight: '700' },
  reminderLabel: { color: '#737373', fontSize: 10, textTransform: 'uppercase', marginBottom: 4, marginTop: 12 },
  reminderInput: { backgroundColor: '#0F0F12', borderWidth: 1, borderColor: '#2B2B36', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, color: '#F5F5F7', fontSize: 14, textAlign: 'center' },
  presetRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  presetChip: { backgroundColor: '#0F0F12', borderWidth: 1, borderColor: '#2B2B36', borderRadius: 16, paddingHorizontal: 10, paddingVertical: 5 },
  presetChipText: { color: '#a3a3a3', fontSize: 11, fontWeight: '600' },
  reminderSaveButton: { backgroundColor: '#FF6B00', borderRadius: 10, paddingVertical: 11, alignItems: 'center', marginTop: 12 },
  reminderSaveButtonText: { color: '#0F0F12', fontSize: 13, fontWeight: '700' },
  formCard: { backgroundColor: '#1C1C22', borderWidth: 1, borderColor: '#2B2B36', borderRadius: 12, padding: 14 },
  label: { color: '#737373', fontSize: 10, textTransform: 'uppercase', marginBottom: 4, marginTop: 12 },
  input: { backgroundColor: '#0F0F12', borderWidth: 1, borderColor: '#2B2B36', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 10, color: '#F5F5F7', fontSize: 14 },
  inputDisabled: { color: '#525252' },
  helperText: { color: '#525252', fontSize: 10, marginTop: 4, lineHeight: 14 },
  saveButton: { backgroundColor: '#FF6B00', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 24 },
  saveButtonText: { color: '#0F0F12', fontSize: 15, fontWeight: '700' },
  securitySection: { marginTop: 24 },
  securityTitle: { color: '#737373', fontSize: 10, textTransform: 'uppercase', marginBottom: 10 },
  changePasswordButton: { borderWidth: 1, borderColor: '#2B2B36', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginBottom: 10 },
  changePasswordButtonText: { color: '#a3a3a3', fontSize: 13, fontWeight: '700' },
  deleteAccountButton: { borderWidth: 1, borderColor: '#ef4444', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  deleteAccountButtonText: { color: '#ef4444', fontSize: 13, fontWeight: '700' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', paddingHorizontal: 24 },
  modalCard: { backgroundColor: '#1C1C22', borderRadius: 16, padding: 20 },
  modalTitle: { color: '#F5F5F7', fontSize: 16, fontWeight: '800', marginBottom: 12 },
  modalLabel: { color: '#737373', fontSize: 10, textTransform: 'uppercase', marginBottom: 4, marginTop: 8 },
  modalInput: { backgroundColor: '#0F0F12', borderWidth: 1, borderColor: '#2B2B36', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 10, color: '#F5F5F7', fontSize: 14 },
  modalButtonRow: { flexDirection: 'row', gap: 8, marginTop: 20 },
  modalCancelButton: { flex: 1, backgroundColor: '#0F0F12', borderWidth: 1, borderColor: '#2B2B36', borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  modalCancelButtonText: { color: '#a3a3a3', fontSize: 13, fontWeight: '600' },
  modalConfirmButton: { flex: 1, backgroundColor: '#FF6B00', borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  modalConfirmButtonText: { color: '#0F0F12', fontSize: 13, fontWeight: '700' },
  deleteModalCard: { borderWidth: 1, borderColor: '#ef4444' },
  deleteModalTitle: { color: '#ef4444', fontSize: 16, fontWeight: '800', textAlign: 'center', marginBottom: 10 },
  deleteModalText: { color: '#a3a3a3', fontSize: 12, textAlign: 'center', lineHeight: 18, marginBottom: 14 },
  deleteModalInstruction: { color: '#F5F5F7', fontSize: 12, textAlign: 'center', marginBottom: 10 },
  deleteModalWord: { color: '#ef4444', fontWeight: '800' },
  deleteModalInput: { backgroundColor: '#0F0F12', borderWidth: 1, borderColor: '#ef4444', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 10, color: '#F5F5F7', fontSize: 14, textAlign: 'center', fontWeight: '700', letterSpacing: 1 },
  deleteFinalButton: { backgroundColor: '#ef4444' },
  deleteFinalButtonDisabled: { backgroundColor: '#3a1414', opacity: 0.5 },
  deleteFinalButtonText: { color: '#F5F5F7', fontSize: 12, fontWeight: '800' },
});