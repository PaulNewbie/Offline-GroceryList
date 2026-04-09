// src/screens/TripDetailScreen.tsx
import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  StyleSheet, View, Text, FlatList,
  TouchableOpacity, TextInput, Alert,
  KeyboardAvoidingView, Platform, Animated,
} from 'react-native';
import { Swipeable, GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useIsFocused } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';

import {
  getTripById, getTripItems, addItem,
  updateItem, deleteItem, clearItems,
  toggleItemChecked, completeTrip,
  updateTrip, formatPrice,
  Trip, TripItem,
} from '../utils/database';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const hasPriceSet = (item: TripItem) => item.unit_price > 0;

// ─── Swipe actions ────────────────────────────────────────────────────────────
function SwipeDeleteAction(
  progress: Animated.AnimatedInterpolation<number>,
  onDelete: () => void,
) {
  const scale = progress.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1], extrapolate: 'clamp' });
  return (
    <TouchableOpacity style={styles.swipeDelete} onPress={onDelete} activeOpacity={0.85}>
      <Animated.Text style={{ transform: [{ scale }], fontSize: 20 }}>🗑</Animated.Text>
      <Animated.Text style={[styles.swipeLabel, { transform: [{ scale }] }]}>Delete</Animated.Text>
    </TouchableOpacity>
  );
}

function SwipeEditAction(
  progress: Animated.AnimatedInterpolation<number>,
  onEdit: () => void,
) {
  const scale = progress.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1], extrapolate: 'clamp' });
  return (
    <TouchableOpacity style={styles.swipeEdit} onPress={onEdit} activeOpacity={0.85}>
      <Animated.Text style={{ transform: [{ scale }], fontSize: 20 }}>✎</Animated.Text>
      <Animated.Text style={[styles.swipeLabel, { transform: [{ scale }] }]}>Edit</Animated.Text>
    </TouchableOpacity>
  );
}

// ─── Item row ─────────────────────────────────────────────────────────────────
interface RowProps {
  item: TripItem;
  editingId: number | null;
  onEdit: (item: TripItem) => void;
  onDelete: (id: number, name: string) => void;
  onToggle: (id: number, checked: boolean) => void;
  onSave: (id: number, product: string, unitPrice: number, qty: number) => void;
  onCancel: () => void;
  onAddPrice: (item: TripItem) => void;
}

