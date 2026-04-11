// src/utils/ocr.ts
// Thin wrapper around ML Kit text recognition.
// If we ever swap to a different OCR library, only this file changes —
// useScannerAI.ts and everything above it stays untouched.

import TextRecognition, { 
  TextRecognitionResult 
} from '@react-native-ml-kit/text-recognition';

export interface OCRResult {
  blocks: TextRecognitionResult['blocks'];
  width:  number;
  height: number;
}

export const recognizeText = async (
  filePath: string, 
  width: number, 
  height: number
): Promise<OCRResult | null> => {
  try {
    const result = await TextRecognition.recognize(`file://${filePath}`);
    return {
      blocks: result.blocks ?? [],
      width,
      height,
    };
  } catch (e) {
    console.error('[OCR] Recognition failed:', e);
    return null;
  }
};