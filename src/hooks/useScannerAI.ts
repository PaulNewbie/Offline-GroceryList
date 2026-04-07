// src/hooks/useScannerAI.ts
import { useState, useEffect, useRef } from 'react';
import { Camera, useCameraDevice } from 'react-native-vision-camera';
import TextRecognition from '@react-native-ml-kit/text-recognition';
import * as Haptics from 'expo-haptics';
import { InferenceSession } from 'onnxruntime-react-native';
import { Asset } from 'expo-asset';
import { processScannedText, ParsedProduct } from '../utils/scannerParser';
import { saveItemToDB } from '../utils/database';

export function useScannerAI(refreshInventory: () => void) {
  // Hardware
  const [hasPermission, setHasPermission] = useState(false);
  const device = useCameraDevice('back');
  const cameraRef = useRef<Camera>(null);

  // AI & Processing State
  const [onnxSession, setOnnxSession] = useState<InferenceSession | null>(null);
  const [isModelLoading, setIsModelLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);

  // Editable Data State
  const [structuredData, setStructuredData] = useState<ParsedProduct | null>(null);
  const [editProduct, setEditProduct] = useState("");
  const [editPrice, setEditPrice] = useState("");

  // UX State
  const [isTorchOn, setIsTorchOn] = useState(false);
  const [isContinuousMode, setIsContinuousMode] = useState(false);
  const [scanFeedback, setScanFeedback] = useState("");

  // 1. Initialize Hardware and AI
  useEffect(() => {
    (async () => {
      const status = await Camera.requestCameraPermission();
      setHasPermission(status === 'granted');

      try {
        const modelAsset = await Asset.loadAsync(require('../../assets/models/model_quantized.onnx'));
        const uri = modelAsset[0].localUri;
        if (!uri) throw new Error("Model URI is null.");
        
        const session = await InferenceSession.create(uri);
        setOnnxSession(session);
      } catch (e) {
        console.error("Failed to load AI model:", e);
      } finally {
        setIsModelLoading(false);
      }
    })();
  }, []);

  // 2. The Core Scanning Logic
  const captureAndRead = async () => {
    if (!cameraRef.current || isModelLoading) return;

    try {
      setIsProcessing(true);
      setStructuredData(null);
      setScanFeedback("");

      const photo = await cameraRef.current.takePhoto({ flash: 'off' });
      const result = await TextRecognition.recognize(`file://${photo.path}`);

      if (result.blocks) {
        const parsedResults = await processScannedText(result.blocks, photo.width, photo.height, onnxSession);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

        setStructuredData(parsedResults);
        setEditProduct(parsedResults.product);
        setEditPrice(parsedResults.price);

        if (isContinuousMode && parsedResults.price !== "---") {
          setScanFeedback(`✅ Auto-Saved: ${parsedResults.product}`);
          await saveItemToDB(parsedResults.product, parsedResults.price);
          refreshInventory();

          setTimeout(() => {
            setStructuredData(null);
            setEditProduct("");
            setEditPrice("");
            setScanFeedback("");
          }, 1500);
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
    isModelLoading,
    isProcessing,
    isTorchOn,
    setIsTorchOn,
    isContinuousMode,
    setIsContinuousMode,
    editProduct,
    setEditProduct,
    editPrice,
    setEditPrice,
    scanFeedback,
    captureAndRead,
    structuredData,
    setStructuredData
  };
}