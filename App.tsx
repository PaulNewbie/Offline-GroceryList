// App.tsx
import React, { useEffect, useState, useRef } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, SafeAreaView, ActivityIndicator, Alert } from 'react-native';
import { Camera, useCameraDevice } from 'react-native-vision-camera';
import TextRecognition from '@react-native-ml-kit/text-recognition';

// NEW: Import the ONNX runtime and Expo File System
import { InferenceSession } from 'onnxruntime-react-native';
import { Asset } from 'expo-asset';

// Extracted Logic & Components
import { processScannedText, ParsedProduct } from './src/utils/scannerParser';
import { initDatabase, saveItemToDB, getOfflineItems } from './src/utils/database';
import InventoryModal from './src/components/InventoryModal';

export default function App() {
  // Hardware State
  const [hasPermission, setHasPermission] = useState(false);
  const device = useCameraDevice('back');
  const cameraRef = useRef<Camera>(null);

  // App State
  const [isProcessing, setIsProcessing] = useState(false);
  const [structuredData, setStructuredData] = useState<ParsedProduct | null>(null);
  
  // Database UI State
  const [offlineItems, setOfflineItems] = useState<any[]>([]);
  const [isModalVisible, setIsModalVisible] = useState(false);

  // NEW: State to hold the loaded AI Brain and track its loading status
  const [onnxSession, setOnnxSession] = useState<InferenceSession | null>(null);
  const [isModelLoading, setIsModelLoading] = useState(true); 

  useEffect(() => {
    (async () => {
      // 1. Request Hardware Permissions
      const status = await Camera.requestCameraPermission();
      setHasPermission(status === 'granted');
      
      // 2. Initialize the Offline Database
      await initDatabase();
      refreshInventory();

      // 3. Load the AI Brain into RAM on startup
      try {
        console.log("Loading AI model...");
        const modelAsset = await Asset.loadAsync(require('./assets/models/model_quantized.onnx'));
        
        // NEW FIX: Extract the URI and prove to TypeScript it is not null
        const uri = modelAsset[0].localUri;
        if (!uri) {
          throw new Error("Model URI is null. Asset failed to bundle correctly.");
        }

        const session = await InferenceSession.create(uri);
        setOnnxSession(session);
        console.log("✅ ONNX AI Brain successfully loaded!");
      } catch (e) {
        console.error("❌ Failed to load AI model:", e);
      } finally {
        setIsModelLoading(false); // Enable the scan button once loaded
      }
    })();
  }, []);

  const refreshInventory = async () => {
    const items = await getOfflineItems();
    setOfflineItems(items);
  };

  const captureAndRead = async () => {
    // Prevent scanning if camera is off or AI isn't loaded yet
    if (!cameraRef.current || isModelLoading) return; 
    
    try {
      setIsProcessing(true);
      setStructuredData(null); 
      const photo = await cameraRef.current.takePhoto({ flash: 'off' });
      const result = await TextRecognition.recognize(`file://${photo.path}`);

      if (result.blocks) {
        // NEW: Ensure we await processScannedText and pass the AI session
        const parsedResults = await processScannedText(
          result.blocks, 
          photo.width, 
          photo.height, 
          onnxSession
        );
        setStructuredData(parsedResults);
      }
    } catch (error) {
      console.error("Scanning Error: ", error);
      Alert.alert("Error", "Something went wrong while scanning.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSaveToInventory = async () => {
    if (!structuredData || structuredData.price === "---") return;
    
    const insertId = await saveItemToDB(structuredData.product, structuredData.price);
    if (insertId) {
      Alert.alert("Success", "Item saved offline.");
      setStructuredData(null); 
      refreshInventory();
    }
  };

  if (!hasPermission || device == null) {
    return (
      <View style={styles.loading}>
        <Text style={styles.loadingText}>Initializing Camera...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      
      {/* 1. CAMERA MODULE */}
      <View style={styles.cameraContainer}>
        <Camera ref={cameraRef} style={StyleSheet.absoluteFill} device={device} isActive={true} photo={true} />
        <View style={styles.overlay}>
          <View style={styles.targetSquare}>
            <View style={styles.bracketTopLeft} /><View style={styles.bracketTopRight} />
            <View style={styles.bracketBottomLeft} /><View style={styles.bracketBottomRight} />
          </View>
          <Text style={styles.overlayText}>
             {isModelLoading ? "Loading AI Brain..." : "Align tag inside the box"}
          </Text>
        </View>
      </View>

      {/* 2. RESULTS MODULE */}
      <View style={styles.uiContainer}>
        <View style={styles.resultCard}>
          <Text style={styles.label}>Product:</Text>
          <Text style={styles.productText}>{structuredData ? structuredData.product : "Waiting..."}</Text>
          <Text style={styles.label}>Price:</Text>
          <Text style={styles.priceText}>{structuredData ? structuredData.price : "---"}</Text>
        </View>

        {/* 3. CONTROLS MODULE */}
        <View style={styles.controlsRow}>
          <TouchableOpacity 
            style={[styles.btn, styles.scanBtn, isModelLoading && { backgroundColor: '#555' }]} 
            onPress={captureAndRead} 
            disabled={isProcessing || isModelLoading}
          >
            {isProcessing ? <ActivityIndicator color="white" /> : <Text style={styles.btnText}>Scan Tag</Text>}
          </TouchableOpacity>

          {structuredData && structuredData.price !== "---" && (
            <TouchableOpacity style={[styles.btn, styles.saveBtn]} onPress={handleSaveToInventory}>
               <Text style={styles.btnText}>Save Item</Text>
            </TouchableOpacity>
          )}
        </View>

        <TouchableOpacity style={styles.inventoryLink} onPress={() => setIsModalVisible(true)}>
          <Text style={styles.inventoryText}>View Offline Inventory ({offlineItems.length})</Text>
        </TouchableOpacity>
      </View>

      {/* 4. INVENTORY OVERLAY (Refactored) */}
      <InventoryModal 
        visible={isModalVisible} 
        onClose={() => setIsModalVisible(false)} 
        items={offlineItems} 
      />

    </SafeAreaView>
  );
}

// STYLES
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#121212' },
  loading: { flex: 1, backgroundColor: '#000', justifyContent: 'center', alignItems: 'center' },
  loadingText: { color: '#FFF' },
  
  cameraContainer: { flex: 0.60, overflow: 'hidden', borderRadius: 20, margin: 10, position: 'relative' },
  overlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.3)' },
  targetSquare: { width: '70%', height: '30%', position: 'relative' },
  overlayText: { color: '#FFF', marginTop: 20, fontSize: 14, fontWeight: 'bold' },
  bracketTopLeft: { position: 'absolute', top: 0, left: 0, width: 30, height: 30, borderTopWidth: 4, borderLeftWidth: 4, borderColor: '#00FF00' },
  bracketTopRight: { position: 'absolute', top: 0, right: 0, width: 30, height: 30, borderTopWidth: 4, borderRightWidth: 4, borderColor: '#00FF00' },
  bracketBottomLeft: { position: 'absolute', bottom: 0, left: 0, width: 30, height: 30, borderBottomWidth: 4, borderLeftWidth: 4, borderColor: '#00FF00' },
  bracketBottomRight: { position: 'absolute', bottom: 0, right: 0, width: 30, height: 30, borderBottomWidth: 4, borderRightWidth: 4, borderColor: '#00FF00' },

  uiContainer: { flex: 0.40, padding: 15, justifyContent: 'space-between' },
  resultCard: { backgroundColor: '#1E1E1E', padding: 20, borderRadius: 12, borderLeftWidth: 4, borderLeftColor: '#00FF00' },
  label: { color: '#888', fontSize: 12, textTransform: 'uppercase', marginBottom: 4 },
  productText: { color: '#FFF', fontSize: 20, fontWeight: 'bold', marginBottom: 15 },
  priceText: { color: '#00FF00', fontSize: 32, fontWeight: 'bold' },
  
  controlsRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 15 },
  btn: { padding: 18, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  scanBtn: { backgroundColor: '#2196F3', flex: 1, marginRight: 5 },
  saveBtn: { backgroundColor: '#4CAF50', flex: 1, marginLeft: 5 },
  btnText: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },
  
  inventoryLink: { paddingVertical: 15, alignItems: 'center' },
  inventoryText: { color: '#2196F3', fontSize: 14, fontWeight: 'bold', textDecorationLine: 'underline' },
});