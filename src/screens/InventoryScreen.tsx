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
  Platform,
  Animated,
} from 'react-native';
import { Swipeable, GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useIsFocused } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  getOfflineItems,
  updateItemInDB,
  deleteItemFromDB,
} from '../utils/database';

// ─── Constants ────────────────────────────────────────────────────────────────
const DEFAULT_BUDGET  = 2000;
const BUDGET_KEY      = 'grocery_budget';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const formatPeso = (n: number) =>
  `₱${n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// ─── Swipe actions ────────────────────────────────────────────────────────────
function RightDeleteAction(
  progress: Animated.AnimatedInterpolation<number>,
  onDelete: () => void,
) {
  const scale = progress.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1], extrapolate: 'clamp' });
  return (
    <TouchableOpacity style={styles.swipeDeleteBox} onPress={onDelete} activeOpacity={0.85}>
      <Animated.Text style={[styles.swipeIcon, { transform: [{ scale }] }]}>🗑</Animated.Text>
      <Animated.Text style={[styles.swipeActionLabel, { transform: [{ scale }] }]}>Delete</Animated.Text>
    </TouchableOpacity>
  );
}

function LeftEditAction(
  progress: Animated.AnimatedInterpolation<number>,
  onEdit: () => void,
) {
  const scale = progress.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1], extrapolate: 'clamp' });
  return (
    <TouchableOpacity style={styles.swipeEditBox} onPress={onEdit} activeOpacity={0.85}>
      <Animated.Text style={[styles.swipeIcon, { transform: [{ scale }] }]}>✎</Animated.Text>
      <Animated.Text style={[styles.swipeActionLabel, { transform: [{ scale }] }]}>Edit</Animated.Text>
    </TouchableOpacity>
  );
}

// ─── Item row ─────────────────────────────────────────────────────────────────
interface RowProps {
  item: any;
  isEditing: boolean;
  onEdit: (item: any) => void;
  onDelete: (id: number, name: string) => void;
  onSaveEdit: (id: number, product: string, unitPrice: number, qty: number) => void;
  onCancelEdit: () => void;
}

function ItemRow({ item, isEditing, onEdit, onDelete, onSaveEdit, onCancelEdit }: RowProps) {
  const swipeRef = useRef<Swipeable>(null);

  // Local edit state — initialised from the item's real DB columns
  const [editProduct,  setEditProduct]  = useState(item.product ?? '');
  const [editPrice,    setEditPrice]    = useState(
    item.unit_price > 0 ? item.unit_price.toFixed(2) : '',
  );
  const [editQty, setEditQty] = useState<number>(item.quantity ?? 1);

  // Sync if item changes externally
  useEffect(() => {
    setEditProduct(item.product ?? '');
    setEditPrice(item.unit_price > 0 ? item.unit_price.toFixed(2) : '');
    setEditQty(item.quantity ?? 1);
  }, [item]);

  const unitPrice  = item.unit_price  ?? 0;
  const qty        = item.quantity    ?? 1;
  const lineTotal  = unitPrice * qty;

  const editUnitPrice = parseFloat(editPrice) || 0;
  const editLineTotal = editUnitPrice * editQty;
  const canSave       = editProduct.trim().length > 0 && editUnitPrice > 0;

  const handleEdit = () => {
    swipeRef.current?.close();
    onEdit(item);
  };
  const handleDelete = () => {
    swipeRef.current?.close();
    onDelete(item.id, item.product);
  };
  const handleSave = () => {
    if (!canSave) return;
    onSaveEdit(item.id, editProduct.trim(), editUnitPrice, editQty);
  };

  // ── Inline edit mode ────────────────────────────────────
  if (isEditing) {
    return (
      <View style={styles.editCard}>
        <Text style={styles.editCardTitle}>Edit Item</Text>

        <Text style={styles.fieldLabel}>PRODUCT NAME</Text>
        <TextInput
          style={styles.editInput}
          value={editProduct}
          onChangeText={setEditProduct}
          autoFocus
          placeholder="Product name"
          placeholderTextColor="#C4C4C4"
        />

        <View style={styles.editRow}>
          <View style={styles.editHalf}>
            <Text style={styles.fieldLabel}>UNIT PRICE (₱)</Text>
            <TextInput
              style={[styles.editInput, styles.editInputPrice]}
              value={editPrice}
              onChangeText={setEditPrice}
              keyboardType="decimal-pad"
              placeholder="0.00"
              placeholderTextColor="#C4C4C4"
            />
          </View>
          <View style={styles.editHalf}>
            <Text style={styles.fieldLabel}>QUANTITY</Text>
            <View style={styles.editStepper}>
              <TouchableOpacity
                style={styles.stepBtn}
                onPress={() => setEditQty(q => Math.max(1, q - 1))}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={styles.stepBtnText}>−</Text>
              </TouchableOpacity>
              <Text style={styles.stepValue}>{editQty}</Text>
              <TouchableOpacity
                style={styles.stepBtn}
                onPress={() => setEditQty(q => q + 1)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={styles.stepBtnText}>+</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Live line total preview */}
        {editUnitPrice > 0 && (
          <View style={styles.editTotalPreview}>
            <Text style={styles.editTotalLabel}>Line total</Text>
            <Text style={styles.editTotalValue}>{formatPeso(editLineTotal)}</Text>
          </View>
        )}

        <View style={styles.editActions}>
          <TouchableOpacity style={styles.editCancelBtn} onPress={onCancelEdit}>
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

  // ── Normal read-only row ─────────────────────────────────
  return (
    <Swipeable
      ref={swipeRef}
      friction={2}
      leftThreshold={60}
      rightThreshold={60}
      renderLeftActions={(progress) => LeftEditAction(progress, handleEdit)}
      renderRightActions={(progress) => RightDeleteAction(progress, handleDelete)}
      overshootLeft={false}
      overshootRight={false}
    >
      <View style={styles.card}>
        <View style={styles.cardLeft}>
          <Text style={styles.productName} numberOfLines={2}>{item.product}</Text>
          <Text style={styles.scannedAt}>
            {new Date(item.scanned_at).toLocaleString('en-PH', {
              month: 'short', day: 'numeric',
              hour: 'numeric', minute: '2-digit',
            })}
          </Text>
          {qty > 1 && (
            <View style={styles.qtyBadge}>
              <Text style={styles.qtyBadgeText}>×{qty} units</Text>
            </View>
          )}
        </View>
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

// ─── Budget header ────────────────────────────────────────────────────────────
interface BudgetHeaderProps {
  items: any[];
  budget: number;
  editingBudget: boolean;
  budgetInput: string;
  onBudgetInputChange: (v: string) => void;
  onStartBudgetEdit: () => void;
  onSaveBudget: () => void;
  onCancelBudgetEdit: () => void;
  onClearAll: () => void;
}

function BudgetHeader({
  items, budget,
  editingBudget, budgetInput,
  onBudgetInputChange, onStartBudgetEdit, onSaveBudget, onCancelBudgetEdit,
  onClearAll,
}: BudgetHeaderProps) {
  // Use real DB columns for all math — no string parsing
  const totalSpent = items.reduce((sum, item) => {
    const price = item.unit_price ?? 0;
    const qty   = item.quantity   ?? 1;
    return sum + price * qty;
  }, 0);

  const totalUnits    = items.reduce((sum, item) => sum + (item.quantity ?? 1), 0);
  const budgetPercent = Math.min((totalSpent / budget) * 100, 100);
  const isOverBudget  = totalSpent > budget;
  const remaining     = budget - totalSpent;

  return (
    <View style={styles.budgetCard}>
      {/* Top row */}
      <View style={styles.budgetTopRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.budgetCardLabel}>BUDGET TRACKER</Text>
          <Text style={styles.budgetItemCount}>
            {items.length} {items.length === 1 ? 'product' : 'products'} · {totalUnits} {totalUnits === 1 ? 'unit' : 'units'}
          </Text>
        </View>
        {items.length > 0 && (
          <TouchableOpacity onPress={onClearAll} style={styles.clearAllBtn}>
            <Text style={styles.clearAllText}>Clear All</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Spent amount */}
      <View style={styles.budgetRow}>
        <Text style={[styles.budgetSpent, isOverBudget && styles.overBudgetColor]}>
          {formatPeso(totalSpent)}
        </Text>
        <Text style={styles.budgetDivider}> / </Text>

        {/* Budget limit — tappable to edit */}
        {editingBudget ? (
          <View style={styles.budgetEditRow}>
            <Text style={styles.pesoPrefix}>₱</Text>
            <TextInput
              style={styles.budgetInput}
              value={budgetInput}
              onChangeText={onBudgetInputChange}
              keyboardType="decimal-pad"
              autoFocus
              returnKeyType="done"
              onSubmitEditing={onSaveBudget}
              selectTextOnFocus
            />
            <TouchableOpacity onPress={onSaveBudget} style={styles.budgetSaveBtn}>
              <Text style={styles.budgetSaveText}>✓</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onCancelBudgetEdit} style={styles.budgetCancelBtn}>
              <Text style={styles.budgetCancelText}>✕</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity onPress={onStartBudgetEdit} style={styles.budgetLimitBtn}>
            <Text style={styles.budgetLimitText}>{formatPeso(budget)}</Text>
            <Text style={styles.budgetEditHint}> ✎</Text>
          </TouchableOpacity>
        )}
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

      {/* Remaining / over */}
      <Text style={[styles.remainingText, isOverBudget && styles.overBudgetColor]}>
        {isOverBudget
          ? `⚠  Over budget by ${formatPeso(Math.abs(remaining))}`
          : `${formatPeso(remaining)} remaining`}
      </Text>

      {/* Swipe hint */}
      {items.length > 0 && (
        <Text style={styles.swipeHint}>← swipe to edit  ·  swipe to delete →</Text>
      )}
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function InventoryScreen({ navigation }: any) {
  const [items,      setItems]      = useState<any[]>([]);
  const [editingId,  setEditingId]  = useState<number | null>(null);

  // ── Budget state ────────────────────────────────────────
  const [budget,        setBudget]        = useState(DEFAULT_BUDGET);
  const [editingBudget, setEditingBudget] = useState(false);
  const [budgetInput,   setBudgetInput]   = useState(DEFAULT_BUDGET.toString());

  const isFocused = useIsFocused();

  // ── Load saved budget from AsyncStorage ─────────────────
  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(BUDGET_KEY);
        if (saved !== null) {
          const parsed = parseFloat(saved);
          if (!isNaN(parsed) && parsed > 0) {
            setBudget(parsed);
            setBudgetInput(parsed.toString());
          }
        }
      } catch (e) {
        console.error('[Budget] Load error:', e);
      }
    })();
  }, []);

  const refresh = useCallback(async () => {
    const rows = await getOfflineItems();
    setItems(rows);
  }, []);

  useEffect(() => {
    if (isFocused) refresh();
  }, [isFocused, refresh]);

  // ── Budget handlers ─────────────────────────────────────
  const handleStartBudgetEdit = () => {
    setBudgetInput(budget.toString());
    setEditingBudget(true);
  };

  const handleSaveBudget = async () => {
    const parsed = parseFloat(budgetInput);
    if (!isNaN(parsed) && parsed > 0) {
      setBudget(parsed);
      try {
        await AsyncStorage.setItem(BUDGET_KEY, parsed.toString());
      } catch (e) {
        console.error('[Budget] Save error:', e);
      }
    }
    setEditingBudget(false);
  };

  const handleCancelBudgetEdit = () => {
    setBudgetInput(budget.toString());
    setEditingBudget(false);
  };

  // ── Item handlers ───────────────────────────────────────
  const handleEdit = (item: any) => setEditingId(item.id);

  const handleSaveEdit = async (
    id: number,
    product: string,
    unitPrice: number,
    qty: number,
  ) => {
    await updateItemInDB(id, product, unitPrice, qty);
    setEditingId(null);
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
      'This will remove all items. This cannot be undone.',
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
  const renderItem = ({ item }: { item: any }) => (
    <ItemRow
      item={item}
      isEditing={editingId === item.id}
      onEdit={handleEdit}
      onDelete={handleDelete}
      onSaveEdit={handleSaveEdit}
      onCancelEdit={() => setEditingId(null)}
    />
  );

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView style={styles.container} edges={['bottom', 'left', 'right']}>
        {items.length === 0 ? (
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
              <BudgetHeader
                items={items}
                budget={budget}
                editingBudget={editingBudget}
                budgetInput={budgetInput}
                onBudgetInputChange={setBudgetInput}
                onStartBudgetEdit={handleStartBudgetEdit}
                onSaveBudget={handleSaveBudget}
                onCancelBudgetEdit={handleCancelBudgetEdit}
                onClearAll={handleClearAll}
              />
            }
            contentContainerStyle={styles.listContainer}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          />
        )}
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container:     { flex: 1, backgroundColor: '#F8F7F4' },
  listContainer: { padding: 14, paddingBottom: 40 },

  // ── Budget card ─────────────────────────────────────────
  budgetCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 18,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  budgetTopRow:    { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  budgetCardLabel: { fontSize: 10, fontWeight: '700', color: '#9CA3AF', letterSpacing: 0.8 },
  budgetItemCount: { fontSize: 12, color: '#6B7280', marginTop: 2, fontWeight: '500' },

  clearAllBtn:  { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA' },
  clearAllText: { color: '#DC2626', fontSize: 12, fontWeight: '700' },

  budgetRow:    { flexDirection: 'row', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap' },
  budgetSpent:  { fontSize: 30, fontWeight: '800', color: '#111827' },
  budgetDivider:{ fontSize: 18, color: '#9CA3AF', fontWeight: '400' },
  overBudgetColor: { color: '#DC2626' },

  // Tappable budget limit
  budgetLimitBtn: { flexDirection: 'row', alignItems: 'center' },
  budgetLimitText:{ fontSize: 18, fontWeight: '700', color: '#6B7280' },
  budgetEditHint: { fontSize: 14, color: '#9CA3AF' },

  // Inline budget editor
  budgetEditRow:   { flexDirection: 'row', alignItems: 'center', gap: 4 },
  pesoPrefix:      { fontSize: 18, fontWeight: '700', color: '#4F46E5' },
  budgetInput:     { fontSize: 18, fontWeight: '700', color: '#4F46E5', minWidth: 80, borderBottomWidth: 2, borderBottomColor: '#4F46E5', paddingVertical: 2, paddingHorizontal: 4 },
  budgetSaveBtn:   { padding: 6, backgroundColor: '#ECFDF5', borderRadius: 8, marginLeft: 4 },
  budgetSaveText:  { color: '#059669', fontWeight: '800', fontSize: 16 },
  budgetCancelBtn: { padding: 6, backgroundColor: '#FEF2F2', borderRadius: 8 },
  budgetCancelText:{ color: '#DC2626', fontWeight: '800', fontSize: 14 },

  progressBg:   { height: 6, backgroundColor: '#F3F4F6', borderRadius: 3, overflow: 'hidden', marginBottom: 6 },
  progressFill: { height: '100%', borderRadius: 3 },

  remainingText: { fontSize: 12, fontWeight: '600', color: '#4F46E5', marginBottom: 2 },
  swipeHint:     { fontSize: 11, color: '#C4C4C4', fontStyle: 'italic', textAlign: 'center', marginTop: 8 },

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
  cardLeft:      { flex: 1, paddingRight: 12 },
  productName:   { fontSize: 15, fontWeight: '700', color: '#111827', marginBottom: 3, lineHeight: 20 },
  scannedAt:     { fontSize: 11, color: '#9CA3AF', marginBottom: 5 },
  qtyBadge:      { alignSelf: 'flex-start', backgroundColor: '#EEF2FF', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2, marginTop: 2 },
  qtyBadgeText:  { color: '#4F46E5', fontSize: 11, fontWeight: '700' },
  cardRight:     { alignItems: 'flex-end' },
  lineTotalText: { fontSize: 18, fontWeight: '800', color: '#059669' },
  unitPriceText: { fontSize: 11, color: '#9CA3AF', marginTop: 2 },

  // ── Swipe actions ───────────────────────────────────────
  swipeDeleteBox:    { backgroundColor: '#DC2626', justifyContent: 'center', alignItems: 'center', width: 80, borderRadius: 16, marginBottom: 8 },
  swipeEditBox:      { backgroundColor: '#4F46E5', justifyContent: 'center', alignItems: 'center', width: 80, borderRadius: 16, marginBottom: 8 },
  swipeIcon:         { fontSize: 20, marginBottom: 2 },
  swipeActionLabel:  { fontSize: 12, fontWeight: '700', color: '#FFFFFF' },

  // ── Edit card ───────────────────────────────────────────
  editCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    marginBottom: 8,
    borderWidth: 1.5,
    borderColor: '#4F46E5',
  },
  editCardTitle:   { fontSize: 14, fontWeight: '800', color: '#4F46E5', marginBottom: 14, letterSpacing: 0.2 },
  fieldLabel:      { fontSize: 10, fontWeight: '700', color: '#9CA3AF', letterSpacing: 0.8, marginBottom: 6 },
  editInput:       { backgroundColor: '#F8F7F4', borderRadius: 12, padding: 12, fontSize: 15, fontWeight: '600', color: '#111827', borderWidth: 1, borderColor: '#E5E7EB', marginBottom: 12 },
  editInputPrice:  { color: '#059669', fontSize: 18, fontWeight: '800' },
  editRow:         { flexDirection: 'row', gap: 10 },
  editHalf:        { flex: 1 },
  editStepper:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#F8F7F4', borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB', padding: 10, marginBottom: 12 },

  stepBtn:     { width: 28, height: 28, borderRadius: 8, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#E5E7EB' },
  stepBtnText: { fontSize: 16, fontWeight: '700', color: '#374151', lineHeight: 20 },
  stepValue:   { fontSize: 18, fontWeight: '800', color: '#111827', minWidth: 28, textAlign: 'center' },

  editTotalPreview: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#ECFDF5', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 14, borderWidth: 1, borderColor: '#A7F3D0' },
  editTotalLabel:   { fontSize: 13, fontWeight: '600', color: '#059669' },
  editTotalValue:   { fontSize: 16, fontWeight: '800', color: '#059669' },

  editActions:         { flexDirection: 'row', gap: 8 },
  editCancelBtn:       { flex: 1, paddingVertical: 12, borderRadius: 12, backgroundColor: '#F3F4F6', alignItems: 'center' },
  editCancelText:      { color: '#6B7280', fontSize: 14, fontWeight: '600' },
  editSaveBtn:         { flex: 2, paddingVertical: 12, borderRadius: 12, backgroundColor: '#4F46E5', alignItems: 'center' },
  editSaveBtnDisabled: { backgroundColor: '#D1D5DB' },
  editSaveText:        { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },

  // ── Empty state ─────────────────────────────────────────
  empty:        { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  emptyIcon:    { fontSize: 52, marginBottom: 16 },
  emptyTitle:   { fontSize: 20, fontWeight: '800', color: '#111827', marginBottom: 8 },
  emptyBody:    { fontSize: 14, color: '#9CA3AF', textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  emptyBackBtn: { backgroundColor: '#4F46E5', paddingHorizontal: 28, paddingVertical: 14, borderRadius: 16 },
  emptyBackText:{ color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
});