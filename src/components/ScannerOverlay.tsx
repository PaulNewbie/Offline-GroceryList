import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';

export default function ScannerOverlay({ isModelLoading, isTorchOn, toggleTorch }: any) {
  return (
    <View style={styles.overlay}>
      {/* Sleek Target Square */}
      <View style={styles.targetSquare}>
        <View style={styles.bracketTopLeft} /><View style={styles.bracketTopRight} />
        <View style={styles.bracketBottomLeft} /><View style={styles.bracketBottomRight} />
      </View>
      
      {/* Blurred, elegant text pill */}
      <Text style={styles.overlayText}>
        {isModelLoading ? "⏳ Warming up AI..." : "Align tag inside the box"}
      </Text>
      
      {/* Modern Floating Action Pill */}
      <TouchableOpacity 
        style={[styles.torchBtn, isTorchOn && styles.torchBtnActive]} 
        onPress={toggleTorch}
        activeOpacity={0.7}
      >
        <Text style={styles.torchText}>{isTorchOn ? "🔦 ON" : "🔦 OFF"}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.45)' },
  targetSquare: { width: 260, height: 160, position: 'relative' },
  overlayText: { color: '#FFFFFF', marginTop: 32, fontSize: 15, fontWeight: '600', letterSpacing: 0.5, backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, overflow: 'hidden' },
  
  // Sleek white brackets instead of neon green
  bracketTopLeft: { position: 'absolute', top: 0, left: 0, width: 40, height: 40, borderTopWidth: 4, borderLeftWidth: 4, borderColor: '#FFFFFF', borderTopLeftRadius: 16 },
  bracketTopRight: { position: 'absolute', top: 0, right: 0, width: 40, height: 40, borderTopWidth: 4, borderRightWidth: 4, borderColor: '#FFFFFF', borderTopRightRadius: 16 },
  bracketBottomLeft: { position: 'absolute', bottom: 0, left: 0, width: 40, height: 40, borderBottomWidth: 4, borderLeftWidth: 4, borderColor: '#FFFFFF', borderBottomLeftRadius: 16 },
  bracketBottomRight: { position: 'absolute', bottom: 0, right: 0, width: 40, height: 40, borderBottomWidth: 4, borderRightWidth: 4, borderColor: '#FFFFFF', borderBottomRightRadius: 16 },
  
  // Torch Button
  torchBtn: { position: 'absolute', top: 40, right: 20, backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 16, paddingVertical: 12, borderRadius: 30, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  torchBtnActive: { backgroundColor: 'rgba(245, 158, 11, 0.8)', borderColor: '#F59E0B' }, // Warm amber when on
  torchText: { color: '#FFF', fontWeight: 'bold', fontSize: 14 },
});