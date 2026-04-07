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
  // We pass a blank function for refreshInventory since the Inventory screen handles its own fetching now
  const scanner = useScannerAI(() => {}); 

  const handleSaveToInventory = async () => {
    if (!scanner.editProduct || scanner.editPrice === "---" || scanner.editPrice === "") return;
    
    const insertId = await saveItemToDB(scanner.editProduct, scanner.editPrice);
    if (insertId) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Success", "Item saved offline.");
      scanner.setStructuredData(null); 
      scanner.setEditProduct("");
      scanner.setEditPrice("");
    }
  };

  if (!scanner.hasPermission || scanner.device == null) {
    return <View style={styles.loading}><Text style={styles.loadingText}>Initializing Camera...</Text></View>;
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.cameraContainer}>
        <Camera ref={scanner.cameraRef} style={StyleSheet.absoluteFill} device={scanner.device} isActive={true} photo={true} torch={scanner.isTorchOn ? 'on' : 'off'} />
        <ScannerOverlay isModelLoading={scanner.isModelLoading} isTorchOn={scanner.isTorchOn} toggleTorch={() => scanner.setIsTorchOn(!scanner.isTorchOn)} />
      </View>
      <ResultEditor scanner={scanner} onSave={handleSaveToInventory} onViewInventory={() => navigation.navigate('Inventory')} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#121212' },
  loading: { flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: '#FFF' },
  cameraContainer: { 
    flex: 1, 
    overflow: 'hidden', 
    borderRadius: 24, 
    marginHorizontal: 16, 
    marginTop: 16, 
    marginBottom: 8, 
    position: 'relative' 
  },
});