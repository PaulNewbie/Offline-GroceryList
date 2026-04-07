// src/screens/InventoryScreen.tsx
import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useIsFocused } from '@react-navigation/native';
import { getOfflineItems, updateItemInDB, deleteItemFromDB } from '../utils/database';

const BUDGET_LIMIT = 2000;

export default function InventoryScreen() {
  const [items, setItems] = useState<any[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editProduct, setEditProduct] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const isFocused = useIsFocused();

  const refresh = async () => {
    const rows = await getOfflineItems();
    setItems(rows);
  };

  useEffect(() => {
    if (isFocused) refresh();
  }, [isFocused]);

  // ── Budget maths ───────────────────────────────────────
  const totalSpent = items.reduce((sum, item) => {
    const n = parseFloat(item.price.replace(/[^\d.]/g, ''));
    return sum + (isNaN(n) ? 0 : n);
  }, 0);
  const budgetPercent = Math.min((totalSpent / BUDGET_LIMIT) * 100, 100);
  const isOverBudget = totalSpent > BUDGET_LIMIT;

  // ── Handlers ───────────────────────────────────────────
  const startEdit = (item: any) => {
    setEditingId(item.id);
    setEditProduct(item.product);
    setEditPrice(item.price);
  };

  const saveEdit = async () => {
    if (!editingId) return;
    await updateItemInDB(editingId, editProduct, editPrice);
    setEditingId(null);
    refresh();
  };

  const handleDelete = (id: number, product: string) => {
    Alert.alert('Remove Item', `Remove "${product}" from your list?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          await deleteItemFromDB(id);
          refresh();
        },
      },
    ]);
  };

  // ── Row render ─────────────────────────────────────────
  const renderItem = ({ item }: any) => {
    const isEditing = editingId === item.id;

    if (isEditing) {
      return (
        <View style={[styles.card, styles.cardEditing]}>
          <Text style={styles.editingLabel}>PRODUCT</Text>
          <TextInput
            style={styles.editInput}
            value={editProduct}
            onChangeText={setEditProduct}
            autoFocus
          />
          <Text style={[styles.editingLabel, { marginTop: 8 }]}>PRICE</Text>
          <TextInput
            style={[styles.editInput, styles.editInputPrice]}
            value={editPrice}
            onChangeText={setEditPrice}
            keyboardType="numbers-and-punctuation"
          />
          <View style={styles.editActions}>
            <TouchableOpacity
              style={styles.editCancelBtn}
              onPress={() => setEditingId(null)}
            >
              <Text style={styles.editCancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.editSaveBtn} onPress={saveEdit}>
              <Text style={styles.editSaveText}>Save</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    return (
      <View style={styles.card}>
        <View style={styles.cardLeft}>
          <Text style={styles.productName} numberOfLines={2}>{item.product}</Text>
          <Text style={styles.scannedAt}>
            {new Date(item.scanned_at).toLocaleString('en-PH', {
              month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
            })}
          </Text>
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[styles.actionBtn, styles.actionEdit]}
              onPress={() => startEdit(item)}
            >
              <Text style={styles.actionEditText}>Edit</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, styles.actionDelete]}
              onPress={() => handleDelete(item.id, item.product)}
            >
              <Text style={styles.actionDeleteText}>Delete</Text>
            </TouchableOpacity>
          </View>
        </View>
        <Text style={styles.priceText}>{item.price}</Text>
      </View>
    );
  };

  // ── List header: budget tracker ───────────────────────
  const ListHeader = () => (
    <View style={styles.budgetCard}>
      <Text style={styles.budgetLabel}>BUDGET TRACKER</Text>
      <View style={styles.budgetRow}>
        <Text style={[styles.budgetSpent, isOverBudget && styles.overBudget]}>
          ₱{totalSpent.toFixed(2)}
        </Text>
        <Text style={styles.budgetLimit}> / ₱{BUDGET_LIMIT.toLocaleString()}.00</Text>
      </View>
      <View style={styles.progressBg}>
        <View
          style={[
            styles.progressFill,
            {
              width: `${budgetPercent}%` as any,
              backgroundColor: isOverBudget ? '#DC2626' : '#4F46E5',
            },
          ]}
        />
      </View>
      {isOverBudget && (
        <Text style={styles.overBudgetWarning}>
          Over budget by ₱{(totalSpent - BUDGET_LIMIT).toFixed(2)}
        </Text>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['bottom', 'left', 'right']}>
      {items.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>🛒</Text>
          <Text style={styles.emptyTitle}>Your list is empty</Text>
          <Text style={styles.emptyBody}>Scan a price tag to add your first item.</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderItem}
          ListHeaderComponent={<ListHeader />}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F7F4',
  },

  // ── Budget card ────────────────────────────────────────
  budgetCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  budgetLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#9CA3AF',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  budgetRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 10,
  },
  budgetSpent: {
    fontSize: 30,
    fontWeight: '800',
    color: '#111827',
  },
  budgetLimit: {
    fontSize: 14,
    color: '#9CA3AF',
  },
  overBudget: {
    color: '#DC2626',
  },
  progressBg: {
    height: 6,
    backgroundColor: '#F3F4F6',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  overBudgetWarning: {
    color: '#DC2626',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 6,
  },

  // ── List ───────────────────────────────────────────────
  listContainer: {
    padding: 14,
    paddingBottom: 32,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 14,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#F3F4F6',
    borderLeftWidth: 3,
    borderLeftColor: '#4F46E5',
  },
  cardEditing: {
    flexDirection: 'column',
    alignItems: 'stretch',
    borderLeftColor: '#4F46E5',
  },
  cardLeft: {
    flex: 1,
    paddingRight: 12,
  },
  productName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 3,
    lineHeight: 20,
  },
  scannedAt: {
    fontSize: 11,
    color: '#9CA3AF',
    marginBottom: 8,
  },
  priceText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#059669',
  },

  // ── Row actions ───────────────────────────────────────
  actionRow: {
    flexDirection: 'row',
    gap: 6,
  },
  actionBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  actionEdit: {
    backgroundColor: '#EEF2FF',
  },
  actionEditText: {
    color: '#4F46E5',
    fontSize: 11,
    fontWeight: '700',
  },
  actionDelete: {
    backgroundColor: '#FEF2F2',
  },
  actionDeleteText: {
    color: '#DC2626',
    fontSize: 11,
    fontWeight: '700',
  },

  // ── Inline edit mode ──────────────────────────────────
  editingLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#9CA3AF',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  editInput: {
    backgroundColor: '#F8F7F4',
    borderRadius: 10,
    padding: 10,
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  editInputPrice: {
    color: '#059669',
    fontSize: 18,
    fontWeight: '800',
  },
  editActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 12,
  },
  editCancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
  },
  editCancelText: {
    color: '#6B7280',
    fontWeight: '600',
    fontSize: 14,
  },
  editSaveBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#4F46E5',
  },
  editSaveText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },

  // ── Empty state ───────────────────────────────────────
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 6,
  },
  emptyBody: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
  },
});