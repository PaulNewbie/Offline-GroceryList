// src/components/ScheduleDatePicker.tsx
// A minimal inline date+time picker that works on both iOS and Android
// without any additional native libraries.
// Usage: drop inside NewListModal or TripHeader's edit mode.

import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Platform, Modal, Pressable,
} from 'react-native';

interface ScheduleDatePickerProps {
  value:    string | null;      // ISO string or null
  onChange: (iso: string | null) => void;
  label?:   string;
}

// Generate the next 90 days as selectable options
const generateDays = (): Array<{ label: string; iso: string }> => {
  const days: Array<{ label: string; iso: string }> = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = 0; i < 90; i++) {
    const d = new Date(today.getTime() + i * 86400000);
    const iso = d.toISOString().split('T')[0];
    const label = i === 0 ? 'Today' : i === 1 ? 'Tomorrow'
      : d.toLocaleDateString('en-PH', { weekday: 'short', month: 'short', day: 'numeric' });
    days.push({ label, iso });
  }
  return days;
};

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = [0, 15, 30, 45];

export default function ScheduleDatePicker({
  value, onChange, label = 'SCHEDULE DATE (optional)',
}: ScheduleDatePickerProps) {
  const [picking, setPicking] = useState(false);

  const days = generateDays();

  // Parse existing value
  const existing = value ? new Date(value) : null;
  const [selectedDay,    setSelectedDay]    = useState<string>(existing?.toISOString().split('T')[0] ?? days[1].iso);
  const [selectedHour,   setSelectedHour]   = useState<number>(existing?.getHours() ?? 10);
  const [selectedMinute, setSelectedMinute] = useState<number>(existing?.getMinutes() ?? 0);

  const handleConfirm = () => {
    const [y, m, d] = selectedDay.split('-').map(Number);
    const dt = new Date(y, m - 1, d, selectedHour, selectedMinute, 0, 0);
    onChange(dt.toISOString());
    setPicking(false);
  };

  const handleClear = () => {
    onChange(null);
    setPicking(false);
  };

  const displayValue = value
    ? new Date(value).toLocaleString('en-PH', {
        weekday: 'short', month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit',
      })
    : null;

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <TouchableOpacity
        style={[styles.btn, value && styles.btnActive]}
        onPress={() => setPicking(true)}
        activeOpacity={0.75}
      >
        <Text style={[styles.btnText, value && styles.btnTextActive]}>
          {displayValue ? `📅  ${displayValue}` : '📅  Set a date and time…'}
        </Text>
        {value && (
          <TouchableOpacity
            onPress={handleClear}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.clearText}>✕</Text>
          </TouchableOpacity>
        )}
      </TouchableOpacity>

      <Modal visible={picking} transparent animationType="slide" onRequestClose={() => setPicking(false)}>
        <Pressable style={styles.backdrop} onPress={() => setPicking(false)} />
        <View style={styles.pickerSheet}>
          <View style={styles.dragHandle} />
          <Text style={styles.pickerTitle}>Pick a date & time</Text>

          {/* Day scroll */}
          <Text style={styles.pickerLabel}>DAY</Text>
          <View style={styles.dayRow}>
            {days.slice(0, 14).map(d => (
              <TouchableOpacity
                key={d.iso}
                style={[styles.dayChip, selectedDay === d.iso && styles.dayChipActive]}
                onPress={() => setSelectedDay(d.iso)}
              >
                <Text style={[styles.dayChipText, selectedDay === d.iso && styles.dayChipTextActive]}>
                  {d.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Hour grid */}
          <Text style={styles.pickerLabel}>HOUR</Text>
          <View style={styles.timeGrid}>
            {[6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21].map(h => (
              <TouchableOpacity
                key={h}
                style={[styles.timeChip, selectedHour === h && styles.timeChipActive]}
                onPress={() => setSelectedHour(h)}
              >
                <Text style={[styles.timeChipText, selectedHour === h && styles.timeChipTextActive]}>
                  {h < 12 ? `${h}am` : h === 12 ? '12pm' : `${h - 12}pm`}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Minute */}
          <Text style={styles.pickerLabel}>MINUTE</Text>
          <View style={styles.minuteRow}>
            {MINUTES.map(m => (
              <TouchableOpacity
                key={m}
                style={[styles.timeChip, selectedMinute === m && styles.timeChipActive]}
                onPress={() => setSelectedMinute(m)}
              >
                <Text style={[styles.timeChipText, selectedMinute === m && styles.timeChipTextActive]}>
                  :{String(m).padStart(2, '0')}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.pickerActions}>
            <TouchableOpacity style={styles.cancelBtn} onPress={handleClear}>
              <Text style={styles.cancelBtnText}>Clear</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.confirmBtn} onPress={handleConfirm}>
              <Text style={styles.confirmBtnText}>Set Schedule</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: 14 },
  label: { fontSize: 10, fontWeight: '700', color: '#9CA3AF', letterSpacing: 0.8, marginBottom: 6 },
  btn: {
    backgroundColor: '#F8F7F4', borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12,
    borderWidth: 1, borderColor: '#E5E7EB', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  btnActive:         { borderColor: '#C7D2FE', backgroundColor: '#EEF2FF' },
  btnText:           { fontSize: 14, color: '#C4C4C4', fontWeight: '500', flex: 1 },
  btnTextActive:     { color: '#4F46E5', fontWeight: '600' },
  clearText:         { fontSize: 13, color: '#9CA3AF', fontWeight: '700', paddingLeft: 8 },

  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)' },
  pickerSheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#FFFFFF', borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: 20, paddingBottom: 36,
  },
  dragHandle: { width: 36, height: 4, backgroundColor: '#D1D5DB', borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  pickerTitle: { fontSize: 18, fontWeight: '800', color: '#111827', marginBottom: 16 },
  pickerLabel: { fontSize: 10, fontWeight: '700', color: '#9CA3AF', letterSpacing: 0.8, marginBottom: 8, marginTop: 12 },

  dayRow:  { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  dayChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: '#E5E7EB' },
  dayChipActive: { backgroundColor: '#EEF2FF', borderColor: '#C7D2FE' },
  dayChipText:   { fontSize: 12, fontWeight: '600', color: '#6B7280' },
  dayChipTextActive: { color: '#4F46E5' },

  timeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  minuteRow: { flexDirection: 'row', gap: 8 },
  timeChip:  { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: '#E5E7EB' },
  timeChipActive: { backgroundColor: '#EEF2FF', borderColor: '#C7D2FE' },
  timeChipText:   { fontSize: 12, fontWeight: '600', color: '#6B7280' },
  timeChipTextActive: { color: '#4F46E5' },

  pickerActions: { flexDirection: 'row', gap: 10, marginTop: 20 },
  cancelBtn:     { flex: 1, paddingVertical: 13, borderRadius: 14, backgroundColor: '#F3F4F6', alignItems: 'center' },
  cancelBtnText: { color: '#6B7280', fontSize: 14, fontWeight: '600' },
  confirmBtn:    { flex: 2, paddingVertical: 13, borderRadius: 14, backgroundColor: '#4F46E5', alignItems: 'center' },
  confirmBtnText:{ color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
});