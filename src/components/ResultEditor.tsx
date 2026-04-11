// src/components/ResultEditor.tsx
import React, { useState, useEffect, useRef } from 'react';
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
  Animated,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path, Line, Rect } from 'react-native-svg';

import { ConfidenceLevel } from '../utils/scannerParser';
import { useVoiceInput } from '../hooks/useVoiceInput';

// ─── Confidence config ────────────────────────────────────────────────────────
const CONFIDENCE_CONFIG: Record<
  ConfidenceLevel,
  { border: string; bg: string; pill: string; pillText: string; label: string; icon: string }
> = {
  high:   { border: '#059669', bg: '#ECFDF5', pill: '#059669', pillText: '#FFF', label: 'Looks good',    icon: '✓' },
  medium: { border: '#D97706', bg: '#FFFBEB', pill: '#D97706', pillText: '#FFF', label: 'Please verify', icon: '⚠' },
  low:    { border: '#DC2626', bg: '#FEF2F2', pill: '#DC2626', pillText: '#FFF', label: 'Tap to edit',   icon: '✎' },
};

const NO_PRICE_CONFIG = {
  border: '#D97706', bg: '#FFFBEB', pill: '#D97706', pillText: '#FFF', label: 'Please verify', icon: '⚠',
};

const formatPeso = (n: number) =>
  `₱${n.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// ─── Mic SVG icon ─────────────────────────────────────────────────────────────
function MicIcon({ size = 20, color = '#4F46E5' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <Rect x="9" y="2" width="6" height="11" rx="3" stroke={color} strokeWidth="2" strokeLinejoin="round" />
      <Path d="M5 10a7 7 0 0 0 14 0" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <Line x1="12" y1="17" x2="12" y2="21" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <Line x1="9"  y1="21" x2="15" y2="21" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </Svg>
  );
}

// ─── Animated mic button ──────────────────────────────────────────────────────
function VoiceMicButton({
  state,
  transcript,
  onPress,
}: {
  state: 'idle' | 'listening' | 'processing' | 'error';
  transcript: string;
  onPress: () => void;
}) {
  const pulse = useRef(new Animated.Value(1)).current;
  const anim  = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    if (state === 'listening') {
      anim.current = Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, { toValue: 1.2, duration: 600, useNativeDriver: true }),
          Animated.timing(pulse, { toValue: 1,   duration: 600, useNativeDriver: true }),
        ]),
      );
      anim.current.start();
    } else {
      anim.current?.stop();
      pulse.setValue(1);
    }
    return () => { anim.current?.stop(); };
  }, [state]);

  const isListening  = state === 'listening';
  const isProcessing = state === 'processing';
  const isError      = state === 'error';

  const bgColor     = isListening ? '#DC2626' : isError ? '#FEF2F2' : '#EEF2FF';
  const iconColor   = isListening ? '#FFFFFF'  : isError ? '#DC2626' : '#4F46E5';
  const borderColor = isListening ? '#DC2626'  : isError ? '#FECACA' : '#C7D2FE';

  return (
    <View style={styles.micWrap}>
      {/* Live transcript tooltip bubble */}
      {isListening && transcript.length > 0 && (
        <View style={styles.transcriptBubble}>
          <Text style={styles.transcriptText} numberOfLines={2}>{transcript}</Text>
        </View>
      )}

      {/* Label above the button */}
      <Text style={[styles.micHint, isListening && styles.micHintListening, isError && styles.micHintError]}>
        {isError ? 'Try again' : isListening ? 'Listening…' : isProcessing ? 'Parsing…' : 'Voice'}
      </Text>

      <Animated.View style={{ transform: [{ scale: pulse }] }}>
        <TouchableOpacity
          style={[styles.micBtn, { backgroundColor: bgColor, borderColor }]}
          onPress={onPress}
          activeOpacity={0.8}
          disabled={isProcessing}
        >
          {isProcessing
            ? <ActivityIndicator color="#4F46E5" size="small" />
            : <MicIcon size={20} color={iconColor} />
          }
        </TouchableOpacity>
      </Animated.View>

      {/* Red recording indicator dot */}
      {isListening && <View style={styles.recordingDot} />}
    </View>
  );
}

// ─── Manual Entry Modal ───────────────────────────────────────────────────────
function ManualEntryModal({
  visible,
  onClose,
  onConfirm,
}: {
  visible: boolean;
  onClose: () => void;
  onConfirm: (product: string, unitPrice: number, qty: number) => void;
}) {
  const insets    = useSafeAreaInsets();
  const [product, setProduct] = useState('');
  const [price,   setPrice]   = useState('');
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
  const [showManual,    setShowManual]    = useState(false);
  const [voiceFeedback, setVoiceFeedback] = useState('');

  // ── Voice input ─────────────────────────────────────────────────────────────
  const voice = useVoiceInput({
    onResult: (parsed) => {
      if (parsed.product) scanner.setEditProduct(parsed.product);
      if (parsed.price)   scanner.setEditPrice(parsed.price);
      if (parsed.qty > 1) scanner.setQuantity(parsed.qty);

      // Brief confirmation pill
      const parts: string[] = [];
      if (parsed.product)               parts.push(parsed.product);
      if (parseFloat(parsed.price) > 0) parts.push(`₱${parsed.price}`);
      if (parsed.qty > 1)               parts.push(`×${parsed.qty}`);
      setVoiceFeedback(`🎤 ${parts.join(' · ')}`);
      setTimeout(() => setVoiceFeedback(''), 3000);
    },
    onError: (msg) => {
      setVoiceFeedback(`⚠ ${msg}`);
      setTimeout(() => setVoiceFeedback(''), 3000);
    },
  });

  // ── Confidence logic ────────────────────────────────────────────────────────
  const hasResult = !!scanner.structuredData;
  const hasPrice  = hasResult && scanner.editPrice && parseFloat(scanner.editPrice) > 0;

  const baseConfidence: ConfidenceLevel =
    hasResult ? (scanner.structuredData?.confidence ?? 'low') : 'high';
  const confidence: ConfidenceLevel =
    hasResult && !hasPrice && baseConfidence === 'high' ? 'medium' : baseConfidence;

  const cfg = hasResult && !hasPrice ? NO_PRICE_CONFIG : CONFIDENCE_CONFIG[confidence];

  const unitPrice = parseFloat(scanner.editPrice) || 0;
  const qty       = scanner.quantity ?? 1;
  const lineTotal = unitPrice * qty;

  const canSave =
    !scanner.isContinuousMode &&
    scanner.editProduct &&
    unitPrice > 0;

  return (
    <View style={[styles.sheet, { paddingBottom: 10 }]}>

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

      {/* ── OCR accuracy notice ── */}
      <View style={styles.ocrNoticeBanner}>
        <Text style={styles.ocrNoticeText}>
          ✏️  Always check the <Text style={styles.ocrNoticeEmphasis}>product name</Text> and{' '}
          <Text style={styles.ocrNoticeEmphasis}>unit price</Text> before saving — tap either field to edit.
        </Text>
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
            <View style={styles.priceInputRow}>
              <Text style={styles.pesoSymbol}>₱</Text>
              <TextInput
                style={[
                  styles.priceInput,
                  hasResult && !hasPrice && { color: '#D97706' },
                ]}
                value={scanner.editPrice}
                onChangeText={scanner.setEditPrice}
                placeholder="0.00"
                placeholderTextColor={hasResult && !hasPrice ? '#F6C065' : '#C4C4C4'}
                keyboardType="decimal-pad"
              />
            </View>
            {hasResult && !hasPrice
              ? <Text style={[styles.editHint, { color: '#D97706' }]}>⚠ Enter price</Text>
              : hasResult && hasPrice
              ? <Text style={styles.editHint}>✎ Tap to edit</Text>
              : null
            }
          </View>

          <View style={styles.cardDivider} />

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

      {/* ── Confidence / no-price hint banner ── */}
      {hasResult && (confidence !== 'high' || !hasPrice) && (
        <View style={[styles.hintBanner, { backgroundColor: cfg.bg, borderColor: cfg.border }]}>
          <Text style={[styles.hintText, { color: cfg.border }]}>
            {!hasPrice
              ? '⚠  No price detected — please type it in the Unit Price field above.'
              : confidence === 'medium'
              ? "⚠  Scanner isn't 100% sure — check the product name before saving."
              : '✎  Couldn\'t read clearly. Please edit the product name above.'}
          </Text>
        </View>
      )}

      {/* ── Scan / voice feedback pill ── */}
      {(scanner.scanFeedback || voiceFeedback) && (
        <View style={[
          styles.feedbackPill,
          voiceFeedback ? styles.feedbackPillVoice : undefined,
        ]}>
          <Text style={[
            styles.feedbackText,
            voiceFeedback ? styles.feedbackTextVoice : undefined,
          ]}>
            {voiceFeedback || scanner.scanFeedback}
          </Text>
        </View>
      )}

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

      {/* ── Footer: Add Manually | [MIC] | View List ── */}
      <View style={styles.footerRow}>
        <TouchableOpacity onPress={() => setShowManual(true)} style={styles.footerLink}>
          <Text style={styles.footerLinkText}>+ Add Manually</Text>
        </TouchableOpacity>

        <View style={styles.footerDivider} />

        <VoiceMicButton
          state={voice.state}
          transcript={voice.transcript}
          onPress={voice.toggle}
        />

        <View style={styles.footerDivider} />

        <TouchableOpacity onPress={onViewInventory} style={styles.footerLink}>
          <Text style={styles.footerLinkText}>View List →</Text>
        </TouchableOpacity>
      </View>

      {/* ── Voice usage hint shown only before first scan/voice ── */}
      {!hasResult && voice.state === 'idle' && (
        <Text style={styles.voiceUsageHint}>
          🎤  Try saying "Milo 52 pesos" or "Lucky Me dalawa 13 pesos"
        </Text>
      )}

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
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    marginTop: 8, marginBottom: 10, position: 'relative',
  },
  dragHandle: { width: 36, height: 4, backgroundColor: '#D1D5DB', borderRadius: 2 },
  autoSavePill: {
    position: 'absolute', right: 0,
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: '#F3F4F6', borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 5,
    borderWidth: 1, borderColor: '#E5E7EB',
  },
  autoSavePillActive:     { backgroundColor: '#4F46E5', borderColor: '#4F46E5' },
  autoSaveDot:            { width: 6, height: 6, borderRadius: 3 },
  autoSavePillText:       { fontSize: 11, fontWeight: '700', color: '#6B7280', letterSpacing: 0.2 },
  autoSavePillTextActive: { color: '#FFFFFF' },

  ocrNoticeBanner: {
    backgroundColor: '#F0F4FF', borderRadius: 10,
    borderWidth: 1, borderColor: '#C7D2FE',
    paddingVertical: 7, paddingHorizontal: 12, marginBottom: 10,
  },
  ocrNoticeText:     { fontSize: 11, color: '#4338CA', lineHeight: 16, fontWeight: '500' },
  ocrNoticeEmphasis: { fontWeight: '800', color: '#3730A3' },

  infoRow:         { flexDirection: 'row', gap: 10, marginBottom: 10 },
  infoCard:        { backgroundColor: '#FFFFFF', borderRadius: 18, padding: 14, borderWidth: 1.5, borderColor: '#E5E7EB' },
  infoCardProduct: { flex: 1.6 },
  infoCardPrice:   { flex: 1, justifyContent: 'space-between' },

  labelRow:           { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  infoLabel:          { fontSize: 10, fontWeight: '700', color: '#9CA3AF', letterSpacing: 0.8 },
  editHint:           { fontSize: 10, color: '#C4C4C4', marginTop: 4, fontStyle: 'italic' },
  confidencePill:     { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 20 },
  confidencePillText: { fontSize: 10, fontWeight: '700', color: '#FFFFFF', letterSpacing: 0.3 },

  productInput:  { fontSize: 16, fontWeight: '700', color: '#111827', padding: 0, lineHeight: 22 },
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

  feedbackPill:      { backgroundColor: '#ECFDF5', borderRadius: 20, paddingVertical: 8, paddingHorizontal: 16, alignSelf: 'center', marginBottom: 8, borderWidth: 1, borderColor: '#A7F3D0' },
  feedbackPillVoice: { backgroundColor: '#EEF2FF', borderColor: '#C7D2FE' },
  feedbackText:      { color: '#059669', fontSize: 13, fontWeight: '600' },
  feedbackTextVoice: { color: '#4338CA' },

  ctaRow:     { gap: 6, marginBottom: 8 },
  btn:        { borderRadius: 18, paddingVertical: 16, alignItems: 'center', justifyContent: 'center' },
  btnScan:    { backgroundColor: '#4F46E5' },
  btnSave:    { backgroundColor: '#059669' },
  btnDisabled:{ backgroundColor: '#D1D5DB' },
  btnText:    { color: '#FFFFFF', fontSize: 16, fontWeight: '700', letterSpacing: 0.2 },

  scanAgainBtn: { alignSelf: 'center', paddingVertical: 8, paddingHorizontal: 20, borderRadius: 20, borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#FFFFFF' },
  scanAgainText:{ color: '#4F46E5', fontSize: 13, fontWeight: '700' },

  // ── Footer ──────────────────────────────────────────────────────────────────
  footerRow:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 6, gap: 10 },
  footerLink:    { paddingVertical: 4, paddingHorizontal: 8 },
  footerLinkText:{ color: '#4F46E5', fontSize: 13, fontWeight: '600' },
  footerDivider: { width: 1, height: 14, backgroundColor: '#D1D5DB' },

  // ── Voice mic ────────────────────────────────────────────────────────────────
  micWrap: { alignItems: 'center', position: 'relative' },
  micBtn: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5,
  },
  micHint:         { fontSize: 9, fontWeight: '600', color: '#9CA3AF', marginBottom: 3, letterSpacing: 0.2 },
  micHintListening:{ fontSize: 9, fontWeight: '700', color: '#DC2626', marginBottom: 3 },
  micHintError:    { fontSize: 9, fontWeight: '700', color: '#DC2626', marginBottom: 3 },
  recordingDot: {
    position: 'absolute', top: 20, right: -2,
    width: 9, height: 9, borderRadius: 5,
    backgroundColor: '#DC2626',
    borderWidth: 1.5, borderColor: '#FFFFFF',
  },
  transcriptBubble: {
    position: 'absolute',
    bottom: 60,
    backgroundColor: '#1F2937',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    width: 210,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 6,
  },
  transcriptText:  { color: '#FFFFFF', fontSize: 12, fontWeight: '500', lineHeight: 16 },
  voiceUsageHint:  { fontSize: 10, color: '#C4C4C4', textAlign: 'center', marginTop: 2, marginBottom: 4, fontStyle: 'italic' },

  // ── Manual modal ─────────────────────────────────────────────────────────────
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