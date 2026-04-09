// src/screens/TripDetailScreen.tsx
import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  StyleSheet, View, Text, FlatList,
  TouchableOpacity, TextInput, Alert, Animated,
} from 'react-native';
import { Swipeable, GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useIsFocused } from '@react-navigation/native';

import {
  getActiveTrip, getTripItems, updateTripItem,
  deleteTripItem, clearTripItems, toggleTripItemChecked,
  updateTrip, Trip, TripItem,
} from '../utils/database';

const formatPeso = (n: number) =>
  `₱${n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// ─── Swipe actions ────────────────────────────────────────────────────────────
function RightDeleteAction(progress: Animated.AnimatedInterpolation<number>, onDelete: () => void) {
  const scale = progress.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1], extrapolate: 'clamp' });
  return (
    <TouchableOpacity style={styles.swipeDeleteBox} onPress={onDelete} activeOpacity={0.85}>
      <Animated.Text style={[styles.swipeIcon, { transform: [{ scale }] }]}>🗑</Animated.Text>
      <Animated.Text style={[styles.swipeLabel, { transform: [{ scale }] }]}>Delete</Animated.Text>
    </TouchableOpacity>
  );
}

function LeftEditAction(progress: Animated.AnimatedInterpolation<number>, onEdit: () => void) {
  const scale = progress.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1], extrapolate: 'clamp' });
  return (
    <TouchableOpacity style={styles.swipeEditBox} onPress={onEdit} activeOpacity={0.85}>
      <Animated.Text style={[styles.swipeIcon, { transform: [{ scale }] }]}>✎</Animated.Text>
      <Animated.Text style={[styles.swipeLabel, { transform: [{ scale }] }]}>Edit</Animated.Text>
    </TouchableOpacity>
  );
}

// ─── Item row ─────────────────────────────────────────────────────────────────
function ItemRow({ item, isEditing, checklistMode, onEdit, onDelete, onSaveEdit, onCancelEdit, onToggleCheck }: any) {
  const swipeRef  = useRef<Swipeable>(null);
  const [editProduct, setEditProduct] = useState(item.product ?? '');
  const [editPrice,   setEditPrice]   = useState(item.unit_price > 0 ? item.unit_price.toFixed(2) : '');
  const [editQty,     setEditQty]     = useState<number>(item.quantity ?? 1);

  useEffect(() => {
    setEditProduct(item.product ?? '');
    setEditPrice(item.unit_price > 0 ? item.unit_price.toFixed(2) : '');
    setEditQty(item.quantity ?? 1);
  }, [item]);

  const unitPrice  = item.unit_price ?? 0;
  const qty        = item.quantity   ?? 1;
  const lineTotal  = unitPrice * qty;
  const isChecked  = item.is_checked === 1;

  const editUnitPrice = parseFloat(editPrice) || 0;
  const canSave       = editProduct.trim().length > 0 && editUnitPrice > 0;

  const handleEdit   = () => { swipeRef.current?.close(); onEdit(item); };
  const handleDelete = () => { swipeRef.current?.close(); onDelete(item.id, item.product); };
  const handleSave   = () => {
    if (!canSave) return;
    onSaveEdit(item.id, editProduct.trim(), editUnitPrice, editQty);
  };

  if (isEditing) {
    return (
      <View style={styles.editCard}>
        <Text style={styles.editCardTitle}>Edit Item</Text>
        <Text style={styles.fieldLabel}>PRODUCT NAME</Text>
        <TextInput style={styles.editInput} value={editProduct} onChangeText={setEditProduct} autoFocus placeholder="Product name" placeholderTextColor="#C4C4C4" />

        <View style={styles.editRow}>
          <View style={styles.editHalf}>
            <Text style={styles.fieldLabel}>UNIT PRICE (₱)</Text>
            <TextInput style={[styles.editInput, styles.editInputPrice]} value={editPrice} onChangeText={setEditPrice} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor="#C4C4C4" />
          </View>
          <View style={styles.editHalf}>
            <Text style={styles.fieldLabel}>QUANTITY</Text>
            <View style={styles.editStepper}>
              <TouchableOpacity style={styles.stepBtn} onPress={() => setEditQty(q => Math.max(1, q - 1))} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Text style={styles.stepBtnText}>−</Text>
              </TouchableOpacity>
              <Text style={styles.stepValue}>{editQty}</Text>
              <TouchableOpacity style={styles.stepBtn} onPress={() => setEditQty(q => q + 1)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Text style={styles.stepBtnText}>+</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {editUnitPrice > 0 && (
          <View style={styles.editTotalPreview}>
            <Text style={styles.editTotalLabel}>Line total</Text>
            <Text style={styles.editTotalValue}>{formatPeso(editUnitPrice * editQty)}</Text>
          </View>
        )}

        <View style={styles.editActions}>
          <TouchableOpacity style={styles.editCancelBtn} onPress={onCancelEdit}>
            <Text style={styles.editCancelText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.editSaveBtn, !canSave && styles.editSaveBtnDisabled]} onPress={handleSave} disabled={!canSave}>
            <Text style={styles.editSaveText}>Save Changes</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <Swipeable
      ref={swipeRef}
      friction={2}
      leftThreshold={60}
      rightThreshold={60}
      renderLeftActions={(p) => LeftEditAction(p, handleEdit)}
      renderRightActions={(p) => RightDeleteAction(p, handleDelete)}
      overshootLeft={false}
      overshootRight={false}
    >
      <TouchableOpacity
        style={[styles.card, isChecked && styles.cardChecked]}
        onPress={checklistMode ? () => onToggleCheck(item.id, !isChecked) : undefined}
        activeOpacity={checklistMode ? 0.7 : 1}
      >
        {/* Checklist checkbox */}
        {checklistMode && (
          <View style={[styles.checkbox, isChecked && styles.checkboxChecked]}>
            {isChecked && <Text style={styles.checkmark}>✓</Text>}
          </View>
        )}

        <View style={[styles.cardLeft, isChecked && styles.cardLeftChecked]}>
          <Text style={[styles.productName, isChecked && styles.productNameChecked]} numberOfLines={2}>
            {item.product}
          </Text>
          <Text style={styles.scannedAt}>
            {new Date(item.scanned_at).toLocaleString('en-PH', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
          </Text>
          {qty > 1 && (
            <View style={styles.qtyBadge}>
              <Text style={styles.qtyBadgeText}>×{qty} units</Text>
            </View>
          )}
        </View>

        <View style={styles.cardRight}>
          <Text style={[styles.lineTotalText, isChecked && styles.lineTotalChecked]}>
            {formatPeso(lineTotal)}
          </Text>
          {qty > 1 && <Text style={styles.unitPriceText}>{formatPeso(unitPrice)} each</Text>}
        </View>
      </TouchableOpacity>
    </Swipeable>
  );
}

// ─── Budget header ────────────────────────────────────────────────────────────
function BudgetHeader({ trip, items, checklistMode, onToggleChecklist, onClearAll, onEditBudget }: any) {
  const totalSpent   = items.reduce((s: number, i: TripItem) => s + (i.unit_price ?? 0) * (i.quantity ?? 1), 0);
  const checkedSpent = items.filter((i: TripItem) => i.is_checked).reduce((s: number, i: TripItem) => s + (i.unit_price ?? 0) * (i.quantity ?? 1), 0);
  const budget       = trip?.budget ?? 2000;
  const pct          = Math.min((totalSpent / budget) * 100, 100);
  const isOver       = totalSpent > budget;
  const totalUnits   = items.reduce((s: number, i: TripItem) => s + (i.quantity ?? 1), 0);
  const checkedCount = items.filter((i: TripItem) => i.is_checked).length;

  return (
    <View style={styles.budgetCard}>
      <View style={styles.budgetTopRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.budgetCardLabel}>BUDGET TRACKER</Text>
          <Text style={styles.budgetItemCount}>
            {items.length} products · {totalUnits} units
            {checklistMode ? ` · ${checkedCount} checked` : ''}
          </Text>
        </View>
        <View style={styles.budgetTopActions}>
          {/* Checklist mode toggle */}
          <TouchableOpacity
            style={[styles.checklistToggle, checklistMode && styles.checklistToggleActive]}
            onPress={onToggleChecklist}
          >
            <Text style={[styles.checklistToggleText, checklistMode && styles.checklistToggleTextActive]}>
              {checklistMode ? '✓ Checklist' : 'Checklist'}
            </Text>
          </TouchableOpacity>
          {items.length > 0 && (
            <TouchableOpacity onPress={onClearAll} style={styles.clearAllBtn}>
              <Text style={styles.clearAllText}>Clear</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <View style={styles.budgetRow}>
        <Text style={[styles.budgetSpent, isOver && { color: '#DC2626' }]}>
          {formatPeso(totalSpent)}
        </Text>
        <TouchableOpacity onPress={onEditBudget} style={styles.budgetLimitBtn}>
          <Text style={styles.budgetLimitText}> / {formatPeso(budget)} ✎</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.progressBg}>
        <View style={[styles.progressFill, { width: `${pct}%` as any, backgroundColor: isOver ? '#DC2626' : '#4F46E5' }]} />
      </View>

      <Text style={[styles.remainingText, isOver && { color: '#DC2626' }]}>
        {isOver
          ? `⚠  Over budget by ${formatPeso(Math.abs(budget - totalSpent))}`
          : `${formatPeso(budget - totalSpent)} remaining`}
      </Text>

      {checklistMode && checkedCount > 0 && (
        <Text style={styles.checkedSpentText}>
          In basket: {formatPeso(checkedSpent)}
        </Text>
      )}

      {items.length > 0 && (
        <Text style={styles.swipeHint}>← swipe to edit  ·  swipe to delete →</Text>
      )}
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function TripDetailScreen({ route, navigation }: any) {
  // tripId may come from navigation params (Lists → TripDetail)
  // or fall back to the active trip (Home → TripDetail without param)
  const tripIdParam: number | undefined = route?.params?.tripId;

  const [trip,          setTrip]          = useState<Trip | null>(null);
  const [items,         setItems]         = useState<TripItem[]>([]);
  const [editingId,     setEditingId]     = useState<number | null>(null);
  const [checklistMode, setChecklistMode] = useState(false);
  const [editingBudget, setEditingBudget] = useState(false);
  const [budgetInput,   setBudgetInput]   = useState('');
  const isFocused = useIsFocused();

  const load = useCallback(async () => {
    let t: Trip | null = null;
    if (tripIdParam) {
      const rows = await getTripItems(tripIdParam);
      // Also fetch the trip itself
      t = { id: tripIdParam } as Trip; // minimal — we'll load properly below
    }
    // Always resolve the full trip object
    const { getActiveTrip: _ga, getAllTrips } = require('../utils/database');
    const allTrips = await require('../utils/database').getAllTrips();
    const resolved = tripIdParam
      ? allTrips.find((tr: Trip) => tr.id === tripIdParam) ?? null
      : await require('../utils/database').getActiveTrip();

    setTrip(resolved);
    if (resolved) {
      const rows = await getTripItems(resolved.id);
      setItems(rows);
    }
  }, [tripIdParam]);

  useEffect(() => { if (isFocused) load(); }, [isFocused, load]);

  useEffect(() => {
    if (trip?.name) navigation.setOptions({ title: trip.name });
  }, [trip, navigation]);

  // ── Budget edit ─────────────────────────────────────────
  const startBudgetEdit = () => {
    setBudgetInput((trip?.budget ?? 2000).toString());
    setEditingBudget(true);
  };

  const saveBudget = async () => {
    const parsed = parseFloat(budgetInput);
    if (trip && !isNaN(parsed) && parsed > 0) {
      await updateTrip(trip.id, { budget: parsed });
      load();
    }
    setEditingBudget(false);
  };

  // ── Item handlers ───────────────────────────────────────
  const handleSaveEdit = async (id: number, product: string, unitPrice: number, qty: number) => {
    await updateTripItem(id, product, unitPrice, qty);
    setEditingId(null);
    load();
  };

  const handleDelete = (id: number, name: string) => {
    Alert.alert('Remove Item', `Remove "${name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: async () => { await deleteTripItem(id); load(); } },
    ]);
  };

  const handleClearAll = () => {
    Alert.alert('Clear All Items', 'Remove all items from this list?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear All', style: 'destructive', onPress: async () => { if (trip) { await clearTripItems(trip.id); load(); } } },
    ]);
  };

  const handleToggleCheck = async (id: number, checked: boolean) => {
    await toggleTripItemChecked(id, checked);
    load();
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView style={styles.container} edges={['bottom', 'left', 'right']}>

        {/* Inline budget editor overlay */}
        {editingBudget && (
          <View style={styles.budgetEditOverlay}>
            <Text style={styles.budgetEditLabel}>Set Budget (₱)</Text>
            <View style={styles.budgetEditRow}>
              <TextInput
                style={styles.budgetEditInput}
                value={budgetInput}
                onChangeText={setBudgetInput}
                keyboardType="decimal-pad"
                autoFocus
                selectTextOnFocus
                returnKeyType="done"
                onSubmitEditing={saveBudget}
              />
              <TouchableOpacity style={styles.budgetSaveBtn} onPress={saveBudget}>
                <Text style={styles.budgetSaveText}>Save</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.budgetCancelBtn} onPress={() => setEditingBudget(false)}>
                <Text style={styles.budgetCancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {items.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>🛒</Text>
            <Text style={styles.emptyTitle}>List is empty</Text>
            <Text style={styles.emptyBody}>Go to the Scanner tab to add items.</Text>
            <TouchableOpacity style={styles.emptyBtn} onPress={() => navigation.navigate('ScannerTab')}>
              <Text style={styles.emptyBtnText}>📷 Open Scanner</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={items}
            keyExtractor={(item) => item.id.toString()}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            ListHeaderComponent={
              <BudgetHeader
                trip={trip}
                items={items}
                checklistMode={checklistMode}
                onToggleChecklist={() => setChecklistMode(m => !m)}
                onClearAll={handleClearAll}
                onEditBudget={startBudgetEdit}
              />
            }
            renderItem={({ item }) => (
              <ItemRow
                item={item}
                isEditing={editingId === item.id}
                checklistMode={checklistMode}
                onEdit={(i: any) => setEditingId(i.id)}
                onDelete={handleDelete}
                onSaveEdit={handleSaveEdit}
                onCancelEdit={() => setEditingId(null)}
                onToggleCheck={handleToggleCheck}
              />
            )}
          />
        )}
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: '#F8F7F4' },
  listContent: { padding: 14, paddingBottom: 40 },

  budgetCard: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 18, marginBottom: 12, borderWidth: 1, borderColor: '#E5E7EB' },
  budgetTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  budgetCardLabel: { fontSize: 10, fontWeight: '700', color: '#9CA3AF', letterSpacing: 0.8 },
  budgetItemCount: { fontSize: 12, color: '#6B7280', marginTop: 2, fontWeight: '500' },
  budgetTopActions: { flexDirection: 'row', gap: 8, alignItems: 'center' },

  checklistToggle:         { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: '#E5E7EB' },
  checklistToggleActive:   { backgroundColor: '#EEF2FF', borderColor: '#4F46E5' },
  checklistToggleText:     { fontSize: 12, fontWeight: '700', color: '#6B7280' },
  checklistToggleTextActive: { color: '#4F46E5' },

  clearAllBtn:  { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA' },
  clearAllText: { color: '#DC2626', fontSize: 12, fontWeight: '700' },

  budgetRow:      { flexDirection: 'row', alignItems: 'baseline', marginBottom: 10, flexWrap: 'wrap' },
  budgetSpent:    { fontSize: 28, fontWeight: '800', color: '#111827' },
  budgetLimitBtn: { flexDirection: 'row', alignItems: 'center' },
  budgetLimitText:{ fontSize: 16, fontWeight: '600', color: '#9CA3AF' },

  progressBg:   { height: 6, backgroundColor: '#F3F4F6', borderRadius: 3, overflow: 'hidden', marginBottom: 6 },
  progressFill: { height: '100%', borderRadius: 3 },
  remainingText:    { fontSize: 12, fontWeight: '600', color: '#4F46E5', marginBottom: 2 },
  checkedSpentText: { fontSize: 12, fontWeight: '600', color: '#059669', marginTop: 2 },
  swipeHint:        { fontSize: 11, color: '#C4C4C4', fontStyle: 'italic', textAlign: 'center', marginTop: 8 },

  // Budget overlay
  budgetEditOverlay: { backgroundColor: '#FFFFFF', padding: 16, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  budgetEditLabel:   { fontSize: 12, fontWeight: '700', color: '#9CA3AF', marginBottom: 8 },
  budgetEditRow:     { flexDirection: 'row', gap: 8, alignItems: 'center' },
  budgetEditInput:   { flex: 1, backgroundColor: '#F8F7F4', borderRadius: 12, padding: 12, fontSize: 18, fontWeight: '700', color: '#4F46E5', borderWidth: 1, borderColor: '#4F46E5' },
  budgetSaveBtn:     { paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#4F46E5', borderRadius: 12 },
  budgetSaveText:    { color: '#FFFFFF', fontWeight: '700' },
  budgetCancelBtn:   { paddingHorizontal: 12, paddingVertical: 12, backgroundColor: '#F3F4F6', borderRadius: 12 },
  budgetCancelText:  { color: '#6B7280', fontWeight: '600' },

  // Item card
  card: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 14, marginBottom: 8, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#F3F4F6', borderLeftWidth: 3, borderLeftColor: '#4F46E5' },
  cardChecked:      { borderLeftColor: '#D1D5DB', backgroundColor: '#FAFAFA' },
  cardLeft:         { flex: 1, paddingRight: 12 },
  cardLeftChecked:  { opacity: 0.5 },
  productName:      { fontSize: 15, fontWeight: '700', color: '#111827', marginBottom: 3, lineHeight: 20 },
  productNameChecked: { textDecorationLine: 'line-through', color: '#9CA3AF' },
  scannedAt:        { fontSize: 11, color: '#9CA3AF', marginBottom: 5 },
  qtyBadge:         { alignSelf: 'flex-start', backgroundColor: '#EEF2FF', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2, marginTop: 2 },
  qtyBadgeText:     { color: '#4F46E5', fontSize: 11, fontWeight: '700' },
  cardRight:        { alignItems: 'flex-end' },
  lineTotalText:    { fontSize: 18, fontWeight: '800', color: '#059669' },
  lineTotalChecked: { color: '#9CA3AF' },
  unitPriceText:    { fontSize: 11, color: '#9CA3AF', marginTop: 2 },

  // Checklist
  checkbox:        { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: '#D1D5DB', marginRight: 12, alignItems: 'center', justifyContent: 'center' },
  checkboxChecked: { backgroundColor: '#059669', borderColor: '#059669' },
  checkmark:       { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },

  // Swipe
  swipeDeleteBox: { backgroundColor: '#DC2626', justifyContent: 'center', alignItems: 'center', width: 80, borderRadius: 16, marginBottom: 8 },
  swipeEditBox:   { backgroundColor: '#4F46E5', justifyContent: 'center', alignItems: 'center', width: 80, borderRadius: 16, marginBottom: 8 },
  swipeIcon:      { fontSize: 20, marginBottom: 2 },
  swipeLabel:     { fontSize: 12, fontWeight: '700', color: '#FFFFFF' },

  // Edit card
  editCard:         { backgroundColor: '#FFFFFF', borderRadius: 18, padding: 16, marginBottom: 8, borderWidth: 1.5, borderColor: '#4F46E5' },
  editCardTitle:    { fontSize: 14, fontWeight: '800', color: '#4F46E5', marginBottom: 14 },
  fieldLabel:       { fontSize: 10, fontWeight: '700', color: '#9CA3AF', letterSpacing: 0.8, marginBottom: 6 },
  editInput:        { backgroundColor: '#F8F7F4', borderRadius: 12, padding: 12, fontSize: 15, fontWeight: '600', color: '#111827', borderWidth: 1, borderColor: '#E5E7EB', marginBottom: 12 },
  editInputPrice:   { color: '#059669', fontSize: 18, fontWeight: '800' },
  editRow:          { flexDirection: 'row', gap: 10 },
  editHalf:         { flex: 1 },
  editStepper:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#F8F7F4', borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB', padding: 10, marginBottom: 12 },
  stepBtn:          { width: 28, height: 28, borderRadius: 8, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#E5E7EB' },
  stepBtnText:      { fontSize: 16, fontWeight: '700', color: '#374151', lineHeight: 20 },
  stepValue:        { fontSize: 18, fontWeight: '800', color: '#111827', minWidth: 28, textAlign: 'center' },
  editTotalPreview: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#ECFDF5', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 14, borderWidth: 1, borderColor: '#A7F3D0' },
  editTotalLabel:   { fontSize: 13, fontWeight: '600', color: '#059669' },
  editTotalValue:   { fontSize: 16, fontWeight: '800', color: '#059669' },
  editActions:      { flexDirection: 'row', gap: 8 },
  editCancelBtn:    { flex: 1, paddingVertical: 12, borderRadius: 12, backgroundColor: '#F3F4F6', alignItems: 'center' },
  editCancelText:   { color: '#6B7280', fontSize: 14, fontWeight: '600' },
  editSaveBtn:      { flex: 2, paddingVertical: 12, borderRadius: 12, backgroundColor: '#4F46E5', alignItems: 'center' },
  editSaveBtnDisabled: { backgroundColor: '#D1D5DB' },
  editSaveText:     { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },

  // Empty
  empty:        { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  emptyIcon:    { fontSize: 52, marginBottom: 16 },
  emptyTitle:   { fontSize: 20, fontWeight: '800', color: '#111827', marginBottom: 8 },
  emptyBody:    { fontSize: 14, color: '#9CA3AF', textAlign: 'center', marginBottom: 24 },
  emptyBtn:     { backgroundColor: '#4F46E5', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 14 },
  emptyBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },
});