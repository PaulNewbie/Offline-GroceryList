import React from 'react';
import { StyleSheet, View, Text, TextInput, Switch, TouchableOpacity, ActivityIndicator } from 'react-native';

export default function ResultEditor({ scanner, onSave, onViewInventory }: any) {
  return (
    <View style={styles.container}>
      {/* Elevated Card Layout */}
      <View style={styles.card}>
        <Text style={styles.label}>Product</Text>
        <TextInput 
          style={styles.input} 
          value={scanner.editProduct} 
          onChangeText={scanner.setEditProduct} 
          placeholder="Scanning..." 
          placeholderTextColor="#71717A" 
        />
        
        <Text style={styles.label}>Price</Text>
        <TextInput 
          style={[styles.input, styles.priceInput]} 
          value={scanner.editPrice} 
          onChangeText={scanner.setEditPrice} 
          keyboardType="numeric" 
          placeholder="₱0.00" 
          placeholderTextColor="#71717A" 
        />
        
        {scanner.scanFeedback ? <Text style={styles.feedbackText}>{scanner.scanFeedback}</Text> : null}
      </View>

      {/* Toggle Row */}
      <View style={styles.toggleRow}>
        <Text style={styles.toggleLabel}>⚡ Auto-Save Mode</Text>
        <Switch 
          value={scanner.isContinuousMode} 
          onValueChange={scanner.setIsContinuousMode} 
          trackColor={{ false: "#3F3F46", true: "#34D399" }} 
          thumbColor={"#FFFFFF"} 
        />
      </View>

      {/* Premium Buttons */}
      <View style={styles.controlsRow}>
        <TouchableOpacity 
          style={[styles.btn, styles.scanBtn, scanner.isModelLoading && styles.btnDisabled]} 
          onPress={scanner.captureAndRead} 
          disabled={scanner.isProcessing || scanner.isModelLoading}
          activeOpacity={0.8}
        >
          {scanner.isProcessing ? <ActivityIndicator color="#FFF" /> : <Text style={styles.btnText}>📸 Scan Tag</Text>}
        </TouchableOpacity>

        {!scanner.isContinuousMode && scanner.editProduct && scanner.editPrice !== "---" && scanner.editPrice !== "" && (
          <TouchableOpacity 
            style={[styles.btn, styles.saveBtn]} 
            onPress={onSave}
            activeOpacity={0.8}
          >
             <Text style={styles.btnText}>💾 Save Item</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Inventory Link */}
      <TouchableOpacity style={styles.inventoryLink} onPress={onViewInventory}>
        <Text style={styles.inventoryText}>View Offline Inventory →</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 0.45, paddingHorizontal: 20, paddingTop: 10, paddingBottom: 20, justifyContent: 'space-between' },
  card: { backgroundColor: '#1C1C1E', padding: 20, borderRadius: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 5, elevation: 8 },
  label: { color: '#A1A1AA', fontSize: 13, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, fontWeight: '700' },
  
  // Tappable Input Boxes
  input: { backgroundColor: '#2C2C2E', color: '#FFFFFF', fontSize: 20, fontWeight: '600', borderRadius: 16, paddingHorizontal: 16, paddingVertical: 14, marginBottom: 16 },
  priceInput: { color: '#10B981', fontSize: 28, fontWeight: 'bold' },
  feedbackText: { color: '#10B981', fontSize: 14, fontWeight: 'bold', textAlign: 'center', marginTop: 4 },
  
  toggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#1C1C1E', padding: 16, borderRadius: 20, marginVertical: 8 },
  toggleLabel: { color: '#E4E4E7', fontSize: 15, fontWeight: '600' },
  
  controlsRow: { flexDirection: 'row', gap: 12, marginTop: 8 },
  btn: { flex: 1, paddingVertical: 18, borderRadius: 20, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4, elevation: 4 },
  scanBtn: { backgroundColor: '#3B82F6' },
  saveBtn: { backgroundColor: '#10B981' },
  btnDisabled: { backgroundColor: '#3F3F46' },
  btnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700', letterSpacing: 0.5 },
  
  inventoryLink: { paddingVertical: 16, alignItems: 'center', marginTop: 4 },
  inventoryText: { color: '#60A5FA', fontSize: 15, fontWeight: '600', textDecorationLine: 'underline' },
});