import React from 'react';
import { StyleSheet, View, Text, TextInput, Switch, TouchableOpacity, ActivityIndicator } from 'react-native';

export default function ResultEditor({ scanner, onSave, onViewInventory }: any) {
  return (
    <View style={styles.uiContainer}>
      <View style={styles.resultCard}>
        <Text style={styles.label}>Product:</Text>
        <TextInput style={styles.productTextInput} value={scanner.editProduct} onChangeText={scanner.setEditProduct} placeholder="Scanning..." placeholderTextColor="#555" />
        
        <Text style={styles.label}>Price:</Text>
        <TextInput style={styles.priceTextInput} value={scanner.editPrice} onChangeText={scanner.setEditPrice} keyboardType="numeric" placeholder="---" placeholderTextColor="#555" />
        
        {scanner.scanFeedback ? <Text style={styles.feedbackText}>{scanner.scanFeedback}</Text> : null}
      </View>

      <View style={styles.toggleRow}>
        <Text style={styles.toggleLabel}>Continuous Auto-Save Mode</Text>
        <Switch value={scanner.isContinuousMode} onValueChange={scanner.setIsContinuousMode} trackColor={{ false: "#767577", true: "#81b0ff" }} thumbColor={scanner.isContinuousMode ? "#2196F3" : "#f4f3f4"} />
      </View>

      <View style={styles.controlsRow}>
        <TouchableOpacity style={[styles.btn, styles.scanBtn, scanner.isModelLoading && { backgroundColor: '#555' }]} onPress={scanner.captureAndRead} disabled={scanner.isProcessing || scanner.isModelLoading}>
          {scanner.isProcessing ? <ActivityIndicator color="white" /> : <Text style={styles.btnText}>Scan Tag</Text>}
        </TouchableOpacity>

        {!scanner.isContinuousMode && scanner.editProduct && scanner.editPrice !== "---" && scanner.editPrice !== "" && (
          <TouchableOpacity style={[styles.btn, styles.saveBtn]} onPress={onSave}>
             <Text style={styles.btnText}>Save Item</Text>
          </TouchableOpacity>
        )}
      </View>

      <TouchableOpacity style={styles.inventoryLink} onPress={onViewInventory}>
        <Text style={styles.inventoryText}>View Offline Inventory →</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  uiContainer: { flex: 0.45, padding: 15, justifyContent: 'space-between' },
  resultCard: { backgroundColor: '#1E1E1E', padding: 20, borderRadius: 12, borderLeftWidth: 4, borderLeftColor: '#00FF00', minHeight: 160 },
  label: { color: '#888', fontSize: 12, textTransform: 'uppercase', marginBottom: 4 },
  productTextInput: { color: '#FFF', fontSize: 20, fontWeight: 'bold', marginBottom: 15, borderBottomWidth: 1, borderBottomColor: '#333', paddingVertical: 5 },
  priceTextInput: { color: '#00FF00', fontSize: 32, fontWeight: 'bold', borderBottomWidth: 1, borderBottomColor: '#333', paddingVertical: 5 },
  feedbackText: { color: '#4CAF50', fontSize: 14, fontWeight: 'bold', textAlign: 'center', marginTop: 10 },
  toggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: 10, paddingHorizontal: 5 },
  toggleLabel: { color: '#FFF', fontSize: 14, fontWeight: 'bold' },
  controlsRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 5 },
  btn: { padding: 18, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  scanBtn: { backgroundColor: '#2196F3', flex: 1, marginRight: 5 },
  saveBtn: { backgroundColor: '#4CAF50', flex: 1, marginLeft: 5 },
  btnText: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },
  inventoryLink: { paddingVertical: 15, alignItems: 'center' },
  inventoryText: { color: '#2196F3', fontSize: 16, fontWeight: 'bold' },
});