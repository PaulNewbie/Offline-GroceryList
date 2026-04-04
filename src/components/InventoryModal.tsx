// src/components/InventoryModal.tsx
import React from 'react';
import { Modal, View, Text, TouchableOpacity, FlatList, StyleSheet } from 'react-native';

interface InventoryModalProps {
  visible: boolean;
  onClose: () => void;
  items: any[];
}

export default function InventoryModal({ visible, onClose, items }: InventoryModalProps) {
  return (
    <Modal visible={visible} animationType="slide" transparent={false}>
      <View style={styles.container}>
        
        {/* MODAL HEADER */}
        <View style={styles.header}>
          <Text style={styles.title}>Offline Database</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeText}>Close</Text>
          </TouchableOpacity>
        </View>

        {/* LIST OR EMPTY STATE */}
        {items.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No items saved yet.</Text>
          </View>
        ) : (
          <FlatList
            data={items}
            keyExtractor={(item) => item.id.toString()}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => (
              <View style={styles.card}>
                <View style={styles.cardInfo}>
                  <Text style={styles.productText}>{item.product}</Text>
                  <Text style={styles.dateText}>
                    {new Date(item.scanned_at).toLocaleString()}
                  </Text>
                </View>
                <Text style={styles.priceText}>{item.price}</Text>
              </View>
            )}
          />
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#121212' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderBottomColor: '#333', backgroundColor: '#1E1E1E' },
  title: { color: '#FFF', fontSize: 20, fontWeight: 'bold' },
  closeButton: { padding: 8 },
  closeText: { color: '#FF4444', fontSize: 16, fontWeight: 'bold' },
  listContent: { padding: 15, paddingBottom: 40 },
  card: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#1E1E1E', padding: 15, borderRadius: 10, marginBottom: 10, borderLeftWidth: 4, borderLeftColor: '#4CAF50' },
  cardInfo: { flex: 1, paddingRight: 10 },
  productText: { color: '#FFF', fontSize: 16, fontWeight: 'bold', marginBottom: 4 },
  dateText: { color: '#888', fontSize: 12 },
  priceText: { color: '#00FF00', fontSize: 18, fontWeight: 'bold' },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyText: { color: '#888', fontSize: 16 }
});