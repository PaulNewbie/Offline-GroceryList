// src/screens/ScannerScreen.tsx
import React from 'react';
import { StyleSheet, View, Text, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Camera } from 'react-native-vision-camera';
import * as Haptics from 'expo-haptics';

import { useScannerAI } from '../hooks/useScannerAI';
import { saveItemToDB, getScannerTarget } from '../utils/database';
import ScannerOverlay from '../components/ScannerOverlay';
import ResultEditor from '../components/ResultEditor';

export default function ScannerScreen({ navigation }: any) {
  const scanner = useScannerAI(() => {});

  // Navigate to whichever list is currently the scanner target
  const goToList = async () => {
    const trip = await getScannerTarget();
    if (trip) {
      navigation.navigate('HomeTab', {
        screen: 'TripDetail',
        params: { tripId: trip.id },
      });
    }
  };

  const handleSaveToInventory = async () => {
    const unitPrice = parseFloat(scanner.editPrice) || 0;
    const qty       = scanner.quantity ?? 1;
    if (!scanner.editProduct || unitPrice === 0) return;

    const insertId = await saveItemToDB(scanner.editProduct, unitPrice, qty);
    if (insertId) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const label = qty > 1 ? `${scanner.editProduct} (×${qty})` : scanner.editProduct;
      Alert.alert('Saved!', `${label} added to your list.`);
      scanner.resetResult();
    }
  };

  const handleManualSave = async (product: string, unitPrice: number, qty: number) => {
    const insertId = await saveItemToDB(product, unitPrice, qty);
    if (insertId) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const label = qty > 1 ? `${product} (×${qty})` : product;
      Alert.alert('Added!', `${label} added to your list.`);
    }
  };

  if (!scanner.hasPermission || scanner.device == null) {
    return (
      <View style={styles.loading}>
        <Text style={styles.loadingText}>
          {!scanner.hasPermission
            ? '📷 Camera permission required.\nPlease allow access in Settings.'
            : 'Initializing Camera…'}
        </Text>
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
        onViewInventory={goToList}
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
    padding: 32,
  },
  loadingText: {
    color: '#6B7280',
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
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