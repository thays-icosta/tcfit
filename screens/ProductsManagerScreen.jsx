import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, TextInput, ScrollView, ActivityIndicator, Switch, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { decode } from 'base64-arraybuffer';
import { supabase } from './supabaseClient';
import { showAlert } from './alertUtils';
import { HOME_CATEGORIES, PROGRAM_LEVELS, PROGRAM_GOALS, NUTRITION_TAGS } from './accessLevel';
import { HeaderBack } from './Header';

const TYPES = [
  { value: 'ebook_receitas', label: 'Guia de Receitas / E-book', icon: 'book-outline' },
  { value: 'treino_template', label: 'Template de Treino', icon: 'barbell-outline' },
  { value: 'desafio', label: 'Inscrição em Desafio', icon: 'trophy-outline' },
  { value: 'substituicao_alimentar', label: 'Guia de Substituição Alimentar', icon: 'swap-horizontal-outline' },
  { value: 'outro', label: 'Outro', icon: 'pricetag-outline' },
];

function typeMeta(value) {
  return TYPES.find((t) => t.value === value) || TYPES[3];
}

function extractFileLabel(url) {
  try {
    const last = decodeURIComponent(url.split('/').pop().split('?')[0]);
    const uuidPrefixMatch = last.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-(.+)$/i);
    const name = uuidPrefixMatch ? uuidPrefixMatch[1] : last;
    if (!name || name.length > 60 || !name.includes('.')) return 'Arquivo vinculado';
    return name;
  } catch {
    return 'Arquivo vinculado';
  }
}

