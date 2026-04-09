// src/screens/SettingsScreen.tsx
import React, { useEffect, useState } from 'react';
import {
  StyleSheet, View, Text, TouchableOpacity,
  TextInput, ScrollView, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BUDGET_KEY     = 'grocery_budget';
const DEFAULT_BUDGET = 2000;

const formatPeso = (n: number) =>
  `₱${n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function SettingsScreen() {
  const [budget,       setBudget]       = useState(DEFAULT_BUDGET);
  const [budgetInput,  setBudgetInput]  = useState(DEFAULT_BUDGET.toString());
  const [editingBudget, setEditingBudget] = useState(false);
  const [saved,        setSaved]        = useState(false);

  useEffect(() => {
    (async () => {
      const v = await AsyncStorage.getItem(BUDGET_KEY);
      if (v) {
        const n = parseFloat(v);
        if (!isNaN(n)) { setBudget(n); setBudgetInput(n.toString()); }
      }
    })();
  }, []);

  const saveBudget = async () => {
    const parsed = parseFloat(budgetInput);
    if (isNaN(parsed) || parsed <= 0) {
      Alert.alert('Invalid', 'Please enter a valid budget amount.');
      return;
    }
    setBudget(parsed);
    await AsyncStorage.setItem(BUDGET_KEY, parsed.toString());
    setEditingBudget(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const clearAllData = () => {
    Alert.alert(
      'Clear All Data',
      'This will delete all your shopping lists and items. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear Everything',
          style: 'destructive',
          onPress: async () => {
            await AsyncStorage.clear();
            Alert.alert('Done', 'All data has been cleared. Restart the app.');
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        <Text style={styles.pageTitle}>Settings</Text>

        {/* ── Budget ─────────────────────────────────────── */}
        <Text style={styles.sectionLabel}>SHOPPING PREFERENCES</Text>
        <View style={styles.card}>
          <View style={styles.cardRow}>
            <View style={styles.cardRowLeft}>
              <Text style={styles.cardRowTitle}>Default Budget</Text>
              <Text style={styles.cardRowSub}>Applied to all new shopping lists</Text>
            </View>
            {!editingBudget ? (
              <TouchableOpacity onPress={() => setEditingBudget(true)} style={styles.valueBtn}>
                <Text style={styles.valueBtnText}>{formatPeso(budget)}</Text>
                <Text style={styles.editHint}> ✎</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.inlineEdit}>
                <Text style={styles.pesoPrefix}>₱</Text>
                <TextInput
                  style={styles.budgetInput}
                  value={budgetInput}
                  onChangeText={setBudgetInput}
                  keyboardType="decimal-pad"
                  autoFocus
                  selectTextOnFocus
                  returnKeyType="done"
                  onSubmitEditing={saveBudget}
                />
                <TouchableOpacity style={styles.saveBtn} onPress={saveBudget}>
                  <Text style={styles.saveBtnText}>Save</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
          {saved && (
            <Text style={styles.savedText}>✓ Budget saved</Text>
          )}
        </View>

        {/* ── About ──────────────────────────────────────── */}
        <Text style={styles.sectionLabel}>ABOUT</Text>
        <View style={styles.card}>
          <View style={[styles.cardRow, styles.cardRowNoBorder]}>
            <Text style={styles.cardRowTitle}>Grocery Offline</Text>
            <Text style={styles.cardRowSub}>v1.0.0</Text>
          </View>
          <View style={[styles.cardRow, styles.cardRowNoBorder]}>
            <Text style={styles.cardRowTitle}>Offline-first grocery scanner</Text>
            <Text style={styles.cardRowSub}>Built for Philippine shoppers 🇵🇭</Text>
          </View>
        </View>

        {/* ── Danger zone ────────────────────────────────── */}
        <Text style={styles.sectionLabel}>DANGER ZONE</Text>
        <View style={styles.card}>
          <TouchableOpacity style={[styles.cardRow, styles.cardRowNoBorder]} onPress={clearAllData}>
            <View style={styles.cardRowLeft}>
              <Text style={[styles.cardRowTitle, { color: '#DC2626' }]}>Clear All Data</Text>
              <Text style={styles.cardRowSub}>Delete all lists, items, and preferences</Text>
            </View>
            <Text style={styles.dangerChevron}>›</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F7F4' },
  scroll:    { padding: 16, paddingBottom: 48 },

  pageTitle:    { fontSize: 28, fontWeight: '800', color: '#111827', marginBottom: 24, letterSpacing: -0.5 },
  sectionLabel: { fontSize: 11, fontWeight: '700', color: '#9CA3AF', letterSpacing: 0.8, marginBottom: 8, marginTop: 16 },

  card: { backgroundColor: '#FFFFFF', borderRadius: 16, borderWidth: 1, borderColor: '#E5E7EB', overflow: 'hidden', marginBottom: 4 },

  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  cardRowNoBorder: { borderBottomWidth: 0 },
  cardRowLeft:     { flex: 1, marginRight: 12 },
  cardRowTitle:    { fontSize: 15, fontWeight: '600', color: '#111827', marginBottom: 2 },
  cardRowSub:      { fontSize: 12, color: '#9CA3AF' },

  valueBtn:     { flexDirection: 'row', alignItems: 'center' },
  valueBtnText: { fontSize: 16, fontWeight: '700', color: '#4F46E5' },
  editHint:     { fontSize: 13, color: '#9CA3AF' },

  inlineEdit:  { flexDirection: 'row', alignItems: 'center', gap: 4 },
  pesoPrefix:  { fontSize: 16, fontWeight: '700', color: '#4F46E5' },
  budgetInput: { fontSize: 16, fontWeight: '700', color: '#4F46E5', minWidth: 70, borderBottomWidth: 2, borderBottomColor: '#4F46E5', paddingVertical: 2, paddingHorizontal: 4 },
  saveBtn:     { paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#4F46E5', borderRadius: 8, marginLeft: 6 },
  saveBtnText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },
  savedText:   { color: '#059669', fontSize: 12, fontWeight: '600', paddingHorizontal: 16, paddingBottom: 12 },

  dangerChevron: { fontSize: 20, color: '#DC2626', fontWeight: '300' },
});