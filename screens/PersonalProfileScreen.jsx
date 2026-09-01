import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, TextInput, ScrollView, ActivityIndicator, Image, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { decode } from 'base64-arraybuffer';
import { supabase } from './supabaseClient';
import PlanPricesScreen from './PlanPricesScreen';
import RecipeManagerScreen from './RecipeManagerScreen';
import TemplateBuilderScreen from './TemplateBuilderScreen';
import ProductsManagerScreen from './ProductsManagerScreen';
import PartnerBrandsManagerScreen from './PartnerBrandsManagerScreen';
import AnamneseConfigScreen from './AnamneseConfigScreen';
import { showAlert } from './alertUtils';

const BRAND_COLOR_PRESETS = ['#f97316', '#22c55e', '#3b82f6', '#a855f7', '#ef4444', '#eab308', '#ec4899', '#14b8a6'];

export default function PersonalProfileScreen({ user, onClose, onLogout }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [avatarUrl, setAvatarUrl] = useState(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [showPlanPrices, setShowPlanPrices] = useState(false);
  const [showRecipeManager, setShowRecipeManager] = useState(false);
  const [showTemplateBuilder, setShowTemplateBuilder] = useState(false);
  const [showProductsManager, setShowProductsManager] = useState(false);
  const [showPartnerBrands, setShowPartnerBrands] = useState(false);
  const [showAnamneseConfig, setShowAnamneseConfig] = useState(false);
  const [studentCount, setStudentCount] = useState(0);

  const [brandingExpanded, setBrandingExpanded] = useState(true);
  const [logoUrl, setLogoUrl] = useState(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [brandColor, setBrandColor] = useState('#f97316');
  const [professionalRegister, setProfessionalRegister] = useState('');
  const [phone, setPhone] = useState('');
  const [contactInstagram, setContactInstagram] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [pixKey, setPixKey] = useState('');
  const [paymentLink, setPaymentLink] = useState('');

  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('users')
        .select('name, email, avatar_url, logo_url, brand_color, professional_register, phone, contact_instagram, contact_email, pix_key, payment_link')
        .eq('id', user.id)
        .single();
      if (data) {
        setName(data.name || '');
        setEmail(data.email || '');
        setAvatarUrl(data.avatar_url || null);
        setLogoUrl(data.logo_url || null);
        setBrandColor(data.brand_color || '#f97316');
        setProfessionalRegister(data.professional_register || '');
        setPhone(data.phone || '');
        setContactInstagram(data.contact_instagram || '');
        setContactEmail(data.contact_email || '');
        setPixKey(data.pix_key || '');
        setPaymentLink(data.payment_link || '');
      }
      setLoading(false);
    })();

    (async () => {
      const { count } = await supabase
        .from('users')
        .select('id', { count: 'exact', head: true })
        .eq('personal_id', user.id)
        .eq('role', 'aluno');
      setStudentCount(count || 0);
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

  const handlePickLogo = async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        showAlert('Permissão necessária', 'Autorize o acesso às fotos.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.7,
        base64: true,
      });
      if (result.canceled || !result.assets?.[0]?.base64) return;

      setUploadingLogo(true);
      const filePath = `logo_${user.id}.jpg`;
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, decode(result.assets[0].base64), { upsert: true, contentType: 'image/jpeg' });
      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage.from('avatars').getPublicUrl(filePath);
      const finalUrl = `${publicUrlData.publicUrl}?t=${Date.now()}`;
      await supabase.from('users').update({ logo_url: finalUrl }).eq('id', user.id);
      setLogoUrl(finalUrl);
    } catch (e) {
      showAlert('Erro ao enviar logo', e.message || 'Erro desconhecido');
    }
    setUploadingLogo(false);
  };

  const handleSaveAll = async () => {
    if (!name.trim()) {
      showAlert('Ops', 'O nome não pode ficar vazio.');
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from('users')
      .update({
        name: name.trim(),
        brand_color: brandColor,
        professional_register: professionalRegister.trim() || null,
        phone: phone.trim() || null,
        contact_instagram: contactInstagram.trim() || null,
        contact_email: contactEmail.trim() || null,
        pix_key: pixKey.trim() || null,
        payment_link: paymentLink.trim() || null,
      })
      .eq('id', user.id);
    setSaving(false);
    if (error) {
      showAlert('Erro', error.message);
    } else {
      showAlert('Salvo!', 'Seu perfil foi atualizado.', [{ text: 'OK', onPress: onClose }]);
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
      'Essa ação é permanente. Todos os seus alunos perderão o vínculo com você, e todas as fichas, dietas, avaliações e mensagens que você criou serão apagadas pra sempre. Tem certeza?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir tudo',
          style: 'destructive',
          onPress: async () => {
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
          },
        },
      ]
    );
  };

  if (showPlanPrices) {
    return <PlanPricesScreen onClose={() => setShowPlanPrices(false)} />;
  }

  if (showRecipeManager) {
    return <RecipeManagerScreen personalId={user.id} onClose={() => setShowRecipeManager(false)} />;
  }

  if (showTemplateBuilder) {
    return <TemplateBuilderScreen personalId={user.id} onClose={() => setShowTemplateBuilder(false)} />;
  }

  if (showProductsManager) {
    return <ProductsManagerScreen personalId={user.id} onClose={() => setShowProductsManager(false)} />;
  }

  if (showPartnerBrands) {
    return <PartnerBrandsManagerScreen personalId={user.id} onClose={() => setShowPartnerBrands(false)} />;
  }

  if (showAnamneseConfig) {
    return <AnamneseConfigScreen personalId={user.id} onClose={() => setShowAnamneseConfig(false)} />;
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

      <View style={styles.summaryCard}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>{studentCount}</Text>
          <Text style={styles.summaryLabel}>{studentCount === 1 ? 'Aluno vinculado' : 'Alunos vinculados'}</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <View style={styles.summaryStatusRow}>
            <View style={styles.summaryStatusDot} />
            <Text style={styles.summaryValue}>Ativa</Text>
          </View>
          <Text style={styles.summaryLabel}>Status da conta</Text>
        </View>
      </View>

      <View style={styles.shortcutGrid}>
        <TouchableOpacity style={styles.shortcutCard} onPress={() => setShowTemplateBuilder(true)}>
          <View style={styles.shortcutIconCircle}>
            <Ionicons name="barbell-outline" size={22} color="#f97316" />
          </View>
          <Text style={styles.shortcutText}>Templates de Treino</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.shortcutCard} onPress={() => setShowPlanPrices(true)}>
          <View style={styles.shortcutIconCircle}>
            <Ionicons name="cash-outline" size={22} color="#f97316" />
          </View>
          <Text style={styles.shortcutText}>Venda de Consultoria</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.shortcutCard} onPress={() => setShowProductsManager(true)}>
          <View style={styles.shortcutIconCircle}>
            <Ionicons name="cube-outline" size={22} color="#f97316" />
          </View>
          <Text style={styles.shortcutText}>Produtos Adicionais</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.shortcutCard} onPress={() => setShowRecipeManager(true)}>
          <View style={styles.shortcutIconCircle}>
            <Ionicons name="restaurant-outline" size={22} color="#f97316" />
          </View>
          <Text style={styles.shortcutText}>Gerenciar Receitas</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.shortcutCard} onPress={() => setShowPartnerBrands(true)}>
          <View style={styles.shortcutIconCircle}>
            <Ionicons name="pricetags-outline" size={22} color="#f97316" />
          </View>
          <Text style={styles.shortcutText}>Marcas Parceiras</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.shortcutCard} onPress={() => setShowAnamneseConfig(true)}>
          <View style={styles.shortcutIconCircle}>
            <Ionicons name="clipboard-outline" size={22} color="#f97316" />
          </View>
          <Text style={styles.shortcutText}>Configurar Anamnese</Text>
        </TouchableOpacity>
      </View>

      <View style={[styles.brandingCard, styles.brandingCardHighlight]}>
        <TouchableOpacity style={styles.brandingHeader} onPress={() => setBrandingExpanded(!brandingExpanded)}>
          <Text style={styles.brandingTitle}>Identidade Visual & Pagamento</Text>
          <Ionicons name={brandingExpanded ? 'chevron-up-outline' : 'chevron-down-outline'} size={18} color="#737373" />
        </TouchableOpacity>

        {brandingExpanded && (
          <View style={styles.brandingBody}>
            <View style={styles.logoRow}>
              <TouchableOpacity onPress={handlePickLogo} disabled={uploadingLogo} style={styles.logoBox}>
                {uploadingLogo ? (
                  <ActivityIndicator color="#f97316" />
                ) : logoUrl ? (
                  <Image source={{ uri: logoUrl }} style={styles.logoImage} resizeMode="contain" />
                ) : (
                  <Text style={styles.logoPlaceholderText}>+ Logo</Text>
                )}
              </TouchableOpacity>
              <Text style={styles.logoHint}>Toque pra enviar sua logo. Salva na hora. Aparece nos seus PDFs.</Text>
            </View>

            <Text style={styles.label}>Cor da sua marca</Text>
            <View style={styles.colorRow}>
              {BRAND_COLOR_PRESETS.map((c) => (
                <TouchableOpacity
                  key={c}
                  style={[styles.colorSwatch, { backgroundColor: c }, brandColor.toLowerCase() === c.toLowerCase() && styles.colorSwatchSelected]}
                  onPress={() => setBrandColor(c)}
                />
              ))}
            </View>
            <TextInput style={styles.input} placeholder="#FF6B00" placeholderTextColor="#525252" value={brandColor} onChangeText={setBrandColor} autoCapitalize="none" />

            <Text style={styles.label}>Registro profissional (CREF / CRN)</Text>
            <TextInput style={styles.input} placeholder="ex: CREF 000000-G/MG" placeholderTextColor="#525252" value={professionalRegister} onChangeText={setProfessionalRegister} />

            <Text style={styles.label}>Telefone / WhatsApp</Text>
            <TextInput style={styles.input} keyboardType="phone-pad" placeholder="ex: 37998231382" placeholderTextColor="#525252" value={phone} onChangeText={setPhone} />

            <Text style={styles.label}>Instagram</Text>
            <TextInput style={styles.input} placeholder="@seuinstagram" placeholderTextColor="#525252" value={contactInstagram} onChangeText={setContactInstagram} autoCapitalize="none" />

            <Text style={styles.label}>E-mail de contato (relatórios)</Text>
            <TextInput style={styles.input} placeholder="contato@seudominio.com" placeholderTextColor="#525252" value={contactEmail} onChangeText={setContactEmail} autoCapitalize="none" keyboardType="email-address" />

            <View style={styles.paymentDivider} />
            <Text style={styles.paymentSectionTitle}>Dados para Pagamento</Text>
            <Text style={styles.paymentHint}>Isso aparece automaticamente nas mensagens de WhatsApp quando alguém demonstra interesse em comprar ou tem uma mensalidade pra pagar.</Text>

            <Text style={styles.label}>Chave Pix</Text>
            <TextInput style={styles.input} placeholder="ex: seu@email.com, CPF ou telefone" placeholderTextColor="#525252" value={pixKey} onChangeText={setPixKey} autoCapitalize="none" />

            <Text style={styles.label}>Link de pagamento (opcional)</Text>
            <TextInput style={styles.input} placeholder="ex: link do Mercado Pago / PagSeguro" placeholderTextColor="#525252" value={paymentLink} onChangeText={setPaymentLink} autoCapitalize="none" />

            <Text style={styles.brandingSavedHint}>A logo salva automaticamente. Os outros campos salvam junto com "Salvar Alterações" no final da página.</Text>
          </View>
        )}
      </View>

      <View style={styles.formCard}>
        <Text style={styles.label}>Nome</Text>
        <TextInput style={styles.input} placeholder="Seu nome" placeholderTextColor="#525252" value={name} onChangeText={setName} />

        <Text style={styles.label}>E-mail de login</Text>
        <TextInput style={[styles.input, styles.inputDisabled]} value={email} editable={false} />
        <Text style={styles.helperText}>O e-mail de login não pode ser alterado por aqui.</Text>
      </View>

      <TouchableOpacity style={styles.saveButton} onPress={handleSaveAll} disabled={saving}>
        {saving ? <ActivityIndicator color="#0a0a0a" /> : <Text style={styles.saveButtonText}>Salvar Alterações</Text>}
      </TouchableOpacity>

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
  summaryCard: { flexDirection: 'row', backgroundColor: '#171717', borderWidth: 1, borderColor: '#292524', borderRadius: 12, paddingVertical: 14, marginBottom: 16 },
  summaryItem: { flex: 1, alignItems: 'center' },
  summaryDivider: { width: 1, backgroundColor: '#292524' },
  summaryValue: { color: '#f5f5f5', fontSize: 18, fontWeight: '800' },
  summaryLabel: { color: '#737373', fontSize: 10, marginTop: 4, textAlign: 'center' },
  summaryStatusRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  summaryStatusDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#22c55e' },
  shortcutGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 16 },
  shortcutCard: { width: '47%', backgroundColor: '#171717', borderWidth: 1, borderColor: '#292524', borderRadius: 14, paddingVertical: 18, alignItems: 'center', gap: 10 },
  shortcutIconCircle: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(249,115,22,0.12)', alignItems: 'center', justifyContent: 'center' },
  shortcutText: { color: '#f5f5f5', fontSize: 12, fontWeight: '700', textAlign: 'center' },
  brandingCard: { backgroundColor: '#171717', borderWidth: 1, borderColor: '#292524', borderRadius: 12, marginBottom: 16, overflow: 'hidden' },
  brandingCardHighlight: { borderColor: '#f97316' },
  brandingHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14 },
  brandingTitle: { color: '#f5f5f5', fontSize: 13, fontWeight: '800', flexShrink: 1, marginRight: 8 },
  brandingBody: { paddingHorizontal: 14, paddingBottom: 14, borderTopWidth: 1, borderTopColor: '#0a0a0a' },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10, marginTop: 4 },
  logoBox: { width: 70, height: 70, borderRadius: 12, backgroundColor: '#0a0a0a', borderWidth: 1, borderColor: '#292524', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  logoImage: { width: '100%', height: '100%' },
  logoPlaceholderText: { color: '#a3a3a3', fontSize: 11, fontWeight: '600' },
  logoHint: { flex: 1, color: '#525252', fontSize: 10, lineHeight: 14 },
  label: { color: '#737373', fontSize: 10, textTransform: 'uppercase', marginBottom: 6, marginTop: 12 },
  colorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  colorSwatch: { width: 32, height: 32, borderRadius: 16, borderWidth: 3, borderColor: 'transparent' },
  colorSwatchSelected: { borderColor: '#f5f5f5' },
  input: { backgroundColor: '#0a0a0a', borderWidth: 1, borderColor: '#292524', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 10, color: '#f5f5f5', fontSize: 14 },
  inputDisabled: { color: '#525252' },
  helperText: { color: '#525252', fontSize: 10, marginTop: 4, lineHeight: 14 },
  paymentDivider: { height: 1, backgroundColor: '#0a0a0a', marginTop: 16, marginBottom: 4 },
  paymentSectionTitle: { color: '#22c55e', fontSize: 12, fontWeight: '800', marginTop: 12, textTransform: 'uppercase' },
  paymentHint: { color: '#525252', fontSize: 10, marginTop: 4, marginBottom: 4, lineHeight: 14 },
  brandingSavedHint: { color: '#525252', fontSize: 9, marginTop: 14, lineHeight: 13 },
  formCard: { backgroundColor: '#171717', borderWidth: 1, borderColor: '#292524', borderRadius: 12, padding: 14, marginBottom: 16 },
  saveButton: { backgroundColor: '#f97316', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
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
});