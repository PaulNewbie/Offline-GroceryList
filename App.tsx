// App.tsx
import React, { useEffect, useState, useRef } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, SafeAreaView, ActivityIndicator } from 'react-native';
import { Camera, useCameraDevice } from 'react-native-vision-camera';
import TextRecognition from '@react-native-ml-kit/text-recognition';
import { processScannedText, ParsedProduct } from './src/utils/scannerParser';

export default function App() {
  const [hasPermission, setHasPermission] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [structuredData, setStructuredData] = useState<ParsedProduct | null>(null);
  
  const device = useCameraDevice('back');
  const cameraRef = useRef<Camera>(null);

  useEffect(() => {
    (async () => {
      const status = await Camera.requestCameraPermission();
      setHasPermission(status === 'granted');
    })();
  }, []);

  const captureAndRead = async () => {
    if (!cameraRef.current) return;

    try {
      setIsProcessing(true);
      setStructuredData(null); 

      // 1. Capture the high-res photo
      const photo = await cameraRef.current.takePhoto({ flash: 'off' });
      
      // 2. Extract all text on the image
      const result = await TextRecognition.recognize(`file://${photo.path}`);

      // 3. Pass the blocks AND the photo dimensions to our new smart parser
      if (result.blocks) {
        const parsedResults = processScannedText(result.blocks, photo.width, photo.height);
        setStructuredData(parsedResults);
      }
      
    } catch (error) {
      console.error("Scanning Error: ", error);
    } finally {
      setIsProcessing(false);
    }
  };

  if (!hasPermission) return <Text style={{marginTop: 50}}>Waiting for permissions...</Text>;
  if (device == null) return <Text style={{marginTop: 50}}>No camera found</Text>;

  return (
    <SafeAreaView style={styles.container}>
      {/* CAMERA UI */}
      <View style={styles.cameraContainer}>
        <Camera 
          ref={cameraRef} 
          style={StyleSheet.absoluteFill} 
          device={device} 
          isActive={true} 
          photo={true} 
        />
        
        {/* THE SMART SQUARE OVERLAY */}
        <View style={styles.overlay}>
          <View style={styles.targetSquare}>
            <View style={styles.cornerTopLeft} />
            <View style={styles.cornerTopRight} />
            <View style={styles.cornerBottomLeft} />
            <View style={styles.cornerBottomRight} />
          </View>
          <Text style={styles.overlayText}>Align tag inside the box</Text>
        </View>
      </View>

      {/* RESULTS UI */}
      <View style={styles.uiContainer}>
        <View style={styles.resultCard}>
          <Text style={styles.resultLabel}>Product:</Text>
          <Text style={styles.resultValue}>
            {structuredData ? structuredData.product : "Waiting..."}
          </Text>
          
          <Text style={styles.resultLabel}>Price:</Text>
          <Text style={styles.resultValuePrice}>
            {structuredData ? structuredData.price : "---"}
          </Text>
        </View>

        <TouchableOpacity style={styles.button} onPress={captureAndRead} disabled={isProcessing}>
          {isProcessing ? <ActivityIndicator color="white" /> : <Text style={styles.buttonText}>Scan Tag</Text>}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#121212' },
  
  // Camera & Overlay Styles
  cameraContainer: { flex: 0.65, overflow: 'hidden', borderRadius: 20, margin: 10, position: 'relative' },
  overlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.3)' },
  targetSquare: { width: '70%', height: '30%', backgroundColor: 'transparent', position: 'relative' },
  overlayText: { color: '#FFF', marginTop: 20, fontSize: 14, fontWeight: '600', textShadowColor: '#000', textShadowOffset: { width: 1, height: 1 }, textShadowRadius: 3 },
  
  // Corner Brackets for a "Scanner" Look
  cornerTopLeft: { position: 'absolute', top: 0, left: 0, width: 30, height: 30, borderTopWidth: 4, borderLeftWidth: 4, borderColor: '#00FF00' },
  cornerTopRight: { position: 'absolute', top: 0, right: 0, width: 30, height: 30, borderTopWidth: 4, borderRightWidth: 4, borderColor: '#00FF00' },
  cornerBottomLeft: { position: 'absolute', bottom: 0, left: 0, width: 30, height: 30, borderBottomWidth: 4, borderLeftWidth: 4, borderColor: '#00FF00' },
  cornerBottomRight: { position: 'absolute', bottom: 0, right: 0, width: 30, height: 30, borderBottomWidth: 4, borderRightWidth: 4, borderColor: '#00FF00' },

  // UI Panel Styles
  uiContainer: { flex: 0.35, padding: 15, justifyContent: 'space-between' },
  resultCard: { backgroundColor: '#1E1E1E', padding: 20, borderRadius: 12, borderLeftWidth: 4, borderLeftColor: '#00FF00', shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 5 },
  resultLabel: { color: '#888', fontSize: 12, textTransform: 'uppercase', marginBottom: 4 },
  resultValue: { color: '#FFF', fontSize: 20, fontWeight: 'bold', marginBottom: 15 },
  resultValuePrice: { color: '#00FF00', fontSize: 32, fontWeight: 'bold' },
  
  button: { backgroundColor: '#2196F3', padding: 18, borderRadius: 12, alignItems: 'center' },
  buttonText: { color: 'white', fontSize: 18, fontWeight: 'bold' }
});