// src/screens/HomeScreen.tsx
import React, { useEffect, useState, useCallback } from 'react';
import {
  StyleSheet, View, Text, TouchableOpacity,
  ScrollView, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useIsFocused } from '@react-navigation/native';
import Svg, { Path, Circle, Rect, Line, Polyline } from 'react-native-svg';

import {
  getActiveTrip, getTripItems, getAllTrips,
  Trip, TripItem, getUpcomingTrips,  
} from '../utils/database';

import CalendarModal from '../components/CalendarModal';

const formatPeso = (n: number) =>
  `₱${n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function HomeScreen({ navigation }: any) {
  const [activeTrip,  setActiveTrip]  = useState<Trip | null>(null);
  const [tripItems,   setTripItems]   = useState<TripItem[]>([]);
  const [allTrips,    setAllTrips]    = useState<Trip[]>([]);
  const [refreshing,  setRefreshing]  = useState(false);
  const isFocused = useIsFocused();

  const [upcomingTrips, setUpcomingTrips] = useState<Trip[]>([]);
  const [showCalendar,  setShowCalendar]  = useState(false);

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
    const upcoming = await getUpcomingTrips();
    setUpcomingTrips(upcoming);
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
    if (h < 12) return 'Good morning!';
    if (h < 18) return 'Good afternoon!';
    return 'Good evening!';
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
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 6 }}>
                <Path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
                <Circle cx="12" cy="13" r="4" />
              </Svg>
              <Text style={styles.scanFabText}>Scan</Text>
            </View>
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

        {upcomingTrips.length > 0 ? (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Upcoming Trips</Text>
              <TouchableOpacity onPress={() => setShowCalendar(true)}>
                <Text style={styles.sectionLink}>Calendar →</Text>
              </TouchableOpacity>
            </View>
            {upcomingTrips.map(trip => (
              <TouchableOpacity
                key={trip.id}
                style={upcomingStyles.row}
                onPress={() => navigation.navigate('TripDetail', { tripId: trip.id })}
                activeOpacity={0.8}
              >
                <View style={upcomingStyles.dateBadge}>
                  <Text style={upcomingStyles.dateDay}>
                    {new Date(trip.scheduled_at!).getDate()}
                  </Text>
                  <Text style={upcomingStyles.dateMon}>
                    {new Date(trip.scheduled_at!).toLocaleDateString('en-PH', { month: 'short' })}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={upcomingStyles.name} numberOfLines={1}>{trip.name}</Text>
                  <Text style={upcomingStyles.time}>
                    {new Date(trip.scheduled_at!).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit' })}
                    {trip.store ? `  ·  ${trip.store}` : ''}
                  </Text>
                </View>
                <Text style={{ color: '#9CA3AF', fontSize: 18 }}>›</Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : (
          <TouchableOpacity
            style={upcomingStyles.emptyCalBtn}
            onPress={() => setShowCalendar(true)}
          >
            <Text style={upcomingStyles.emptyCalBtnText}>📅  View Shopping Calendar</Text>
          </TouchableOpacity>
        )}

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
            
            {/* My Lists Action */}
            <TouchableOpacity
              style={styles.actionCard}
              onPress={() => navigation.navigate('ListsTab')}
            >
              <Svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#4F46E5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 8 }}>
                <Path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                <Line x1="9" y1="12" x2="15" y2="12" />
                <Line x1="9" y1="16" x2="15" y2="16" />
              </Svg>
              <Text style={styles.actionLabel}>My-Lists</Text>
            </TouchableOpacity>

            {/* Scan Tag Action */}
            <TouchableOpacity
              style={styles.actionCard}
              onPress={() => navigation.navigate('ScannerTab')}
            >
              <Svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#4F46E5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 8 }}>
                <Path d="M4 7V4h3M20 7V4h-3M4 17v3h3M20 17v3h-3M7 12h10M7 9h10M7 15h10" />
              </Svg>
              <Text style={styles.actionLabel}>Scan-Tag</Text>
            </TouchableOpacity>

            {/* Settings Action */}
            <TouchableOpacity
              style={styles.actionCard}
              onPress={() => navigation.navigate('SettingsTab')}
            >
              <Svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#4F46E5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 8 }}>
                <Circle cx="12" cy="12" r="3" />
                <Path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" />
              </Svg>
              <Text style={styles.actionLabel}>Settings</Text>
            </TouchableOpacity>

          </View>
        </View>
      </ScrollView>
      <CalendarModal
        visible={showCalendar}
        onClose={() => setShowCalendar(false)}
        onNavigate={(id) => {
          setShowCalendar(false);
          navigation.navigate('TripDetail', { tripId: id });
        }}
      />
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

const upcomingStyles = StyleSheet.create({
  row: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderLeftWidth: 3,
    borderLeftColor: '#4F46E5',
  },
  dateBadge: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#EEF2FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateDay:  { fontSize: 16, fontWeight: '800', color: '#4F46E5' },
  dateMon:  { fontSize: 10, fontWeight: '600', color: '#818CF8' },
  name:     { fontSize: 14, fontWeight: '700', color: '#111827' },
  time:     { fontSize: 12, color: '#9CA3AF', marginTop: 2, fontWeight: '500' },
  emptyCalBtn: {
    backgroundColor: '#EEF2FF',
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#C7D2FE',
    marginBottom: 20,
  },
  emptyCalBtnText: { color: '#4F46E5', fontWeight: '700', fontSize: 14 },
});