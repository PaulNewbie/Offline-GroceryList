// src/screens/CatalogueScreen.tsx
//
// Replaces InventoryScreen. Surfaces the ProductCatalogue table that was
// previously populated silently but never shown to the user anywhere.
//
// Features:
//   • Search with live FTS5-backed results (reuses searchCatalogue)
//   • Full list sorted by scan_count desc when search is empty
//   • Shows last known price + how many times scanned + last seen date
//   • "Add to current list" shortcut — taps pre-fill AddItemBar in TripDetail
//   • Pull-to-refresh
//   • Empty state with explanation

import React, { useEffect, useState, useCallback } from 'react';
import {
  StyleSheet, View, Text, FlatList,
  TextInput, TouchableOpacity, RefreshControl,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useIsFocused } from '@react-navigation/native';
import * as SQLite from 'expo-sqlite';

import {
  searchCatalogue, getScannerTarget,
  addItem, formatPrice, CatalogueEntry,
} from '../utils/database';

// ─── Full catalogue fetch (all rows, sorted by scan_count) ────────────────────
// searchCatalogue requires a query string. For the "show all" state we need
// a separate direct query — exposed here as a module-local helper.
const db = (SQLite as any).openDatabaseSync('buyoyo_offline.db');

const getAllCatalogue = async (): Promise<CatalogueEntry[]> => {
  try {
    return await db.getAllAsync(
      `SELECT * FROM ProductCatalogue ORDER BY scan_count DESC, last_seen_at DESC LIMIT 200`,
    ) as CatalogueEntry[];
  } catch { return []; }
};

const deleteCatalogueEntry = async (id: number): Promise<boolean> => {
  try {
    await db.runAsync('DELETE FROM ProductCatalogue WHERE id = ?', [id]);
    return true;
  } catch { return false; }
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const formatRelativeDate = (iso: string): string => {
  const diff = Date.now() - new Date(iso).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 7)  return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return `${Math.floor(days / 30)}mo ago`;
};

