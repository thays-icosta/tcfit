import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const WHATSAPP_NUMBER = '5537998231382';

export default function UpgradeLockModal({ visible, onClose, personalName, personalPhone, featureLabel }) {
  const handleUpgrade = () => {
    const phone = (personalPhone || WHATSAPP_NUMBER).replace(/\D/g, '') || WHATSAPP_NUMBER;
    const message = `Olá${personalName ? `, ${personalName}` : ''}! Vi que ${featureLabel} é exclusivo da Consultoria VIP e quero saber mais sobre fazer upgrade.`;
    Linking.openURL(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`).catch(() => {});
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.iconCircle}>
            <Ionicons name="lock-closed" size={26} color="#f97316" />
          </View>
          <Text style={styles.title}>Recurso Exclusivo Consultoria VIP</Text>
          <Text style={styles.text}>
            {featureLabel} é exclusivo de quem tem a Consultoria Individualizada{personalName ? ` com ${personalName}` : ''}. Fala no WhatsApp pra saber como fazer upgrade.
          </Text>
          <TouchableOpacity style={styles.upgradeButton} onPress={handleUpgrade}>
            <Ionicons name="logo-whatsapp" size={16} color="#0a0a0a" />
            <Text style={styles.upgradeButtonText}>Fazer Upgrade</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeButtonText}>Fechar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', paddingHorizontal: 24 },
  card: { backgroundColor: '#171717', borderWidth: 1, borderColor: '#f97316', borderRadius: 18, padding: 22, alignItems: 'center' },
  iconCircle: { width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(249,115,22,0.12)', alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  title: { color: '#f5f5f5', fontSize: 16, fontWeight: '800', textAlign: 'center', marginBottom: 8 },
  text: { color: '#a3a3a3', fontSize: 13, lineHeight: 19, textAlign: 'center', marginBottom: 18 },
  upgradeButton: { flexDirection: 'row', gap: 8, backgroundColor: '#f97316', borderRadius: 12, paddingVertical: 13, paddingHorizontal: 24, alignItems: 'center', justifyContent: 'center', width: '100%' },
  upgradeButtonText: { color: '#0a0a0a', fontSize: 13, fontWeight: '800' },
  closeButton: { paddingVertical: 12, marginTop: 4 },
  closeButtonText: { color: '#737373', fontSize: 12, fontWeight: '600' },
});
