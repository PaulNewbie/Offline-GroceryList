// src/hooks/useScannerAI.ts
import { useState, useEffect, useRef } from 'react';
import { Dimensions } from 'react-native';                          // ← add
import { Camera, useCameraDevice } from 'react-native-vision-camera';
import * as Haptics from 'expo-haptics';
import { deleteAsync } from 'expo-file-system/legacy';

import { recognizeText } from '../utils/ocr';
import { processScannedText, ParsedProduct } from '../utils/scannerParser';
import { saveItemToDB } from '../utils/database';
import { cropPhotoToBox } from '../utils/cropToBox';               // ← add

export function useScannerAI(refreshInventory: () => void) {
  const [hasPermission, setHasPermission] = useState(false);
  const device = useCameraDevice('back');
  const cameraRef = useRef<Camera>(null);

  const [isProcessing, setIsProcessing]     = useState(false);
  const [structuredData, setStructuredData] = useState<ParsedProduct | null>(null);
  const [editProduct, setEditProduct]       = useState('');
  const [editPrice, setEditPrice]           = useState('');
  const [quantity, setQuantity]             = useState(1);

  const [isTorchOn, setIsTorchOn]               = useState(false);
  const [isContinuousMode, setIsContinuousMode] = useState(false);
  const [scanFeedback, setScanFeedback]         = useState('');

  const isCapturing = useRef(false);

  // ── Store camera container dimensions ──────────────────
  // Defaults to window size — updated by onLayout in ScannerScreen
  // ✅ Replace with this
  interface LayoutSize {
    width:  number;
    height: number;
  }

  const cameraLayout = useRef<LayoutSize>(Dimensions.get('window'));

  const setCameraLayout = (width: number, height: number) => {
    cameraLayout.current = { width, height };
  };

  useEffect(() => {
    (async () => {
      const status = await Camera.requestCameraPermission();
      setHasPermission(status === 'granted');
    })();
  }, []);

  const resetResult = () => {
    setStructuredData(null);
    setEditProduct('');
    setEditPrice('');
    setQuantity(1);
    setScanFeedback('');
  };

  const captureAndRead = async () => {
    if (isCapturing.current || !cameraRef.current) return;

    let originalUri: string | null = null;
    let croppedUri:  string | null = null;
    isCapturing.current = true;

    try {
      setIsProcessing(true);
      resetResult();

      const photo = await cameraRef.current.takePhoto({ flash: 'off' });
      originalUri = `file://${photo.path}`;

      // ── Crop to box before OCR ──────────────────────────
      const { width: screenW, height: screenH } = cameraLayout.current;

      const cropped = await cropPhotoToBox(
        photo.path,
        photo.width,
        photo.height,
        screenW,
        screenH,
      );
      croppedUri = cropped.uri;

      // ── OCR on the cropped region only ──────────────────
      const result = await recognizeText(
        croppedUri.replace('file://', ''),
        cropped.width,
        cropped.height,
      );

      if (result && result.blocks.length > 0) {
        const parsedResults = await processScannedText(
          result.blocks,
          cropped.width,
          cropped.height,
        );

        if (parsedResults.confidence === 'high') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } else if (parsedResults.confidence === 'medium') {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        } else {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        }

        setStructuredData(parsedResults);
        setEditProduct(parsedResults.product);
        const numericStr = parsedResults.price.replace(/[^0-9.]/g, '');
        setEditPrice(numericStr);

        if (isContinuousMode && parsedResults.price !== '---') {
          if (parsedResults.confidence === 'high') {
            const unitPrice = parseFloat(numericStr) || 0;
            setScanFeedback(`✅ Auto-Saved: ${parsedResults.product}`);
            await saveItemToDB(parsedResults.product, unitPrice, 1);
            refreshInventory();
            setTimeout(resetResult, 1500);
          } else {
            setScanFeedback('⚠  Please verify before saving');
          }
        }
      } else {
        // No blocks found — likely nothing inside the box
        setScanFeedback('⚠  No text detected — center the tag in the box');
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      }

    } catch (error) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      console.error('[Scanner] captureAndRead error:', error);
    } finally {
      // Always clean up both files
      if (originalUri) {
        deleteAsync(originalUri, { idempotent: true }).catch(
          e => console.warn('[Scanner] Original photo cleanup failed:', e),
        );
      }
      if (croppedUri) {
        deleteAsync(croppedUri, { idempotent: true }).catch(
          e => console.warn('[Scanner] Cropped photo cleanup failed:', e),
        );
      }
      setIsProcessing(false);
      isCapturing.current = false;
    }
  };

  return {
    device,
    cameraRef,
    hasPermission,
    isModelLoading: false,
    isProcessing,
    isTorchOn,        setIsTorchOn,
    isContinuousMode, setIsContinuousMode,
    editProduct,      setEditProduct,
    editPrice,        setEditPrice,
    quantity,         setQuantity,
    scanFeedback,
    captureAndRead,
    structuredData,   setStructuredData,
    resetResult,
    setCameraLayout,                        // ← expose so ScannerScreen can call it
  };
}