// src/hooks/useVoiceInput.ts
//
// Full Filipino-English voice parser overhaul.
//
// Handles the following patterns that the original parser missed:
//
//   QUANTITY (ligature/linker forms):
//     "dalawang"  → 2   (dalawa + -ng linker)
//     "tatlong"   → 3   (tatlo + -ng)
//     "apat na"   → 4   (apat + na linker)
//     "limang"    → 5
//     "animng"    → 6   (rare but heard)
//     "pitong"    → 7
//     "walong"    → 8
//     "siyam na"  → 9
//     "sampung"   → 10
//
//   QUANTITY (classifier phrases):
//     "dalawang lata"     → qty:2, strips "lata"
//     "tatlong piraso"    → qty:3, strips "piraso"
//     "limang pack"       → qty:5, strips "pack"
//     "dalawang bote"     → qty:2, strips "bote"
//
//   PRICE (mixed forms):
//     "beinte singko"     → 25
//     "singkuwenta"       → 50
//     "isang daan"        → 100
//     "dalawang daan"     → 200
//     "tres siyento"      → 300  (Spanish-Filipino blend)
//     "limang daan"       → 500
//
//   NOISE WORDS (stripped from product name):
//     Filipino: ang, ng, yung, ung, ay, si, ni, kay, para, sa,
//               na, nang, nito, nyan, ito, iyan, iyon, dito, doon,
//               po, ho, opo, nga, kasi, tapos, din, rin, lang, lamang
//     Units/classifiers: lata, piraso, piraso, bote, kahon, supot,
//                        sobre, pack, packs, sachet, sachets, bag,
//                        bags, box, boxes, can, cans, piece, pieces,
//                        pc, pcs, pack, unit, units
//     Transaction: pesos, peso, php, presyo, price, halaga, bayad,
//                  bili, bilhin, kumuha, bumili
//
//   PRODUCT CLEANUP:
//     Capitalizes each word properly after stripping noise
//     Handles product names that come BEFORE or AFTER the quantity/price

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

// ─── Filipino number word map ─────────────────────────────────────────────────
// Includes base forms AND ligature/linker suffixed forms (-ng, na).
// Ligatures are extremely common in natural speech:
//   "dalawa" → standalone count
//   "dalawang" → modifying a noun ("dalawang sardinas")
// Both must map to the same digit.

const FILIPINO_NUMBERS: Record<string, number> = {
  // ── Base forms ──
  isa: 1, dalawa: 2, tatlo: 3, apat: 4, lima: 5,
  anim: 6, pito: 7, walo: 8, siyam: 9, sampu: 10,
  labing: 11, labindalawa: 12, labintatlo: 13,
  labing_apat: 14, labinlima: 15,

  // ── -ng ligature forms (word + ng, no space) ──
  // These appear when the number directly modifies a noun.
  isang: 1, dalawang: 2, tatlong: 3, apat_na: 4, limang: 5,
  anim_na: 6, pitong: 7, walong: 8, siyam_na: 9, sampung: 10,

  // ── Spanish-origin numbers common in PH market speech ──
  uno: 1, dos: 2, tres: 3, kwatro: 4, singko: 5,
  seis: 6, syete: 7, otso: 8, nuwebe: 9, dyis: 10,
  onse: 11, dose: 12, trese: 13, katorse: 14, kinse: 15,
  dyisesais: 16, dyisesyete: 17, dyisootso: 18, dyisnuwebe: 19,
  beynte: 20, beinte: 20,

  // ── English forms ──
  one: 1, two: 2, three: 3, four: 4, five: 5,
  six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12,
};

// ─── Filipino price word map ──────────────────────────────────────────────────
// Handles spoken price forms like "beinte singko pesos" → 25,
// "isang daan" → 100, "dalawang daan at limampung piso" → 250.

const HUNDREDS: Record<string, number> = {
  'isang daan': 100, 'dalawang daan': 200, 'tatlong daan': 300,
  'apat na daan': 400, 'limang daan': 500, 'anim na daan': 600,
  'pitong daan': 700, 'walong daan': 800, 'siyam na daan': 900,
  // Spanish blends
  'syento': 100, 'dos syentos': 200, 'tres syentos': 300,
  'tres siyento': 300, 'singkuwenta': 50,
};

