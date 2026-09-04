import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Image, Linking, Modal, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const WHATSAPP_NUMBER = '5537998231382';

// Shared "what's inside this product" sheet — unlock CTA, PDF preview/download,
// release key, or linked recipes — used anywhere a non-workout product card is
// tapped (Loja, and the Home hub/nutrition cards) so clicking never just dumps
// the student on the flat Loja list without the item they actually picked.
export default function ProductDetailModal({ product, unlocked, recipes, onSelectRecipe, onClose, personalName, personalPhone }) {
  if (!product) return null;
  const linkedRecipes = (recipes || []).filter((r) => (product.recipe_ids || []).includes(r.id));

  const handleUnlockRequest = () => {
    const phone = (personalPhone || WHATSAPP_NUMBER).replace(/\D/g, '') || WHATSAPP_NUMBER;
    const message = `Olá${personalName ? `, ${personalName}` : ''}! Vi o conteúdo "${product.name}" no app e quero desbloquear.`;
    Linking.openURL(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`).catch(() => {});
  };

  const fileUrl = product.pdf_url || (product.delivery_type === 'arquivo' ? product.delivery_value : null);

  return (
    <Modal visible={!!product} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalSheet}>
          <ScrollView>
            {product.cover_image_url ? (
              <Image source={{ uri: product.cover_image_url }} style={styles.modalCover} resizeMode="cover" />
            ) : null}
            <Text style={styles.modalTitle}>{product.name}</Text>
            {product.description ? <Text style={styles.modalDescription}>{product.description}</Text> : null}
            <Text style={styles.modalPrice}>{product.price != null ? `R$ ${Number(product.price).toFixed(2)}` : 'Consulte'}</Text>

            {unlocked ? (
              <>
                {linkedRecipes.length > 0 && (
                  <>
                    <Text style={styles.modalSectionLabel}>O que está incluso</Text>
                    {linkedRecipes.map((r) => (
                      <TouchableOpacity key={r.id} style={styles.includedRow} onPress={() => onSelectRecipe?.(r)}>
                        <Ionicons name="restaurant-outline" size={16} color="#f97316" />
                        <Text style={styles.includedRowText}>{r.title}</Text>
                        <Text style={styles.chevron}>›</Text>
                      </TouchableOpacity>
                    ))}
                  </>
                )}
                {fileUrl && (
                  <>
                    {Platform.OS === 'web' && fileUrl.toLowerCase().includes('.pdf') && (
                      <iframe
                        src={fileUrl}
                        style={{ width: '100%', height: 340, border: 'none', borderRadius: 12, marginBottom: 10, background: '#0a0a0a' }}
                        title="Pré-visualização do PDF"
                      />
                    )}
                    <TouchableOpacity style={styles.unlockButton} onPress={() => Linking.openURL(fileUrl).catch(() => {})}>
                      <Text style={styles.unlockButtonText}>
                        {fileUrl.toLowerCase().includes('.pdf') ? '📄 Abrir E-book em PDF' : '📥 Abrir Arquivo'}
                      </Text>
                    </TouchableOpacity>
                  </>
                )}
                {product.delivery_type === 'chave' && product.delivery_value && (
                  <View style={styles.keyBox}>
                    <Text style={styles.keyBoxLabel}>Chave de liberação</Text>
                    <Text style={styles.keyBoxValue}>{product.delivery_value}</Text>
                  </View>
                )}
              </>
            ) : (
              <TouchableOpacity style={styles.unlockButton} onPress={handleUnlockRequest}>
                <Ionicons name="lock-open-outline" size={16} color="#0a0a0a" />
                <Text style={styles.unlockButtonText}>Desbloquear Conteúdo / Assinar Plano</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity style={styles.modalCloseButton} onPress={onClose}>
              <Text style={styles.modalCloseButtonText}>Fechar</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: '#171717', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 40, maxHeight: '85%' },
  modalCover: { width: '100%', aspectRatio: 1, borderRadius: 12, marginBottom: 14, backgroundColor: '#0a0a0a' },
  modalTitle: { color: '#f5f5f5', fontSize: 18, fontWeight: '800', marginBottom: 6 },
  modalDescription: { color: '#a3a3a3', fontSize: 13, lineHeight: 19, marginBottom: 10 },
  modalPrice: { color: '#f97316', fontSize: 20, fontWeight: '800', marginBottom: 16 },
  modalSectionLabel: { color: '#737373', fontSize: 10, textTransform: 'uppercase', marginBottom: 8 },
  includedRow: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#0a0a0a', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 8 },
  includedRowText: { color: '#f5f5f5', fontSize: 12, fontWeight: '600', flex: 1 },
  chevron: { color: '#525252', fontSize: 18 },
  unlockButton: { flexDirection: 'row', gap: 8, backgroundColor: '#f97316', borderRadius: 12, paddingVertical: 14, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  unlockButtonText: { color: '#0a0a0a', fontSize: 14, fontWeight: '800' },
  keyBox: { backgroundColor: '#0a0a0a', borderRadius: 10, padding: 14, marginTop: 8 },
  keyBoxLabel: { color: '#737373', fontSize: 10, textTransform: 'uppercase', marginBottom: 6 },
  keyBoxValue: { color: '#22c55e', fontSize: 15, fontWeight: '800', fontFamily: 'Courier' },
  modalCloseButton: { paddingVertical: 12, alignItems: 'center', marginTop: 12 },
  modalCloseButtonText: { color: '#a3a3a3', fontSize: 13, fontWeight: '600' },
});
