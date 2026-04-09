// src/screens/HomeScreen.tsx
import React, { useEffect, useState, useCallback } from 'react';
import {
  StyleSheet, View, Text, TouchableOpacity,
  ScrollView, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useIsFocused } from '@react-navigation/native';

import {
  getActiveTrip, getTripItems, getAllTrips,
  Trip, TripItem,
} from '../utils/database';

const formatPeso = (n: number) =>
  `₱${n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function HomeScreen({ navigation }: any) {
  const [activeTrip,  setActiveTrip]  = useState<Trip | null>(null);
  const [tripItems,   setTripItems]   = useState<TripItem[]>([]);
  const [allTrips,    setAllTrips]    = useState<Trip[]>([]);
  const [refreshing,  setRefreshing]  = useState(false);
  const isFocused = useIsFocused();

  const load = useCallback(async () => {
    const trip  = await getActiveTrip();
    const trips = await getAllTrips();
    setActiveTrip(trip);
    setAllTrips(trips);
    if (trip) {
      const items = await getTripItems(trip.id);
      setTripItems(items);
    } else {
      setTripItems([]);
    }
  }, []);

  useEffect(() => { if (isFocused) load(); }, [isFocused, load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  // ── Budget math ─────────────────────────────────────────
  const totalSpent = tripItems.reduce(
    (sum, i) => sum + (i.unit_price ?? 0) * (i.quantity ?? 1), 0,
  );
  const budget        = activeTrip?.budget ?? 2000;
  const budgetPct     = Math.min((totalSpent / budget) * 100, 100);
  const isOverBudget  = totalSpent > budget;
  const checkedCount  = tripItems.filter(i => i.is_checked).length;
  const completedTrips = allTrips.filter(t => t.status === 'completed').length;

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning 👋';
    if (h < 18) return 'Good afternoon 👋';
    return 'Good evening 👋';
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ── */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>{greeting()}</Text>
            <Text style={styles.appName}>Grocery App List</Text>
          </View>
          <TouchableOpacity
            style={styles.scanFab}
            onPress={() => navigation.navigate('ScannerTab')}
            activeOpacity={0.85}
          >
            <Text style={styles.scanFabText}>📷 Scan</Text>
          </TouchableOpacity>
        </View>

        {/* ── Active trip card ── */}
        {activeTrip ? (
          <TouchableOpacity
            style={styles.activeTripCard}
            onPress={() => navigation.navigate('TripDetail', { tripId: activeTrip.id })}
            activeOpacity={0.9}
          >
            <View style={styles.activeTripHeader}>
              <View style={styles.activeBadge}>
                <Text style={styles.activeBadgeText}>ACTIVE</Text>
              </View>
              <Text style={styles.activeTripChevron}>›</Text>
            </View>
            <Text style={styles.activeTripName}>{activeTrip.name}</Text>
            {activeTrip.store && (
              <Text style={styles.activeTripStore}>📍 {activeTrip.store}</Text>
            )}

            {/* Mini budget bar */}
            <View style={styles.miniBarBg}>
              <View style={[
                styles.miniBarFill,
                { width: `${budgetPct}%` as any, backgroundColor: isOverBudget ? '#DC2626' : '#FFFFFF' },
              ]} />
            </View>

            <View style={styles.activeTripFooter}>
              <Text style={styles.activeTripSpent}>
                {formatPeso(totalSpent)}
                <Text style={styles.activeTripBudget}> / {formatPeso(budget)}</Text>
              </Text>
              <Text style={styles.activeTripItems}>
                {tripItems.length} items · {checkedCount} checked
              </Text>
            </View>
          </TouchableOpacity>
        ) : (
          <View style={styles.noTripCard}>
            <Text style={styles.noTripText}>No active shopping list</Text>
            <TouchableOpacity
              style={styles.newTripBtn}
              onPress={() => navigation.navigate('ListsTab')}
            >
              <Text style={styles.newTripBtnText}>Create a List</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Quick stats row ── */}
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{allTrips.filter(t => t.status === 'active').length}</Text>
            <Text style={styles.statLabel}>Active Lists</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{completedTrips}</Text>
            <Text style={styles.statLabel}>Completed</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{allTrips.filter(t => t.status === 'template').length}</Text>
            <Text style={styles.statLabel}>Templates</Text>
          </View>
        </View>

        {/* ── Recent items preview ── */}
        {tripItems.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Recent Items</Text>
              <TouchableOpacity onPress={() => navigation.navigate('TripDetail', { tripId: activeTrip?.id })}>
                <Text style={styles.sectionLink}>See all →</Text>
              </TouchableOpacity>
            </View>
            {tripItems.slice(0, 4).map(item => (
              <View key={item.id} style={styles.previewRow}>
                <Text style={styles.previewName} numberOfLines={1}>{item.product}</Text>
                <Text style={styles.previewPrice}>
                  {formatPeso((item.unit_price ?? 0) * (item.quantity ?? 1))}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* ── Quick actions ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.actionsGrid}>
            <TouchableOpacity
              style={styles.actionCard}
              onPress={() => navigation.navigate('ListsTab')}
            >
              <Text style={styles.actionIcon}>📋</Text>
              <Text style={styles.actionLabel}>My Lists</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionCard}
              onPress={() => navigation.navigate('ScannerTab')}
            >
              <Text style={styles.actionIcon}>📷</Text>
              <Text style={styles.actionLabel}>Scan Tag</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionCard}
              onPress={() => navigation.navigate('SettingsTab')}
            >
              <Text style={styles.actionIcon}>⚙️</Text>
              <Text style={styles.actionLabel}>Settings</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F7F4' },
  scroll:    { padding: 16, paddingBottom: 40 },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  greeting: { fontSize: 13, color: '#9CA3AF', fontWeight: '500' },
  appName:  { fontSize: 28, fontWeight: '800', color: '#111827', letterSpacing: -0.5 },

  scanFab: {
    backgroundColor: '#4F46E5',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
  scanFabText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },

  // ── Active trip card ──────────────────────────────────
  activeTripCard: {
    backgroundColor: '#4F46E5',
    borderRadius: 20,
    padding: 18,
    marginBottom: 16,
  },
  activeTripHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  activeBadge:     { backgroundColor: 'rgba(255,255,255,0.25)', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20 },
  activeBadgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: '800', letterSpacing: 0.8 },
  activeTripChevron: { color: '#FFFFFF', fontSize: 24, fontWeight: '300' },
  activeTripName:    { fontSize: 20, fontWeight: '800', color: '#FFFFFF', marginBottom: 4 },
  activeTripStore:   { fontSize: 13, color: 'rgba(255,255,255,0.7)', marginBottom: 14 },

  miniBarBg:   { height: 4, backgroundColor: 'rgba(255,255,255,0.3)', borderRadius: 2, overflow: 'hidden', marginBottom: 12 },
  miniBarFill: { height: '100%', borderRadius: 2 },

  activeTripFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  activeTripSpent:  { fontSize: 22, fontWeight: '800', color: '#FFFFFF' },
  activeTripBudget: { fontSize: 14, color: 'rgba(255,255,255,0.7)', fontWeight: '400' },
  activeTripItems:  { fontSize: 12, color: 'rgba(255,255,255,0.7)' },

  noTripCard: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 24, marginBottom: 16, alignItems: 'center', borderWidth: 1, borderColor: '#E5E7EB' },
  noTripText: { fontSize: 15, color: '#9CA3AF', marginBottom: 14 },
  newTripBtn: { backgroundColor: '#4F46E5', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 14 },
  newTripBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 14 },

  // ── Stats ─────────────────────────────────────────────
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  statCard:  { flex: 1, backgroundColor: '#FFFFFF', borderRadius: 16, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: '#E5E7EB' },
  statValue: { fontSize: 24, fontWeight: '800', color: '#111827' },
  statLabel: { fontSize: 11, color: '#9CA3AF', marginTop: 2, fontWeight: '600' },

  // ── Sections ──────────────────────────────────────────
  section:       { marginBottom: 20 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  sectionTitle:  { fontSize: 16, fontWeight: '800', color: '#111827' },
  sectionLink:   { fontSize: 13, color: '#4F46E5', fontWeight: '600' },

  previewRow:   { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  previewName:  { fontSize: 14, fontWeight: '600', color: '#374151', flex: 1, marginRight: 8 },
  previewPrice: { fontSize: 14, fontWeight: '700', color: '#059669' },

  actionsGrid: { flexDirection: 'row', gap: 10 },
  actionCard:  { flex: 1, backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: '#E5E7EB' },
  actionIcon:  { fontSize: 24, marginBottom: 6 },
  actionLabel: { fontSize: 12, fontWeight: '700', color: '#374151' },
});