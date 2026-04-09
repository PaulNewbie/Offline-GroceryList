// src/components/ResultEditor.tsx
import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Pressable,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ConfidenceLevel } from '../utils/scannerParser';

// ─── Confidence config ────────────────────────────────────────────────────────
const CONFIDENCE_CONFIG: Record<
  ConfidenceLevel,
  { border: string; bg: string; pill: string; pillText: string; label: string; icon: string }
> = {
  high:   { border: '#059669', bg: '#ECFDF5', pill: '#059669', pillText: '#FFF', label: 'Looks good',    icon: '✓' },
  medium: { border: '#D97706', bg: '#FFFBEB', pill: '#D97706', pillText: '#FFF', label: 'Please verify', icon: '⚠' },
  low:    { border: '#DC2626', bg: '#FEF2F2', pill: '#DC2626', pillText: '#FFF', label: 'Tap to edit',   icon: '✎' },
};

const formatPeso = (n: number) =>
  `₱${n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// ─── Manual Entry Modal ───────────────────────────────────────────────────────
// onConfirm now receives (product, unitPrice: number, qty: number)
function ManualEntryModal({
  visible,
  onClose,
  onConfirm,
}: {
  visible: boolean;
  onClose: () => void;
  onConfirm: (product: string, unitPrice: number, qty: number) => void;
}) {
  const insets   = useSafeAreaInsets();
  const [product, setProduct] = useState('');
  const [price,   setPrice]   = useState('');   // plain numeric string
  const [qty,     setQty]     = useState(1);

  const unitPrice  = parseFloat(price) || 0;
  const lineTotal  = unitPrice * qty;
  const canConfirm = product.trim().length > 0 && unitPrice > 0;

  const handleConfirm = () => {
    if (!canConfirm) return;
    onConfirm(product.trim(), unitPrice, qty);
    setProduct(''); setPrice(''); setQty(1);
    onClose();
  };

  const handleClose = () => {
    setProduct(''); setPrice(''); setQty(1);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <KeyboardAvoidingView
        style={styles.modalBackdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} />

        <View style={[styles.modalSheet, { paddingBottom: Math.max(insets.bottom + 16, 24) }]}>
          <View style={styles.dragHandle} />

          <Text style={styles.modalTitle}>Add Item Manually</Text>
          <Text style={styles.modalSubtitle}>Use this when the tag can't be scanned.</Text>

          <Text style={styles.modalLabel}>PRODUCT NAME</Text>
          <TextInput
            style={styles.modalInput}
            value={product}
            onChangeText={setProduct}
            placeholder="e.g. Nestle Milo 200g"
            placeholderTextColor="#C4C4C4"
            autoFocus
            returnKeyType="next"
          />

          <View style={styles.modalRow}>
            <View style={styles.modalHalf}>
              <Text style={styles.modalLabel}>UNIT PRICE (₱)</Text>
              <TextInput
                style={[styles.modalInput, styles.modalInputPrice]}
                value={price}
                onChangeText={setPrice}
                placeholder="0.00"
                placeholderTextColor="#C4C4C4"
                keyboardType="decimal-pad"
                returnKeyType="done"
              />
            </View>

            <View style={styles.modalHalf}>
              <Text style={styles.modalLabel}>QUANTITY</Text>
              <View style={styles.stepperInline}>
                <TouchableOpacity
                  style={styles.stepBtn}
                  onPress={() => setQty(q => Math.max(1, q - 1))}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={styles.stepBtnText}>−</Text>
                </TouchableOpacity>
                <Text style={styles.stepValue}>{qty}</Text>
                <TouchableOpacity
                  style={styles.stepBtn}
                  onPress={() => setQty(q => q + 1)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={styles.stepBtnText}>+</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Live line total */}
          {unitPrice > 0 && (
            <View style={styles.modalTotalRow}>
              <Text style={styles.modalTotalLabel}>Line total</Text>
              <Text style={styles.modalTotalValue}>{formatPeso(lineTotal)}</Text>
            </View>
          )}

          <View style={styles.modalActions}>
            <TouchableOpacity style={styles.modalCancelBtn} onPress={handleClose}>
              <Text style={styles.modalCancelText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalConfirmBtn, !canConfirm && styles.modalConfirmDisabled]}
              onPress={handleConfirm}
              disabled={!canConfirm}
            >
              <Text style={styles.modalConfirmText}>Add to List</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function ResultEditor({ scanner, onSave, onViewInventory, onManualSave }: any) {
  const insets = useSafeAreaInsets();
  const [showManual, setShowManual] = useState(false);

  const hasResult = !!scanner.structuredData;
  const confidence: ConfidenceLevel =
    hasResult ? (scanner.structuredData?.confidence ?? 'low') : 'high';
  const cfg = CONFIDENCE_CONFIG[confidence];

  // editPrice is a plain numeric string e.g. "52.00"
  const unitPrice = parseFloat(scanner.editPrice) || 0;
  const qty       = scanner.quantity ?? 1;
  const lineTotal = unitPrice * qty;

  const canSave =
    !scanner.isContinuousMode &&
    scanner.editProduct &&
    unitPrice > 0;

  return (
    <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom + 8, 20) }]}>

      {/* ── Top bar ── */}
      <View style={styles.topBar}>
        <View style={styles.dragHandle} />
        <TouchableOpacity
          style={[styles.autoSavePill, scanner.isContinuousMode && styles.autoSavePillActive]}
          onPress={() => scanner.setIsContinuousMode(!scanner.isContinuousMode)}
          activeOpacity={0.8}
        >
          <View style={[
            styles.autoSaveDot,
            { backgroundColor: scanner.isContinuousMode ? '#FFFFFF' : '#9CA3AF' },
          ]} />
          <Text style={[
            styles.autoSavePillText,
            scanner.isContinuousMode && styles.autoSavePillTextActive,
          ]}>
            {scanner.isContinuousMode ? 'Auto-Save ON' : 'Auto-Save'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* ── Product + Price/Qty cards ── */}
      <View style={styles.infoRow}>

        {/* Product card */}
        <View style={[
          styles.infoCard,
          styles.infoCardProduct,
          hasResult && { borderColor: cfg.border, backgroundColor: cfg.bg },
        ]}>
          <View style={styles.labelRow}>
            <Text style={styles.infoLabel}>PRODUCT</Text>
            {hasResult && (
              <View style={[styles.confidencePill, { backgroundColor: cfg.pill }]}>
                <Text style={styles.confidencePillText}>{cfg.icon}  {cfg.label}</Text>
              </View>
            )}
          </View>
          <TextInput
            style={[
              styles.productInput,
              hasResult && confidence !== 'high' && { color: cfg.border },
            ]}
            value={scanner.editProduct}
            onChangeText={scanner.setEditProduct}
            placeholder="Align tag in box…"
            placeholderTextColor="#C4C4C4"
            multiline
            numberOfLines={2}
          />
          {hasResult && <Text style={styles.editHint}>✎ Tap to edit</Text>}
        </View>

        {/* Price + Qty card */}
        <View style={[styles.infoCard, styles.infoCardPrice]}>
          <View>
            <Text style={styles.infoLabel}>UNIT PRICE</Text>
            {/* Show ₱ prefix inside the card, input holds plain number */}
            <View style={styles.priceInputRow}>
              <Text style={styles.pesoSymbol}>₱</Text>
              <TextInput
                style={styles.priceInput}
                value={scanner.editPrice}
                onChangeText={scanner.setEditPrice}
                placeholder="0.00"
                placeholderTextColor="#C4C4C4"
                keyboardType="decimal-pad"
              />
            </View>
            {hasResult && <Text style={styles.editHint}>✎ Tap to edit</Text>}
          </View>

          <View style={styles.cardDivider} />

          {/* Quantity stepper */}
          <View>
            <Text style={styles.infoLabel}>QTY</Text>
            <View style={styles.stepper}>
              <TouchableOpacity
                style={styles.stepBtn}
                onPress={() => scanner.setQuantity(Math.max(1, qty - 1))}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={styles.stepBtnText}>−</Text>
              </TouchableOpacity>
              <Text style={styles.stepValue}>{qty}</Text>
              <TouchableOpacity
                style={styles.stepBtn}
                onPress={() => scanner.setQuantity(qty + 1)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <Text style={styles.stepBtnText}>+</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Line total — only show when qty > 1 */}
          {qty > 1 && unitPrice > 0 && (
            <>
              <View style={styles.cardDivider} />
              <View>
                <Text style={styles.infoLabel}>TOTAL</Text>
                <Text style={styles.lineTotalText}>{formatPeso(lineTotal)}</Text>
              </View>
            </>
          )}
        </View>
      </View>

      {/* ── Confidence hint ── */}
      {hasResult && confidence !== 'high' && (
        <View style={[styles.hintBanner, { backgroundColor: cfg.bg, borderColor: cfg.border }]}>
          <Text style={[styles.hintText, { color: cfg.border }]}>
            {confidence === 'medium'
              ? '⚠  Scanner isn\'t 100% sure — check the product name before saving.'
              : '✎  Couldn\'t read clearly. Please edit the product name above.'}
          </Text>
        </View>
      )}

      {/* ── Auto-save feedback ── */}
      {scanner.scanFeedback ? (
        <View style={styles.feedbackPill}>
          <Text style={styles.feedbackText}>{scanner.scanFeedback}</Text>
        </View>
      ) : null}

      {/* ── CTA buttons ── */}
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
              style={styles.scanAgainBtn}
              onPress={scanner.captureAndRead}
              disabled={scanner.isProcessing}
              activeOpacity={0.75}
            >
              {scanner.isProcessing
                ? <ActivityIndicator color="#4F46E5" size="small" />
                : <Text style={styles.scanAgainText}>↺  Scan Again</Text>
              }
            </TouchableOpacity>
          </>
        ) : (
          <TouchableOpacity
            style={[styles.btn, styles.btnScan, scanner.isProcessing && styles.btnDisabled]}
            onPress={scanner.captureAndRead}
            disabled={scanner.isProcessing}
            activeOpacity={0.85}
          >
            {scanner.isProcessing
              ? <ActivityIndicator color="#FFFFFF" />
              : <Text style={styles.btnText}>Scan Tag</Text>
            }
          </TouchableOpacity>
        )}
      </View>

      {/* ── Footer links ── */}
      <View style={styles.footerRow}>
        <TouchableOpacity onPress={() => setShowManual(true)} style={styles.footerLink}>
          <Text style={styles.footerLinkText}>+ Add Manually</Text>
        </TouchableOpacity>
        <View style={styles.footerDivider} />
        <TouchableOpacity onPress={onViewInventory} style={styles.footerLink}>
          <Text style={styles.footerLinkText}>View List →</Text>
        </TouchableOpacity>
      </View>

      <ManualEntryModal
        visible={showManual}
        onClose={() => setShowManual(false)}
        onConfirm={onManualSave}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  sheet: {
    paddingHorizontal: 16,
    paddingTop: 0,
    backgroundColor: '#F8F7F4',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    marginBottom: 14,
    position: 'relative',
  },
  dragHandle: {
    width: 36,
    height: 4,
    backgroundColor: '#D1D5DB',
    borderRadius: 2,
  },
  autoSavePill: {
    position: 'absolute',
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#F3F4F6',
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  autoSavePillActive:     { backgroundColor: '#4F46E5', borderColor: '#4F46E5' },
  autoSaveDot:            { width: 6, height: 6, borderRadius: 3 },
  autoSavePillText:       { fontSize: 11, fontWeight: '700', color: '#6B7280', letterSpacing: 0.2 },
  autoSavePillTextActive: { color: '#FFFFFF' },

  infoRow:         { flexDirection: 'row', gap: 10, marginBottom: 10 },
  infoCard:        { backgroundColor: '#FFFFFF', borderRadius: 18, padding: 14, borderWidth: 1.5, borderColor: '#E5E7EB' },
  infoCardProduct: { flex: 1.6 },
  infoCardPrice:   { flex: 1, justifyContent: 'space-between' },

  labelRow:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  infoLabel:     { fontSize: 10, fontWeight: '700', color: '#9CA3AF', letterSpacing: 0.8 },
  editHint:      { fontSize: 10, color: '#C4C4C4', marginTop: 4, fontStyle: 'italic' },

  confidencePill:     { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 20 },
  confidencePillText: { fontSize: 10, fontWeight: '700', color: '#FFFFFF', letterSpacing: 0.3 },

  productInput: { fontSize: 16, fontWeight: '700', color: '#111827', padding: 0, lineHeight: 22 },

  priceInputRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  pesoSymbol:    { fontSize: 18, fontWeight: '800', color: '#059669', marginRight: 2 },
  priceInput:    { fontSize: 22, fontWeight: '800', color: '#059669', padding: 0, flex: 1 },

  cardDivider:   { height: 1, backgroundColor: '#F3F4F6', marginVertical: 10 },

  stepper:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 },
  stepBtn:       { width: 28, height: 28, borderRadius: 8, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#E5E7EB' },
  stepBtnText:   { fontSize: 16, fontWeight: '700', color: '#374151', lineHeight: 20 },
  stepValue:     { fontSize: 18, fontWeight: '800', color: '#111827', minWidth: 24, textAlign: 'center' },
  lineTotalText: { fontSize: 15, fontWeight: '800', color: '#059669', marginTop: 4 },

  hintBanner: { borderRadius: 12, borderWidth: 1, paddingVertical: 10, paddingHorizontal: 14, marginBottom: 10 },
  hintText:   { fontSize: 12, fontWeight: '600', lineHeight: 18 },

  feedbackPill: { backgroundColor: '#ECFDF5', borderRadius: 20, paddingVertical: 8, paddingHorizontal: 16, alignSelf: 'center', marginBottom: 10, borderWidth: 1, borderColor: '#A7F3D0' },
  feedbackText: { color: '#059669', fontSize: 13, fontWeight: '600' },

  ctaRow:    { gap: 6, marginBottom: 8 },
  btn:       { borderRadius: 18, paddingVertical: 16, alignItems: 'center', justifyContent: 'center' },
  btnScan:   { backgroundColor: '#4F46E5' },
  btnSave:   { backgroundColor: '#059669' },
  btnDisabled: { backgroundColor: '#D1D5DB' },
  btnText:   { color: '#FFFFFF', fontSize: 16, fontWeight: '700', letterSpacing: 0.2 },

  scanAgainBtn:  { alignSelf: 'center', paddingVertical: 8, paddingHorizontal: 20, borderRadius: 20, borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#FFFFFF' },
  scanAgainText: { color: '#4F46E5', fontSize: 13, fontWeight: '700' },

  footerRow:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 8, gap: 12 },
  footerLink:    { paddingVertical: 4, paddingHorizontal: 8 },
  footerLinkText:{ color: '#4F46E5', fontSize: 13, fontWeight: '600' },
  footerDivider: { width: 1, height: 14, backgroundColor: '#D1D5DB' },

  // ── Manual modal ──
  modalBackdrop:        { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  modalSheet:           { backgroundColor: '#FFFFFF', borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 20, paddingTop: 12 },
  modalTitle:           { fontSize: 18, fontWeight: '800', color: '#111827', marginBottom: 4, marginTop: 8 },
  modalSubtitle:        { fontSize: 13, color: '#9CA3AF', marginBottom: 20 },
  modalLabel:           { fontSize: 10, fontWeight: '700', color: '#9CA3AF', letterSpacing: 0.8, marginBottom: 6 },
  modalInput:           { backgroundColor: '#F8F7F4', borderRadius: 14, padding: 14, fontSize: 15, fontWeight: '600', color: '#111827', borderWidth: 1, borderColor: '#E5E7EB', marginBottom: 16 },
  modalInputPrice:      { color: '#059669', fontSize: 18, fontWeight: '800' },
  modalRow:             { flexDirection: 'row', gap: 12, marginBottom: 4 },
  modalHalf:            { flex: 1 },
  stepperInline:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#F8F7F4', borderRadius: 14, borderWidth: 1, borderColor: '#E5E7EB', padding: 10, marginBottom: 16 },
  modalTotalRow:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#ECFDF5', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 14, borderWidth: 1, borderColor: '#A7F3D0' },
  modalTotalLabel:      { fontSize: 13, fontWeight: '600', color: '#059669' },
  modalTotalValue:      { fontSize: 16, fontWeight: '800', color: '#059669' },
  modalActions:         { flexDirection: 'row', gap: 10, marginTop: 8 },
  modalCancelBtn:       { flex: 1, paddingVertical: 14, borderRadius: 14, backgroundColor: '#F3F4F6', alignItems: 'center' },
  modalCancelText:      { color: '#6B7280', fontSize: 15, fontWeight: '600' },
  modalConfirmBtn:      { flex: 2, paddingVertical: 14, borderRadius: 14, backgroundColor: '#059669', alignItems: 'center' },
  modalConfirmDisabled: { backgroundColor: '#D1D5DB' },
  modalConfirmText:     { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
});