// src/components/InventoryModal.tsx
import React, { useState } from 'react';
import { Modal, View, Text, TouchableOpacity, FlatList, StyleSheet, TextInput, Alert } from 'react-native';
import { updateItemInDB, deleteItemFromDB } from '../utils/database';

interface InventoryModalProps {
  visible: boolean;
  onClose: () => void;
  items: any[];
  onRefresh: () => void; // New prop so we can refresh the list after an edit
}

export default function InventoryModal({ visible, onClose, items, onRefresh }: InventoryModalProps) {
  // Budget State (You can make this user-editable later)
  const BUDGET_LIMIT = 2000; 

  // Rapid Correction State
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editProduct, setEditProduct] = useState('');
  const [editPrice, setEditPrice] = useState('');

  // Calculate Running Total by stripping non-numeric characters (except decimals)
  const totalSpent = items.reduce((sum, item) => {
    const numericPrice = parseFloat(item.price.replace(/[^\d.]/g, ''));
    return sum + (isNaN(numericPrice) ? 0 : numericPrice);
  }, 0);

  const budgetPercent = Math.min((totalSpent / BUDGET_LIMIT) * 100, 100);
  const isOverBudget = totalSpent > BUDGET_LIMIT;

  // --- Handlers ---
  const startEditing = (item: any) => {
    setEditingId(item.id);
    setEditProduct(item.product);
    setEditPrice(item.price);
  };

  const handleSaveEdit = async () => {
    if (editingId) {
      await updateItemInDB(editingId, editProduct, editPrice);
      setEditingId(null);
      onRefresh(); // Tell App.tsx to fetch fresh data
    }
  };

  const handleDelete = async (id: number) => {
    Alert.alert("Remove Item", "Are you sure you want to delete this from your list?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => {
          await deleteItemFromDB(id);
          onRefresh();
        } 
      }
    ]);
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={false}>
      <View style={styles.container}>
        
        {/* HEADER */}
        <View style={styles.header}>
          <Text style={styles.title}>Grocery List</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeText}>Close</Text>
          </TouchableOpacity>
        </View>

        {/* BUDGET TRACKER */}
        <View style={styles.budgetContainer}>
          <Text style={styles.budgetLabel}>Budget Tracker</Text>
          <View style={styles.budgetRow}>
            <Text style={[styles.totalSpent, isOverBudget && styles.overBudgetText]}>
              ₱{totalSpent.toFixed(2)}
            </Text>
            <Text style={styles.budgetLimit}>/ ₱{BUDGET_LIMIT.toFixed(2)}</Text>
          </View>
          
          <View style={styles.progressBarBg}>
            <View style={[
              styles.progressBarFill, 
              { width: `${budgetPercent}%`, backgroundColor: isOverBudget ? '#FF4444' : '#4CAF50' }
            ]} />
          </View>
        </View>

        {/* ITEM LIST */}
        {items.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No items saved yet.</Text>
          </View>
        ) : (
          <FlatList
            data={items}
            keyExtractor={(item) => item.id.toString()}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => {
              const isEditing = editingId === item.id;

              return (
                <View style={[styles.card, isEditing && styles.editingCard]}>
                  {isEditing ? (
                    // RAPID CORRECTION UI
                    <View style={styles.editModeContainer}>
                      <TextInput 
                        style={styles.input} 
                        value={editProduct} 
                        onChangeText={setEditProduct}
                        placeholder="Product Name"
                        placeholderTextColor="#888"
                      />
                      <TextInput 
                        style={styles.input} 
                        value={editPrice} 
                        onChangeText={setEditPrice}
                        placeholder="Price"
                        placeholderTextColor="#888"
                        keyboardType="numbers-and-punctuation"
                      />
                      <View style={styles.actionRow}>
                        <TouchableOpacity onPress={() => setEditingId(null)} style={styles.cancelBtn}>
                          <Text style={styles.btnText}>Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={handleSaveEdit} style={styles.saveBtn}>
                          <Text style={styles.btnText}>Save</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ) : (
                    // NORMAL READ-ONLY UI
                    <>
                      <View style={styles.cardInfo}>
                        <Text style={styles.productText}>{item.product}</Text>
                        <Text style={styles.dateText}>
                          {new Date(item.scanned_at).toLocaleString()}
                        </Text>
                      </View>
                      <View style={styles.rightActions}>
                        <Text style={styles.priceText}>{item.price}</Text>
                        <View style={styles.iconRow}>
                           <TouchableOpacity onPress={() => startEditing(item)} style={styles.iconBtn}>
                             <Text style={styles.editText}>Edit</Text>
                           </TouchableOpacity>
                           <TouchableOpacity onPress={() => handleDelete(item.id)} style={styles.iconBtn}>
                             <Text style={styles.deleteText}>Del</Text>
                           </TouchableOpacity>
                        </View>
                      </View>
                    </>
                  )}
                </View>
              );
            }}
          />
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#121212' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingTop: 50, borderBottomWidth: 1, borderBottomColor: '#333', backgroundColor: '#1E1E1E' },
  title: { color: '#FFF', fontSize: 20, fontWeight: 'bold' },
  closeButton: { padding: 8 },
  closeText: { color: '#FF4444', fontSize: 16, fontWeight: 'bold' },
  
  budgetContainer: { padding: 20, backgroundColor: '#1E1E1E', borderBottomWidth: 1, borderBottomColor: '#333' },
  budgetLabel: { color: '#888', fontSize: 12, textTransform: 'uppercase', marginBottom: 5 },
  budgetRow: { flexDirection: 'row', alignItems: 'baseline', marginBottom: 10 },
  totalSpent: { color: '#FFF', fontSize: 32, fontWeight: 'bold' },
  overBudgetText: { color: '#FF4444' },
  budgetLimit: { color: '#888', fontSize: 16, marginLeft: 5 },
  progressBarBg: { height: 10, backgroundColor: '#333', borderRadius: 5, overflow: 'hidden' },
  progressBarFill: { height: '100%', borderRadius: 5 },

  listContent: { padding: 15, paddingBottom: 40 },
  card: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#1E1E1E', padding: 15, borderRadius: 10, marginBottom: 10, borderLeftWidth: 4, borderLeftColor: '#4CAF50' },
  editingCard: { borderLeftColor: '#2196F3', flexDirection: 'column' },
  cardInfo: { flex: 1, paddingRight: 10 },
  productText: { color: '#FFF', fontSize: 16, fontWeight: 'bold', marginBottom: 4 },
  dateText: { color: '#888', fontSize: 12 },
  
  rightActions: { alignItems: 'flex-end' },
  priceText: { color: '#00FF00', fontSize: 18, fontWeight: 'bold', marginBottom: 5 },
  iconRow: { flexDirection: 'row', gap: 10 },
  iconBtn: { padding: 5 },
  editText: { color: '#2196F3', fontSize: 14, fontWeight: 'bold' },
  deleteText: { color: '#FF4444', fontSize: 14, fontWeight: 'bold' },

  editModeContainer: { width: '100%' },
  input: { backgroundColor: '#333', color: '#FFF', padding: 10, borderRadius: 8, marginBottom: 10, fontSize: 16 },
  actionRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10 },
  cancelBtn: { padding: 10 },
  saveBtn: { backgroundColor: '#2196F3', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8 },
  btnText: { color: '#FFF', fontWeight: 'bold' },

  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { color: '#888', fontSize: 16 }
});