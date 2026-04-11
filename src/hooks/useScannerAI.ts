// src/hooks/useScannerAI.ts
import { useState, useEffect, useRef } from 'react';
import { Camera, useCameraDevice } from 'react-native-vision-camera';
import TextRecognition from '@react-native-ml-kit/text-recognition';
import * as Haptics from 'expo-haptics';
import * as FileSystem from 'expo-file-system';

import { recognizeText } from '../utils/ocr';
import { processScannedText, ParsedProduct } from '../utils/scannerParser';
import { saveItemToDB } from '../utils/database';

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

  // FIX 2a: Debounce guard — prevents concurrent OCR jobs when the user
  // taps the scan button rapidly. A ref (not state) avoids a re-render cycle.
  const isCapturing = useRef(false);

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

  let photoPath: string | null = null;
  isCapturing.current = true;

  try {
    setIsProcessing(true);
    resetResult();

    const photo = await cameraRef.current.takePhoto({ flash: 'off' });
    photoPath = photo.path;

    // --- NEW LOGIC START ---
    // Use the utility instead of calling TextRecognition directly
    const result = await recognizeText(photoPath, photo.width, photo.height);

    if (result && result.blocks.length > 0) {
      const parsedResults = await processScannedText(
        result.blocks,
        photo.width,  // Use photo metadata for accuracy
        photo.height,
      );
    // --- NEW LOGIC END ---

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
    }
  } catch (error) {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    console.error('[Scanner] captureAndRead error:', error);
  } finally {
    if (photoPath) {
      FileSystem.deleteAsync(`file://${photoPath}`, { idempotent: true }).catch(
        (e) => console.warn('[Scanner] Photo cleanup failed:', e),
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
  };
}