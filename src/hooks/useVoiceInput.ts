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
  // Patterns (in order of specificity):
  //   "quantity 3" | "qty 3" | "times 3" | "x3" | "× 3"
  //   Filipino: "dalawa" | "tatlo" etc.

  // "quantity/qty/times N" or "N quantity/qty/pieces/pcs/packs"
  const qtyPattern =
    /(?:quantity|qty|times|x|×)\s*(\d+)|(\d+)\s*(?:pieces?|pcs?|packs?|units?|quantity|qty)/i;
  const qtyMatch = remaining.match(qtyPattern);
  if (qtyMatch) {
    qty = parseInt(qtyMatch[1] ?? qtyMatch[2], 10) || 1;
    remaining = remaining.replace(qtyMatch[0], ' ');
  } else {
    // Filipino number words anywhere in the string
    for (const [word, num] of Object.entries(FILIPINO_NUMBERS)) {
      // Only match whole words
      const re = new RegExp(`\\b${word}\\b`, 'i');
      if (re.test(remaining)) {
        qty = num;
        remaining = remaining.replace(re, ' ');
        break;
      }
    }
  }

  // ── 2. Extract PRICE ──────────────────────────────────────────────────────
  // Patterns (most specific first):
  //   "52.50 pesos" | "52 pesos" | "pesos 52" | "price 52" | "presyo 52"
  //   bare decimal "52.50" (no label)

  const pricePatterns: RegExp[] = [
    // Number + peso keyword
    /(\d{1,5}(?:\.\d{1,2})?)\s*(?:pesos?|peso|php|presyo)\b/i,
    // Peso keyword + number
    /(?:pesos?|peso|php|presyo|price|halaga)\s+(\d{1,5}(?:\.\d{1,2})?)\b/i,
    // "price is 52" / "presyo ay 52"
    /(?:price|presyo)\s+(?:is|ay|ng)?\s*(\d{1,5}(?:\.\d{1,2})?)\b/i,
    // Bare decimal (last resort — must have cents to avoid grabbing weights like "200")
    /\b(\d{1,5}\.\d{1,2})\b/,
    // Plain integer ≤ 4 digits that hasn't been matched yet (very last resort)
    /\b(\d{1,4})\b/,
  ];

  for (const pattern of pricePatterns) {
    const m = remaining.match(pattern);
    if (m) {
      const candidate = parseFloat(m[1]);
      // Sanity check: price should be > 0 and < 100,000
      if (candidate > 0 && candidate < 100000) {
        price     = candidate;
        remaining = remaining.replace(m[0], ' ');
        break;
      }
    }
  }

  // ── 3. Extract PRODUCT ────────────────────────────────────────────────────
  // Strip leftover noise keywords and clean up
  const noiseWords = [
    'pesos', 'peso', 'php', 'presyo', 'price', 'halaga',
    'quantity', 'qty', 'times', 'pieces', 'pcs', 'packs', 'units',
    'ang', 'ng', 'yung', 'ung', 'ay', 'is', 'at', 'and',
  ];
  let product = remaining;
  for (const noise of noiseWords) {
    product = product.replace(new RegExp(`\\b${noise}\\b`, 'gi'), ' ');
  }

  // Clean up extra whitespace and capitalise words
  product = product
    .replace(/\s{2,}/g, ' ')
    .trim()
    .replace(/\b\w/g, c => c.toUpperCase());

  return {
    product: product || transcript, // fallback to raw if parsing strips everything
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
    // If this is a final result, process immediately
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
      // Recognition ended without a final result — treat as done
      setState('idle');
      isListening.current = false;
    }
  });

  // ── Start ──────────────────────────────────────────────────────────────────
  const startListening = useCallback(async () => {
    try {
      const { status } = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (status !== 'granted') {
        onError?.('Microphone permission denied.');
        return;
      }
      setTranscript('');
      setState('listening');
      isListening.current = true;

      ExpoSpeechRecognitionModule.start({
        lang:          'en-PH',   // Philippine English — handles Taglish well
        interimResults: true,     // show live transcript as user speaks
        maxAlternatives: 1,
        continuous:     false,    // stop after first pause
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