// src/components/CalendarModal.tsx
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  StyleSheet, View, Text, Modal, TouchableOpacity,
  TextInput, Pressable, ActivityIndicator,
  KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Calendar, DateData } from 'react-native-calendars';

import {
  getScheduledByMonth, ScheduledDay,
  createTrip, setTripSchedule,
} from '../utils/database';
import { scheduleTripNotification } from '../utils/notifications';

// ─── Types ────────────────────────────────────────────────────────────────────
type MarkedDates = Record<string, {
  dots?:          Array<{ key: string; color: string }>;
  selected?:      boolean;
  selectedColor?: string;
}>;

// ─── Helpers ──────────────────────────────────────────────────────────────────
const toMonthBounds = (yearMonth: string) => {
  const [y, m] = yearMonth.split('-').map(Number);
  const lastDay = new Date(y, m, 0).getDate();
  return {
    start: `${yearMonth}-01`,
    end:   `${yearMonth}-${String(lastDay).padStart(2, '0')}`,
  };
};

const todayString = () => new Date().toISOString().split('T')[0];

const formatDayHeading = (iso: string) =>
  new Date(iso + 'T00:00:00').toLocaleDateString('en-PH', {
    weekday: 'long', month: 'long', day: 'numeric',
  });

// Hour options shown in the time picker (6am–9pm)
const HOUR_OPTIONS = [6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21];
const MINUTE_OPTIONS = [0, 15, 30, 45];

const fmt12 = (h: number) =>
  h < 12 ? `${h}am` : h === 12 ? '12pm' : `${h - 12}pm`;

