// src/hooks/useScannerAI.ts
import { useState, useEffect, useRef } from 'react';
import { Camera, useCameraDevice } from 'react-native-vision-camera';
import TextRecognition from '@react-native-ml-kit/text-recognition';
import * as Haptics from 'expo-haptics';

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
    if (!cameraRef.current) return;
    try {
      setIsProcessing(true);
      resetResult();

      const photo = await cameraRef.current.takePhoto({ flash: 'off' });
      const result = await TextRecognition.recognize(`file://${photo.path}`);

      if (result.blocks) {
        const parsedResults = await processScannedText(
          result.blocks,
          photo.width,
          photo.height,
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
        // editPrice holds the display string for the TextInput (e.g. "52.00")
        // Strip the ₱ symbol so the user sees a plain number in the field
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
    } finally {
      setIsProcessing(false);
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
    editPrice,        setEditPrice,   // plain numeric string e.g. "52.00"
    quantity,         setQuantity,
    scanFeedback,
    captureAndRead,
    structuredData,   setStructuredData,
    resetResult,
  };
}