// src/screens/InventoryScreen.tsx
import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  Alert,
  Animated,
  Pressable,
} from 'react-native';
import { Swipeable, GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useIsFocused } from '@react-navigation/native';
import {
  getOfflineItems,
  updateItemInDB,
  deleteItemFromDB,
} from '../utils/database';

// ─── Constants ────────────────────────────────────────────
const BUDGET_LIMIT = 2000;

// ─── Helpers ──────────────────────────────────────────────
// Parse "₱52.00" or "₱52.00 ×3" into { unitPrice, qty }
// The ×N suffix was appended by ScannerScreen when saving.
const parseItem = (item: any): { unitPrice: number; qty: number; displayName: string } => {
  const raw: string = item.product ?? '';

  // Extract "×N" quantity suffix if present
  const qtyMatch = raw.match(/\s*[×x](\d+)\s*$/i);
  const qty = qtyMatch ? parseInt(qtyMatch[1], 10) : 1;
  const displayName = qtyMatch ? raw.replace(qtyMatch[0], '').trim() : raw;

  // Strip currency symbol and commas, then parse
  const priceStr: string = item.price ?? '0';
  const unitPrice = parseFloat(priceStr.replace(/[^0-9.]/g, '')) || 0;

  return { unitPrice, qty, displayName };
};

