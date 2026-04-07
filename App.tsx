// App.tsx
import React, { useEffect, useState, useRef } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, SafeAreaView, ActivityIndicator, Alert, TextInput, Switch } from 'react-native';
import { Camera, useCameraDevice } from 'react-native-vision-camera';
import TextRecognition from '@react-native-ml-kit/text-recognition';
import * as Haptics from 'expo-haptics'; // NEW: Haptic Feedback

import { InferenceSession } from 'onnxruntime-react-native';
import { Asset } from 'expo-asset';

import { processScannedText, ParsedProduct } from './src/utils/scannerParser';
import { initDatabase, saveItemToDB, getOfflineItems } from './src/utils/database';
import InventoryModal from './src/components/InventoryModal';

export default function App() {
  const [hasPermission, setHasPermission] = useState(false);
  const device = useCameraDevice('back');
  const cameraRef = useRef<Camera>(null);

  const [isProcessing, setIsProcessing] = useState(false);
  const [structuredData, setStructuredData] = useState<ParsedProduct | null>(null);
  const [offlineItems, setOfflineItems] = useState<any[]>([]);
  const [isModalVisible, setIsModalVisible] = useState(false);

  // Editable Text State
  const [editProduct, setEditProduct] = useState("");
  const [editPrice, setEditPrice] = useState("");

  const [onnxSession, setOnnxSession] = useState<InferenceSession | null>(null);
  const [isModelLoading, setIsModelLoading] = useState(true); 

  // NEW: UX Features State
  const [isTorchOn, setIsTorchOn] = useState(false);
  const [isContinuousMode, setIsContinuousMode] = useState(false);
  const [scanFeedback, setScanFeedback] = useState(""); // Used to show quick auto-save alerts

  useEffect(() => {
    (async () => {
      const status = await Camera.requestCameraPermission();
      setHasPermission(status === 'granted');
      await initDatabase();
      refreshInventory();

      try {
        console.log("Loading AI model...");
        const modelAsset = await Asset.loadAsync(require('./assets/models/model_quantized.onnx'));
        
        const uri = modelAsset[0].localUri;
        if (!uri) throw new Error("Model URI is null.");

        const session = await InferenceSession.create(uri);
        setOnnxSession(session);
      } catch (e) {
        console.error("❌ Failed to load AI model:", e);
      } finally {
        setIsModelLoading(false);
      }
    })();
  }, []);

  const refreshInventory = async () => {
    const items = await getOfflineItems();
    setOfflineItems(items);
  };

  const captureAndRead = async () => {
    if (!cameraRef.current || isModelLoading) return; 
    
    try {
      setIsProcessing(true);
      setStructuredData(null); 
      setScanFeedback("");

      const photo = await cameraRef.current.takePhoto({ flash: 'off' });
      const result = await TextRecognition.recognize(`file://${photo.path}`);

      if (result.blocks) {
        const parsedResults = await processScannedText(result.blocks, photo.width, photo.height, onnxSession);
        
        // FEATURE 1: HAPTIC FEEDBACK (Vibrate on successful read)
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

        setStructuredData(parsedResults);
        setEditProduct(parsedResults.product);
        setEditPrice(parsedResults.price);

        // FEATURE 2: CONTINUOUS SCANNING MODE
        if (isContinuousMode && parsedResults.price !== "---") {
          setScanFeedback(`✅ Auto-Saved: ${parsedResults.product}`);
          await saveItemToDB(parsedResults.product, parsedResults.price);
          refreshInventory();

          // Clear the screen after 1.5 seconds so they can scan the next item
          setTimeout(() => {
            setStructuredData(null);
            setEditProduct("");
            setEditPrice("");
            setScanFeedback("");
          }, 1500);
        }
      }
    } catch (error) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Error", "Something went wrong while scanning.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSaveToInventory = async () => {
    if (!editProduct || editPrice === "---" || editPrice === "") return;
    
    const insertId = await saveItemToDB(editProduct, editPrice);
    if (insertId) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      Alert.alert("Success", "Item saved offline.");
      setStructuredData(null); 
      setEditProduct("");
      setEditPrice("");
      refreshInventory();
    }
  };

  if (!hasPermission || device == null) {
    return <View style={styles.loading}><Text style={styles.loadingText}>Initializing Camera...</Text></View>;
  }

  return (
    <SafeAreaView style={styles.container}>
      
      {/* 1. CAMERA MODULE */}
      <View style={styles.cameraContainer}>
        {/* FEATURE 3: THE FLASHLIGHT (Torch) */}
        <Camera ref={cameraRef} style={StyleSheet.absoluteFill} device={device} isActive={true} photo={true} torch={isTorchOn ? 'on' : 'off'} />
        
        <View style={styles.overlay}>
          <View style={styles.targetSquare}>
            <View style={styles.bracketTopLeft} /><View style={styles.bracketTopRight} />
            <View style={styles.bracketBottomLeft} /><View style={styles.bracketBottomRight} />
          </View>
          <Text style={styles.overlayText}>
             {isModelLoading ? "Loading AI Brain..." : "Align tag inside the box"}
          </Text>
        </View>

        {/* Torch Toggle Button */}
        <TouchableOpacity style={styles.torchBtn} onPress={() => setIsTorchOn(!isTorchOn)}>
          <Text style={styles.torchText}>{isTorchOn ? "🔦 Flash: ON" : "🔦 Flash: OFF"}</Text>
        </TouchableOpacity>
      </View>

      {/* 2. RESULTS MODULE */}
      <View style={styles.uiContainer}>
        <View style={styles.resultCard}>
          <Text style={styles.label}>Product:</Text>
          <TextInput style={styles.productTextInput} value={editProduct} onChangeText={setEditProduct} placeholder="Scanning..." placeholderTextColor="#555" />
          
          <Text style={styles.label}>Price:</Text>
          <TextInput style={styles.priceTextInput} value={editPrice} onChangeText={setEditPrice} keyboardType="numeric" placeholder="---" placeholderTextColor="#555" />
          
          {/* Continuous Mode Feedback Toast */}
          {scanFeedback ? <Text style={styles.feedbackText}>{scanFeedback}</Text> : null}
        </View>

        {/* Continuous Mode Toggle */}
        <View style={styles.toggleRow}>
          <Text style={styles.toggleLabel}>Continuous Auto-Save Mode</Text>
          <Switch 
            value={isContinuousMode} 
            onValueChange={setIsContinuousMode} 
            trackColor={{ false: "#767577", true: "#81b0ff" }}
            thumbColor={isContinuousMode ? "#2196F3" : "#f4f3f4"}
          />
        </View>

        {/* 3. CONTROLS MODULE */}
        <View style={styles.controlsRow}>
          <TouchableOpacity style={[styles.btn, styles.scanBtn, isModelLoading && { backgroundColor: '#555' }]} onPress={captureAndRead} disabled={isProcessing || isModelLoading}>
            {isProcessing ? <ActivityIndicator color="white" /> : <Text style={styles.btnText}>Scan Tag</Text>}
          </TouchableOpacity>

          {/* Hide Manual Save Button if Auto-Save is ON */}
          {!isContinuousMode && editProduct && editPrice !== "---" && editPrice !== "" && (
            <TouchableOpacity style={[styles.btn, styles.saveBtn]} onPress={handleSaveToInventory}>
               <Text style={styles.btnText}>Save Item</Text>
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity style={styles.inventoryLink} onPress={() => setIsModalVisible(true)}>
          <Text style={styles.inventoryText}>View Offline Inventory ({offlineItems.length})</Text>
        </TouchableOpacity>
      </View>

      <InventoryModal visible={isModalVisible} onClose={() => setIsModalVisible(false)} items={offlineItems} onRefresh={function (): void {
        throw new Error('Function not implemented.');
      } } />

    </SafeAreaView>
  );
}

// STYLES
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#121212' },
  loading: { flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: '#FFF' },
  
  cameraContainer: { flex: 0.55, overflow: 'hidden', borderRadius: 20, margin: 10, position: 'relative' },
  overlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.3)' },
  targetSquare: { width: '70%', height: '30%', position: 'relative' },
  overlayText: { color: '#FFF', marginTop: 20, fontSize: 14, fontWeight: 'bold' },
  bracketTopLeft: { position: 'absolute', top: 0, left: 0, width: 30, height: 30, borderTopWidth: 4, borderLeftWidth: 4, borderColor: '#00FF00' },
  bracketTopRight: { position: 'absolute', top: 0, right: 0, width: 30, height: 30, borderTopWidth: 4, borderRightWidth: 4, borderColor: '#00FF00' },
  bracketBottomLeft: { position: 'absolute', bottom: 0, left: 0, width: 30, height: 30, borderBottomWidth: 4, borderLeftWidth: 4, borderColor: '#00FF00' },
  bracketBottomRight: { position: 'absolute', bottom: 0, right: 0, width: 30, height: 30, borderBottomWidth: 4, borderRightWidth: 4, borderColor: '#00FF00' },
  
  // Torch Button Styles
  torchBtn: { position: 'absolute', top: 15, right: 15, backgroundColor: 'rgba(0,0,0,0.6)', padding: 10, borderRadius: 8 },
  torchText: { color: '#FFF', fontWeight: 'bold' },

  uiContainer: { flex: 0.45, padding: 15, justifyContent: 'space-between' },
  resultCard: { backgroundColor: '#1E1E1E', padding: 20, borderRadius: 12, borderLeftWidth: 4, borderLeftColor: '#00FF00', minHeight: 160 },
  label: { color: '#888', fontSize: 12, textTransform: 'uppercase', marginBottom: 4 },
  
  // Editable Input Styles
  productTextInput: { color: '#FFF', fontSize: 20, fontWeight: 'bold', marginBottom: 15, borderBottomWidth: 1, borderBottomColor: '#333', paddingVertical: 5 },
  priceTextInput: { color: '#00FF00', fontSize: 32, fontWeight: 'bold', borderBottomWidth: 1, borderBottomColor: '#333', paddingVertical: 5 },
  feedbackText: { color: '#4CAF50', fontSize: 14, fontWeight: 'bold', textAlign: 'center', marginTop: 10 },

  // Toggle Styles
  toggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: 10, paddingHorizontal: 5 },
  toggleLabel: { color: '#FFF', fontSize: 14, fontWeight: 'bold' },

  controlsRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 5 },
  btn: { padding: 18, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  scanBtn: { backgroundColor: '#2196F3', flex: 1, marginRight: 5 },
  saveBtn: { backgroundColor: '#4CAF50', flex: 1, marginLeft: 5 },
  btnText: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },
  
  inventoryLink: { paddingVertical: 15, alignItems: 'center' },
  inventoryText: { color: '#2196F3', fontSize: 14, fontWeight: 'bold', textDecorationLine: 'underline' },
});