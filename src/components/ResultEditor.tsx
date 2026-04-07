// src/components/ResultEditor.tsx
import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  Switch,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function ResultEditor({ scanner, onSave, onViewInventory }: any) {
  const insets = useSafeAreaInsets();

  const canSave =
    !scanner.isContinuousMode &&
    scanner.editProduct &&
    scanner.editPrice !== '---' &&
    scanner.editPrice !== '';

  return (
    <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom + 8, 20) }]}>
      {/* Drag handle — feels like a native bottom sheet */}
      <View style={styles.dragHandle} />

      {/* Product + Price side by side */}
      <View style={styles.infoRow}>
        <View style={[styles.infoCard, styles.infoCardProduct]}>
          <Text style={styles.infoLabel}>PRODUCT</Text>
          <TextInput
            style={styles.productInput}
            value={scanner.editProduct}
            onChangeText={scanner.setEditProduct}
            placeholder="Align tag in box…"
            placeholderTextColor="#C4C4C4"
            multiline
            numberOfLines={2}
          />
        </View>

        <View style={[styles.infoCard, styles.infoCardPrice]}>
          <Text style={styles.infoLabel}>PRICE</Text>
          <TextInput
            style={styles.priceInput}
            value={scanner.editPrice}
            onChangeText={scanner.setEditPrice}
            placeholder="₱0.00"
            placeholderTextColor="#C4C4C4"
            keyboardType="numeric"
          />
        </View>
      </View>

      {/* Feedback pill (auto-save confirmation) */}
      {scanner.scanFeedback ? (
        <View style={styles.feedbackPill}>
          <Text style={styles.feedbackText}>{scanner.scanFeedback}</Text>
        </View>
      ) : null}

      {/* Auto-save toggle */}
      <View style={styles.toggleCard}>
        <View style={styles.toggleLeft}>
          <Text style={styles.toggleIcon}>⚡</Text>
          <View>
            <Text style={styles.toggleTitle}>Auto-Save Mode</Text>
            <Text style={styles.toggleSub}>Save items without confirming</Text>
          </View>
        </View>
        <Switch
          value={scanner.isContinuousMode}
          onValueChange={scanner.setIsContinuousMode}
          trackColor={{ false: '#E5E7EB', true: '#4F46E5' }}
          thumbColor="#FFFFFF"
          ios_backgroundColor="#E5E7EB"
        />
      </View>

      {/* Primary CTA area */}
      <View style={styles.ctaRow}>
        {canSave ? (
          <>
            <TouchableOpacity
              style={[styles.btn, styles.btnSave]}
              onPress={onSave}
              activeOpacity={0.85}
            >
              <Text style={styles.btnText}>Save to List</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btn, styles.btnScanSecondary]}
              onPress={scanner.captureAndRead}
              disabled={scanner.isProcessing || scanner.isModelLoading}
              activeOpacity={0.85}
            >
              {scanner.isProcessing ? (
                <ActivityIndicator color="#374151" size="small" />
              ) : (
                <Text style={styles.btnTextSecondary}>Scan Again</Text>
              )}
            </TouchableOpacity>
          </>
        ) : (
          <TouchableOpacity
            style={[
              styles.btn,
              styles.btnScan,
              (scanner.isModelLoading || scanner.isProcessing) && styles.btnDisabled,
            ]}
            onPress={scanner.captureAndRead}
            disabled={scanner.isProcessing || scanner.isModelLoading}
            activeOpacity={0.85}
          >
            {scanner.isProcessing ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : scanner.isModelLoading ? (
              <Text style={styles.btnText}>⏳ Loading AI…</Text>
            ) : (
              <Text style={styles.btnText}>Scan Tag</Text>
            )}
          </TouchableOpacity>
        )}
      </View>

      {/* Inventory link */}
      <TouchableOpacity style={styles.inventoryLink} onPress={onViewInventory}>
        <Text style={styles.inventoryText}>View Grocery List →</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: {
    paddingHorizontal: 16,
    paddingTop: 0,
    backgroundColor: '#F8F7F4',
  },

  dragHandle: {
    width: 36,
    height: 4,
    backgroundColor: '#D1D5DB',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 8,
    marginBottom: 14,
  },

  // ── Info cards ─────────────────────────────────────────
  infoRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  infoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  infoCardProduct: {
    flex: 1.6,
  },
  infoCardPrice: {
    flex: 1,
    justifyContent: 'space-between',
  },
  infoLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#9CA3AF',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  productInput: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    padding: 0,
    lineHeight: 22,
  },
  priceInput: {
    fontSize: 28,
    fontWeight: '800',
    color: '#059669',
    padding: 0,
    marginTop: 4,
  },

  // ── Feedback ────────────────────────────────────────────
  feedbackPill: {
    backgroundColor: '#ECFDF5',
    borderRadius: 20,
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignSelf: 'center',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#A7F3D0',
  },
  feedbackText: {
    color: '#059669',
    fontSize: 13,
    fontWeight: '600',
  },

  // ── Toggle ──────────────────────────────────────────────
  toggleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 10,
  },
  toggleLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  toggleIcon: {
    fontSize: 18,
  },
  toggleTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  toggleSub: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 1,
  },

  // ── Buttons ─────────────────────────────────────────────
  ctaRow: {
    gap: 8,
    marginBottom: 8,
  },
  btn: {
    borderRadius: 18,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnScan: {
    backgroundColor: '#4F46E5',
  },
  btnSave: {
    backgroundColor: '#059669',
  },
  btnScanSecondary: {
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  btnDisabled: {
    backgroundColor: '#D1D5DB',
  },
  btnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  btnTextSecondary: {
    color: '#374151',
    fontSize: 15,
    fontWeight: '600',
  },

  // ── Footer link ─────────────────────────────────────────
  inventoryLink: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  inventoryText: {
    color: '#4F46E5',
    fontSize: 14,
    fontWeight: '600',
  },
});