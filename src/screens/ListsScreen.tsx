// src/screens/ListsScreen.tsx
import React, { useEffect, useState, useCallback } from 'react';
import {
  StyleSheet, View, Text, FlatList,
  TouchableOpacity, Alert, TextInput,
  Modal, KeyboardAvoidingView, Platform, Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useIsFocused } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Svg, { Path, Circle, Rect, Line, Polyline } from 'react-native-svg';

import {
  getAllTripsWithSummary, createTrip, deleteTrip,
  completeTrip, duplicateTripAsTemplate,
  formatPrice, setScannerTarget,
  Trip, TripWithSummary,
} from '../utils/database';

const BUDGET_KEY     = 'grocery_budget';
const DEFAULT_BUDGET = 2000;

// ─── Minimal SVG icons ────────────────────────────────────────────────────────

function IconCamera({ size = 16, color = '#4F46E5' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 22 22" fill="none">
      <Rect x="2" y="5" width="18" height="14" rx="2" stroke={color} strokeWidth="1.8" />
      <Circle cx="11" cy="12" r="3.5" stroke={color} strokeWidth="1.8" />
      <Path d="M8 5V4C8 3.4 8.4 3 9 3H13C13.6 3 14 3.4 14 4V5"
        stroke={color} strokeWidth="1.8" strokeLinejoin="round" />
    </Svg>
  );
}