function ItemRow({ item, editingId, onEdit, onDelete, onToggle, onSave, onCancel, onAddPrice }: RowProps) {
  const swipeRef   = useRef<Swipeable>(null);
  const isEditing  = editingId === item.id;
  const isChecked  = item.is_checked === 1;
  const hasPrice   = hasPriceSet(item);
  const lineTotal  = (item.unit_price ?? 0) * (item.quantity ?? 1);

  // Local edit state
  const [editProduct, setEditProduct] = useState(item.product);
  const [editPrice,   setEditPrice]   = useState(item.unit_price > 0 ? item.unit_price.toFixed(2) : '');
  const [editQty,     setEditQty]     = useState(item.quantity ?? 1);

  useEffect(() => {
    setEditProduct(item.product);
    setEditPrice(item.unit_price > 0 ? item.unit_price.toFixed(2) : '');
    setEditQty(item.quantity ?? 1);
  }, [item]);

  const editUnitPrice = parseFloat(editPrice) || 0;
  const canSave       = editProduct.trim().length > 0;

  const handleEdit   = () => { swipeRef.current?.close(); onEdit(item); };
  const handleDelete = () => { swipeRef.current?.close(); onDelete(item.id, item.product); };

  // ── Edit mode ─────────────────────────────────────────
  if (isEditing) {
    return (
      <View style={styles.editCard}>
        <Text style={styles.editCardLabel}>PRODUCT NAME</Text>
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
            <Text style={styles.editCardLabel}>UNIT PRICE (₱) — optional</Text>
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
            <Text style={styles.editCardLabel}>QTY</Text>
            <View style={styles.stepperRow}>
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

        {editUnitPrice > 0 && editQty > 1 && (
          <View style={styles.editPreviewRow}>
            <Text style={styles.editPreviewLabel}>Line total</Text>
            <Text style={styles.editPreviewValue}>{formatPrice(editUnitPrice * editQty)}</Text>
          </View>
        )}

        <View style={styles.editActions}>
          <TouchableOpacity style={styles.cancelBtn} onPress={onCancel}>
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.saveBtn, !canSave && styles.saveBtnDisabled]}
            onPress={() => canSave && onSave(item.id, editProduct.trim(), editUnitPrice, editQty)}
            disabled={!canSave}
          >
            <Text style={styles.saveBtnText}>Save</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // ── Normal row ────────────────────────────────────────
  return (
    <Swipeable
      ref={swipeRef}
      friction={2}
      leftThreshold={60}
      rightThreshold={60}
      renderLeftActions={p => SwipeEditAction(p, handleEdit)}
      renderRightActions={p => SwipeDeleteAction(p, handleDelete)}
      overshootLeft={false}
      overshootRight={false}
    >
      <TouchableOpacity
        style={[styles.card, isChecked && styles.cardChecked]}
        onPress={() => { onToggle(item.id, !isChecked); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); }}
        activeOpacity={0.7}
      >
        {/* Checkbox */}
        <View style={[styles.checkbox, isChecked && styles.checkboxChecked]}>
          {isChecked && <Text style={styles.checkmark}>✓</Text>}
        </View>

        {/* Name + meta */}
        <View style={styles.cardMiddle}>
          <Text style={[styles.productName, isChecked && styles.productNameChecked]} numberOfLines={2}>
            {item.product}
          </Text>
          {hasPrice && item.quantity > 1 && (
            <Text style={styles.unitPriceHint}>{formatPrice(item.unit_price)} each</Text>
          )}
        </View>

        {/* Right side — price or + Add Price */}
        <View style={styles.cardRight}>
          {hasPrice ? (
            <>
              <Text style={[styles.lineTotalText, isChecked && styles.lineTotalChecked]}>
                {formatPrice(lineTotal)}
              </Text>
              {item.quantity > 1 && (
                <View style={styles.qtyBadge}>
                  <Text style={styles.qtyBadgeText}>×{item.quantity}</Text>
                </View>
              )}
            </>
          ) : (
            // No price set yet — show a clear call-to-action
            <TouchableOpacity
              style={styles.addPriceBtn}
              onPress={() => onAddPrice(item)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.addPriceBtnText}>+ Price</Text>
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>
    </Swipeable>
  );
}

// ─── Budget card ──────────────────────────────────────────────────────────────
function BudgetCard({
  trip, items,
  editingBudget, budgetInput,
  onStartEdit, onSave, onCancel, onChange,
  onClearAll,
}: any) {
  // Only count items that have a price set
  const pricedItems = items.filter((i: TripItem) => hasPriceSet(i));
  const totalSpent  = pricedItems.reduce(
    (s: number, i: TripItem) => s + i.unit_price * (i.quantity ?? 1), 0,
  );
  const totalUnits    = items.reduce((s: number, i: TripItem) => s + (i.quantity ?? 1), 0);
  const checkedCount  = items.filter((i: TripItem) => i.is_checked === 1).length;
  const budget        = trip?.budget ?? 2000;
  const pct           = Math.min((totalSpent / budget) * 100, 100);
  const isOver        = totalSpent > budget;
  const hasBudgetData = pricedItems.length > 0;

  return (
    <View style={styles.budgetCard}>
      {/* Top row */}
      <View style={styles.budgetTopRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.budgetLabel}>BUDGET TRACKER</Text>
          <Text style={styles.budgetMeta}>
            {items.length} items · {totalUnits} units · {checkedCount} checked
          </Text>
        </View>
        {items.length > 0 && (
          <TouchableOpacity style={styles.clearBtn} onPress={onClearAll}>
            <Text style={styles.clearBtnText}>Clear all</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Only show totals if at least one item is priced */}
      {hasBudgetData ? (
        <>
          <View style={styles.budgetAmountRow}>
            <Text style={[styles.budgetSpent, isOver && styles.overBudget]}>
              {formatPrice(totalSpent)}
            </Text>
            {editingBudget ? (
              <View style={styles.budgetEditInline}>
                <Text style={styles.budgetEditPrefix}> / ₱</Text>
                <TextInput
                  style={styles.budgetEditInput}
                  value={budgetInput}
                  onChangeText={onChange}
                  keyboardType="decimal-pad"
                  autoFocus
                  selectTextOnFocus
                  returnKeyType="done"
                  onSubmitEditing={onSave}
                />
                <TouchableOpacity style={styles.budgetSaveBtn} onPress={onSave}>
                  <Text style={styles.budgetSaveBtnText}>✓</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.budgetCancelBtn} onPress={onCancel}>
                  <Text style={styles.budgetCancelBtnText}>✕</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity onPress={onStartEdit} style={styles.budgetLimitRow}>
                <Text style={styles.budgetLimit}> / {formatPrice(budget)}</Text>
                <Text style={styles.budgetEditHint}> ✎</Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.progressBg}>
            <View style={[
              styles.progressFill,
              { width: `${pct}%` as any, backgroundColor: isOver ? '#DC2626' : '#4F46E5' },
            ]} />
          </View>

          <Text style={[styles.remainingText, isOver && { color: '#DC2626' }]}>
            {isOver
              ? `⚠  Over budget by ${formatPrice(Math.abs(budget - totalSpent))}`
              : `${formatPrice(budget - totalSpent)} remaining`}
          </Text>
        </>
      ) : (
        <Text style={styles.noPriceHint}>
          Add prices to items to track your budget.
        </Text>
      )}

      {items.length > 0 && (
        <Text style={styles.swipeHint}>← swipe to edit  ·  swipe to delete →</Text>
      )}
    </View>
  );
}

// ─── Add item bar ─────────────────────────────────────────────────────────────
// Always visible at the bottom. Price is optional — just type a name and tap Add.
function AddItemBar({ onAdd }: { onAdd: (product: string, unitPrice: number, qty: number) => void }) {
  const [product,   setProduct]   = useState('');
  const [price,     setPrice]     = useState('');
  const [qty,       setQty]       = useState(1);
  const [showExtra, setShowExtra] = useState(false);
  const inputRef = useRef<TextInput>(null);

  const handleAdd = () => {
    const name = product.trim();
    if (!name) return;
    onAdd(name, parseFloat(price) || 0, qty);
    setProduct(''); setPrice(''); setQty(1); setShowExtra(false);
    inputRef.current?.focus();
  };

  return (
    <View style={styles.addBar}>
      {/* Optional price + qty row */}
      {showExtra && (
        <View style={styles.addBarExtra}>
          <View style={styles.addBarPriceWrap}>
            <Text style={styles.addBarPesoPrefix}>₱</Text>
            <TextInput
              style={styles.addBarPriceInput}
              value={price}
              onChangeText={setPrice}
              placeholder="Price (optional)"
              placeholderTextColor="#C4C4C4"
              keyboardType="decimal-pad"
              returnKeyType="done"
            />
          </View>
          <View style={styles.addBarStepper}>
            <TouchableOpacity style={styles.stepBtn} onPress={() => setQty(q => Math.max(1, q - 1))} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={styles.stepBtnText}>−</Text>
            </TouchableOpacity>
            <Text style={styles.stepValue}>{qty}</Text>
            <TouchableOpacity style={styles.stepBtn} onPress={() => setQty(q => q + 1)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={styles.stepBtnText}>+</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Main input row */}
      <View style={styles.addBarRow}>
        <TextInput
          ref={inputRef}
          style={styles.addBarInput}
          value={product}
          onChangeText={setProduct}
          placeholder="Add an item…"
          placeholderTextColor="#C4C4C4"
          returnKeyType="done"
          onSubmitEditing={handleAdd}
          blurOnSubmit={false}
        />
        {/* Toggle extra fields */}
        <TouchableOpacity
          style={styles.addBarToggle}
          onPress={() => setShowExtra(s => !s)}
        >
          <Text style={styles.addBarToggleText}>{showExtra ? '▲' : '₱+'}</Text>
        </TouchableOpacity>
        {/* Add button */}
        <TouchableOpacity
          style={[styles.addBarBtn, !product.trim() && styles.addBarBtnDisabled]}
          onPress={handleAdd}
          disabled={!product.trim()}
        >
          <Text style={styles.addBarBtnText}>Add</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Add Price modal (inline sheet) ──────────────────────────────────────────
// Opens when user taps "+ Price" on an unpriced row.
function AddPriceSheet({
  item, onSave, onClose,
}: { item: TripItem | null; onSave: (id: number, price: number, qty: number) => void; onClose: () => void }) {
  const [price, setPrice] = useState('');
  const [qty,   setQty]   = useState(item?.quantity ?? 1);

  useEffect(() => {
    setPrice('');
    setQty(item?.quantity ?? 1);
  }, [item]);

  if (!item) return null;

  const unitPrice = parseFloat(price) || 0;
  const canSave   = unitPrice > 0;

  return (
    <View style={styles.priceSheet}>
      <View style={styles.priceSheetHandle} />
      <Text style={styles.priceSheetTitle} numberOfLines={1}>{item.product}</Text>
      <Text style={styles.priceSheetSub}>Enter the price you see on the tag.</Text>

      <View style={styles.priceSheetRow}>
        <View style={styles.priceSheetPriceWrap}>
          <Text style={styles.priceSheetPrefix}>₱</Text>
          <TextInput
            style={styles.priceSheetInput}
            value={price}
            onChangeText={setPrice}
            keyboardType="decimal-pad"
            autoFocus
            placeholder="0.00"
            placeholderTextColor="#C4C4C4"
            returnKeyType="done"
            onSubmitEditing={() => canSave && onSave(item.id, unitPrice, qty)}
          />
        </View>

        <View style={styles.addBarStepper}>
          <TouchableOpacity style={styles.stepBtn} onPress={() => setQty(q => Math.max(1, q - 1))} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={styles.stepBtnText}>−</Text>
          </TouchableOpacity>
          <Text style={styles.stepValue}>{qty}</Text>
          <TouchableOpacity style={styles.stepBtn} onPress={() => setQty(q => q + 1)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={styles.stepBtnText}>+</Text>
          </TouchableOpacity>
        </View>
      </View>

      {unitPrice > 0 && qty > 1 && (
        <Text style={styles.priceSheetTotal}>Total: {formatPrice(unitPrice * qty)}</Text>
      )}

      <View style={styles.priceSheetActions}>
        <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
          <Text style={styles.cancelBtnText}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.saveBtn, !canSave && styles.saveBtnDisabled]}
          onPress={() => canSave && onSave(item.id, unitPrice, qty)}
          disabled={!canSave}
        >
          <Text style={styles.saveBtnText}>Save Price</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function TripDetailScreen({ route, navigation }: any) {
  const tripId: number = route?.params?.tripId;

  const [trip,         setTrip]         = useState<Trip | null>(null);
  const [items,        setItems]         = useState<TripItem[]>([]);
  const [editingId,    setEditingId]     = useState<number | null>(null);
  const [addPriceItem, setAddPriceItem]  = useState<TripItem | null>(null);

  // Budget editing
  const [editingBudget, setEditingBudget] = useState(false);
  const [budgetInput,   setBudgetInput]   = useState('');

  const isFocused = useIsFocused();

// ─── load ─────────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    if (!tripId) {
      console.warn('[TripDetail] No tripId provided');
      return;
    }
    try {
      const t = await getTripById(tripId);
      if (!t) {
        console.warn('[TripDetail] Trip not found for id:', tripId);
        return;
      }
      const rows = await getTripItems(tripId);
      setTrip(t);
      setItems(rows);
      console.log('[TripDetail] Loaded trip:', t.name, '| items:', rows.length);
    } catch (e) {
      console.error('[TripDetail] load error:', e);
    }
  }, [tripId]);

  useEffect(() => { if (isFocused) load(); }, [isFocused, load]);
  useEffect(() => { if (trip?.name) navigation.setOptions({ title: trip.name }); }, [trip]);

  // ── Budget handlers ─────────────────────────────────────
  const startBudgetEdit = () => { setBudgetInput((trip?.budget ?? 2000).toString()); setEditingBudget(true); };
  const saveBudget = async () => {
    const n = parseFloat(budgetInput);
    if (trip && !isNaN(n) && n > 0) { await updateTrip(trip.id, { budget: n }); load(); }
    setEditingBudget(false);
  };

  // ── Item handlers ───────────────────────────────────────
  const handleAdd = async (product: string, unitPrice: number, qty: number) => {
    if (!tripId) {
      console.warn('[TripDetail] handleAdd called without tripId');
      return;
    }
    const trimmed = product.trim();
    if (!trimmed) return;
    
    const insertId = await addItem(tripId, trimmed, unitPrice, qty);
    console.log('[TripDetail] addItem result:', insertId, 'for tripId:', tripId);
    
    if (insertId) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      load();
    }
  };

  const handleSaveEdit = async (id: number, product: string, unitPrice: number, qty: number) => {
    await updateItem(id, product, unitPrice, qty);
    setEditingId(null);
    load();
  };

  const handleSavePrice = async (id: number, unitPrice: number, qty: number) => {
    const item = items.find(i => i.id === id);
    if (!item) return;
    await updateItem(id, item.product, unitPrice, qty);
    setAddPriceItem(null);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    load();
  };

  const handleDelete = (id: number, name: string) => {
    Alert.alert('Remove Item', `Remove "${name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: async () => { await deleteItem(id); load(); } },
    ]);
  };

  const handleToggle = async (id: number, checked: boolean) => {
    await toggleItemChecked(id, checked);
    load();
  };

  const handleClearAll = () => {
    Alert.alert('Clear All Items', 'Remove everything from this list?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear All', style: 'destructive', onPress: async () => { await clearItems(tripId); load(); } },
    ]);
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView style={styles.container} edges={['left', 'right']}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={90}
        >
          {/* ── Add Price sheet — sits above keyboard when active ── */}
          {addPriceItem && (
            <AddPriceSheet
              item={addPriceItem}
              onSave={handleSavePrice}
              onClose={() => setAddPriceItem(null)}
            />
          )}

          {/* ── Main list ── */}
          {items.length === 0 && !addPriceItem ? (
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>🛒</Text>
              <Text style={styles.emptyTitle}>List is empty</Text>
              <Text style={styles.emptyBody}>
                Type an item in the bar below.{'\n'}
                Price is optional — add it later if you don't know it yet.
              </Text>
            </View>
          ) : (
            <FlatList
              data={items}
              keyExtractor={i => i.id.toString()}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              ListHeaderComponent={
                <BudgetCard
                  trip={trip}
                  items={items}
                  editingBudget={editingBudget}
                  budgetInput={budgetInput}
                  onStartEdit={startBudgetEdit}
                  onSave={saveBudget}
                  onCancel={() => setEditingBudget(false)}
                  onChange={setBudgetInput}
                  onClearAll={handleClearAll}
                />
              }
              renderItem={({ item }) => (
                <ItemRow
                  item={item}
                  editingId={editingId}
                  onEdit={i => setEditingId(i.id)}
                  onDelete={handleDelete}
                  onToggle={handleToggle}
                  onSave={handleSaveEdit}
                  onCancel={() => setEditingId(null)}
                  onAddPrice={i => setAddPriceItem(i)}
                />
              )}
            />
          )}

          {/* ── Always-visible add bar ── */}
          {!addPriceItem && (
            <AddItemBar onAdd={handleAdd} />
          )}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: '#F8F7F4' },
  listContent: { padding: 14, paddingBottom: 8 },

  // ── Budget card ─────────────────────────────────────────
  budgetCard:     { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 18, marginBottom: 12, borderWidth: 1, borderColor: '#E5E7EB' },
  budgetTopRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  budgetLabel:    { fontSize: 10, fontWeight: '700', color: '#9CA3AF', letterSpacing: 0.8 },
  budgetMeta:     { fontSize: 12, color: '#6B7280', marginTop: 2, fontWeight: '500' },
  clearBtn:       { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA' },
  clearBtnText:   { color: '#DC2626', fontSize: 12, fontWeight: '700' },
  budgetAmountRow:{ flexDirection: 'row', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap' },
  budgetSpent:    { fontSize: 28, fontWeight: '800', color: '#111827' },
  overBudget:     { color: '#DC2626' },
  budgetLimitRow: { flexDirection: 'row', alignItems: 'center' },
  budgetLimit:    { fontSize: 16, fontWeight: '600', color: '#9CA3AF' },
  budgetEditHint: { fontSize: 13, color: '#C4C4C4' },
  budgetEditInline:    { flexDirection: 'row', alignItems: 'center', gap: 4 },
  budgetEditPrefix:    { fontSize: 16, fontWeight: '600', color: '#9CA3AF' },
  budgetEditInput:     { fontSize: 16, fontWeight: '700', color: '#4F46E5', minWidth: 70, borderBottomWidth: 2, borderBottomColor: '#4F46E5', paddingVertical: 2, paddingHorizontal: 4 },
  budgetSaveBtn:       { padding: 6, backgroundColor: '#ECFDF5', borderRadius: 8, marginLeft: 4 },
  budgetSaveBtnText:   { color: '#059669', fontWeight: '800', fontSize: 14 },
  budgetCancelBtn:     { padding: 6, backgroundColor: '#FEF2F2', borderRadius: 8 },
  budgetCancelBtnText: { color: '#DC2626', fontWeight: '700', fontSize: 13 },
  progressBg:     { height: 6, backgroundColor: '#F3F4F6', borderRadius: 3, overflow: 'hidden', marginBottom: 6 },
  progressFill:   { height: '100%', borderRadius: 3 },
  remainingText:  { fontSize: 12, fontWeight: '600', color: '#4F46E5', marginBottom: 2 },
  noPriceHint:    { fontSize: 13, color: '#C4C4C4', fontStyle: 'italic', marginTop: 4 },
  swipeHint:      { fontSize: 11, color: '#C4C4C4', fontStyle: 'italic', textAlign: 'center', marginTop: 10 },

  // ── Item card ───────────────────────────────────────────
  card: {
    backgroundColor: '#FFFFFF', borderRadius: 14, padding: 14, marginBottom: 8,
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderWidth: 1, borderColor: '#F3F4F6',
    borderLeftWidth: 3, borderLeftColor: '#4F46E5',
  },
  cardChecked:          { borderLeftColor: '#D1D5DB', backgroundColor: '#FAFAFA' },
  checkbox:             { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: '#D1D5DB', alignItems: 'center', justifyContent: 'center' },
  checkboxChecked:      { backgroundColor: '#059669', borderColor: '#059669' },
  checkmark:            { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
  cardMiddle:           { flex: 1 },
  productName:          { fontSize: 15, fontWeight: '700', color: '#111827', lineHeight: 20 },
  productNameChecked:   { textDecorationLine: 'line-through', color: '#9CA3AF' },
  unitPriceHint:        { fontSize: 11, color: '#9CA3AF', marginTop: 2 },
  cardRight:            { alignItems: 'flex-end', minWidth: 72 },
  lineTotalText:        { fontSize: 16, fontWeight: '800', color: '#059669' },
  lineTotalChecked:     { color: '#9CA3AF' },
  qtyBadge:             { marginTop: 3, backgroundColor: '#EEF2FF', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  qtyBadgeText:         { fontSize: 11, fontWeight: '700', color: '#4F46E5' },

  // + Price button
  addPriceBtn:     { backgroundColor: '#ECFDF5', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, borderWidth: 1, borderColor: '#A7F3D0' },
  addPriceBtnText: { fontSize: 12, fontWeight: '700', color: '#059669' },

  // ── Swipe actions ───────────────────────────────────────
  swipeDelete: { backgroundColor: '#DC2626', justifyContent: 'center', alignItems: 'center', width: 80, borderRadius: 14, marginBottom: 8 },
  swipeEdit:   { backgroundColor: '#4F46E5', justifyContent: 'center', alignItems: 'center', width: 80, borderRadius: 14, marginBottom: 8 },
  swipeLabel:  { fontSize: 12, fontWeight: '700', color: '#FFFFFF', marginTop: 2 },

  // ── Edit card ───────────────────────────────────────────
  editCard:        { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, marginBottom: 8, borderWidth: 1.5, borderColor: '#4F46E5' },
  editCardLabel:   { fontSize: 10, fontWeight: '700', color: '#9CA3AF', letterSpacing: 0.8, marginBottom: 6 },
  editInput:       { backgroundColor: '#F8F7F4', borderRadius: 12, padding: 12, fontSize: 15, fontWeight: '600', color: '#111827', borderWidth: 1, borderColor: '#E5E7EB', marginBottom: 12 },
  editInputPrice:  { color: '#059669', fontSize: 18, fontWeight: '800' },
  editRow:         { flexDirection: 'row', gap: 10 },
  editHalf:        { flex: 1 },
  editPreviewRow:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#ECFDF5', borderRadius: 10, padding: 10, marginBottom: 12, borderWidth: 1, borderColor: '#A7F3D0' },
  editPreviewLabel:{ fontSize: 13, fontWeight: '600', color: '#059669' },
  editPreviewValue:{ fontSize: 15, fontWeight: '800', color: '#059669' },
  editActions:     { flexDirection: 'row', gap: 8 },

  stepperRow:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#F8F7F4', borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB', padding: 10, marginBottom: 12 },
  stepBtn:     { width: 28, height: 28, borderRadius: 8, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#E5E7EB' },
  stepBtnText: { fontSize: 16, fontWeight: '700', color: '#374151', lineHeight: 20 },
  stepValue:   { fontSize: 18, fontWeight: '800', color: '#111827', minWidth: 28, textAlign: 'center' },

  cancelBtn:        { flex: 1, paddingVertical: 12, borderRadius: 12, backgroundColor: '#F3F4F6', alignItems: 'center' },
  cancelBtnText:    { color: '#6B7280', fontSize: 14, fontWeight: '600' },
  saveBtn:          { flex: 2, paddingVertical: 12, borderRadius: 12, backgroundColor: '#4F46E5', alignItems: 'center' },
  saveBtnDisabled:  { backgroundColor: '#D1D5DB' },
  saveBtnText:      { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },

  // ── Add item bar ────────────────────────────────────────
  addBar:        { backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: '#E5E7EB', padding: 12 },
  addBarExtra:   { flexDirection: 'row', gap: 8, marginBottom: 8 },
  addBarPriceWrap:{ flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8F7F4', borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB', paddingHorizontal: 10 },
  addBarPesoPrefix:{ fontSize: 15, fontWeight: '700', color: '#059669' },
  addBarPriceInput:{ flex: 1, fontSize: 15, fontWeight: '600', color: '#059669', paddingVertical: 10 },
  addBarStepper:  { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8F7F4', borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB', paddingHorizontal: 8, paddingVertical: 6, gap: 8 },
  addBarRow:     { flexDirection: 'row', alignItems: 'center', gap: 8 },
  addBarInput:   { flex: 1, backgroundColor: '#F8F7F4', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, fontWeight: '600', color: '#111827', borderWidth: 1, borderColor: '#E5E7EB' },
  addBarToggle:  { padding: 10, borderRadius: 10, backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: '#E5E7EB' },
  addBarToggleText: { fontSize: 12, fontWeight: '700', color: '#6B7280' },
  addBarBtn:     { backgroundColor: '#4F46E5', paddingHorizontal: 18, paddingVertical: 12, borderRadius: 14 },
  addBarBtnDisabled: { backgroundColor: '#D1D5DB' },
  addBarBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },

  // ── Add price sheet ─────────────────────────────────────
  priceSheet:        { backgroundColor: '#FFFFFF', borderTopWidth: 1, borderTopColor: '#E5E7EB', padding: 16, paddingBottom: 8 },
  priceSheetHandle:  { width: 36, height: 4, backgroundColor: '#D1D5DB', borderRadius: 2, alignSelf: 'center', marginBottom: 14 },
  priceSheetTitle:   { fontSize: 16, fontWeight: '800', color: '#111827', marginBottom: 2 },
  priceSheetSub:     { fontSize: 12, color: '#9CA3AF', marginBottom: 14 },
  priceSheetRow:     { flexDirection: 'row', gap: 10, marginBottom: 8 },
  priceSheetPriceWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8F7F4', borderRadius: 14, borderWidth: 1.5, borderColor: '#4F46E5', paddingHorizontal: 12 },
  priceSheetPrefix:  { fontSize: 22, fontWeight: '800', color: '#059669', marginRight: 4 },
  priceSheetInput:   { flex: 1, fontSize: 26, fontWeight: '800', color: '#059669', paddingVertical: 10 },
  priceSheetTotal:   { fontSize: 13, fontWeight: '600', color: '#059669', textAlign: 'right', marginBottom: 10 },
  priceSheetActions: { flexDirection: 'row', gap: 8, marginTop: 4 },

  // ── Empty state ─────────────────────────────────────────
  empty:     { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  emptyIcon: { fontSize: 52, marginBottom: 16 },
  emptyTitle:{ fontSize: 20, fontWeight: '800', color: '#111827', marginBottom: 8 },
  emptyBody: { fontSize: 14, color: '#9CA3AF', textAlign: 'center', lineHeight: 22 },
});