import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, TextInput, ScrollView, ActivityIndicator, Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from './supabaseClient';
import { showAlert } from './alertUtils';

const TYPES = [
  { value: 'ebook_receitas', label: 'Guia de Receitas / E-book', icon: 'book-outline' },
  { value: 'desafio', label: 'Inscrição em Desafio', icon: 'trophy-outline' },
  { value: 'substituicao_alimentar', label: 'Guia de Substituição Alimentar', icon: 'swap-horizontal-outline' },
  { value: 'outro', label: 'Outro', icon: 'pricetag-outline' },
];

function typeMeta(value) {
  return TYPES.find((t) => t.value === value) || TYPES[3];
}

export default function ProductsManagerScreen({ personalId, onClose }) {
  const [products, setProducts] = useState([]);
  const [recipes, setRecipes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [managingProduct, setManagingProduct] = useState(null);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState('ebook_receitas');
  const [price, setPrice] = useState('');
  const [deliveryType, setDeliveryType] = useState('arquivo');
  const [deliveryValue, setDeliveryValue] = useState('');
  const [showAsAddon, setShowAsAddon] = useState(false);
  const [active, setActive] = useState(true);
  const [selectedRecipeIds, setSelectedRecipeIds] = useState([]);
  const [students, setStudents] = useState([]);
  const [grants, setGrants] = useState([]);
  const [loadingGrants, setLoadingGrants] = useState(false);
  const [grantingStudentId, setGrantingStudentId] = useState(null);

  const loadProducts = async () => {
    const { data } = await supabase.from('products').select('*').eq('personal_id', personalId).order('created_at', { ascending: false });
    setProducts(data || []);
    setLoading(false);
  };

  const loadRecipes = async () => {
    const { data } = await supabase.from('recipes').select('id, title').eq('personal_id', personalId).order('title');
    setRecipes(data || []);
  };

  useEffect(() => {
    loadProducts();
    loadRecipes();
  }, []);

  const toggleSelectedRecipe = (recipeId) => {
    setSelectedRecipeIds((prev) =>
      prev.includes(recipeId) ? prev.filter((id) => id !== recipeId) : [...prev, recipeId]
    );
  };

  const resetForm = () => {
    setEditingId(null);
    setTitle('');
    setDescription('');
    setType('ebook_receitas');
    setPrice('');
    setDeliveryType('arquivo');
    setDeliveryValue('');
    setShowAsAddon(false);
    setActive(true);
    setSelectedRecipeIds([]);
  };

  const handleOpenNew = () => {
    resetForm();
    setShowForm(true);
  };

  const handleOpenEdit = (product) => {
    setEditingId(product.id);
    setTitle(product.name || '');
    setDescription(product.description || '');
    setType(product.type || 'ebook_receitas');
    setPrice(product.price != null ? String(product.price) : '');
    setDeliveryType(product.delivery_type || 'arquivo');
    setDeliveryValue(product.delivery_value || '');
    setShowAsAddon(product.show_as_addon || false);
    setActive(product.active !== false);
    setSelectedRecipeIds(product.recipe_ids || []);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!title.trim()) {
      showAlert('Ops', 'Digita o título do produto.');
      return;
    }
    setSaving(true);
    const payload = {
      personal_id: personalId,
      name: title.trim(),
      description: description.trim() || null,
      type,
      price: price ? Number(price) : null,
      delivery_type: deliveryType,
      delivery_value: deliveryValue.trim() || null,
      show_as_addon: showAsAddon,
      active,
      product_key: type,
      recipe_ids: selectedRecipeIds,
    };

    let error;
    if (editingId) {
      ({ error } = await supabase.from('products').update(payload).eq('id', editingId));
    } else {
      ({ error } = await supabase.from('products').insert(payload));
    }
    setSaving(false);
    if (error) {
      showAlert('Erro', error.message);
    } else {
      setShowForm(false);
      resetForm();
      loadProducts();
    }
  };

  const handleOpenManage = async (product) => {
    setManagingProduct(product);
    setLoadingGrants(true);
    const [{ data: studentRows }, { data: grantRows }] = await Promise.all([
      supabase.from('users').select('id, name').eq('personal_id', personalId).eq('role', 'aluno').order('name'),
      supabase.from('product_grants').select('id, student_id, users!product_grants_student_id_fkey (name)').eq('product_id', product.id),
    ]);
    setStudents(studentRows || []);
    setGrants(grantRows || []);
    setLoadingGrants(false);
  };

  const handleGrantAccess = async (studentId) => {
    if (!managingProduct) return;
    setGrantingStudentId(studentId);
    const { error } = await supabase.from('product_grants').insert({
      product_id: managingProduct.id,
      student_id: studentId,
      personal_id: personalId,
    });
    if (error) {
      showAlert('Erro ao liberar acesso', error.message);
    } else {
      await handleOpenManage(managingProduct);
    }
    setGrantingStudentId(null);
  };

  const handleRevokeAccess = async (grantId) => {
    await supabase.from('product_grants').delete().eq('id', grantId);
    if (managingProduct) await handleOpenManage(managingProduct);
  };

  const handleDelete = (productId) => {
    showAlert('Excluir produto', 'Tem certeza?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: async () => {
          await supabase.from('products').delete().eq('id', productId);
          loadProducts();
        },
      },
    ]);
  };

  if (managingProduct) {
    const linkedRecipes = recipes.filter((r) => (managingProduct.recipe_ids || []).includes(r.id));

    return (
      <View style={styles.container}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => setManagingProduct(null)}>
            <Text style={styles.closeText}>← Voltar</Text>
          </TouchableOpacity>
          <Text style={styles.title}>{managingProduct.name}</Text>
        </View>

        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}>
          <Text style={styles.label}>Receitas incluídas</Text>
          {linkedRecipes.length === 0 ? (
            <Text style={styles.helperText}>Nenhuma receita vinculada. Edite o produto pra adicionar.</Text>
          ) : (
            <View style={styles.recipeChecklist}>
              {linkedRecipes.map((r) => (
                <View key={r.id} style={styles.recipeCheckRow}>
                  <Ionicons name="restaurant-outline" size={14} color="#f97316" />
                  <Text style={styles.recipeCheckLabel}>{r.title}</Text>
                </View>
              ))}
            </View>
          )}

          <Text style={[styles.label, { marginTop: 24 }]}>Liberar acesso pra aluno</Text>
          <Text style={styles.helperText}>Depois que o aluno comprar (fora do app, via WhatsApp/Pix), libere o acesso aqui pra ele ver as receitas na aba de Receitas dele.</Text>

          {loadingGrants ? (
            <ActivityIndicator color="#f97316" style={{ marginTop: 16 }} />
          ) : students.length === 0 ? (
            <Text style={styles.helperText}>Você ainda não tem alunos.</Text>
          ) : (
            <View style={{ marginTop: 10 }}>
              {students.map((s) => {
                const grant = grants.find((g) => g.student_id === s.id);
                return (
                  <View key={s.id} style={styles.studentGrantRow}>
                    <Text style={styles.studentGrantName}>{s.name}</Text>
                    {grant ? (
                      <TouchableOpacity onPress={() => handleRevokeAccess(grant.id)}>
                        <Text style={styles.revokeLink}>✓ Liberado — Revogar</Text>
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity onPress={() => handleGrantAccess(s.id)} disabled={grantingStudentId === s.id}>
                        {grantingStudentId === s.id ? (
                          <ActivityIndicator color="#f97316" size="small" />
                        ) : (
                          <Text style={styles.grantLink}>Liberar acesso</Text>
                        )}
                      </TouchableOpacity>
                    )}
                  </View>
                );
              })}
            </View>
          )}
        </ScrollView>
      </View>
    );
  }

  if (showForm) {
    return (
      <View style={styles.container}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => setShowForm(false)}>
            <Text style={styles.closeText}>← Voltar</Text>
          </TouchableOpacity>
          <Text style={styles.title}>{editingId ? 'Editar Produto' : 'Novo Produto'}</Text>
        </View>

        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}>
          <Text style={styles.label}>Tipo</Text>
          <View style={styles.typeRow}>
            {TYPES.map((t) => (
              <TouchableOpacity key={t.value} style={[styles.typeChip, type === t.value && styles.typeChipActive]} onPress={() => setType(t.value)}>
                <Ionicons name={t.icon} size={14} color={type === t.value ? '#0a0a0a' : '#a3a3a3'} />
                <Text style={[styles.typeChipText, type === t.value && styles.typeChipTextActive]}>{t.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>Título do Produto</Text>
          <TextInput style={styles.input} placeholder="ex: Guia de Receitas Fitness" placeholderTextColor="#525252" value={title} onChangeText={setTitle} />

          <Text style={styles.label}>Descrição / Benefícios</Text>
          <TextInput style={styles.textArea} multiline placeholder="O que o cliente recebe ao comprar" placeholderTextColor="#525252" value={description} onChangeText={setDescription} />

          <Text style={styles.label}>Preço (R$)</Text>
          <View style={styles.priceRow}>
            <Text style={styles.currencyPrefix}>R$</Text>
            <TextInput style={styles.priceInput} keyboardType="decimal-pad" placeholder="ex: 47,00" placeholderTextColor="#525252" value={price} onChangeText={setPrice} />
          </View>

          <Text style={styles.label}>Entregável / Acesso</Text>
          <View style={styles.deliveryTypeRow}>
            <TouchableOpacity style={[styles.deliveryTypeChip, deliveryType === 'arquivo' && styles.deliveryTypeChipActive]} onPress={() => setDeliveryType('arquivo')}>
              <Text style={[styles.deliveryTypeChipText, deliveryType === 'arquivo' && styles.deliveryTypeChipTextActive]}>Link de Arquivo (PDF/E-book)</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.deliveryTypeChip, deliveryType === 'chave' && styles.deliveryTypeChipActive]} onPress={() => setDeliveryType('chave')}>
              <Text style={[styles.deliveryTypeChipText, deliveryType === 'chave' && styles.deliveryTypeChipTextActive]}>Chave de Liberação</Text>
            </TouchableOpacity>
          </View>
          <TextInput
            style={styles.input}
            placeholder={deliveryType === 'arquivo' ? 'Cole o link do arquivo (Drive, Dropbox...)' : 'ex: RECEITAS2026'}
            placeholderTextColor="#525252"
            value={deliveryValue}
            onChangeText={setDeliveryValue}
            autoCapitalize="none"
          />

          <Text style={styles.label}>Conteúdo do Produto (Receitas Incluídas)</Text>
          {recipes.length === 0 ? (
            <Text style={styles.helperText}>Você ainda não cadastrou receitas em “Gerenciar Receitas”.</Text>
          ) : (
            <View style={styles.recipeChecklist}>
              {recipes.map((r) => {
                const checked = selectedRecipeIds.includes(r.id);
                return (
                  <TouchableOpacity key={r.id} style={styles.recipeCheckRow} onPress={() => toggleSelectedRecipe(r.id)}>
                    <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
                      {checked && <Ionicons name="checkmark" size={13} color="#0a0a0a" />}
                    </View>
                    <Text style={styles.recipeCheckLabel}>{r.title}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>Exibir na Vitrine Pública (Landing Page) — aparece como oferta complementar no checkout</Text>
            <Switch value={showAsAddon} onValueChange={setShowAsAddon} trackColor={{ false: '#292524', true: '#22c55e' }} thumbColor="#f5f5f5" />
          </View>

          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>Produto ativo</Text>
            <Switch value={active} onValueChange={setActive} trackColor={{ false: '#292524', true: '#f97316' }} thumbColor="#f5f5f5" />
          </View>

          <TouchableOpacity style={styles.saveButton} onPress={handleSave} disabled={saving}>
            {saving ? <ActivityIndicator color="#0a0a0a" /> : <Text style={styles.saveButtonText}>Salvar Produto</Text>}
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={onClose}>
          <Text style={styles.closeText}>← Voltar</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Produtos Adicionais</Text>
      </View>

      <Text style={styles.hint2}>E-books, desafios avulsos e guias — tudo que não é consultoria direta. Marque "oferta complementar" pra aparecer como upsell na vitrine.</Text>

      <TouchableOpacity style={styles.newButton} onPress={handleOpenNew}>
        <Text style={styles.newButtonText}>+ Novo Produto</Text>
      </TouchableOpacity>

      {loading ? (
        <ActivityIndicator color="#f97316" style={{ marginTop: 20 }} />
      ) : (
        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 30 }}>
          {products.length === 0 ? (
            <Text style={styles.emptyText}>Nenhum produto cadastrado ainda.</Text>
          ) : (
            products.map((p) => {
              const meta = typeMeta(p.type);
              return (
                <View key={p.id} style={styles.productCard}>
                  <View style={styles.productCardTop}>
                    <View style={styles.productIconCircle}>
                      <Ionicons name={meta.icon} size={18} color="#f97316" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.productName}>{p.name}{!p.active ? ' (inativo)' : ''}</Text>
                      <Text style={styles.productMeta}>{meta.label} · {p.price != null ? `R$ ${Number(p.price).toFixed(2)}` : 'Consulte'}</Text>
                    </View>
                  </View>
                  {p.show_as_addon && (
                    <View style={styles.addonTag}>
                      <Text style={styles.addonTagText}>UPSELL ATIVO</Text>
                    </View>
                  )}
                  <View style={styles.productActionsRow}>
                    <TouchableOpacity onPress={() => handleOpenManage(p)}>
                      <Text style={styles.manageLink}>📂 Ver Conteúdo</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleOpenEdit(p)}>
                      <Text style={styles.editLink}>Editar</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleDelete(p.id)}>
                      <Text style={styles.deleteLink}>🗑️ Excluir</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a', paddingTop: 50 },
  topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, marginBottom: 8 },
  closeText: { color: '#f97316', fontSize: 14, fontWeight: '600' },
  title: { color: '#f5f5f5', fontSize: 16, fontWeight: '700', marginLeft: 16 },
  hint2: { color: '#737373', fontSize: 11, paddingHorizontal: 16, marginBottom: 14, lineHeight: 16 },
  newButton: { backgroundColor: '#f97316', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginHorizontal: 16, marginBottom: 16 },
  newButtonText: { color: '#0a0a0a', fontSize: 14, fontWeight: '700' },
  emptyText: { color: '#525252', fontSize: 13, textAlign: 'center', marginTop: 30 },
  productCard: { backgroundColor: '#171717', borderWidth: 1, borderColor: '#292524', borderRadius: 14, padding: 14, marginBottom: 12 },
  productCardTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  productIconCircle: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(249,115,22,0.12)', alignItems: 'center', justifyContent: 'center' },
  productName: { color: '#f5f5f5', fontSize: 13, fontWeight: '700' },
  productMeta: { color: '#737373', fontSize: 10, marginTop: 2 },
  addonTag: { alignSelf: 'flex-start', backgroundColor: 'rgba(34,197,94,0.12)', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, marginTop: 10 },
  addonTagText: { color: '#22c55e', fontSize: 9, fontWeight: '800' },
  productActionsRow: { flexDirection: 'row', gap: 16, marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#0a0a0a' },
  manageLink: { color: '#22c55e', fontSize: 12, fontWeight: '700' },
  editLink: { color: '#3b82f6', fontSize: 12, fontWeight: '700' },
  deleteLink: { fontSize: 12, color: '#ef4444', fontWeight: '700' },
  studentGrantRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#171717', borderWidth: 1, borderColor: '#292524', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 8 },
  studentGrantName: { color: '#f5f5f5', fontSize: 13, fontWeight: '600' },
  grantLink: { color: '#f97316', fontSize: 12, fontWeight: '700' },
  revokeLink: { color: '#22c55e', fontSize: 11, fontWeight: '700' },
  label: { color: '#737373', fontSize: 10, textTransform: 'uppercase', marginBottom: 6, marginTop: 14 },
  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  typeChip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#171717', borderWidth: 1, borderColor: '#292524', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 8 },
  typeChipActive: { backgroundColor: '#f97316', borderColor: '#f97316' },
  typeChipText: { color: '#a3a3a3', fontSize: 11, fontWeight: '600' },
  typeChipTextActive: { color: '#0a0a0a' },
  input: { backgroundColor: '#171717', borderWidth: 1, borderColor: '#292524', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 10, color: '#f5f5f5', fontSize: 13 },
  textArea: { backgroundColor: '#171717', borderWidth: 1, borderColor: '#292524', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 10, color: '#f5f5f5', fontSize: 13, minHeight: 70, textAlignVertical: 'top' },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  currencyPrefix: { color: '#a3a3a3', fontSize: 13, fontWeight: '600' },
  priceInput: { flex: 1, backgroundColor: '#171717', borderWidth: 1, borderColor: '#292524', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 10, color: '#f5f5f5', fontSize: 13 },
  deliveryTypeRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  deliveryTypeChip: { flex: 1, backgroundColor: '#171717', borderWidth: 1, borderColor: '#292524', borderRadius: 8, paddingVertical: 10, alignItems: 'center' },
  deliveryTypeChipActive: { backgroundColor: '#3b82f6', borderColor: '#3b82f6' },
  deliveryTypeChipText: { color: '#a3a3a3', fontSize: 11, fontWeight: '600', textAlign: 'center' },
  deliveryTypeChipTextActive: { color: '#0a0a0a' },
  helperText: { color: '#525252', fontSize: 11 },
  recipeChecklist: { backgroundColor: '#171717', borderWidth: 1, borderColor: '#292524', borderRadius: 10, padding: 8 },
  recipeCheckRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, paddingHorizontal: 6 },
  checkbox: { width: 20, height: 20, borderRadius: 5, borderWidth: 1.5, borderColor: '#292524', alignItems: 'center', justifyContent: 'center' },
  checkboxChecked: { backgroundColor: '#f97316', borderColor: '#f97316' },
  recipeCheckLabel: { color: '#f5f5f5', fontSize: 12, fontWeight: '600', flexShrink: 1 },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 18 },
  switchLabel: { color: '#f5f5f5', fontSize: 12, fontWeight: '600', flexShrink: 1, marginRight: 8 },
  saveButton: { backgroundColor: '#f97316', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 24 },
  saveButtonText: { color: '#0a0a0a', fontSize: 15, fontWeight: '700' },
});