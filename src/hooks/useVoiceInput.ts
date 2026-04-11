// src/hooks/useVoiceInput.ts
// Smart voice parser — extracts product name, price, and quantity from speech.
//
// Example utterances it handles:
//   "Milo 200g 52 pesos"                 → product: Milo 200g, price: 52, qty: 1
//   "Lucky Me Pancit Canton 13 pesos"    → product: Lucky Me Pancit Canton, price: 13, qty: 1
//   "Nestle Milo 52.50 pesos quantity 3" → product: Nestle Milo, price: 52.50, qty: 3
//   "Alaska evap times 2 price 38"       → product: Alaska evap, price: 38, qty: 2
//   "Sardines dalawa 25"                 → product: Sardines, price: 25, qty: 2
//   "Colgate toothpaste tatlo 75 pesos"  → product: Colgate toothpaste, price: 75, qty: 3

import { PermissionsAndroid, Platform, Alert } from 'react-native';
import { useState, useCallback, useRef } from 'react';
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from 'expo-speech-recognition';

export interface VoiceResult {
  product: string;
  price:   string;   // plain numeric string e.g. "52.00"
  qty:     number;
}

// ─── Filipino number words → digit ────────────────────────────────────────────
const FILIPINO_NUMBERS: Record<string, number> = {
  isa: 1, dalawa: 2, tatlo: 3, apat: 4, lima: 5,
  anim: 6, pito: 7, walo: 8, siyam: 9, sampu: 10,
  one: 1, two: 2, three: 3, four: 4, five: 5,
  six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
};

// ─── Smart parser ─────────────────────────────────────────────────────────────
export function parseVoiceInput(transcript: string): VoiceResult {
  // Normalise — lowercase, collapse whitespace, strip stray punctuation
  const raw = transcript
    .toLowerCase()
    .replace(/[₱,]/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();

  let remaining = raw;
  let price  = 0;
  let qty    = 1;

  // ── 1. Extract QUANTITY ────────────────────────────────────────────────────
  const qtyPattern =
    /(?:quantity|qty|times|x|×)\s*(\d+)|(\d+)\s*(?:pieces?|pcs?|packs?|units?|quantity|qty)/i;
  const qtyMatch = remaining.match(qtyPattern);
  if (qtyMatch) {
    qty = parseInt(qtyMatch[1] ?? qtyMatch[2], 10) || 1;
    remaining = remaining.replace(qtyMatch[0], ' ');
  } else {
    for (const [word, num] of Object.entries(FILIPINO_NUMBERS)) {
      const re = new RegExp(`\\b${word}\\b`, 'i');
      if (re.test(remaining)) {
        qty = num;
        remaining = remaining.replace(re, ' ');
        break;
      }
    }
  }

  // ── 2. Extract PRICE ──────────────────────────────────────────────────────
  const pricePatterns: RegExp[] = [
    /(\d{1,5}(?:\.\d{1,2})?)\s*(?:pesos?|peso|php|presyo)\b/i,
    /(?:pesos?|peso|php|presyo|price|halaga)\s+(\d{1,5}(?:\.\d{1,2})?)\b/i,
    /(?:price|presyo)\s+(?:is|ay|ng)?\s*(\d{1,5}(?:\.\d{1,2})?)\b/i,
    /\b(\d{1,5}\.\d{1,2})\b/,
    /\b(\d{1,4})\b/,
  ];

  for (const pattern of pricePatterns) {
    const m = remaining.match(pattern);
    if (m) {
      const candidate = parseFloat(m[1]);
      if (candidate > 0 && candidate < 100000) {
        price     = candidate;
        remaining = remaining.replace(m[0], ' ');
        break;
      }
    }
  }

  // ── 3. Extract PRODUCT ────────────────────────────────────────────────────
  const noiseWords = [
    'pesos', 'peso', 'php', 'presyo', 'price', 'halaga',
    'quantity', 'qty', 'times', 'pieces', 'pcs', 'packs', 'units',
    'ang', 'ng', 'yung', 'ung', 'ay', 'is', 'at', 'and',
  ];
  let product = remaining;
  for (const noise of noiseWords) {
    product = product.replace(new RegExp(`\\b${noise}\\b`, 'gi'), ' ');
  }

  product = product
    .replace(/\s{2,}/g, ' ')
    .trim()
    .replace(/\b\w/g, c => c.toUpperCase());

  return {
    product: product || transcript, 
    price:   price > 0 ? price.toFixed(2) : '',
    qty,
  };
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
export type VoiceState = 'idle' | 'listening' | 'processing' | 'error';

interface UseVoiceInputOptions {
  onResult: (result: VoiceResult) => void;
  onError?:  (message: string) => void;
}

export function useVoiceInput({ onResult, onError }: UseVoiceInputOptions) {
  const [state,      setState]      = useState<VoiceState>('idle');
  const [transcript, setTranscript] = useState('');
  const isListening = useRef(false);

  // ── Live transcript updates ────────────────────────────────────────────────
  useSpeechRecognitionEvent('result', event => {
    const text = event.results?.[0]?.transcript ?? '';
    setTranscript(text);
    if (!event.isFinal) return;
    
    setState('processing');
    const parsed = parseVoiceInput(text);
    onResult(parsed);
    setState('idle');
    setTranscript('');
    isListening.current = false;
  });

  useSpeechRecognitionEvent('error', event => {
    console.warn('[Voice] Error:', event.error, event.message);
    setState('error');
    isListening.current = false;
    onError?.(event.message ?? 'Speech recognition error');
    setTimeout(() => setState('idle'), 2000);
  });

  useSpeechRecognitionEvent('end', () => {
    if (isListening.current) {
      setState('idle');
      isListening.current = false;
    }
  });

  // ── Native OS Permission Helper ────────────────────────────────────────────
  const requestNativeMicrophonePermission = async () => {
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
          {
            title: 'Microphone Permission',
            message: 'OfflineScanner needs access to your microphone to parse grocery items via voice.',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          },
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      } catch (err) {
        console.warn(err);
        return false;
      }
    }
    return true; 
  };

  // ── Start ──────────────────────────────────────────────────────────────────
  const startListening = useCallback(async () => {
    try {
      // 1. Force the native Android OS prompt first
      const hasNativePermission = await requestNativeMicrophonePermission();
      if (!hasNativePermission) {
        Alert.alert('Permission Denied', 'Microphone access is required for voice logging.');
        onError?.('Microphone permission denied.');
        return;
      }

      // 2. Call Expo's internal permission check (safeguard)
      const { status } = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (status !== 'granted') {
        onError?.('Microphone permission denied by Expo.');
        return;
      }

      setTranscript('');
      setState('listening');
      isListening.current = true;

      ExpoSpeechRecognitionModule.start({
        lang:           'en-PH',  
        interimResults: true,     
        maxAlternatives: 1,
        continuous:     false,    
      });
    } catch (e) {
      console.error('[Voice] start error:', e);
      setState('error');
      onError?.('Could not start voice input.');
      setTimeout(() => setState('idle'), 2000);
    }
  }, [onError]);

  // ── Stop ───────────────────────────────────────────────────────────────────
  const stopListening = useCallback(() => {
    ExpoSpeechRecognitionModule.stop();
    isListening.current = false;
    setState('idle');
  }, []);

  // ── Toggle (tap to start, tap again to stop) ───────────────────────────────
  const toggle = useCallback(() => {
    if (state === 'listening') {
      stopListening();
    } else if (state === 'idle') {
      startListening();
    }
  }, [state, startListening, stopListening]);

  return { state, transcript, toggle, startListening, stopListening };
}