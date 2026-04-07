import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';

export default function ScannerOverlay({ isModelLoading, isTorchOn, toggleTorch }: any) {
  return (
    <View style={styles.overlay}>
      <View style={styles.targetSquare}>
        <View style={styles.bracketTopLeft} /><View style={styles.bracketTopRight} />
        <View style={styles.bracketBottomLeft} /><View style={styles.bracketBottomRight} />
      </View>
      <Text style={styles.overlayText}>
        {isModelLoading ? "Loading AI Brain..." : "Align tag inside the box"}
      </Text>
      
      <TouchableOpacity style={styles.torchBtn} onPress={toggleTorch}>
        <Text style={styles.torchText}>{isTorchOn ? "🔦 Flash: ON" : "🔦 Flash: OFF"}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.3)' },
  targetSquare: { width: '70%', height: '30%', position: 'relative' },
  overlayText: { color: '#FFF', marginTop: 20, fontSize: 14, fontWeight: 'bold' },
  bracketTopLeft: { position: 'absolute', top: 0, left: 0, width: 30, height: 30, borderTopWidth: 4, borderLeftWidth: 4, borderColor: '#00FF00' },
  bracketTopRight: { position: 'absolute', top: 0, right: 0, width: 30, height: 30, borderTopWidth: 4, borderRightWidth: 4, borderColor: '#00FF00' },
  bracketBottomLeft: { position: 'absolute', bottom: 0, left: 0, width: 30, height: 30, borderBottomWidth: 4, borderLeftWidth: 4, borderColor: '#00FF00' },
  bracketBottomRight: { position: 'absolute', bottom: 0, right: 0, width: 30, height: 30, borderBottomWidth: 4, borderRightWidth: 4, borderColor: '#00FF00' },
  torchBtn: { position: 'absolute', top: 15, right: 15, backgroundColor: 'rgba(0,0,0,0.6)', padding: 10, borderRadius: 8 },
  torchText: { color: '#FFF', fontWeight: 'bold' },
});