// ─── Catalogue entry row ──────────────────────────────────────────────────────
function CatalogueRow({
  entry,
  onAddToList,
  onDelete,
}: {
  entry: CatalogueEntry;
  onAddToList: (entry: CatalogueEntry) => void;
  onDelete: (entry: CatalogueEntry) => void;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.rowLeft}>
        <Text style={styles.rowName} numberOfLines={2}>{entry.name}</Text>
        <View style={styles.rowMeta}>
          <Text style={styles.rowMetaText}>
            {formatRelativeDate(entry.last_seen_at)}
          </Text>
          <View style={styles.metaDot} />
          <Text style={styles.rowMetaText}>
            scanned {entry.scan_count}×
          </Text>
        </View>
      </View>

      <View style={styles.rowRight}>
        {entry.last_price > 0 ? (
          <Text style={styles.rowPrice}>{formatPrice(entry.last_price)}</Text>
        ) : (
          <Text style={styles.rowNoPrice}>no price</Text>
        )}
        <View style={styles.rowActions}>
          <TouchableOpacity
            style={styles.addBtn}
            onPress={() => onAddToList(entry)}
            activeOpacity={0.75}
          >
            <Text style={styles.addBtnText}>+ Add</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.deleteBtn}
            onPress={() => onDelete(entry)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            activeOpacity={0.75}
          >
            <Text style={styles.deleteBtnText}>✕</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function CatalogueScreen({ navigation }: any) {
  const [entries,     setEntries]     = useState<CatalogueEntry[]>([]);
  const [query,       setQuery]       = useState('');
  const [refreshing,  setRefreshing]  = useState(false);
  const [totalCount,  setTotalCount]  = useState(0);
  const isFocused = useIsFocused();

  const load = useCallback(async () => {
    const rows = query.trim().length >= 2
      ? await searchCatalogue(query)
      : await getAllCatalogue();
    setEntries(rows);

    // Keep total count for the header (always reflects full table, not search)
    if (!query.trim()) setTotalCount(rows.length);
  }, [query]);

  useEffect(() => { if (isFocused) load(); }, [isFocused, load]);

  // Re-search as query changes
  useEffect(() => { load(); }, [query]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  // ── Add to scanner-target list ───────────────────────────────────────────
  const handleAddToList = async (entry: CatalogueEntry) => {
    const trip = await getScannerTarget();
    if (!trip) {
      Alert.alert('No active list', 'Create a list first before adding items.');
      return;
    }
    const insertId = await addItem(
      trip.id,
      entry.name,
      entry.last_price ?? 0,
      1,
    );
    if (insertId) {
      Alert.alert(
        'Added!',
        `"${entry.name}" added to "${trip.name}".`,
        [
          { text: 'OK' },
          {
            text: 'View List',
            onPress: () =>
              navigation.navigate('HomeTab', {
                screen: 'TripDetail',
                params: { tripId: trip.id },
              }),
          },
        ],
      );
    }
  };

  // ── Delete entry ─────────────────────────────────────────────────────────
  const handleDelete = (entry: CatalogueEntry) => {
    Alert.alert(
      'Remove from History',
      `Remove "${entry.name}" from your price history?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            await deleteCatalogueEntry(entry.id);
            load();
          },
        },
      ],
    );
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  const isSearching = query.trim().length >= 2;

  return (
    <SafeAreaView style={styles.container} edges={['bottom', 'left', 'right']}>
      {/* Search bar */}
      <View style={styles.searchWrap}>
        <Text style={styles.searchIcon}>🔍</Text>
        <TextInput
          style={styles.searchInput}
          value={query}
          onChangeText={setQuery}
          placeholder="Search price history…"
          placeholderTextColor="#C4C4C4"
          returnKeyType="search"
          clearButtonMode="while-editing"
          autoCorrect={false}
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => setQuery('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={styles.clearIcon}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={entries}
        keyExtractor={item => item.id.toString()}
        renderItem={({ item }) => (
          <CatalogueRow
            entry={item}
            onAddToList={handleAddToList}
            onDelete={handleDelete}
          />
        )}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListHeaderComponent={
          entries.length > 0 ? (
            <Text style={styles.listHeader}>
              {isSearching
                ? `${entries.length} result${entries.length !== 1 ? 's' : ''} for "${query}"`
                : `${totalCount} product${totalCount !== 1 ? 's' : ''} in history`}
            </Text>
          ) : null
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            {isSearching ? (
              <>
                <Text style={styles.emptyIcon}>🔍</Text>
                <Text style={styles.emptyTitle}>No results for "{query}"</Text>
                <Text style={styles.emptyBody}>
                  Try a different spelling or scan the product first.
                </Text>
              </>
            ) : (
              <>
                <Text style={styles.emptyIcon}>🏷️</Text>
                <Text style={styles.emptyTitle}>No price history yet</Text>
                <Text style={styles.emptyBody}>
                  Every product you scan or add with a price is saved here
                  automatically. Next time you need it, you'll see the last
                  known price instantly.
                </Text>
              </>
            )}
          </View>
        }
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      />
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F7F4' },

  // ── Search ───────────────────────────────────────────────
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    marginHorizontal: 14,
    marginTop: 12,
    marginBottom: 8,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    gap: 8,
  },
  searchIcon:  { fontSize: 15 },
  searchInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    color: '#111827',
    padding: 0,
  },
  clearIcon: { fontSize: 13, color: '#9CA3AF', fontWeight: '700' },

  // ── List ─────────────────────────────────────────────────
  listContent:  { paddingHorizontal: 14, paddingBottom: 40 },
  listHeader:   {
    fontSize: 12,
    fontWeight: '600',
    color: '#9CA3AF',
    marginBottom: 10,
    marginTop: 2,
    letterSpacing: 0.2,
  },

  // ── Row ──────────────────────────────────────────────────
  row: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
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
  rowLeft:      { flex: 1, paddingRight: 12 },
  rowName:      { fontSize: 15, fontWeight: '700', color: '#111827', lineHeight: 20, marginBottom: 4 },
  rowMeta:      { flexDirection: 'row', alignItems: 'center', gap: 6 },
  rowMetaText:  { fontSize: 11, color: '#9CA3AF', fontWeight: '500' },
  metaDot:      { width: 3, height: 3, borderRadius: 1.5, backgroundColor: '#D1D5DB' },

  rowRight:     { alignItems: 'flex-end', gap: 6 },
  rowPrice:     { fontSize: 16, fontWeight: '800', color: '#059669' },
  rowNoPrice:   { fontSize: 12, color: '#D1D5DB', fontWeight: '500', fontStyle: 'italic' },

  rowActions:   { flexDirection: 'row', alignItems: 'center', gap: 6 },
  addBtn: {
    backgroundColor: '#EEF2FF',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  addBtnText:  { fontSize: 12, fontWeight: '700', color: '#4F46E5' },
  deleteBtn:   { padding: 4 },
  deleteBtnText: { fontSize: 13, color: '#D1D5DB', fontWeight: '700' },

  // ── Empty ─────────────────────────────────────────────────
  empty:     { alignItems: 'center', paddingTop: 60, paddingHorizontal: 32 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyTitle:{ fontSize: 18, fontWeight: '800', color: '#111827', marginBottom: 8, textAlign: 'center' },
  emptyBody: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 22,
  },
});