const formatPeso = (n: number) =>
  `₱${n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// ─── Swipe action renderers ────────────────────────────────
function RightAction(
  progress: Animated.AnimatedInterpolation<number>,
  _drag: Animated.AnimatedInterpolation<number>,
  onDelete: () => void,
) {
  const scale = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0.8, 1],
    extrapolate: 'clamp',
  });
  return (
    <TouchableOpacity style={styles.swipeDeleteBox} onPress={onDelete} activeOpacity={0.85}>
      <Animated.Text style={[styles.swipeIcon, { transform: [{ scale }] }]}>🗑</Animated.Text>
      <Animated.Text style={[styles.swipeLabel, styles.swipeDeleteLabel, { transform: [{ scale }] }]}>
        Delete
      </Animated.Text>
    </TouchableOpacity>
  );
}

function LeftAction(
  progress: Animated.AnimatedInterpolation<number>,
  _drag: Animated.AnimatedInterpolation<number>,
  onEdit: () => void,
) {
  const scale = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [0.8, 1],
    extrapolate: 'clamp',
  });
  return (
    <TouchableOpacity style={styles.swipeEditBox} onPress={onEdit} activeOpacity={0.85}>
      <Animated.Text style={[styles.swipeIcon, { transform: [{ scale }] }]}>✎</Animated.Text>
      <Animated.Text style={[styles.swipeLabel, styles.swipeEditLabel, { transform: [{ scale }] }]}>
        Edit
      </Animated.Text>
    </TouchableOpacity>
  );
}

// ─── Row component ────────────────────────────────────────
interface RowProps {
  item: any;
  onEdit: (item: any) => void;
  onDelete: (id: number, name: string) => void;
}

function ItemRow({ item, onEdit, onDelete }: RowProps) {
  const swipeRef = useRef<Swipeable>(null);
  const { unitPrice, qty, displayName } = parseItem(item);
  const lineTotal = unitPrice * qty;

  const handleEdit = () => {
    swipeRef.current?.close();
    onEdit(item);
  };

  const handleDelete = () => {
    swipeRef.current?.close();
    onDelete(item.id, displayName);
  };

  return (
    <Swipeable
      ref={swipeRef}
      friction={2}
      leftThreshold={60}
      rightThreshold={60}
      renderRightActions={(progress, drag) => RightAction(progress, drag, handleDelete)}
      renderLeftActions={(progress, drag) => LeftAction(progress, drag, handleEdit)}
      overshootRight={false}
      overshootLeft={false}
    >
      <View style={styles.card}>
        {/* Left: name + meta */}
        <View style={styles.cardLeft}>
          <Text style={styles.productName} numberOfLines={2}>{displayName}</Text>
          <Text style={styles.scannedAt}>
            {new Date(item.scanned_at).toLocaleString('en-PH', {
              month: 'short', day: 'numeric',
              hour: 'numeric', minute: '2-digit',
            })}
          </Text>

          {/* Qty badge */}
          {qty > 1 && (
            <View style={styles.qtyBadge}>
              <Text style={styles.qtyBadgeText}>×{qty} units</Text>
            </View>
          )}
        </View>

        {/* Right: unit price + line total */}
        <View style={styles.cardRight}>
          <Text style={styles.lineTotalText}>{formatPeso(lineTotal)}</Text>
          {qty > 1 && (
            <Text style={styles.unitPriceText}>{formatPeso(unitPrice)} each</Text>
          )}
        </View>
      </View>
    </Swipeable>
  );
}

// ─── Edit modal ───────────────────────────────────────────
interface EditModalProps {
  item: any | null;
  onClose: () => void;
  onSave: (id: number, product: string, price: string, qty: number) => void;
}

function EditModal({ item, onClose, onSave }: EditModalProps) {
  const { unitPrice, qty: parsedQty, displayName } = item ? parseItem(item) : { unitPrice: 0, qty: 1, displayName: '' };

  const [product, setProduct] = useState(displayName);
  const [price,   setPrice]   = useState(unitPrice > 0 ? unitPrice.toFixed(2) : '');
  const [qty,     setQty]     = useState(parsedQty);

  // Sync when item changes
  useEffect(() => {
    if (item) {
      const p = parseItem(item);
      setProduct(p.displayName);
      setPrice(p.unitPrice > 0 ? p.unitPrice.toFixed(2) : '');
      setQty(p.qty);
    }
  }, [item]);

  if (!item) return null;

  const canSave = product.trim().length > 0 && price.trim().length > 0;

  const handleSave = () => {
    if (!canSave) return;
    const productLabel = qty > 1 ? `${product.trim()} ×${qty}` : product.trim();
    onSave(item.id, productLabel, `₱${price.trim()}`, qty);
    onClose();
  };

  return (
    // Inline edit card replaces the row — rendered by FlatList caller
    <View style={styles.editCard}>
      <Text style={styles.editCardTitle}>Edit Item</Text>

      <Text style={styles.editLabel}>PRODUCT NAME</Text>
      <TextInput
        style={styles.editInput}
        value={product}
        onChangeText={setProduct}
        autoFocus
        placeholder="Product name"
        placeholderTextColor="#C4C4C4"
      />

      <View style={styles.editRow}>
        <View style={styles.editHalf}>
          <Text style={styles.editLabel}>UNIT PRICE (₱)</Text>
          <TextInput
            style={[styles.editInput, styles.editInputPrice]}
            value={price}
            onChangeText={setPrice}
            keyboardType="decimal-pad"
            placeholder="0.00"
            placeholderTextColor="#C4C4C4"
          />
        </View>
        <View style={styles.editHalf}>
          <Text style={styles.editLabel}>QUANTITY</Text>
          <View style={styles.editStepper}>
            <TouchableOpacity
              style={styles.stepBtn}
              onPress={() => setQty(q => Math.max(1, q - 1))}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.stepBtnText}>−</Text>
            </TouchableOpacity>
            <Text style={styles.stepValue}>{qty}</Text>
            <TouchableOpacity
              style={styles.stepBtn}
              onPress={() => setQty(q => q + 1)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.stepBtnText}>+</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Live line total preview */}
      <View style={styles.editTotalPreview}>
        <Text style={styles.editTotalLabel}>Line total</Text>
        <Text style={styles.editTotalValue}>
          {formatPeso((parseFloat(price) || 0) * qty)}
        </Text>
      </View>

      <View style={styles.editActions}>
        <TouchableOpacity style={styles.editCancelBtn} onPress={onClose}>
          <Text style={styles.editCancelText}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.editSaveBtn, !canSave && styles.editSaveBtnDisabled]}
          onPress={handleSave}
          disabled={!canSave}
        >
          <Text style={styles.editSaveText}>Save Changes</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Budget header ────────────────────────────────────────
interface BudgetHeaderProps {
  items: any[];
  onClearAll: () => void;
}

function BudgetHeader({ items, onClearAll }: BudgetHeaderProps) {
  // qty-aware total
  const totalSpent = items.reduce((sum, item) => {
    const { unitPrice, qty } = parseItem(item);
    return sum + unitPrice * qty;
  }, 0);

  const totalItems = items.reduce((sum, item) => {
    const { qty } = parseItem(item);
    return sum + qty;
  }, 0);

  const budgetPercent = Math.min((totalSpent / BUDGET_LIMIT) * 100, 100);
  const isOverBudget  = totalSpent > BUDGET_LIMIT;
  const remaining     = BUDGET_LIMIT - totalSpent;

  return (
    <View style={styles.budgetCard}>
      {/* Header row */}
      <View style={styles.budgetTopRow}>
        <View>
          <Text style={styles.budgetCardLabel}>BUDGET TRACKER</Text>
          <Text style={styles.budgetItemCount}>
            {items.length} {items.length === 1 ? 'product' : 'products'} · {totalItems} {totalItems === 1 ? 'unit' : 'units'}
          </Text>
        </View>
        {items.length > 0 && (
          <TouchableOpacity onPress={onClearAll} style={styles.clearAllBtn}>
            <Text style={styles.clearAllText}>Clear All</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Spent + limit */}
      <View style={styles.budgetRow}>
        <Text style={[styles.budgetSpent, isOverBudget && styles.overBudget]}>
          {formatPeso(totalSpent)}
        </Text>
        <Text style={styles.budgetLimit}> / {formatPeso(BUDGET_LIMIT)}</Text>
      </View>

      {/* Progress bar */}
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

      {/* Remaining / over budget line */}
      <Text style={[styles.remainingText, isOverBudget && styles.overBudgetText]}>
        {isOverBudget
          ? `Over budget by ${formatPeso(Math.abs(remaining))}`
          : `${formatPeso(remaining)} remaining`}
      </Text>

      {/* Swipe hint — shown until list has items */}
      {items.length > 0 && (
        <View style={styles.swipeHint}>
          <Text style={styles.swipeHintText}>← swipe to edit  ·  swipe to delete →</Text>
        </View>
      )}
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────
export default function InventoryScreen({ navigation }: any) {
  const [items,     setItems]     = useState<any[]>([]);
  const [editItem,  setEditItem]  = useState<any | null>(null);
  const isFocused = useIsFocused();

  const refresh = useCallback(async () => {
    const rows = await getOfflineItems();
    setItems(rows);
  }, []);

  useEffect(() => {
    if (isFocused) refresh();
  }, [isFocused, refresh]);

  // ── Handlers ────────────────────────────────────────────
  const handleEdit = (item: any) => setEditItem(item);

  const handleSaveEdit = async (id: number, product: string, price: string, _qty: number) => {
    await updateItemInDB(id, product, price);
    setEditItem(null);
    refresh();
  };

  const handleDelete = (id: number, name: string) => {
    Alert.alert('Remove Item', `Remove "${name}" from your list?`, [
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

  const handleClearAll = () => {
    Alert.alert(
      'Clear Everything?',
      'This will remove all items from your grocery list. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: async () => {
            for (const item of items) await deleteItemFromDB(item.id);
            refresh();
          },
        },
      ],
    );
  };

  // ── Render ───────────────────────────────────────────────
  const renderItem = ({ item }: { item: any }) => {
    // Show inline edit card for the item being edited
    if (editItem?.id === item.id) {
      return (
        <EditModal
          item={editItem}
          onClose={() => setEditItem(null)}
          onSave={handleSaveEdit}
        />
      );
    }
    return (
      <ItemRow
        item={item}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />
    );
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView style={styles.container} edges={['bottom', 'left', 'right']}>

        {items.length === 0 ? (
          // ── Empty state ──────────────────────────────────
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>🛒</Text>
            <Text style={styles.emptyTitle}>Your list is empty</Text>
            <Text style={styles.emptyBody}>
              Scan a price tag to add your first item, or add one manually.
            </Text>
            <TouchableOpacity
              style={styles.emptyBackBtn}
              onPress={() => navigation.goBack()}
            >
              <Text style={styles.emptyBackText}>Go to Scanner</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={items}
            keyExtractor={(item) => item.id.toString()}
            renderItem={renderItem}
            ListHeaderComponent={
              <BudgetHeader items={items} onClearAll={handleClearAll} />
            }
            contentContainerStyle={styles.listContainer}
            showsVerticalScrollIndicator={false}
            // Close any open swipeable when scrolling starts
            onScrollBeginDrag={() => setEditItem(null)}
          />
        )}
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}

// ─── Styles ───────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F7F4',
  },
  listContainer: {
    padding: 14,
    paddingBottom: 40,
  },

  // ── Budget card ─────────────────────────────────────────
  budgetCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  budgetTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  budgetCardLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#9CA3AF',
    letterSpacing: 0.8,
  },
  budgetItemCount: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 2,
    fontWeight: '500',
  },
  clearAllBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  clearAllText: {
    color: '#DC2626',
    fontSize: 12,
    fontWeight: '700',
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
    marginBottom: 6,
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  remainingText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4F46E5',
    marginBottom: 4,
  },
  overBudgetText: {
    color: '#DC2626',
  },
  swipeHint: {
    marginTop: 8,
    alignItems: 'center',
  },
  swipeHintText: {
    fontSize: 11,
    color: '#C4C4C4',
    fontStyle: 'italic',
    letterSpacing: 0.2,
  },

  // ── Item card ───────────────────────────────────────────
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
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
    marginBottom: 5,
  },
  qtyBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#EEF2FF',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginTop: 2,
  },
  qtyBadgeText: {
    color: '#4F46E5',
    fontSize: 11,
    fontWeight: '700',
  },
  cardRight: {
    alignItems: 'flex-end',
  },
  lineTotalText: {
    fontSize: 18,
    fontWeight: '800',
    color: '#059669',
  },
  unitPriceText: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 2,
  },

  // ── Swipe actions ───────────────────────────────────────
  swipeDeleteBox: {
    backgroundColor: '#DC2626',
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
    borderRadius: 16,
    marginBottom: 8,
  },
  swipeEditBox: {
    backgroundColor: '#4F46E5',
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
    borderRadius: 16,
    marginBottom: 8,
  },
  swipeIcon: {
    fontSize: 20,
    marginBottom: 2,
  },
  swipeLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
  swipeDeleteLabel: { color: '#FFFFFF' },
  swipeEditLabel:   { color: '#FFFFFF' },

  // ── Edit card ───────────────────────────────────────────
  editCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    marginBottom: 8,
    borderWidth: 1.5,
    borderColor: '#4F46E5',
  },
  editCardTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#4F46E5',
    marginBottom: 14,
    letterSpacing: 0.2,
  },
  editLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#9CA3AF',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  editInput: {
    backgroundColor: '#F8F7F4',
    borderRadius: 12,
    padding: 12,
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginBottom: 12,
  },
  editInputPrice: {
    color: '#059669',
    fontSize: 18,
    fontWeight: '800',
  },
  editRow: {
    flexDirection: 'row',
    gap: 10,
  },
  editHalf: { flex: 1 },
  editStepper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8F7F4',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 10,
    marginBottom: 12,
  },
  stepBtn: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  stepBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#374151',
    lineHeight: 20,
  },
  stepValue: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
    minWidth: 28,
    textAlign: 'center',
  },
  editTotalPreview: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#ECFDF5',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  editTotalLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#059669',
  },
  editTotalValue: {
    fontSize: 16,
    fontWeight: '800',
    color: '#059669',
  },
  editActions: {
    flexDirection: 'row',
    gap: 8,
  },
  editCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
  },
  editCancelText: {
    color: '#6B7280',
    fontSize: 14,
    fontWeight: '600',
  },
  editSaveBtn: {
    flex: 2,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#4F46E5',
    alignItems: 'center',
  },
  editSaveBtnDisabled: {
    backgroundColor: '#D1D5DB',
  },
  editSaveText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },

  // ── Empty state ─────────────────────────────────────────
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyIcon: {
    fontSize: 52,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 8,
  },
  emptyBody: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  emptyBackBtn: {
    backgroundColor: '#4F46E5',
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 16,
  },
  emptyBackText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});