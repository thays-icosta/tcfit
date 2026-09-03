import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, TextInput, ScrollView, ActivityIndicator, Switch, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { decode } from 'base64-arraybuffer';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from './supabaseClient';
import { showAlert } from './alertUtils';
import { HeaderBack } from './Header';

function uuidv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export default function PartnerBrandsManagerScreen({ personalId, onClose }) {
  const insets = useSafeAreaInsets();
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [sectionEnabled, setSectionEnabled] = useState(true);
  const [savingSectionToggle, setSavingSectionToggle] = useState(false);

  const [name, setName] = useState('');
  const [logoUrl, setLogoUrl] = useState(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [couponCode, setCouponCode] = useState('');
  const [affiliateLink, setAffiliateLink] = useState('');
  const [active, setActive] = useState(true);

  const loadBrands = async () => {
    const { data } = await supabase.from('partner_brands').select('*').eq('personal_id', personalId).order('created_at', { ascending: false });
    setBrands(data || []);
    setLoading(false);
  };

  const loadSectionToggle = async () => {
    const { data } = await supabase.from('users').select('show_partners_section').eq('id', personalId).single();
    setSectionEnabled(data?.show_partners_section !== false);
  };

  useEffect(() => {
    loadBrands();
    loadSectionToggle();
  }, []);

  const handleToggleSection = async (value) => {
    setSectionEnabled(value);
    setSavingSectionToggle(true);
    await supabase.from('users').update({ show_partners_section: value }).eq('id', personalId);
    setSavingSectionToggle(false);
  };

  const resetForm = () => {
    setEditingId(null);
    setName('');
    setLogoUrl(null);
    setCouponCode('');
    setAffiliateLink('');
    setActive(true);
  };

  const handlePickLogo = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      showAlert('Permissão necessária', 'Autorize o acesso às fotos.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7, base64: true });
    if (result.canceled || !result.assets?.[0]?.base64) return;

    setUploadingLogo(true);
    try {
      const fileName = `${uuidv4()}.jpg`;
      const { error } = await supabase.storage.from('partner-logos').upload(fileName, decode(result.assets[0].base64), { contentType: 'image/jpeg' });
      if (error) throw error;
      const { data } = supabase.storage.from('partner-logos').getPublicUrl(fileName);
      setLogoUrl(data.publicUrl);
    } catch {
      showAlert('Não deu pra enviar a logo', 'Sem problema, você pode salvar sem logo e adicionar depois.');
    }
    setUploadingLogo(false);
  };

  const handleOpenNew = () => {
    resetForm();
    setShowForm(true);
  };

  const handleOpenEdit = (brand) => {
    setEditingId(brand.id);
    setName(brand.name || '');
    setLogoUrl(brand.logo_url || null);
    setCouponCode(brand.coupon_code || '');
    setAffiliateLink(brand.affiliate_link || '');
    setActive(brand.active !== false);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      showAlert('Ops', 'Digita o nome da marca.');
      return;
    }
    setSaving(true);
    const payload = {
      personal_id: personalId,
      name: name.trim(),
      logo_url: logoUrl,
      coupon_code: couponCode.trim() || null,
      affiliate_link: affiliateLink.trim() || null,
      active,
    };

    let error;
    if (editingId) {
      ({ error } = await supabase.from('partner_brands').update(payload).eq('id', editingId));
    } else {
      ({ error } = await supabase.from('partner_brands').insert(payload));
    }
    setSaving(false);
    if (error) {
      showAlert('Erro', error.message);
    } else {
      setShowForm(false);
      resetForm();
      loadBrands();
    }
  };

  const handleDelete = (brandId) => {
    showAlert('Excluir marca parceira', 'Tem certeza?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: async () => {
          await supabase.from('partner_brands').delete().eq('id', brandId);
          loadBrands();
        },
      },
    ]);
  };

  if (showForm) {
    return (
      <View style={[styles.container, { paddingTop: Math.max(insets.top + 12, 24) }]}>
        <HeaderBack title={editingId ? 'Editar Marca' : 'Nova Marca Parceira'} onBack={() => setShowForm(false)} style={{ paddingHorizontal: 16 }} />

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}>
          <TouchableOpacity style={styles.logoPicker} onPress={handlePickLogo} disabled={uploadingLogo}>
            {uploadingLogo ? (
              <ActivityIndicator color="#f97316" />
            ) : logoUrl ? (
              <Image source={{ uri: logoUrl }} style={styles.logoPreview} resizeMode="contain" />
            ) : (
              <Text style={styles.logoPickerText}>🏷️ Adicionar logo</Text>
            )}
          </TouchableOpacity>

          <Text style={styles.label}>Nome da Marca</Text>
          <TextInput style={styles.input} placeholder="ex: Growth, Caffeine Army" placeholderTextColor="#525252" value={name} onChangeText={setName} />

          <Text style={styles.label}>Código do Cupom</Text>
          <TextInput style={styles.input} placeholder="ex: THAYS10" placeholderTextColor="#525252" value={couponCode} onChangeText={setCouponCode} autoCapitalize="characters" />

          <Text style={styles.label}>Link de Afiliado / Redirecionamento</Text>
          <Text style={[styles.helperText, { marginBottom: 6 }]}>Pode colar o link já com cupom ou UTM anexado (ex: https://loja.com?cupom=THAYS10). Abre em nova aba no navegador.</Text>
          <TextInput style={styles.input} placeholder="https://..." placeholderTextColor="#525252" value={affiliateLink} onChangeText={setAffiliateLink} autoCapitalize="none" />

          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>Marca ativa (visível para os alunos)</Text>
            <Switch value={active} onValueChange={setActive} trackColor={{ false: '#292524', true: '#f97316' }} thumbColor="#f5f5f5" />
          </View>

          <TouchableOpacity style={styles.saveButton} onPress={handleSave} disabled={saving}>
            {saving ? <ActivityIndicator color="#0a0a0a" /> : <Text style={styles.saveButtonText}>Salvar Marca</Text>}
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <HeaderBack title="Marcas Parceiras" onBack={onClose} style={{ paddingHorizontal: 16 }} />

      <View style={styles.sectionToggleBox}>
        <View style={{ flex: 1 }}>
          <Text style={styles.sectionToggleLabel}>Exibir seção “Marcas Parceiras” pros alunos {savingSectionToggle && '(salvando...)'}</Text>
          <Text style={styles.helperText}>Desligue pra esconder a seção inteira sem precisar apagar as marcas cadastradas.</Text>
        </View>
        <Switch value={sectionEnabled} onValueChange={handleToggleSection} trackColor={{ false: '#292524', true: '#22c55e' }} thumbColor="#f5f5f5" />
      </View>

      <TouchableOpacity style={styles.newButton} onPress={handleOpenNew}>
        <Text style={styles.newButtonText}>+ Nova Marca Parceira</Text>
      </TouchableOpacity>

      {loading ? (
        <ActivityIndicator color="#f97316" style={{ marginTop: 20 }} />
      ) : (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 30 }}>
          {brands.length === 0 ? (
            <Text style={styles.emptyText}>Nenhuma marca parceira cadastrada ainda.</Text>
          ) : (
            brands.map((b) => (
              <View key={b.id} style={styles.brandCard}>
                <View style={styles.brandLogoWrap}>
                  {b.logo_url ? (
                    <Image source={{ uri: b.logo_url }} style={styles.brandLogoImage} resizeMode="contain" />
                  ) : (
                    <Ionicons name="pricetag-outline" size={20} color="#f97316" />
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.brandName}>{b.name}</Text>
                  {b.coupon_code ? <Text style={styles.brandCoupon}>Cupom: {b.coupon_code}</Text> : null}
                  {!b.active && <Text style={styles.brandInactive}>Inativa</Text>}
                </View>
                <View style={styles.brandActions}>
                  <TouchableOpacity hitSlop={6} onPress={() => handleOpenEdit(b)}>
                    <Ionicons name="create-outline" size={18} color="#3b82f6" />
                  </TouchableOpacity>
                  <TouchableOpacity hitSlop={6} onPress={() => handleDelete(b.id)}>
                    <Ionicons name="trash-outline" size={18} color="#ef4444" />
                  </TouchableOpacity>
                </View>
              </View>
            ))
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a', paddingTop: 50 },
  sectionToggleBox: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#171717', borderWidth: 1, borderColor: '#292524', borderRadius: 12, padding: 14, marginHorizontal: 16, marginBottom: 14 },
  sectionToggleLabel: { color: '#f5f5f5', fontSize: 12, fontWeight: '700', marginBottom: 4 },
  helperText: { color: '#525252', fontSize: 11, lineHeight: 15 },
  newButton: { backgroundColor: '#f97316', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginHorizontal: 16, marginBottom: 16 },
  newButtonText: { color: '#0a0a0a', fontSize: 14, fontWeight: '700' },
  emptyText: { color: '#525252', fontSize: 13, textAlign: 'center', marginTop: 30 },
  brandCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#171717', borderWidth: 1, borderColor: '#292524', borderRadius: 14, padding: 12, marginBottom: 10 },
  brandLogoWrap: { width: 48, height: 48, borderRadius: 10, backgroundColor: '#0a0a0a', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  brandLogoImage: { width: '100%', height: '100%' },
  brandName: { color: '#f5f5f5', fontSize: 13, fontWeight: '700' },
  brandCoupon: { color: '#a3a3a3', fontSize: 11, marginTop: 2 },
  brandInactive: { color: '#ef4444', fontSize: 10, fontWeight: '700', marginTop: 2 },
  brandActions: { flexDirection: 'row', gap: 14 },
  label: { color: '#737373', fontSize: 10, textTransform: 'uppercase', marginBottom: 6, marginTop: 14 },
  logoPicker: { height: 120, backgroundColor: '#171717', borderWidth: 1, borderColor: '#292524', borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 6, overflow: 'hidden', padding: 16 },
  logoPreview: { width: '100%', height: '100%' },
  logoPickerText: { color: '#a3a3a3', fontSize: 13, fontWeight: '600' },
  input: { backgroundColor: '#171717', borderWidth: 1, borderColor: '#292524', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 10, color: '#f5f5f5', fontSize: 13 },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 18 },
  switchLabel: { color: '#f5f5f5', fontSize: 12, fontWeight: '600', flexShrink: 1, marginRight: 8 },
  saveButton: { backgroundColor: '#f97316', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 24 },
  saveButtonText: { color: '#0a0a0a', fontSize: 15, fontWeight: '700' },
});
