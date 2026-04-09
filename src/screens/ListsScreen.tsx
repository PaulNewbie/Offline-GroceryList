// src/screens/ListsScreen.tsx
import React, { useEffect, useState, useCallback } from 'react';
import {
  StyleSheet, View, Text, FlatList,
  TouchableOpacity, Alert, TextInput, Modal,
  KeyboardAvoidingView, Platform, Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useIsFocused } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  getAllTrips, createTrip, deleteTrip,
  completeTrip, duplicateTripAsTemplate,
  getTripItems, Trip,
} from '../utils/database';

const BUDGET_KEY  = 'grocery_budget';
const DEFAULT_BUDGET = 2000;

const formatPeso = (n: number) =>
  `₱${n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const STATUS_LABEL: Record<string, string> = {
  active: '🟢 Active', completed: '✅ Completed', template: '📄 Template',
};

// ─── New List Modal ───────────────────────────────────────────────────────────
function NewListModal({
  visible, onClose, onConfirm, defaultBudget,
}: {
  visible: boolean;
  onClose: () => void;
  onConfirm: (name: string, store: string, budget: number) => void;
  defaultBudget: number;
}) {
  const insets_bottom = 24;
  const [name,   setName]   = useState('');
  const [store,  setStore]  = useState('');
  const [budget, setBudget] = useState(defaultBudget.toString());

  const canCreate = name.trim().length > 0;

  const handleCreate = () => {
    if (!canCreate) return;
    onConfirm(name.trim(), store.trim(), parseFloat(budget) || DEFAULT_BUDGET);
    setName(''); setStore(''); setBudget(defaultBudget.toString());
    onClose();
  };

  const handleClose = () => {
    setName(''); setStore(''); setBudget(defaultBudget.toString());
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <KeyboardAvoidingView
        style={styles.modalBackdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />
        <View style={[styles.modalSheet, { paddingBottom: insets_bottom + 16 }]}>
          <View style={styles.dragHandle} />
          <Text style={styles.modalTitle}>New Shopping List</Text>
          <Text style={styles.modalSubtitle}>Give your list a name to get started.</Text>

          <Text style={styles.modalLabel}>LIST NAME *</Text>
          <TextInput
            style={styles.modalInput}
            value={name}
            onChangeText={setName}
            placeholder={`Shopping List — ${new Date().toLocaleDateString('en-PH', { month: 'short', day: 'numeric' })}`}
            placeholderTextColor="#C4C4C4"
            autoFocus
            returnKeyType="next"
          />

          <Text style={styles.modalLabel}>STORE (optional)</Text>
          <TextInput
            style={styles.modalInput}
            value={store}
            onChangeText={setStore}
            placeholder="e.g. SM Hypermarket, Puregold"
            placeholderTextColor="#C4C4C4"
            returnKeyType="next"
          />

          <Text style={styles.modalLabel}>BUDGET (₱)</Text>
          <TextInput
            style={[styles.modalInput, styles.modalInputPrice]}
            value={budget}
            onChangeText={setBudget}
            keyboardType="decimal-pad"
            returnKeyType="done"
            onSubmitEditing={handleCreate}
          />

          <View style={styles.modalActions}>
            <TouchableOpacity style={styles.modalCancelBtn} onPress={handleClose}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalConfirmBtn, !canCreate && styles.modalConfirmDisabled]}
              onPress={handleCreate}
              disabled={!canCreate}
            >
              <Text style={styles.modalConfirmText}>Create List</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Trip card ────────────────────────────────────────────────────────────────
function TripCard({
  trip, onPress, onComplete, onDelete, onDuplicate,
}: {
  trip: Trip & { itemCount: number; totalSpent: number };
  onPress: () => void;
  onComplete: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
}) {
  const isOverBudget = trip.totalSpent > trip.budget;
  const pct = Math.min((trip.totalSpent / trip.budget) * 100, 100);

  return (
    <TouchableOpacity style={styles.tripCard} onPress={onPress} activeOpacity={0.85}>
      {/* Status badge */}
      <View style={styles.tripCardHeader}>
        <Text style={styles.tripStatusText}>{STATUS_LABEL[trip.status]}</Text>
        {trip.store ? <Text style={styles.tripStore}>📍 {trip.store}</Text> : null}
      </View>

      <Text style={styles.tripName}>{trip.name}</Text>
      <Text style={styles.tripDate}>
        {new Date(trip.created_at).toLocaleDateString('en-PH', {
          month: 'long', day: 'numeric', year: 'numeric',
        })}
      </Text>

      {/* Mini budget bar */}
      <View style={styles.tripBarBg}>
        <View style={[
          styles.tripBarFill,
          { width: `${pct}%` as any, backgroundColor: isOverBudget ? '#DC2626' : '#4F46E5' },
        ]} />
      </View>

      <View style={styles.tripCardFooter}>
        <Text style={[styles.tripSpent, isOverBudget && { color: '#DC2626' }]}>
          {formatPeso(trip.totalSpent)}
          <Text style={styles.tripBudget}> / {formatPeso(trip.budget)}</Text>
        </Text>
        <Text style={styles.tripItemCount}>{trip.itemCount} items</Text>
      </View>

      {/* Actions */}
      <View style={styles.tripActions}>
        {trip.status === 'active' && (
          <TouchableOpacity style={styles.tripActionBtn} onPress={onComplete}>
            <Text style={styles.tripActionText}>✅ Complete</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.tripActionBtn} onPress={onDuplicate}>
          <Text style={styles.tripActionText}>📄 Template</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tripActionBtn, styles.tripDeleteBtn]} onPress={onDelete}>
          <Text style={styles.tripDeleteText}>🗑 Delete</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function ListsScreen({ navigation }: any) {
  const [trips,       setTrips]       = useState<any[]>([]);
  const [showNewList, setShowNewList] = useState(false);
  const [defaultBudget, setDefaultBudget] = useState(DEFAULT_BUDGET);
  const isFocused = useIsFocused();

  const load = useCallback(async () => {
    const savedBudget = await AsyncStorage.getItem(BUDGET_KEY);
    if (savedBudget) setDefaultBudget(parseFloat(savedBudget) || DEFAULT_BUDGET);

    const rawTrips = await getAllTrips();
    // Enrich each trip with item count and total spent
    const enriched = await Promise.all(rawTrips.map(async (trip) => {
      const items = await getTripItems(trip.id);
      const totalSpent = items.reduce((sum, i) => sum + (i.unit_price ?? 0) * (i.quantity ?? 1), 0);
      return { ...trip, itemCount: items.length, totalSpent };
    }));
    setTrips(enriched);
  }, []);

  useEffect(() => { if (isFocused) load(); }, [isFocused, load]);

  // ── Handlers ────────────────────────────────────────────
  const handleCreate = async (name: string, store: string, budget: number) => {
    await createTrip(name, budget, store || undefined);
    load();
  };

  const handleComplete = (trip: Trip) => {
    Alert.alert('Complete Trip', `Mark "${trip.name}" as completed?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Complete', onPress: async () => { await completeTrip(trip.id); load(); } },
    ]);
  };

  const handleDelete = (trip: Trip) => {
    Alert.alert('Delete List', `Delete "${trip.name}" and all its items?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => { await deleteTrip(trip.id); load(); },
      },
    ]);
  };

  const handleDuplicate = async (trip: Trip) => {
    const newName = `${trip.name} (Template)`;
    await duplicateTripAsTemplate(trip.id, newName);
    load();
    Alert.alert('Saved as Template', `"${newName}" is ready to reuse.`);
  };

  // Group by status
  const active    = trips.filter(t => t.status === 'active');
  const completed = trips.filter(t => t.status === 'completed');
  const templates = trips.filter(t => t.status === 'template');

  const sections = [
    ...(active.length    ? [{ title: '🟢 Active Lists',   data: active }]    : []),
    ...(templates.length ? [{ title: '📄 Templates',      data: templates }]  : []),
    ...(completed.length ? [{ title: '✅ History',        data: completed }]  : []),
  ];

  return (
    <SafeAreaView style={styles.container} edges={['bottom', 'left', 'right']}>
      <FlatList
        data={sections}
        keyExtractor={(_, i) => i.toString()}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={styles.listHeader}>
            <TouchableOpacity
              style={styles.newListBtn}
              onPress={() => setShowNewList(true)}
              activeOpacity={0.85}
            >
              <Text style={styles.newListBtnText}>+ New Shopping List</Text>
            </TouchableOpacity>
          </View>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>📋</Text>
            <Text style={styles.emptyTitle}>No lists yet</Text>
            <Text style={styles.emptyBody}>Create your first shopping list to get started.</Text>
          </View>
        }
        renderItem={({ item: section }) => (
          <View>
            <Text style={styles.groupTitle}>{section.title}</Text>
            {section.data.map((trip: any) => (
              <TripCard
                key={trip.id}
                trip={trip}
                onPress={() => navigation.navigate('TripDetail', { tripId: trip.id })}
                onComplete={() => handleComplete(trip)}
                onDelete={() => handleDelete(trip)}
                onDuplicate={() => handleDuplicate(trip)}
              />
            ))}
          </View>
        )}
      />

      <NewListModal
        visible={showNewList}
        onClose={() => setShowNewList(false)}
        onConfirm={handleCreate}
        defaultBudget={defaultBudget}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: '#F8F7F4' },
  listContent: { padding: 14, paddingBottom: 40 },
  listHeader:  { marginBottom: 6 },

  newListBtn: {
    backgroundColor: '#4F46E5',
    borderRadius: 16,
    paddingVertical: 15,
    alignItems: 'center',
    marginBottom: 16,
  },
  newListBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },

  groupTitle: { fontSize: 13, fontWeight: '700', color: '#9CA3AF', letterSpacing: 0.5, marginBottom: 8, marginTop: 4 },

  tripCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  tripCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  tripStatusText: { fontSize: 12, fontWeight: '700', color: '#6B7280' },
  tripStore:      { fontSize: 11, color: '#9CA3AF' },
  tripName:       { fontSize: 17, fontWeight: '800', color: '#111827', marginBottom: 2 },
  tripDate:       { fontSize: 12, color: '#9CA3AF', marginBottom: 12 },

  tripBarBg:   { height: 5, backgroundColor: '#F3F4F6', borderRadius: 3, overflow: 'hidden', marginBottom: 8 },
  tripBarFill: { height: '100%', borderRadius: 3 },

  tripCardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 },
  tripSpent:      { fontSize: 18, fontWeight: '800', color: '#111827' },
  tripBudget:     { fontSize: 13, color: '#9CA3AF', fontWeight: '400' },
  tripItemCount:  { fontSize: 12, color: '#9CA3AF' },

  tripActions:    { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  tripActionBtn:  { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, backgroundColor: '#F3F4F6' },
  tripActionText: { fontSize: 12, fontWeight: '600', color: '#374151' },
  tripDeleteBtn:  { backgroundColor: '#FEF2F2' },
  tripDeleteText: { fontSize: 12, fontWeight: '600', color: '#DC2626' },

  empty:     { alignItems: 'center', paddingTop: 60 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyTitle:{ fontSize: 18, fontWeight: '800', color: '#111827', marginBottom: 6 },
  emptyBody: { fontSize: 14, color: '#9CA3AF', textAlign: 'center' },

  // Modal
  modalBackdrop:        { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  modalSheet:           { backgroundColor: '#FFFFFF', borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 20, paddingTop: 12 },
  dragHandle:           { width: 36, height: 4, backgroundColor: '#D1D5DB', borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  modalTitle:           { fontSize: 18, fontWeight: '800', color: '#111827', marginBottom: 4 },
  modalSubtitle:        { fontSize: 13, color: '#9CA3AF', marginBottom: 20 },
  modalLabel:           { fontSize: 10, fontWeight: '700', color: '#9CA3AF', letterSpacing: 0.8, marginBottom: 6 },
  modalInput:           { backgroundColor: '#F8F7F4', borderRadius: 14, padding: 14, fontSize: 15, fontWeight: '600', color: '#111827', borderWidth: 1, borderColor: '#E5E7EB', marginBottom: 14 },
  modalInputPrice:      { color: '#059669', fontWeight: '800' },
  modalActions:         { flexDirection: 'row', gap: 10, marginTop: 4 },
  modalCancelBtn:       { flex: 1, paddingVertical: 14, borderRadius: 14, backgroundColor: '#F3F4F6', alignItems: 'center' },
  modalCancelText:      { color: '#6B7280', fontSize: 15, fontWeight: '600' },
  modalConfirmBtn:      { flex: 2, paddingVertical: 14, borderRadius: 14, backgroundColor: '#4F46E5', alignItems: 'center' },
  modalConfirmDisabled: { backgroundColor: '#D1D5DB' },
  modalConfirmText:     { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
});