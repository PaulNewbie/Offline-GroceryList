// src/screens/ScannerScreen.tsx
import React, { useState, useRef, useEffect } from 'react';
import {
  StyleSheet, View, Text, TouchableOpacity,
  Animated, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Camera } from 'react-native-vision-camera';
import * as Haptics from 'expo-haptics';

import { useScannerAI } from '../hooks/useScannerAI';
import { saveItemToDB, getScannerTarget } from '../utils/database';
import ScannerOverlay from '../components/ScannerOverlay';
import ResultEditor from '../components/ResultEditor';

// ─── Inline save toast ────────────────────────────────────────────────────────
// FIX 3a: Replaces the Alert.alert('Saved!', ...) that required a mandatory
// extra tap to dismiss. This toast auto-dismisses after 2s and never blocks
// the scanning rhythm.
function SaveToast({ message }: { message: string }) {
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.delay(1600),
      Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start();
  }, [message]);

  return (
    <Animated.View style={[styles.toast, { opacity }]}>
      <Text style={styles.toastText}>{message}</Text>
    </Animated.View>
  );
}

// ─── Permission denied state ──────────────────────────────────────────────────
// FIX 3b: The old code showed plain text with no recovery path. On Android,
// Camera.requestCameraPermission() only shows the OS prompt once — after a
// denial, subsequent calls return 'denied' immediately without prompting.
// The only way to recover is to send the user to app Settings.
function PermissionDeniedView() {
  return (
    <View style={styles.permissionContainer}>
      <Text style={styles.permissionIcon}>📷</Text>
      <Text style={styles.permissionTitle}>Camera Access Required</Text>
      <Text style={styles.permissionBody}>
        OfflineScanner needs camera access to scan price tags.
        Please enable it in your device settings.
      </Text>
      <TouchableOpacity
        style={styles.permissionBtn}
        onPress={() => Linking.openSettings()}
        activeOpacity={0.85}
      >
        <Text style={styles.permissionBtnText}>Open Settings</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function ScannerScreen({ navigation }: any) {
  const scanner = useScannerAI(() => {});

  // FIX 3a: toast state — message key forces a re-mount of SaveToast so the
  // animation restarts even if the same product is scanned twice in a row.
  const [toast, setToast] = useState<{ message: string; key: number } | null>(null);

  const showToast = (message: string) => {
    setToast({ message, key: Date.now() });
    setTimeout(() => setToast(null), 2100); // slightly longer than animation
  };

  const goToList = async () => {
    const trip = await getScannerTarget();
    if (trip) {
      navigation.navigate('HomeTab', {
        screen: 'TripDetail',
        params: { tripId: trip.id },
      });
    }
  };

  const handleSaveToInventory = async () => {
    const unitPrice = parseFloat(scanner.editPrice) || 0;
    const qty       = scanner.quantity ?? 1;
    if (!scanner.editProduct || unitPrice === 0) return;

    const insertId = await saveItemToDB(scanner.editProduct, unitPrice, qty);
    if (insertId) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const label = qty > 1 ? `${scanner.editProduct} (×${qty})` : scanner.editProduct;
      // FIX 3a: toast instead of Alert — no mandatory tap required.
      showToast(`✓ ${label} added`);
      scanner.resetResult();
    }
  };

  const handleManualSave = async (product: string, unitPrice: number, qty: number) => {
    const insertId = await saveItemToDB(product, unitPrice, qty);
    if (insertId) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const label = qty > 1 ? `${product} (×${qty})` : product;
      showToast(`✓ ${label} added`);
    }
  };

  // FIX 3b: Distinguish between "not yet asked" and "denied" so we can show
  // the right recovery UI. hasPermission=false covers both states in the
  // original code — now we show the Settings prompt only when truly denied.
  if (!scanner.hasPermission) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
        <PermissionDeniedView />
      </SafeAreaView>
    );
  }

  if (scanner.device == null) {
    return (
      <View style={styles.loading}>
        <Text style={styles.loadingText}>Initializing Camera…</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {/* FIX 3a: Toast rendered above everything, pointer-events none so it
          doesn't block touches on the camera or result editor below it. */}
      {toast && (
        <View style={styles.toastContainer} pointerEvents="none">
          <SaveToast key={toast.key} message={toast.message} />
        </View>
      )}

      <View style={styles.cameraContainer}>
        <Camera
          ref={scanner.cameraRef}
          style={StyleSheet.absoluteFill}
          device={scanner.device}
          isActive={true}
          photo={true}
          torch={scanner.isTorchOn ? 'on' : 'off'}
        />
        <ScannerOverlay
          isModelLoading={scanner.isModelLoading}
          isTorchOn={scanner.isTorchOn}
          toggleTorch={() => scanner.setIsTorchOn(!scanner.isTorchOn)}
        />
      </View>

      <ResultEditor
        scanner={scanner}
        onSave={handleSaveToInventory}
        onManualSave={handleManualSave}
        onViewInventory={goToList}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F7F4',
  },
  loading: {
    flex: 1,
    backgroundColor: '#F8F7F4',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  loadingText: {
    color: '#6B7280',
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
  cameraContainer: {
    flex: 1,
    overflow: 'hidden',
    borderRadius: 24,
    marginHorizontal: 14,
    marginTop: 12,
    marginBottom: 0,
  },

  // ── Toast ──────────────────────────────────────────────
  toastContainer: {
    position: 'absolute',
    top: 60,
    left: 0,
    right: 0,
    zIndex: 100,
    alignItems: 'center',
  },
  toast: {
    backgroundColor: '#059669',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
  toastText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.2,
  },

  // ── Permission denied ──────────────────────────────────
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  permissionIcon:  { fontSize: 52, marginBottom: 16 },
  permissionTitle: { fontSize: 20, fontWeight: '800', color: '#111827', marginBottom: 10, textAlign: 'center' },
  permissionBody:  { fontSize: 14, color: '#6B7280', textAlign: 'center', lineHeight: 22, marginBottom: 28 },
  permissionBtn:   { backgroundColor: '#4F46E5', paddingHorizontal: 28, paddingVertical: 14, borderRadius: 16 },
  permissionBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
});