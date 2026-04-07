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

  const handleSaveToInventory = async () => {
    if (!scanner.editProduct || scanner.editPrice === '---' || scanner.editPrice === '') return;

    const insertId = await saveItemToDB(scanner.editProduct, scanner.editPrice);
    if (insertId) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert('Saved!', `${scanner.editProduct} added to your list.`);
      scanner.setStructuredData(null);
      scanner.setEditProduct('');
      scanner.setEditPrice('');
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
    // Only apply safe area insets on top/sides; bottom is handled by ResultEditor
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {/* Camera — takes up roughly top 52% of the screen */}
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

      {/* Bottom sheet */}
      <ResultEditor
        scanner={scanner}
        onSave={handleSaveToInventory}
        onViewInventory={() => navigation.navigate('Inventory')}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F7F4', // Matches the sheet so seam is invisible
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
    // flex: 1 here lets the camera expand naturally;
    // ResultEditor's content is fixed-height so this takes all remaining space
    flex: 1,
    overflow: 'hidden',
    borderRadius: 24,
    marginHorizontal: 14,
    marginTop: 12,
    marginBottom: 0,
  },
});