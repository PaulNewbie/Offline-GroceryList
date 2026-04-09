// src/screens/ScannerScreen.tsx
import React from 'react';
import { StyleSheet, View, Text, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Camera } from 'react-native-vision-camera';
import * as Haptics from 'expo-haptics';

import { useScannerAI } from '../hooks/useScannerAI';
import { saveItemToDB } from '../utils/database';
import ScannerOverlay from '../components/ScannerOverlay';
import ResultEditor from '../components/ResultEditor';

export default function ScannerScreen({ navigation }: any) {
  const scanner = useScannerAI(() => {});

  // ── Save scanned result ──────────────────────────────────
  const handleSaveToInventory = async () => {
    if (!scanner.editProduct || scanner.editPrice === '---' || scanner.editPrice === '') return;

    // Append " x{qty}" to product name when qty > 1 so the list is readable
    const productLabel =
      (scanner.quantity ?? 1) > 1
        ? `${scanner.editProduct} ×${scanner.quantity}`
        : scanner.editProduct;

    const insertId = await saveItemToDB(productLabel, scanner.editPrice);
    if (insertId) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Saved!', `${productLabel} added to your list.`);
      scanner.setStructuredData(null);
      scanner.setEditProduct('');
      scanner.setEditPrice('');
      scanner.setQuantity(1);
    }
  };

  // ── Save manual entry ────────────────────────────────────
  const handleManualSave = async (product: string, price: string, qty: number) => {
    const productLabel = qty > 1 ? `${product} ×${qty}` : product;
    const insertId = await saveItemToDB(productLabel, price);
    if (insertId) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Added!', `${productLabel} added to your list.`);
    }
  };

  if (!scanner.hasPermission || scanner.device == null) {
    return (
      <View style={styles.loading}>
        <Text style={styles.loadingText}>Initializing Camera…</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.cameraContainer}>
        <Camera
          ref={scanner.cameraRef}
          style={StyleSheet.absoluteFill}
          device={scanner.device}
          isActive={true}
          photo={true}
          torch={scanner.isTorchOn ? 'on' : 'off'}
        />
        <ScannerOverlay
          isModelLoading={scanner.isModelLoading}
          isTorchOn={scanner.isTorchOn}
          toggleTorch={() => scanner.setIsTorchOn(!scanner.isTorchOn)}
        />
      </View>

      <ResultEditor
        scanner={scanner}
        onSave={handleSaveToInventory}
        onManualSave={handleManualSave}
        onViewInventory={() => navigation.navigate('Inventory')}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F7F4',
  },
  loading: {
    flex: 1,
    backgroundColor: '#F8F7F4',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#6B7280',
    fontSize: 15,
  },
  cameraContainer: {
    flex: 1,
    overflow: 'hidden',
    borderRadius: 24,
    marginHorizontal: 14,
    marginTop: 12,
    marginBottom: 0,
  },
});