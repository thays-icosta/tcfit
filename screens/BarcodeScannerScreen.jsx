import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';

export default function BarcodeScannerScreen({ onFoodFound, onClose }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [fetching, setFetching] = useState(false);

  const handleBarcodeScanned = async (result) => {
    if (scanned || fetching) return;
    setScanned(true);
    setFetching(true);

    try {
      const response = await fetch(`https://world.openfoodfacts.org/api/v2/product/${result.data}.json`);
      const json = await response.json();

      if (json.status === 1 && json.product) {
        const p = json.product;
        const n = p.nutriments || {};
        const name = p.product_name_pt || p.product_name || 'Produto sem nome';
        onFoodFound({
          barcode: result.data,
          name,
          kcal: n['energy-kcal_100g'] || 0,
          protein: n['proteins_100g'] || 0,
          carbs: n['carbohydrates_100g'] || 0,
          fat: n['fat_100g'] || 0,
        });
      } else {
        alert('Produto não encontrado nessa base de dados. Tenta buscar manualmente.');
        setScanned(false);
      }
    } catch (e) {
      alert('Erro ao consultar o produto. Confere sua conexão.');
      setScanned(false);
    }
    setFetching(false);
  };

  if (!permission) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#f97316" />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <Text style={styles.permissionText}>Precisamos da câmera pra escanear o código de barras.</Text>
        <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
          <Text style={styles.permissionButtonText}>Permitir câmera</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onClose} style={{ marginTop: 16 }}>
          <Text style={styles.cancelText}>Cancelar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        style={StyleSheet.absoluteFillObject}
        barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e'] }}
        onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
      />
      <View style={styles.overlay}>
        <View style={styles.scanFrame} />
        <Text style={styles.hintText}>Aponte a câmera pro código de barras</Text>
        {fetching && (
          <View style={styles.loadingBox}>
            <ActivityIndicator color="#f97316" />
            <Text style={styles.loadingText}>Buscando produto...</Text>
          </View>
        )}
      </View>
      <TouchableOpacity style={styles.closeButton} onPress={onClose}>
        <Text style={styles.closeButtonText}>Cancelar</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a' },
  center: { flex: 1, backgroundColor: '#0a0a0a', alignItems: 'center', justifyContent: 'center', padding: 24 },
  permissionText: { color: '#f5f5f5', fontSize: 14, textAlign: 'center', marginBottom: 16 },
  permissionButton: { backgroundColor: '#f97316', borderRadius: 10, paddingVertical: 12, paddingHorizontal: 24 },
  permissionButtonText: { color: '#0a0a0a', fontSize: 14, fontWeight: '700' },
  cancelText: { color: '#a3a3a3', fontSize: 13 },
  overlay: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scanFrame: { width: 250, height: 150, borderWidth: 2, borderColor: '#f97316', borderRadius: 12, backgroundColor: 'transparent' },
  hintText: { color: '#f5f5f5', fontSize: 13, marginTop: 20, backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  loadingBox: { marginTop: 20, alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.7)', padding: 16, borderRadius: 12 },
  loadingText: { color: '#f5f5f5', fontSize: 12, marginTop: 8 },
  closeButton: { position: 'absolute', top: 50, left: 16, backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8 },
  closeButtonText: { color: '#f97316', fontSize: 14, fontWeight: '700' },
});