// ─── Noise words to strip from product name ───────────────────────────────────
// Order matters: longer phrases before shorter ones to avoid partial matches.
const NOISE_WORDS = new Set([
  // Filipino particles and linkers
  'ang', 'ng', 'mga', 'yung', 'ung', 'ay', 'si', 'ni', 'kay',
  'para', 'sa', 'na', 'nang', 'nito', 'nyan', 'niyan', 'noon',
  'ito', 'iyan', 'iyon', 'dito', 'doon', 'po', 'ho', 'opo',
  'nga', 'kasi', 'tapos', 'din', 'rin', 'lang', 'lamang',
  'at', 'o', 'pero', 'kaya', 'dahil', 'kung', 'kapag',
  // Transaction words
  'pesos', 'peso', 'piso', 'php', 'presyo', 'price', 'halaga',
  'bayad', 'bili', 'bilhin', 'kumuha', 'bumili', 'gusto', 'ko',
  'nang', 'mag', 'makakuha',
  // Unit/classifier words — stripped after quantity is extracted
  'lata', 'piraso', 'bote', 'kahon', 'supot', 'sobre',
  'pack', 'packs', 'sachet', 'sachets', 'bag', 'bags',
  'box', 'boxes', 'can', 'cans', 'piece', 'pieces',
  'pc', 'pcs', 'unit', 'units', 'bottle', 'bottles',
  'litre', 'litres', 'liter', 'liters',
  // English filler
  'the', 'a', 'an', 'of', 'for', 'and', 'or', 'is', 'it',
  'please', 'i', 'want', 'need', 'get', 'buy',
]);

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Normalize transcript: lowercase, strip ₱ and commas, collapse whitespace. */
const normalize = (text: string): string =>
  text
    .toLowerCase()
    .replace(/[₱,]/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();

/**
 * Try to resolve a spoken word to a number from FILIPINO_NUMBERS.
 * Handles the "apat na" and "anim na" forms which have a space before "na"
 * by replacing the space with an underscore key in the map.
 */
const resolveNumberWord = (word: string): number | null => {
  if (FILIPINO_NUMBERS[word] !== undefined) return FILIPINO_NUMBERS[word];
  return null;
};

/**
 * Extract quantity from a normalized transcript string.
 * Returns { qty, remaining } where remaining has the quantity phrase removed.
 *
 * Handles in order of specificity:
 *   1. "apat na <classifier>" and "anim na <classifier>" (two-word number + na)
 *   2. Standard "-ng" ligature forms ("dalawang", "tatlong")
 *   3. Digit-based patterns ("quantity 3", "3 pieces", "x3")
 *   4. Base Filipino/English number words without ligature
 */
function extractQuantity(text: string): { qty: number; remaining: string } {
  let remaining = text;
  let qty = 1;

  // ── Pattern 1: "apat na" / "anim na" / "siyam na" two-word forms ─────────
  // Must be checked before single-word patterns to avoid "apat" matching alone.
  const twoWordPattern = /\b(apat|anim|siyam)\s+na\b/;
  const twoWordMatch = remaining.match(twoWordPattern);
  if (twoWordMatch) {
    const key = `${twoWordMatch[1]}_na`;
    if (FILIPINO_NUMBERS[key]) {
      qty = FILIPINO_NUMBERS[key];
      remaining = remaining.replace(twoWordMatch[0], ' ');
    }
  }

  if (qty > 1) return { qty, remaining: remaining.trim() };

  // ── Pattern 2: Explicit quantity keywords with digits ─────────────────────
  const explicitQtyPattern =
    /(?:quantity|qty|times|x|×)\s*(\d+)|(\d+)\s*(?:pieces?|pcs?|packs?|units?|quantity|qty|piraso|lata|bote)/i;
  const explicitMatch = remaining.match(explicitQtyPattern);
  if (explicitMatch) {
    qty = parseInt(explicitMatch[1] ?? explicitMatch[2], 10) || 1;
    remaining = remaining.replace(explicitMatch[0], ' ');
    return { qty, remaining: remaining.trim() };
  }

  // ── Pattern 3: Number word (including -ng ligature forms) ─────────────────
  // Sort by length descending so "dalawang" matches before "dalawa".
  const numberEntries = Object.entries(FILIPINO_NUMBERS)
    .filter(([key]) => !key.includes('_')) // skip underscore-keyed two-word forms
    .sort(([a], [b]) => b.length - a.length);

  for (const [word, num] of numberEntries) {
    // \b doesn't work well with non-ASCII but our number words are ASCII-safe
    const re = new RegExp(`\\b${word}\\b`, 'i');
    if (re.test(remaining)) {
      qty = num;
      remaining = remaining.replace(re, ' ');
      break;
    }
  }

  return { qty, remaining: remaining.trim() };
}

/**
 * Extract price from a normalized transcript string.
 * Returns { price, remaining } — price is a number (0 if not found).
 *
 * Handles in order of specificity:
 *   1. Spoken hundred forms ("isang daan", "dalawang daan at limampung")
 *   2. Spanish-Filipino blends ("beinte singko", "singkuwenta")
 *   3. Digit with peso marker ("52 pesos", "₱52", "PHP 52")
 *   4. Bare decimal ("52.50")
 *   5. Bare integer that looks like a price (last resort)
 */
function extractPrice(text: string): { price: number; remaining: string } {
  let remaining = text;

  // ── Pattern 1: Spoken hundreds ────────────────────────────────────────────
  for (const [phrase, value] of Object.entries(HUNDREDS).sort(
    ([a], [b]) => b.length - a.length, // longest first
  )) {
    if (remaining.includes(phrase)) {
      // Check for "at [tens]" addend after the hundreds phrase
      // e.g. "dalawang daan at limampu" → 250
      const afterPhrase = remaining
        .substring(remaining.indexOf(phrase) + phrase.length)
        .trim();

      let addend = 0;
      // "at limampu", "at beinte singko", etc.
      const addendMatch = afterPhrase.match(
        /^(?:at\s+)?(\d{1,3})\b|^(?:at\s+)?(beinte|beynte|singkuwenta|tres\s*punta)/i,
      );
      if (addendMatch) {
        addend = parseInt(addendMatch[1] ?? '0', 10) || 0;
      }

      const price = value + addend;
      remaining = remaining.replace(phrase, ' ');
      if (addend > 0 && addendMatch) {
        remaining = remaining.replace(addendMatch[0], ' ');
      }
      return { price, remaining: remaining.trim() };
    }
  }

  // ── Pattern 2: Spanish-Filipino price blends ──────────────────────────────
  // "beinte singko" → 25, "beinte" → 20, "singkuwenta" → 50
  const spanishBlends: Array<[RegExp, number]> = [
    [/\bbeinte\s*singko\b/i, 25],
    [/\bbeynte\s*singko\b/i, 25],
    [/\bsingkuwenta\b/i,     50],
    [/\bbeinte\b/i,          20],
    [/\bbeynte\b/i,          20],
    [/\btres\s*punta\b/i,    30],
  ];
  for (const [re, value] of spanishBlends) {
    if (re.test(remaining)) {
      remaining = remaining.replace(re, ' ');
      return { price: value, remaining: remaining.trim() };
    }
  }

  // ── Pattern 3: Digit with peso marker ────────────────────────────────────
  const pesoPatterns: RegExp[] = [
    /(\d{1,5}(?:\.\d{1,2})?)\s*(?:pesos?|piso?|php|presyo)\b/i,
    /(?:pesos?|piso?|php|presyo|price|halaga)\s+(\d{1,5}(?:\.\d{1,2})?)\b/i,
    /(?:price|presyo)\s+(?:is|ay|ng)?\s*(\d{1,5}(?:\.\d{1,2})?)\b/i,
  ];
  for (const pattern of pesoPatterns) {
    const m = remaining.match(pattern);
    if (m) {
      const candidate = parseFloat(m[1]);
      if (candidate > 0 && candidate < 100000) {
        remaining = remaining.replace(m[0], ' ');
        return { price: candidate, remaining: remaining.trim() };
      }
    }
  }

  // ── Pattern 4: Bare decimal ───────────────────────────────────────────────
  const decimalMatch = remaining.match(/\b(\d{1,5}\.\d{1,2})\b/);
  if (decimalMatch) {
    const candidate = parseFloat(decimalMatch[1]);
    if (candidate > 0 && candidate < 100000) {
      remaining = remaining.replace(decimalMatch[0], ' ');
      return { price: candidate, remaining: remaining.trim() };
    }
  }

  // ── Pattern 5: Last-resort bare integer ───────────────────────────────────
  // Only fires if nothing else matched. Picks the largest number remaining
  // since product weights (200, 500) are often smaller than prices.
  const intMatches = [...remaining.matchAll(/\b(\d{1,5})\b/g)];
  if (intMatches.length > 0) {
    // Prefer numbers that look like prices (> 5) over weights/counts
    const pricelike = intMatches
      .map(m => ({ match: m, value: parseInt(m[1], 10) }))
      .filter(({ value }) => value >= 1 && value < 100000);

    if (pricelike.length > 0) {
      // Take the last number in the string — prices tend to come after product names
      const best = pricelike[pricelike.length - 1];
      remaining = remaining.replace(best.match[0], ' ');
      return { price: best.value, remaining: remaining.trim() };
    }
  }

  return { price: 0, remaining: remaining.trim() };
}

/**
 * Strip noise words from a product name string.
 * Works token by token; preserves words not in the noise set.
 */
function cleanProductName(text: string): string {
  const tokens = text.split(/\s+/);
  const cleaned = tokens.filter(token => {
    const lower = token.toLowerCase().replace(/[^a-z]/g, '');
    return lower.length > 0 && !NOISE_WORDS.has(lower);
  });

  return cleaned
    .join(' ')
    .trim()
    // Title-case each word
    .replace(/\b\w/g, c => c.toUpperCase());
}

// ─── Main parser ──────────────────────────────────────────────────────────────

export function parseVoiceInput(transcript: string): VoiceResult {
  const raw = normalize(transcript);

  // Step 1: Extract quantity (modifies `remaining`)
  const { qty, remaining: afterQty } = extractQuantity(raw);

  // Step 2: Extract price from what's left
  const { price, remaining: afterPrice } = extractPrice(afterQty);

  // Step 3: Whatever remains is the product name — strip noise words
  const product = cleanProductName(afterPrice) || transcript;

  return {
    product,
    price: price > 0 ? price.toFixed(2) : '',
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

  const startListening = useCallback(async () => {
    try {
      const hasNativePermission = await requestNativeMicrophonePermission();
      if (!hasNativePermission) {
        Alert.alert('Permission Denied', 'Microphone access is required for voice logging.');
        onError?.('Microphone permission denied.');
        return;
      }

      const { status } = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (status !== 'granted') {
        onError?.('Microphone permission denied by Expo.');
        return;
      }

      setTranscript('');
      setState('listening');
      isListening.current = true;

      ExpoSpeechRecognitionModule.start({
        lang:            'en-PH',
        interimResults:  true,
        maxAlternatives: 1,
        continuous:      false,
      });
    } catch (e) {
      console.error('[Voice] start error:', e);
      setState('error');
      onError?.('Could not start voice input.');
      setTimeout(() => setState('idle'), 2000);
    }
  }, [onError]);

  const stopListening = useCallback(() => {
    ExpoSpeechRecognitionModule.stop();
    isListening.current = false;
    setState('idle');
  }, []);

  const toggle = useCallback(() => {
    if (state === 'listening') {
      stopListening();
    } else if (state === 'idle') {
      startListening();
    }
  }, [state, startListening, stopListening]);

  return { state, transcript, toggle, startListening, stopListening };
}