// ─── Quick-create sheet ───────────────────────────────────────────────────────
// Slides up when user taps an empty day. Keeps it minimal — just name + time.
function QuickCreateSheet({
  day,
  onClose,
  onCreated,
}: {
  day: string;
  onClose: () => void;
  onCreated: (tripId: number, name: string, scheduledAt: string) => void;
}) {
  const insets = useSafeAreaInsets();
  const [name,   setName]   = useState('');
  const [hour,   setHour]   = useState(10);
  const [minute, setMinute] = useState(0);
  const [saving, setSaving] = useState(false);

  const canSave = name.trim().length > 0;

  const buildIso = () => {
    const [y, m, d] = day.split('-').map(Number);
    return new Date(y, m - 1, d, hour, minute, 0, 0).toISOString();
  };

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      const iso = buildIso();
      const id  = await createTrip(name.trim(), 2000, undefined, 'active');
      if (id) {
        await setTripSchedule(id, iso);
        await scheduleTripNotification(id, name.trim(), iso);
        onCreated(id, name.trim(), iso);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    // KeyboardAvoidingView so the input isn't hidden by the keyboard
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.createSheetOuter}
    >
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      <View style={[styles.createSheet, { paddingBottom: Math.max(insets.bottom + 16, 24) }]}>
        <View style={styles.dragHandle} />

        <Text style={styles.createTitle}>Schedule a trip</Text>
        <Text style={styles.createSub}>{formatDayHeading(day)}</Text>

        {/* List name */}
        <Text style={styles.fieldLabel}>LIST NAME</Text>
        <TextInput
          style={styles.nameInput}
          value={name}
          onChangeText={setName}
          placeholder="e.g. Weekly groceries, SM run"
          placeholderTextColor="#C4C4C4"
          autoFocus
          returnKeyType="done"
          onSubmitEditing={handleSave}
        />

        {/* Hour picker */}
        <Text style={styles.fieldLabel}>WHAT TIME?</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={{ marginBottom: 8 }}
          contentContainerStyle={{ gap: 6, paddingRight: 4 }}
        >
          {HOUR_OPTIONS.map(h => (
            <TouchableOpacity
              key={h}
              style={[styles.chip, hour === h && styles.chipActive]}
              onPress={() => setHour(h)}
            >
              <Text style={[styles.chipText, hour === h && styles.chipTextActive]}>
                {fmt12(h)}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Minute picker */}
        <View style={styles.minuteRow}>
          {MINUTE_OPTIONS.map(m => (
            <TouchableOpacity
              key={m}
              style={[styles.chip, styles.chipMinute, minute === m && styles.chipActive]}
              onPress={() => setMinute(m)}
            >
              <Text style={[styles.chipText, minute === m && styles.chipTextActive]}>
                :{String(m).padStart(2, '0')}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Preview */}
        <View style={styles.previewRow}>
          <Text style={styles.previewIcon}>📅</Text>
          <Text style={styles.previewText}>
            {formatDayHeading(day)} at {fmt12(hour)}
            {minute > 0 ? `:${String(minute).padStart(2, '0')}` : ''}
          </Text>
        </View>

        {/* Actions */}
        <View style={styles.sheetActions}>
          <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.confirmBtn, !canSave && styles.confirmBtnDisabled]}
            onPress={handleSave}
            disabled={!canSave || saving}
          >
            {saving
              ? <ActivityIndicator color="#FFFFFF" size="small" />
              : <Text style={styles.confirmBtnText}>Schedule Trip</Text>
            }
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

// ─── Day detail panel ─────────────────────────────────────────────────────────
// Shows existing trips for a selected day + button to add another.
function DayPanel({
  day,
  scheduledDays,
  onNavigate,
  onAddAnother,
}: {
  day: string;
  scheduledDays: ScheduledDay[];
  onNavigate: (tripId: number) => void;
  onAddAnother: () => void;
}) {
  const match = scheduledDays.find(d => d.day === day);

  return (
    <View style={styles.dayPanel}>
      <Text style={styles.dayPanelHeading}>{formatDayHeading(day)}</Text>

      {match ? (
        match.trips.map(trip => (
          <TouchableOpacity
            key={trip.id}
            style={styles.tripRow}
            onPress={() => onNavigate(trip.id)}
            activeOpacity={0.75}
          >
            <View style={styles.tripDot} />
            <Text style={styles.tripName} numberOfLines={1}>{trip.name}</Text>
            <Text style={styles.tripTime}>
              {new Date(trip.scheduled_at).toLocaleTimeString('en-PH', {
                hour: '2-digit', minute: '2-digit',
              })}
            </Text>
            <Text style={styles.tripChevron}>›</Text>
          </TouchableOpacity>
        ))
      ) : (
        <Text style={styles.noTripsText}>No trips scheduled.</Text>
      )}

      {/* Always show the add button */}
      <TouchableOpacity style={styles.addAnotherBtn} onPress={onAddAnother} activeOpacity={0.75}>
        <Text style={styles.addAnotherBtnText}>+ Schedule a trip for this day</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Main modal ───────────────────────────────────────────────────────────────
interface CalendarModalProps {
  visible:    boolean;
  onClose:    () => void;
  onNavigate: (tripId: number) => void;
}

export default function CalendarModal({ visible, onClose, onNavigate }: CalendarModalProps) {
  const insets = useSafeAreaInsets();

  const [currentMonth,  setCurrentMonth]  = useState(() => todayString().slice(0, 7));
  const [scheduledDays, setScheduledDays] = useState<ScheduledDay[]>([]);
  const [selectedDay,   setSelectedDay]   = useState<string | null>(null);
  const [creating,      setCreating]      = useState(false);  // show QuickCreateSheet
  const [loading,       setLoading]       = useState(false);

  const cache = useRef<Record<string, ScheduledDay[]>>({});

  const fetchMonth = useCallback(async (monthKey: string) => {
    if (cache.current[monthKey]) {
      setScheduledDays(cache.current[monthKey]);
      return;
    }
    setLoading(true);
    const { start, end } = toMonthBounds(monthKey);
    const days = await getScheduledByMonth(start, end);
    cache.current[monthKey] = days;
    setScheduledDays(days);
    setLoading(false);
  }, []);

  // Invalidate cache + refetch when modal opens
  useEffect(() => {
    if (visible) {
      cache.current = {};
      fetchMonth(currentMonth);
    }
  }, [visible]);

  useEffect(() => {
    if (visible) fetchMonth(currentMonth);
  }, [currentMonth]);

  // Called when a trip is successfully created from the QuickCreateSheet
  const handleCreated = (tripId: number, name: string, scheduledAt: string) => {
    setCreating(false);
    // Invalidate cache so the new dot appears immediately
    cache.current = {};
    fetchMonth(currentMonth);
    // Stay on the calendar so the user sees the new dot — don't navigate away
  };

  const markedDates = (): MarkedDates => {
    const marks: MarkedDates = {};
    for (const d of scheduledDays) {
      marks[d.day] = {
        dots: [{ key: 'trip', color: '#4F46E5' }],
        ...(selectedDay === d.day ? { selected: true, selectedColor: '#4F46E5' } : {}),
      };
    }
    if (selectedDay && !marks[selectedDay]) {
      marks[selectedDay] = { selected: true, selectedColor: '#4F46E5' };
    }
    return marks;
  };

  const handleDayPress = (day: DateData) => {
    setSelectedDay(day.dateString);
    setCreating(false);  // close create sheet if open
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>

      {/* Dim backdrop — tapping it closes the whole modal */}
      <Pressable style={styles.backdrop} onPress={onClose} />

      {/* Main calendar sheet */}
      <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom + 8, 16) }]}>
        <View style={styles.dragHandle} />

        {/* Header */}
        <View style={styles.sheetHeader}>
          <Text style={styles.sheetTitle}>Shopping Calendar</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            {loading && <ActivityIndicator size="small" color="#4F46E5" />}
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={styles.closeBtn}>✕</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Calendar grid */}
        <Calendar
          current={currentMonth + '-01'}
          markingType="multi-dot"
          markedDates={markedDates()}
          onDayPress={handleDayPress}
          onMonthChange={(month: DateData) => {
            setSelectedDay(null);
            setCreating(false);
            setCurrentMonth(month.dateString.slice(0, 7));
          }}
          theme={{
            todayTextColor:             '#4F46E5',
            selectedDayBackgroundColor: '#4F46E5',
            dotColor:                   '#4F46E5',
            arrowColor:                 '#4F46E5',
            textDayFontWeight:          '600',
            textMonthFontWeight:        '800',
            calendarBackground:         'transparent',
            dayTextColor:               '#111827',
            textDisabledColor:          '#D1D5DB',
            monthTextColor:             '#111827',
          }}
        />

        {/* Day panel — appears when a day is tapped */}
        {selectedDay && !creating && (
          <DayPanel
            day={selectedDay}
            scheduledDays={scheduledDays}
            onNavigate={(id) => { onClose(); onNavigate(id); }}
            onAddAnother={() => setCreating(true)}
          />
        )}
      </View>

      {/* Quick-create sheet — slides over the calendar sheet */}
      {creating && selectedDay && (
        <QuickCreateSheet
          day={selectedDay}
          onClose={() => setCreating(false)}
          onCreated={handleCreated}
        />
      )}

    </Modal>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },

  // ── Main sheet ──────────────────────────────────────────
  sheet: {
    position:             'absolute',
    bottom: 0, left: 0, right: 0,
    backgroundColor:      '#FFFFFF',
    borderTopLeftRadius:  28,
    borderTopRightRadius: 28,
    paddingHorizontal:    16,
    paddingTop:           12,
  },
  dragHandle: {
    width: 36, height: 4,
    backgroundColor: '#D1D5DB',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  sheetTitle: { fontSize: 18, fontWeight: '800', color: '#111827' },
  closeBtn:   { fontSize: 16, color: '#9CA3AF', fontWeight: '700', padding: 4 },

  // ── Day panel ────────────────────────────────────────────
  dayPanel: {
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
    paddingTop: 12,
  },
  dayPanelHeading: {
    fontSize: 14, fontWeight: '700', color: '#374151', marginBottom: 10,
  },
  tripRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: '#F9FAFB',
  },
  tripDot:     { width: 8, height: 8, borderRadius: 4, backgroundColor: '#4F46E5', marginRight: 10 },
  tripName:    { flex: 1, fontSize: 14, fontWeight: '600', color: '#111827' },
  tripTime:    { fontSize: 13, color: '#9CA3AF', fontWeight: '500', marginRight: 6 },
  tripChevron: { fontSize: 18, color: '#9CA3AF' },
  noTripsText: { fontSize: 13, color: '#C4C4C4', fontStyle: 'italic', marginBottom: 10 },

  addAnotherBtn: {
    marginTop: 10,
    backgroundColor: '#EEF2FF',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#C7D2FE',
    marginBottom: 4,
  },
  addAnotherBtnText: { color: '#4F46E5', fontWeight: '700', fontSize: 14 },

  // ── Quick-create sheet ───────────────────────────────────
  createSheetOuter: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
  },
  createSheet: {
    backgroundColor:      '#FFFFFF',
    borderTopLeftRadius:  28,
    borderTopRightRadius: 28,
    paddingHorizontal:    20,
    paddingTop:           12,
  },
  createTitle: { fontSize: 18, fontWeight: '800', color: '#111827', marginBottom: 2 },
  createSub:   { fontSize: 13, color: '#9CA3AF', marginBottom: 18 },

  fieldLabel: {
    fontSize: 10, fontWeight: '700', color: '#9CA3AF',
    letterSpacing: 0.8, marginBottom: 6,
  },
  nameInput: {
    backgroundColor: '#F8F7F4', borderRadius: 14,
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, fontWeight: '600', color: '#111827',
    borderWidth: 1, borderColor: '#E5E7EB', marginBottom: 16,
  },

  chip: {
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 10, backgroundColor: '#F3F4F6',
    borderWidth: 1, borderColor: '#E5E7EB',
  },
  chipMinute: { flex: 1, alignItems: 'center' },
  chipActive: { backgroundColor: '#EEF2FF', borderColor: '#C7D2FE' },
  chipText:   { fontSize: 13, fontWeight: '600', color: '#6B7280' },
  chipTextActive: { color: '#4F46E5' },

  minuteRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },

  previewRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#F8F7F4', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 10,
    marginBottom: 18, borderWidth: 1, borderColor: '#E5E7EB',
  },
  previewIcon: { fontSize: 16 },
  previewText: { fontSize: 13, fontWeight: '600', color: '#374151', flex: 1 },

  sheetActions: { flexDirection: 'row', gap: 10 },
  cancelBtn: {
    flex: 1, paddingVertical: 14, borderRadius: 14,
    backgroundColor: '#F3F4F6', alignItems: 'center',
  },
  cancelBtnText: { color: '#6B7280', fontSize: 15, fontWeight: '600' },
  confirmBtn: {
    flex: 2, paddingVertical: 14, borderRadius: 14,
    backgroundColor: '#4F46E5', alignItems: 'center',
  },
  confirmBtnDisabled: { backgroundColor: '#D1D5DB' },
  confirmBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
});