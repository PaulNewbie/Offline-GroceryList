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
  const [quantity, setQuantity]             = useState(1);   // ← new

  const [isTorchOn, setIsTorchOn]               = useState(false);
  const [isContinuousMode, setIsContinuousMode] = useState(false);
  const [scanFeedback, setScanFeedback]         = useState('');

  useEffect(() => {
    (async () => {
      const status = await Camera.requestCameraPermission();
      setHasPermission(status === 'granted');
    })();
  }, []);

  const captureAndRead = async () => {
    if (!cameraRef.current) return;

    try {
      setIsProcessing(true);
      setStructuredData(null);
      setScanFeedback('');
      setQuantity(1);  // reset qty on each new scan

      const photo = await cameraRef.current.takePhoto({ flash: 'off' });
      const result = await TextRecognition.recognize(`file://${photo.path}`);

      if (result.blocks) {
        const parsedResults = await processScannedText(
          result.blocks,
          photo.width,
          photo.height,
        );

        // Haptic quality signal
        if (parsedResults.confidence === 'high') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } else if (parsedResults.confidence === 'medium') {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        } else {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        }

        setStructuredData(parsedResults);
        setEditProduct(parsedResults.product);
        setEditPrice(parsedResults.price);

        if (isContinuousMode && parsedResults.price !== '---') {
          if (parsedResults.confidence === 'high') {
            setScanFeedback(`✅ Auto-Saved: ${parsedResults.product}`);
            await saveItemToDB(parsedResults.product, parsedResults.price);
            refreshInventory();
            setTimeout(() => {
              setStructuredData(null);
              setEditProduct('');
              setEditPrice('');
              setQuantity(1);
              setScanFeedback('');
            }, 1500);
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
    isTorchOn,       setIsTorchOn,
    isContinuousMode, setIsContinuousMode,
    editProduct,     setEditProduct,
    editPrice,       setEditPrice,
    quantity,        setQuantity,       // ← exposed
    scanFeedback,
    captureAndRead,
    structuredData,  setStructuredData,
  };
}