function uuidv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export default function ProductsManagerScreen({ personalId, onClose }) {
  const [products, setProducts] = useState([]);
  const [recipes, setRecipes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [managingProduct, setManagingProduct] = useState(null);
  const [previewProduct, setPreviewProduct] = useState(null);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState('ebook_receitas');
  const [price, setPrice] = useState('');
  const [deliveryType, setDeliveryType] = useState('arquivo');
  const [deliveryValue, setDeliveryValue] = useState('');
  const [showAsAddon, setShowAsAddon] = useState(false);
  const [active, setActive] = useState(true);
  const [selectedRecipeIds, setSelectedRecipeIds] = useState([]);
  const [coverImageUrl, setCoverImageUrl] = useState(null);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [requiredAccessLevel, setRequiredAccessLevel] = useState(null);
  const [category, setCategory] = useState(null);
  const [students, setStudents] = useState([]);
  const [grants, setGrants] = useState([]);
  const [loadingGrants, setLoadingGrants] = useState(false);
  const [grantingStudentId, setGrantingStudentId] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [selectedTemplateIds, setSelectedTemplateIds] = useState([]);
  const [linkedTemplates, setLinkedTemplates] = useState([]);
  const [level, setLevel] = useState(null);
  const [goal, setGoal] = useState(null);
  const [materialType, setMaterialType] = useState(null);
  const [nutritionTags, setNutritionTags] = useState([]);
  const [sectionEnabled, setSectionEnabled] = useState(true);
  const [savingSectionToggle, setSavingSectionToggle] = useState(false);

  const loadSectionToggle = async () => {
    const { data } = await supabase.from('users').select('show_produtos_avulsos_section').eq('id', personalId).single();
    setSectionEnabled(data?.show_produtos_avulsos_section !== false);
  };

  const handleToggleSection = async (value) => {
    setSectionEnabled(value);
    setSavingSectionToggle(true);
    await supabase.from('users').update({ show_produtos_avulsos_section: value }).eq('id', personalId);
    setSavingSectionToggle(false);
  };

  const loadProducts = async () => {
    const { data } = await supabase.from('products').select('*').eq('personal_id', personalId).order('created_at', { ascending: false });
    setProducts(data || []);
    setLoading(false);
  };

  const loadRecipes = async () => {
    const { data } = await supabase.from('recipes').select('id, title').eq('personal_id', personalId).order('title');
    setRecipes(data || []);
  };

  const loadTemplates = async () => {
    const { data } = await supabase.from('workout_templates').select('id, name').eq('personal_id', personalId).order('name');
    setTemplates(data || []);
  };

  useEffect(() => {
    loadProducts();
    loadRecipes();
    loadTemplates();
    loadSectionToggle();
  }, []);

  const toggleSelectedRecipe = (recipeId) => {
    setSelectedRecipeIds((prev) =>
      prev.includes(recipeId) ? prev.filter((id) => id !== recipeId) : [...prev, recipeId]
    );
  };

  const toggleSelectedTemplate = (templateId) => {
    setSelectedTemplateIds((prev) =>
      prev.includes(templateId) ? prev.filter((id) => id !== templateId) : [...prev, templateId]
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
    setCoverImageUrl(null);
    setRequiredAccessLevel(null);
    setSelectedTemplateIds([]);
    setCategory(null);
    setLevel(null);
    setGoal(null);
    setMaterialType(null);
    setNutritionTags([]);
  };

  const toggleNutritionTag = (value) => {
    setNutritionTags((prev) => (prev.includes(value) ? prev.filter((t) => t !== value) : [...prev, value]));
  };

  const handlePickCoverImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      showAlert('Permissão necessária', 'Autorize o acesso às fotos.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.6, base64: true });
    if (result.canceled || !result.assets?.[0]?.base64) return;

    setUploadingCover(true);
    try {
      const fileName = `${uuidv4()}.jpg`;
      const { error } = await supabase.storage.from('product-covers').upload(fileName, decode(result.assets[0].base64), { contentType: 'image/jpeg' });
      if (error) throw error;
      const { data } = supabase.storage.from('product-covers').getPublicUrl(fileName);
      setCoverImageUrl(data.publicUrl);
    } catch {
      showAlert('Não deu pra enviar a capa', 'Sem problema, você pode salvar o produto sem foto e adicionar depois.');
    }
    setUploadingCover(false);
  };

  const handlePickFile = async () => {
    const result = await DocumentPicker.getDocumentAsync({ type: 'application/pdf', copyToCacheDirectory: true });
    if (result.canceled || !result.assets?.[0]) return;

    const asset = result.assets[0];
    setUploadingFile(true);
    try {
      const response = await fetch(asset.uri);
      const blob = await response.blob();
      const safeName = (asset.name || 'arquivo.pdf').replace(/[^a-zA-Z0-9._-]/g, '_');
      const fileName = `${uuidv4()}-${safeName}`;
      const { error } = await supabase.storage.from('product-files').upload(fileName, blob, { contentType: 'application/pdf' });
      if (error) throw error;
      const { data } = supabase.storage.from('product-files').getPublicUrl(fileName);
      setDeliveryValue(data.publicUrl);
    } catch {
      showAlert('Não deu pra enviar o PDF', 'Tenta de novo ou cole um link (Drive/Dropbox) manualmente.');
    }
    setUploadingFile(false);
  };

  const handleOpenNew = () => {
    resetForm();
    setShowForm(true);
  };

  const handleOpenEdit = async (product) => {
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
    setCoverImageUrl(product.cover_image_url || null);
    setRequiredAccessLevel(product.required_access_level || null);
    setCategory(product.category || null);
    setLevel(product.level || null);
    setGoal(product.goal || null);
    setMaterialType(product.material_type || null);
    setNutritionTags(product.nutrition_tags || []);
    setShowForm(true);

    if (product.type === 'treino_template') {
      const { data: rows } = await supabase
        .from('product_templates')
        .select('template_id')
        .eq('product_id', product.id)
        .order('order_index');
      setSelectedTemplateIds(rows && rows.length > 0 ? rows.map((r) => r.template_id) : product.template_id ? [product.template_id] : []);
    } else {
      setSelectedTemplateIds([]);
    }
  };

  const handleSave = async () => {
    if (!title.trim()) {
      showAlert('Ops', 'Digita o título do produto.');
      return;
    }
    if (type === 'treino_template' && selectedTemplateIds.length === 0) {
      showAlert('Ops', 'Escolhe pelo menos um treino (Treino A, B, C...) pra esse produto entregar.');
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
      delivery_value: deliveryType === 'receitas' ? null : deliveryValue.trim() || null,
      show_as_addon: showAsAddon,
      active,
      product_key: type,
      recipe_ids: type === 'treino_template' ? [] : deliveryType === 'receitas' ? selectedRecipeIds : [],
      cover_image_url: coverImageUrl,
      required_access_level: requiredAccessLevel,
      template_id: type === 'treino_template' ? selectedTemplateIds[0] : null,
      category,
      level: type === 'treino_template' ? level : null,
      goal: type === 'treino_template' ? goal : null,
      material_type: type === 'ebook_receitas' ? materialType : null,
      nutrition_tags: type === 'ebook_receitas' && materialType === 'plano_alimentar' ? nutritionTags : null,
    };

    let error;
    let productId = editingId;
    if (editingId) {
      ({ error } = await supabase.from('products').update(payload).eq('id', editingId));
    } else {
      const { data: inserted, error: insertError } = await supabase.from('products').insert(payload).select().single();
      error = insertError;
      productId = inserted?.id || null;
    }

    if (!error && productId && type === 'treino_template') {
      await supabase.from('product_templates').delete().eq('product_id', productId);
      const rows = selectedTemplateIds.map((templateId, index) => ({
        product_id: productId,
        template_id: templateId,
        personal_id: personalId,
        order_index: index,
      }));
      if (rows.length > 0) {
        ({ error } = await supabase.from('product_templates').insert(rows));
      }
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

  const loadLinkedTemplates = async (product) => {
    if (product.source_template_id) {
      const { data } = await supabase
        .from('template_sessions')
        .select('id, name')
        .eq('template_id', product.source_template_id)
        .order('order_index');
      setLinkedTemplates(data || []);
      return;
    }
    const { data } = await supabase
      .from('product_templates')
      .select('template_id, order_index, workout_templates (name)')
      .eq('product_id', product.id)
      .order('order_index');
    setLinkedTemplates((data || []).map((row) => ({ id: row.template_id, name: row.workout_templates?.name || 'Treino' })));
  };

  const handleOpenPreview = (product) => {
    setPreviewProduct(product);
    if (product.type === 'treino_template') loadLinkedTemplates(product);
  };

  const handleOpenManage = async (product) => {
    setManagingProduct(product);
    if (product.type === 'treino_template') loadLinkedTemplates(product);
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

  if (previewProduct) {
    const meta = typeMeta(previewProduct.type);
    const previewRecipes = recipes.filter((r) => (previewProduct.recipe_ids || []).includes(r.id));

    return (
      <View style={styles.container}>
        <HeaderBack title="Ver como Aluno" onBack={() => setPreviewProduct(null)} style={{ paddingHorizontal: 16 }} />

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}>
          <Text style={styles.previewSectionLabel}>Card de Venda Público (Visitante)</Text>
          <View style={styles.saleCard}>
            <View style={styles.saleIconCircle}>
              <Ionicons name={meta.icon} size={28} color="#f97316" />
            </View>
            <Text style={styles.saleName}>{previewProduct.name}</Text>
            {previewProduct.description ? <Text style={styles.saleDescription}>{previewProduct.description}</Text> : null}
            <Text style={styles.salePrice}>
              {previewProduct.price != null ? `R$ ${Number(previewProduct.price).toFixed(2).replace('.', ',')}` : 'Consulte'}
            </Text>
            <View style={styles.saleButton}>
              <Text style={styles.saleButtonText}>Quero Comprar</Text>
            </View>
          </View>

          <Text style={[styles.previewSectionLabel, { marginTop: 28 }]}>Área do Aluno (Depois de Liberado)</Text>

          {previewProduct.type === 'treino_template' ? (
            <>
              <Text style={styles.helperText}>É assim que aparece na Vitrine do aluno depois que você libera o acesso — ele toca em um botão e as fichas são criadas automaticamente na aba de Treinos dele:</Text>
              <View style={styles.previewRecipeList}>
                {linkedTemplates.length === 0 ? (
                  <Text style={[styles.helperText, { padding: 10 }]}>Nenhum treino vinculado ainda.</Text>
                ) : (
                  linkedTemplates.map((t, i) => (
                    <View key={t.id} style={styles.previewRecipeRow}>
                      <View style={styles.previewRecipeThumb}>
                        <Ionicons name="barbell-outline" size={18} color="#f97316" />
                      </View>
                      <Text style={styles.previewRecipeTitle}>{String.fromCharCode(65 + i)} — {t.name}</Text>
                      <Ionicons name="lock-open-outline" size={16} color="#22c55e" />
                    </View>
                  ))
                )}
              </View>
            </>
          ) : (
            <>
              <Text style={styles.helperText}>É assim que aparece na aba de Receitas do aluno depois que você libera o acesso:</Text>
              {previewRecipes.length === 0 ? (
                <Text style={styles.helperText}>Nenhuma receita vinculada a esse produto ainda.</Text>
              ) : (
                <View style={styles.previewRecipeList}>
                  {previewRecipes.map((r) => (
                    <View key={r.id} style={styles.previewRecipeRow}>
                      <View style={styles.previewRecipeThumb}>
                        <Text style={{ fontSize: 18 }}>🍽️</Text>
                      </View>
                      <Text style={styles.previewRecipeTitle}>{r.title}</Text>
                      <Ionicons name="lock-open-outline" size={16} color="#22c55e" />
                    </View>
                  ))}
                </View>
              )}
            </>
          )}
        </ScrollView>
      </View>
    );
  }

  if (managingProduct) {
    const linkedRecipes = recipes.filter((r) => (managingProduct.recipe_ids || []).includes(r.id));

    return (
      <View style={styles.container}>
        <HeaderBack title={managingProduct.name} onBack={() => setManagingProduct(null)} style={{ paddingHorizontal: 16 }} />

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}>
          {managingProduct.type === 'treino_template' ? (
            <>
              <Text style={styles.label}>Treinos vinculados</Text>
              {linkedTemplates.length === 0 ? (
                <Text style={styles.helperText}>Nenhum treino vinculado. Edite o produto pra adicionar.</Text>
              ) : (
                <View style={styles.recipeChecklist}>
                  {linkedTemplates.map((t, i) => (
                    <View key={t.id} style={styles.recipeCheckRow}>
                      <Ionicons name="barbell-outline" size={14} color="#f97316" />
                      <Text style={styles.recipeCheckLabel}>{String.fromCharCode(65 + i)} — {t.name}</Text>
                    </View>
                  ))}
                </View>
              )}
            </>
          ) : (
            <>
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
            </>
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
        <HeaderBack title={editingId ? 'Editar Produto' : 'Novo Produto'} onBack={() => setShowForm(false)} style={{ paddingHorizontal: 16 }} />

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}>
          <TouchableOpacity style={styles.coverPicker} onPress={handlePickCoverImage} disabled={uploadingCover}>
            {uploadingCover ? (
              <ActivityIndicator color="#f97316" />
            ) : coverImageUrl ? (
              <Image source={{ uri: coverImageUrl }} style={styles.coverPreview} resizeMode="cover" />
            ) : (
              <Text style={styles.coverPickerText}>📷 Adicionar foto de capa</Text>
            )}
          </TouchableOpacity>

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

          {type === 'treino_template' ? (
            <>
              <Text style={styles.label}>Quais Treinos esse programa entrega? (ex: Treino A, Treino B, Treino C)</Text>
              {templates.length === 0 ? (
                <Text style={styles.helperText}>Você ainda não criou nenhum template em “Biblioteca de Treinos”.</Text>
              ) : (
                <View style={styles.recipeChecklist}>
                  {templates.map((t) => {
                    const checked = selectedTemplateIds.includes(t.id);
                    const order = selectedTemplateIds.indexOf(t.id);
                    return (
                      <TouchableOpacity key={t.id} style={styles.recipeCheckRow} onPress={() => toggleSelectedTemplate(t.id)}>
                        <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
                          {checked && <Ionicons name="checkmark" size={13} color="#0a0a0a" />}
                        </View>
                        <Text style={styles.recipeCheckLabel}>{t.name}</Text>
                        {checked && <Text style={styles.templateOrderBadge}>{order + 1}º</Text>}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
              <Text style={[styles.helperText, { marginTop: 8 }]}>A ordem que você marca é a ordem que aparece pro aluno (Treino A, B, C...). Ao liberar acesso, o aluno mesmo cria as fichas na aba dele com um toque.</Text>

              <Text style={styles.label}>Nível</Text>
              <View style={styles.accessLevelFormRow}>
                {PROGRAM_LEVELS.map((l) => (
                  <TouchableOpacity
                    key={l.value}
                    style={[styles.accessLevelFormChip, level === l.value && styles.accessLevelFormChipActive]}
                    onPress={() => setLevel(level === l.value ? null : l.value)}
                  >
                    <Text style={[styles.accessLevelFormChipText, level === l.value && styles.accessLevelFormChipTextActive]}>{l.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.label}>Objetivo</Text>
              <View style={styles.accessLevelFormRow}>
                {PROGRAM_GOALS.map((g) => (
                  <TouchableOpacity
                    key={g.value}
                    style={[styles.accessLevelFormChip, goal === g.value && styles.accessLevelFormChipActive]}
                    onPress={() => setGoal(goal === g.value ? null : g.value)}
                  >
                    <Text style={[styles.accessLevelFormChipText, goal === g.value && styles.accessLevelFormChipTextActive]}>{g.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          ) : (
            <>
              <Text style={styles.label}>Tipo de Material</Text>
              <Text style={styles.helperText}>Define em qual card (Planos Alimentares / E-books e Receitas) esse produto aparece na landing page.</Text>
              <View style={styles.accessLevelFormRow}>
                {[
                  { value: null, label: 'Sem tipo' },
                  { value: 'plano_alimentar', label: 'Plano Alimentar' },
                  { value: 'ebook_receita', label: 'E-book / Receita' },
                ].map((opt) => (
                  <TouchableOpacity
                    key={opt.label}
                    style={[styles.accessLevelFormChip, materialType === opt.value && styles.accessLevelFormChipActive]}
                    onPress={() => setMaterialType(opt.value)}
                  >
                    <Text style={[styles.accessLevelFormChipText, materialType === opt.value && styles.accessLevelFormChipTextActive]}>{opt.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {materialType === 'plano_alimentar' && (
                <>
                  <Text style={styles.label}>Tags do Plano Alimentar</Text>
                  <Text style={styles.helperText}>Usadas nos filtros em pílula da landing page. Pode marcar mais de uma.</Text>
                  <View style={styles.accessLevelFormRow}>
                    {NUTRITION_TAGS.map((opt) => (
                      <TouchableOpacity
                        key={opt.value}
                        style={[styles.accessLevelFormChip, nutritionTags.includes(opt.value) && styles.accessLevelFormChipActive]}
                        onPress={() => toggleNutritionTag(opt.value)}
                      >
                        <Text style={[styles.accessLevelFormChipText, nutritionTags.includes(opt.value) && styles.accessLevelFormChipTextActive]}>{opt.label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              )}

              <Text style={styles.label}>Entregável / Acesso</Text>
              <View style={styles.deliveryTypeRow}>
                <TouchableOpacity style={[styles.deliveryTypeChip, deliveryType === 'arquivo' && styles.deliveryTypeChipActive]} onPress={() => setDeliveryType('arquivo')}>
                  <Text style={[styles.deliveryTypeChipText, deliveryType === 'arquivo' && styles.deliveryTypeChipTextActive]}>Arquivo (PDF/E-book)</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.deliveryTypeChip, deliveryType === 'chave' && styles.deliveryTypeChipActive]} onPress={() => setDeliveryType('chave')}>
                  <Text style={[styles.deliveryTypeChipText, deliveryType === 'chave' && styles.deliveryTypeChipTextActive]}>Chave de Liberação</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.deliveryTypeChip, deliveryType === 'receitas' && styles.deliveryTypeChipActive]} onPress={() => setDeliveryType('receitas')}>
                  <Text style={[styles.deliveryTypeChipText, deliveryType === 'receitas' && styles.deliveryTypeChipTextActive]}>Pacote de Receitas Internas</Text>
                </TouchableOpacity>
              </View>

              {(deliveryType === 'arquivo' || deliveryType === 'chave') && (
                <>
                  {deliveryType === 'arquivo' && (
                    <TouchableOpacity style={styles.filePickerButton} onPress={handlePickFile} disabled={uploadingFile}>
                      {uploadingFile ? (
                        <ActivityIndicator color="#f97316" size="small" />
                      ) : (
                        <>
                          <Ionicons name="cloud-upload-outline" size={16} color="#f97316" />
                          <Text style={styles.filePickerButtonText}>{deliveryValue ? 'Trocar PDF enviado' : 'Enviar PDF'}</Text>
                        </>
                      )}
                    </TouchableOpacity>
                  )}

                  {deliveryType === 'arquivo' && deliveryValue ? (
                    <View style={styles.fileConfirmBadge}>
                      <Ionicons name="document-text-outline" size={16} color="#22c55e" />
                      <Text style={styles.fileConfirmText} numberOfLines={1}>{extractFileLabel(deliveryValue)} (Enviado com sucesso)</Text>
                      <TouchableOpacity hitSlop={8} onPress={() => setDeliveryValue('')}>
                        <Ionicons name="close-circle" size={16} color="#737373" />
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <TextInput
                      style={styles.input}
                      placeholder={deliveryType === 'arquivo' ? 'Ou cole o link do arquivo (Drive, Dropbox...)' : 'ex: RECEITAS2026'}
                      placeholderTextColor="#525252"
                      value={deliveryValue}
                      onChangeText={setDeliveryValue}
                      autoCapitalize="none"
                    />
                  )}
                </>
              )}

              {deliveryType === 'receitas' && (
                <>
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
                </>
              )}
            </>
          )}

          <Text style={styles.label}>Nível mínimo de acesso</Text>
          <Text style={styles.helperText}>Alunos com esse nível (ou o “Consultoria VIP”) já veem esse conteúdo liberado sem precisar de liberação manual. Deixe em “Nenhum” pra liberar só manualmente em “Ver Conteúdo”.</Text>
          <View style={styles.accessLevelFormRow}>
            <TouchableOpacity
              style={[styles.accessLevelFormChip, requiredAccessLevel === null && styles.accessLevelFormChipActive]}
              onPress={() => setRequiredAccessLevel(null)}
            >
              <Text style={[styles.accessLevelFormChipText, requiredAccessLevel === null && styles.accessLevelFormChipTextActive]}>Nenhum</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.accessLevelFormChip, requiredAccessLevel === 'plataforma_base' && styles.accessLevelFormChipActive]}
              onPress={() => setRequiredAccessLevel('plataforma_base')}
            >
              <Text style={[styles.accessLevelFormChipText, requiredAccessLevel === 'plataforma_base' && styles.accessLevelFormChipTextActive]}>Plataforma Base</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.accessLevelFormChip, requiredAccessLevel === 'consultoria_vip' && styles.accessLevelFormChipActive]}
              onPress={() => setRequiredAccessLevel('consultoria_vip')}
            >
              <Text style={[styles.accessLevelFormChipText, requiredAccessLevel === 'consultoria_vip' && styles.accessLevelFormChipTextActive]}>Consultoria VIP</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.label}>Categoria na Home do Aluno</Text>
          <Text style={styles.helperText}>Define em qual seção esse produto aparece na tela inicial do aluno.</Text>
          <View style={styles.accessLevelFormRow}>
            <TouchableOpacity
              style={[styles.accessLevelFormChip, category === null && styles.accessLevelFormChipActive]}
              onPress={() => setCategory(null)}
            >
              <Text style={[styles.accessLevelFormChipText, category === null && styles.accessLevelFormChipTextActive]}>Sem categoria</Text>
            </TouchableOpacity>
            {HOME_CATEGORIES.map((c) => (
              <TouchableOpacity
                key={c.value}
                style={[styles.accessLevelFormChip, category === c.value && styles.accessLevelFormChipActive]}
                onPress={() => setCategory(c.value)}
              >
                <Text style={[styles.accessLevelFormChipText, category === c.value && styles.accessLevelFormChipTextActive]}>{c.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

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
      <HeaderBack title="Produtos Adicionais" onBack={onClose} style={{ paddingHorizontal: 16 }} />

      <View style={styles.sectionToggleBox}>
        <View style={{ flex: 1 }}>
          <Text style={styles.sectionToggleLabel}>Exibir seção “Produtos Avulsos” na vitrine {savingSectionToggle && '(salvando...)'}</Text>
          <Text style={styles.helperText}>Desligue pra esconder a seção inteira da página pública sem apagar os produtos.</Text>
        </View>
        <Switch value={sectionEnabled} onValueChange={handleToggleSection} trackColor={{ false: '#292524', true: '#22c55e' }} thumbColor="#f5f5f5" />
      </View>

      <Text style={styles.hint2}>E-books, desafios avulsos e guias — tudo que não é consultoria direta. Marque "oferta complementar" pra aparecer como upsell na vitrine.</Text>

      <TouchableOpacity style={styles.newButton} onPress={handleOpenNew}>
        <Text style={styles.newButtonText}>+ Novo Produto</Text>
      </TouchableOpacity>

      {loading ? (
        <ActivityIndicator color="#f97316" style={{ marginTop: 20 }} />
      ) : (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 30 }}>
          {products.length === 0 ? (
            <Text style={styles.emptyText}>Nenhum produto cadastrado ainda.</Text>
          ) : (
            <View style={styles.productGrid}>
              {products.map((p) => {
                const meta = typeMeta(p.type);
                return (
                  <View key={p.id} style={styles.productGridCard}>
                    <View style={styles.productCoverWrap}>
                      {p.cover_image_url ? (
                        <Image source={{ uri: p.cover_image_url }} style={styles.productCoverImage} resizeMode="cover" />
                      ) : (
                        <View style={styles.productCoverPlaceholder}>
                          <Ionicons name={meta.icon} size={28} color="#f97316" />
                        </View>
                      )}
                      {p.show_as_addon && (
                        <View style={styles.addonTagOverlay}>
                          <Text style={styles.addonTagText}>UPSELL</Text>
                        </View>
                      )}
                      {!p.active && (
                        <View style={styles.inactiveOverlay}>
                          <Text style={styles.inactiveOverlayText}>INATIVO</Text>
                        </View>
                      )}
                    </View>

                    <View style={styles.productGridInfo}>
                      <Text style={styles.productGridName} numberOfLines={2}>{p.name}</Text>
                      {(p.level || p.goal) && (
                        <View style={styles.metaBadgeRow}>
                          {p.level ? <Text style={styles.metaBadge}>{PROGRAM_LEVELS.find((l) => l.value === p.level)?.label}</Text> : null}
                          {p.goal ? <Text style={styles.metaBadge}>{PROGRAM_GOALS.find((g) => g.value === p.goal)?.label}</Text> : null}
                        </View>
                      )}
                      <Text style={styles.productGridPrice}>{p.price != null ? `R$ ${Number(p.price).toFixed(2)}` : 'Consulte'}</Text>

                      <View style={styles.productGridActions}>
                        <TouchableOpacity hitSlop={6} onPress={() => handleOpenPreview(p)}>
                          <Ionicons name="eye-outline" size={18} color="#a855f7" />
                        </TouchableOpacity>
                        <TouchableOpacity hitSlop={6} onPress={() => handleOpenManage(p)}>
                          <Ionicons name="folder-outline" size={18} color="#22c55e" />
                        </TouchableOpacity>
                        <TouchableOpacity hitSlop={6} onPress={() => handleOpenEdit(p)}>
                          <Ionicons name="create-outline" size={18} color="#3b82f6" />
                        </TouchableOpacity>
                        <TouchableOpacity hitSlop={6} onPress={() => handleDelete(p.id)}>
                          <Ionicons name="trash-outline" size={18} color="#ef4444" />
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a', paddingTop: 50 },
  hint2: { color: '#737373', fontSize: 11, paddingHorizontal: 16, marginBottom: 14, lineHeight: 16 },
  sectionToggleBox: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#171717', borderWidth: 1, borderColor: '#292524', borderRadius: 12, padding: 14, marginHorizontal: 16, marginBottom: 14 },
  sectionToggleLabel: { color: '#f5f5f5', fontSize: 12, fontWeight: '700', marginBottom: 4 },
  newButton: { backgroundColor: '#f97316', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginHorizontal: 16, marginBottom: 16 },
  newButtonText: { color: '#0a0a0a', fontSize: 14, fontWeight: '700' },
  emptyText: { color: '#525252', fontSize: 13, textAlign: 'center', marginTop: 30 },
  productCard: { backgroundColor: '#171717', borderWidth: 1, borderColor: '#292524', borderRadius: 14, padding: 14, marginBottom: 12 },
  productCardTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  productIconCircle: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(249,115,22,0.12)', alignItems: 'center', justifyContent: 'center' },
  productName: { color: '#f5f5f5', fontSize: 13, fontWeight: '700' },
  productMeta: { color: '#737373', fontSize: 10, marginTop: 2 },
  addonTag: { alignSelf: 'flex-start', backgroundColor: 'rgba(34,197,94,0.12)', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, marginTop: 10 },
  addonTagText: { color: '#0a0a0a', fontSize: 9, fontWeight: '800' },
  productActionsPrimaryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#0a0a0a' },
  productActionChip: { backgroundColor: '#0a0a0a', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  productActionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, marginTop: 10 },
  previewLink: { color: '#a855f7', fontSize: 12, fontWeight: '700' },
  manageLink: { color: '#22c55e', fontSize: 12, fontWeight: '700' },
  productGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  productGridCard: { width: '47%', backgroundColor: '#171717', borderWidth: 1, borderColor: '#292524', borderRadius: 14, overflow: 'hidden' },
  productCoverWrap: { width: '100%', aspectRatio: 1, backgroundColor: '#0a0a0a', position: 'relative' },
  metaBadgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4 },
  metaBadge: { color: '#a3a3a3', fontSize: 9, fontWeight: '700', backgroundColor: '#0a0a0a', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  productCoverImage: { width: '100%', height: '100%' },
  productCoverPlaceholder: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },
  addonTagOverlay: { position: 'absolute', top: 8, left: 8, backgroundColor: 'rgba(34,197,94,0.9)', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 },
  inactiveOverlay: { position: 'absolute', top: 8, right: 8, backgroundColor: 'rgba(0,0,0,0.75)', borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3 },
  inactiveOverlayText: { color: '#a3a3a3', fontSize: 8, fontWeight: '800' },
  productGridInfo: { padding: 10 },
  productGridName: { color: '#f5f5f5', fontSize: 12, fontWeight: '700', minHeight: 32 },
  productGridPrice: { color: '#f97316', fontSize: 15, fontWeight: '800', marginTop: 6 },
  productGridActions: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#0a0a0a' },
  previewSectionLabel: { color: '#737373', fontSize: 10, textTransform: 'uppercase', marginBottom: 10 },
  saleCard: { backgroundColor: '#171717', borderWidth: 1, borderColor: '#292524', borderRadius: 16, padding: 20, alignItems: 'center' },
  saleIconCircle: { width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(249,115,22,0.12)', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  saleName: { color: '#f5f5f5', fontSize: 17, fontWeight: '800', textAlign: 'center' },
  saleDescription: { color: '#a3a3a3', fontSize: 12, textAlign: 'center', marginTop: 8, lineHeight: 18 },
  salePrice: { color: '#f97316', fontSize: 20, fontWeight: '800', marginTop: 14 },
  saleButton: { backgroundColor: '#f97316', borderRadius: 12, paddingVertical: 14, paddingHorizontal: 32, marginTop: 16 },
  saleButtonText: { color: '#0a0a0a', fontSize: 14, fontWeight: '800' },
  previewRecipeList: { backgroundColor: '#171717', borderWidth: 1, borderColor: '#292524', borderRadius: 12, padding: 8 },
  previewRecipeRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, paddingHorizontal: 6 },
  previewRecipeThumb: { width: 36, height: 36, borderRadius: 8, backgroundColor: '#0a0a0a', alignItems: 'center', justifyContent: 'center' },
  previewRecipeTitle: { color: '#f5f5f5', fontSize: 12, fontWeight: '600', flex: 1 },
  editLink: { color: '#3b82f6', fontSize: 12, fontWeight: '700' },
  deleteLink: { fontSize: 12, color: '#ef4444', fontWeight: '700' },
  studentGrantRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#171717', borderWidth: 1, borderColor: '#292524', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 8 },
  studentGrantName: { color: '#f5f5f5', fontSize: 13, fontWeight: '600' },
  grantLink: { color: '#f97316', fontSize: 12, fontWeight: '700' },
  revokeLink: { color: '#22c55e', fontSize: 11, fontWeight: '700' },
  label: { color: '#737373', fontSize: 10, textTransform: 'uppercase', marginBottom: 6, marginTop: 14 },
  coverPicker: { width: '100%', aspectRatio: 1, backgroundColor: '#171717', borderWidth: 1, borderColor: '#292524', borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 6, overflow: 'hidden' },
  coverPreview: { width: '100%', height: '100%' },
  coverPickerText: { color: '#a3a3a3', fontSize: 13, fontWeight: '600' },
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
  filePickerButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: 'rgba(249,115,22,0.1)', borderWidth: 1, borderColor: '#f97316', borderStyle: 'dashed', borderRadius: 8, paddingVertical: 12, marginBottom: 8 },
  filePickerButtonText: { color: '#f97316', fontSize: 12, fontWeight: '700' },
  fileConfirmBadge: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(34,197,94,0.1)', borderWidth: 1, borderColor: '#22c55e', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10 },
  fileConfirmText: { flex: 1, color: '#22c55e', fontSize: 12, fontWeight: '600' },
  helperText: { color: '#525252', fontSize: 11 },
  accessLevelFormRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  accessLevelFormChip: { backgroundColor: '#171717', borderWidth: 1, borderColor: '#292524', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 8 },
  accessLevelFormChipActive: { backgroundColor: '#a855f7', borderColor: '#a855f7' },
  accessLevelFormChipText: { color: '#a3a3a3', fontSize: 11, fontWeight: '600' },
  accessLevelFormChipTextActive: { color: '#0a0a0a' },
  recipeChecklist: { backgroundColor: '#171717', borderWidth: 1, borderColor: '#292524', borderRadius: 10, padding: 8 },
  recipeCheckRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, paddingHorizontal: 6 },
  checkbox: { width: 20, height: 20, borderRadius: 5, borderWidth: 1.5, borderColor: '#292524', alignItems: 'center', justifyContent: 'center' },
  checkboxChecked: { backgroundColor: '#f97316', borderColor: '#f97316' },
  recipeCheckLabel: { color: '#f5f5f5', fontSize: 12, fontWeight: '600', flexShrink: 1, flex: 1 },
  templateOrderBadge: { color: '#f97316', fontSize: 10, fontWeight: '800', backgroundColor: 'rgba(249,115,22,0.12)', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 18 },
  switchLabel: { color: '#f5f5f5', fontSize: 12, fontWeight: '600', flexShrink: 1, marginRight: 8 },
  saveButton: { backgroundColor: '#f97316', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 24 },
  saveButtonText: { color: '#0a0a0a', fontSize: 15, fontWeight: '700' },
});