function IconCheck({ size = 14, color = '#059669' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 14 14" fill="none">
      <Polyline points="2,7 6,11 12,3" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function IconTrash({ size = 14, color = '#DC2626' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 14 14" fill="none">
      <Polyline points="2,3 12,3" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
      <Path d="M5 3V2h4v1" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <Rect x="3" y="4" width="8" height="8" rx="1" stroke={color} strokeWidth="1.6" />
      <Line x1="6" y1="6.5" x2="6" y2="10" stroke={color} strokeWidth="1.4" strokeLinecap="round" />
      <Line x1="8" y1="6.5" x2="8" y2="10" stroke={color} strokeWidth="1.4" strokeLinecap="round" />
    </Svg>
  );
}

function IconCopy({ size = 14, color = '#6B7280' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 14 14" fill="none">
      <Rect x="4" y="4" width="8" height="9" rx="1.2" stroke={color} strokeWidth="1.5" />
      <Path d="M2 10V2.8C2 2.36 2.36 2 2.8 2H10" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
    </Svg>
  );
}

// ─── New List Modal ───────────────────────────────────────────────────────────
function NewListModal({
  visible, onClose, onConfirm, defaultBudget,
}: {
  visible: boolean;
  onClose: () => void;
  onConfirm: (name: string, store: string, budget: number, note: string) => void;
  defaultBudget: number;
}) {
  const [name,   setName]   = useState('');
  const [store,  setStore]  = useState('');
  const [budget, setBudget] = useState(defaultBudget.toString());
  const [note,   setNote]   = useState('');

  const canCreate = name.trim().length > 0;

  const handleClose = () => {
    setName(''); setStore(''); setBudget(defaultBudget.toString()); setNote('');
    onClose();
  };

  const handleCreate = () => {
    if (!canCreate) return;
    onConfirm(name.trim(), store.trim(), parseFloat(budget) || DEFAULT_BUDGET, note.trim());
    setName(''); setStore(''); setBudget(defaultBudget.toString()); setNote('');
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <KeyboardAvoidingView
        style={styles.modalBackdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />
        <View style={styles.modalSheet}>
          <View style={styles.dragHandle} />
          <Text style={styles.modalTitle}>New Shopping List</Text>
          <Text style={styles.modalSub}>Give your list a name to get started.</Text>

          <Text style={styles.modalLabel}>LIST NAME *</Text>
          <TextInput
            style={styles.modalInput}
            value={name}
            onChangeText={setName}
            placeholder="e.g. Weekly groceries, Adobo ingredients"
            placeholderTextColor="#C4C4C4"
            autoFocus
            returnKeyType="next"
          />

          <Text style={styles.modalLabel}>NOTE (optional)</Text>
          <TextInput
            style={[styles.modalInput, styles.modalInputNote]}
            value={note}
            onChangeText={setNote}
            placeholder="e.g. For mom's birthday dinner"
            placeholderTextColor="#C4C4C4"
            returnKeyType="next"
            multiline
          />

          <Text style={styles.modalLabel}>STORE (optional)</Text>
          <TextInput
            style={styles.modalInput}
            value={store}
            onChangeText={setStore}
            placeholder="e.g. SM, Puregold, Palengke"
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
// FIX: now uses TripWithSummary — summary data comes from the JOIN query,
// not from a separate per-trip getTripItems() call.
function TripCard({ trip, isScannerTarget, onPress, onComplete, onDelete, onDuplicate, onSetScanner }: {
  trip: TripWithSummary;
  isScannerTarget: boolean;
  onPress: () => void;
  onComplete: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onSetScanner: () => void;
}) {
  const isOverBudget  = trip.total_spent > trip.budget;
  const pct           = Math.min((trip.total_spent / trip.budget) * 100, 100);
  const unpricedCount = trip.item_count - trip.priced_count;
  const isCompleted   = trip.status === 'completed';

  return (
    <TouchableOpacity
      style={[styles.tripCard, isScannerTarget && styles.tripCardTarget]}
      onPress={onPress}
      activeOpacity={0.85}
    >
      {/* Top row */}
      <View style={styles.tripCardTop}>
        <View style={styles.tripCardTopLeft}>
          <View style={[
            styles.statusDot,
            trip.status === 'completed' && styles.statusDotDone,
            trip.status === 'template'  && styles.statusDotTemplate,
          ]} />
          <Text style={styles.statusText}>
            {trip.status === 'active'    ? 'Active'
           : trip.status === 'completed' ? 'Done'
           : 'Template'}
          </Text>
        </View>
        <View style={styles.tripCardTopRight}>
          {isScannerTarget && (
            <View style={styles.scannerTargetBadge}>
              <IconCamera size={11} color="#4F46E5" />
              <Text style={styles.scannerTargetText}>Scanner</Text>
            </View>
          )}
          {trip.store ? (
            <Text style={styles.tripStore}>{trip.store}</Text>
          ) : null}
        </View>
      </View>

      {/* Name */}
      <Text style={styles.tripName}>{trip.name}</Text>

      {/* Note */}
      {trip.note ? (
        <Text style={styles.tripNote} numberOfLines={2}>{trip.note}</Text>
      ) : null}

      {/* Date */}
      <Text style={styles.tripDate}>
        {new Date(trip.created_at).toLocaleDateString('en-PH', {
          month: 'long', day: 'numeric', year: 'numeric',
        })}
      </Text>

      {/* Item summary — now from JOIN, not a separate query */}
      <Text style={styles.tripMeta}>
        {trip.item_count} {trip.item_count === 1 ? 'item' : 'items'}
        {trip.priced_count > 0 ? ` · ${trip.priced_count} priced` : ''}
        {unpricedCount > 0     ? ` · ${unpricedCount} no price`   : ''}
      </Text>

      {/* Budget bar */}
      {trip.priced_count > 0 && (
        <>
          <View style={styles.tripBarBg}>
            <View style={[
              styles.tripBarFill,
              { width: `${pct}%` as any, backgroundColor: isOverBudget ? '#DC2626' : '#4F46E5' },
            ]} />
          </View>
          <Text style={[styles.tripSpent, isOverBudget && { color: '#DC2626' }]}>
            {formatPrice(trip.total_spent)}
            <Text style={styles.tripBudget}> / {formatPrice(trip.budget)}</Text>
          </Text>
        </>
      )}

      {/* Divider */}
      <View style={styles.actionDivider} />

      {/* Actions */}
      <View style={styles.tripActions}>
        {!isCompleted && !isScannerTarget && (
          <TouchableOpacity style={styles.actionBtn} onPress={onSetScanner}>
            <IconCamera size={13} color="#4F46E5" />
            <Text style={[styles.actionBtnText, { color: '#4F46E5' }]}>Use for Scanner</Text>
          </TouchableOpacity>
        )}
        {trip.status === 'active' && (
          <TouchableOpacity style={styles.actionBtn} onPress={onComplete}>
            <IconCheck size={13} color="#059669" />
            <Text style={[styles.actionBtnText, { color: '#059669' }]}>Complete</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={styles.actionBtn} onPress={onDuplicate}>
          <IconCopy size={13} color="#6B7280" />
          <Text style={styles.actionBtnText}>Save as template</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.actionBtn, styles.actionBtnDelete]} onPress={onDelete}>
          <IconTrash size={13} color="#DC2626" />
          <Text style={[styles.actionBtnText, styles.actionBtnDeleteText]}>Delete</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

// ─── Section header ────────────────────────────────────────────────────────────
function SectionHeader({ label, accent }: { label: string; accent: string }) {
  return (
    <View style={[styles.sectionHeader, { borderLeftColor: accent }]}>
      <Text style={styles.sectionHeaderText}>{label}</Text>
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function ListsScreen({ navigation }: any) {
  const [trips,           setTrips]           = useState<TripWithSummary[]>([]);
  const [showNewList,     setShowNewList]      = useState(false);
  const [defaultBudget,   setDefaultBudget]   = useState(DEFAULT_BUDGET);
  const [scannerTargetId, setScannerTargetId] = useState<number | null>(null);
  const isFocused = useIsFocused();

  // FIX: Single query replaces the N+1 Promise.all loop.
  // getAllTripsWithSummary returns item_count, priced_count, total_spent via
  // a LEFT JOIN + GROUP BY — no per-trip follow-up queries needed.
  const load = useCallback(async () => {
    const saved = await AsyncStorage.getItem(BUDGET_KEY);
    if (saved) setDefaultBudget(parseFloat(saved) || DEFAULT_BUDGET);

    const enriched = await getAllTripsWithSummary();
    setTrips(enriched);

    const target = enriched.find(t => t.is_scanner_target === 1);
    setScannerTargetId(target?.id ?? null);
  }, []);

  useEffect(() => { if (isFocused) load(); }, [isFocused, load]);

  // ── Handlers ────────────────────────────────────────────
  const handleCreate = async (name: string, store: string, budget: number, note: string) => {
    const id = await createTrip(name, budget, store || undefined, 'active', note || undefined);
    load();
    if (id) navigation.navigate('TripDetail', { tripId: id });
  };

  const handleComplete = (trip: Trip) => {
    Alert.alert('Mark as Complete', `Mark "${trip.name}" as completed?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Complete', onPress: async () => { await completeTrip(trip.id); load(); } },
    ]);
  };

  const handleDelete = (trip: Trip) => {
    Alert.alert('Delete List', `Delete "${trip.name}"? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await deleteTrip(trip.id); load(); } },
    ]);
  };

  const handleDuplicate = async (trip: Trip) => {
    const newName = `${trip.name} (Copy)`;
    await duplicateTripAsTemplate(trip.id, newName);
    load();
    Alert.alert('Saved as Template', `"${newName}" is ready to reuse.`);
  };

  const handleSetScanner = async (trip: Trip) => {
    await setScannerTarget(trip.id);
    setScannerTargetId(trip.id);
    load();
  };

  // Group
  const active    = trips.filter(t => t.status === 'active');
  const templates = trips.filter(t => t.status === 'template');
  const completed = trips.filter(t => t.status === 'completed');

  const renderCard = (trip: TripWithSummary) => (
    <TripCard
      key={trip.id}
      trip={trip}
      isScannerTarget={trip.id === scannerTargetId}
      onPress={() => navigation.navigate('TripDetail', { tripId: trip.id })}
      onComplete={() => handleComplete(trip)}
      onDelete={() => handleDelete(trip)}
      onDuplicate={() => handleDuplicate(trip)}
      onSetScanner={() => handleSetScanner(trip)}
    />
  );

  return (
    <SafeAreaView style={styles.container} edges={['bottom', 'left', 'right']}>
      <FlatList
        data={[]}
        keyExtractor={() => 'dummy'}
        renderItem={null}
        ListHeaderComponent={
          <View style={styles.listContent}>
            <TouchableOpacity style={styles.newBtn} onPress={() => setShowNewList(true)} activeOpacity={0.85}>
              <Text style={styles.newBtnText}>+ New Shopping List</Text>
            </TouchableOpacity>

            {trips.length === 0 && (
              <View style={styles.empty}>
                <Text style={styles.emptyIcon}>📋</Text>
                <Text style={styles.emptyTitle}>No lists yet</Text>
                <Text style={styles.emptyBody}>
                  Create a list and start adding items.{'\n'}
                  Prices are always optional.
                </Text>
              </View>
            )}

            {active.length > 0 && (
              <View style={styles.section}>
                <SectionHeader label="Active" accent="#4F46E5" />
                {active.map(renderCard)}
              </View>
            )}

            {templates.length > 0 && (
              <View style={styles.section}>
                <SectionHeader label="Templates" accent="#D97706" />
                {templates.map(renderCard)}
              </View>
            )}

            {completed.length > 0 && (
              <View style={styles.section}>
                <SectionHeader label="History" accent="#9CA3AF" />
                {completed.map(renderCard)}
              </View>
            )}
          </View>
        }
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
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
  listContent: { padding: 14 },

  newBtn:     { backgroundColor: '#4F46E5', borderRadius: 16, paddingVertical: 15, alignItems: 'center', marginBottom: 20 },
  newBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },

  section:           { marginBottom: 8 },
  sectionHeader:     { borderLeftWidth: 3, paddingLeft: 10, marginBottom: 10, marginTop: 4 },
  sectionHeaderText: { fontSize: 12, fontWeight: '800', color: '#374151', letterSpacing: 0.4, textTransform: 'uppercase' },

  tripCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  tripCardTarget: {
    borderColor: '#C7D2FE',
    backgroundColor: '#FAFAFE',
  },

  tripCardTop:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  tripCardTopLeft:  { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tripCardTopRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },

  statusDot:         { width: 7, height: 7, borderRadius: 4, backgroundColor: '#4F46E5' },
  statusDotDone:     { backgroundColor: '#059669' },
  statusDotTemplate: { backgroundColor: '#D97706' },
  statusText:        { fontSize: 12, fontWeight: '600', color: '#6B7280' },

  scannerTargetBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: '#EEF2FF', paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 20, borderWidth: 1, borderColor: '#C7D2FE',
  },
  scannerTargetText: { fontSize: 11, fontWeight: '700', color: '#4F46E5' },

  tripStore: { fontSize: 11, color: '#9CA3AF', fontWeight: '500' },
  tripName:  { fontSize: 17, fontWeight: '800', color: '#111827', marginBottom: 4 },
  tripNote:  { fontSize: 13, color: '#6B7280', marginBottom: 6, lineHeight: 18, fontStyle: 'italic' },
  tripDate:  { fontSize: 11, color: '#C4C4C4', marginBottom: 6 },
  tripMeta:  { fontSize: 13, color: '#6B7280', marginBottom: 10 },

  tripBarBg:   { height: 4, backgroundColor: '#F3F4F6', borderRadius: 3, overflow: 'hidden', marginBottom: 6 },
  tripBarFill: { height: '100%', borderRadius: 3 },
  tripSpent:   { fontSize: 16, fontWeight: '800', color: '#111827', marginBottom: 2 },
  tripBudget:  { fontSize: 13, color: '#9CA3AF', fontWeight: '400' },

  actionDivider: { height: 1, backgroundColor: '#F3F4F6', marginVertical: 12 },

  tripActions:         { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  actionBtn:           { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, backgroundColor: '#F3F4F6' },
  actionBtnText:       { fontSize: 12, fontWeight: '600', color: '#374151' },
  actionBtnDelete:     { backgroundColor: '#FEF2F2' },
  actionBtnDeleteText: { color: '#DC2626' },

  empty:     { alignItems: 'center', paddingTop: 60, paddingHorizontal: 32 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyTitle:{ fontSize: 18, fontWeight: '800', color: '#111827', marginBottom: 6 },
  emptyBody: { fontSize: 14, color: '#9CA3AF', textAlign: 'center', lineHeight: 22 },

  modalBackdrop:        { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  modalSheet:           { backgroundColor: '#FFFFFF', borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 40 },
  dragHandle:           { width: 36, height: 4, backgroundColor: '#D1D5DB', borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  modalTitle:           { fontSize: 20, fontWeight: '800', color: '#111827', marginBottom: 4 },
  modalSub:             { fontSize: 13, color: '#9CA3AF', marginBottom: 24 },
  modalLabel:           { fontSize: 10, fontWeight: '700', color: '#9CA3AF', letterSpacing: 0.8, marginBottom: 6 },
  modalInput:           { backgroundColor: '#F8F7F4', borderRadius: 14, padding: 14, fontSize: 15, fontWeight: '600', color: '#111827', borderWidth: 1, borderColor: '#E5E7EB', marginBottom: 14 },
  modalInputNote:       { minHeight: 60, textAlignVertical: 'top', fontWeight: '400', fontStyle: 'italic' },
  modalInputPrice:      { color: '#059669', fontWeight: '800' },
  modalActions:         { flexDirection: 'row', gap: 10, marginTop: 4 },
  modalCancelBtn:       { flex: 1, paddingVertical: 14, borderRadius: 14, backgroundColor: '#F3F4F6', alignItems: 'center' },
  modalCancelText:      { color: '#6B7280', fontSize: 15, fontWeight: '600' },
  modalConfirmBtn:      { flex: 2, paddingVertical: 14, borderRadius: 14, backgroundColor: '#4F46E5', alignItems: 'center' },
  modalConfirmDisabled: { backgroundColor: '#D1D5DB' },
  modalConfirmText:     { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
});