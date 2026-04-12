// src/hooks/useVoiceInput.ts
// Filipino-English voice parser — with Levenshtein cache added

import { PermissionsAndroid, Platform, Alert } from 'react-native';
import { useState, useCallback, useRef } from 'react';
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from 'expo-speech-recognition';

export interface VoiceResult {
  product: string;
  price:   string;
  qty:     number;
}

// ─── Filipino number word map ─────────────────────────────────────────────────
const FILIPINO_NUMBERS: Record<string, number> = {
  isa: 1, dalawa: 2, tatlo: 3, apat: 4, lima: 5,
  anim: 6, pito: 7, walo: 8, siyam: 9, sampu: 10,
  labing: 11, labindalawa: 12, labintatlo: 13,
  labing_apat: 14, labinlima: 15,
  isang: 1, dalawang: 2, tatlong: 3, apat_na: 4, limang: 5,
  anim_na: 6, pitong: 7, walong: 8, siyam_na: 9, sampung: 10,
  uno: 1, dos: 2, tres: 3, kwatro: 4, singko: 5,
  seis: 6, syete: 7, otso: 8, nuwebe: 9, dyis: 10,
  onse: 11, dose: 12, trese: 13, katorse: 14, kinse: 15,
  dyisesais: 16, dyisesyete: 17, dyisootso: 18, dyisnuwebe: 19,
  beynte: 20, beinte: 20,
  one: 1, two: 2, three: 3, four: 4, five: 5,
  six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12,
};

const HUNDREDS: Record<string, number> = {
  'isang daan': 100, 'dalawang daan': 200, 'tatlong daan': 300,
  'apat na daan': 400, 'limang daan': 500, 'anim na daan': 600,
  'pitong daan': 700, 'walong daan': 800, 'siyam na daan': 900,
  'syento': 100, 'dos syentos': 200, 'tres syentos': 300,
  'tres siyento': 300, 'singkuwenta': 50,
};

const NOISE_WORDS = new Set([
  'ang','ng','mga','yung','ung','ay','si','ni','kay',
  'para','sa','na','nang','nito','nyan','niyan','noon',
  'ito','iyan','iyon','dito','doon','po','ho','opo',
  'nga','kasi','tapos','din','rin','lang','lamang',
  'at','o','pero','kaya','dahil','kung','kapag',
  'pesos','peso','piso','php','presyo','price','halaga',
  'bayad','bili','bilhin','kumuha','bumili','gusto','ko',
  'mag','makakuha',
  'lata','piraso','bote','kahon','supot','sobre',
  'pack','packs','sachet','sachets','bag','bags',
  'box','boxes','can','cans','piece','pieces',
  'pc','pcs','unit','units','bottle','bottles',
  'litre','litres','liter','liters',
  'the','a','an','of','for','and','or','is','it',
  'please','i','want','need','get','buy',
]);

// ─── Levenshtein + module-level cache ────────────────────────────────────────
// The voice parser calls levenshtein() inside hasFuzzyPriceWord which runs
// on every token of every speech transcript. Across a session users say the
// same words repeatedly ("pesos", "dalawang", brand names) — the cache
// converts those repeated O(m×n) DP computations into O(1) map lookups.
// Cap at 2000 entries — clears rather than evicts to keep the implementation
// simple. A typical session won't approach this limit.
const _lvCache = new Map<string, number>();

function levenshtein(a: string, b: string): number {
  const key = `${a}|${b}`;
  if (_lvCache.has(key)) return _lvCache.get(key)!;

  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);

  const result = dp[m][n];
  if (_lvCache.size >= 2000) _lvCache.clear();
  _lvCache.set(key, result);
  return result;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const normalize = (text: string): string =>
  text.toLowerCase().replace(/[₱,]/g, ' ').replace(/\s{2,}/g, ' ').trim();

function extractQuantity(text: string): { qty: number; remaining: string } {
  let remaining = text;
  let qty = 1;

  const twoWordMatch = remaining.match(/\b(apat|anim|siyam)\s+na\b/);
  if (twoWordMatch) {
    const key = `${twoWordMatch[1]}_na`;
    if (FILIPINO_NUMBERS[key]) {
      qty = FILIPINO_NUMBERS[key];
      remaining = remaining.replace(twoWordMatch[0], ' ');
    }
  }
  if (qty > 1) return { qty, remaining: remaining.trim() };

  const explicitMatch = remaining.match(
    /(?:quantity|qty|times|x|×)\s*(\d+)|(\d+)\s*(?:pieces?|pcs?|packs?|units?|quantity|qty|piraso|lata|bote)/i,
  );
  if (explicitMatch) {
    qty = parseInt(explicitMatch[1] ?? explicitMatch[2], 10) || 1;
    remaining = remaining.replace(explicitMatch[0], ' ');
    return { qty, remaining: remaining.trim() };
  }

  const numberEntries = Object.entries(FILIPINO_NUMBERS)
    .filter(([key]) => !key.includes('_'))
    .sort(([a], [b]) => b.length - a.length);

  for (const [word, num] of numberEntries) {
    const re = new RegExp(`\\b${word}\\b`, 'i');
    if (re.test(remaining)) {
      qty = num;
      remaining = remaining.replace(re, ' ');
      break;
    }
  }
  return { qty, remaining: remaining.trim() };
}

function extractPrice(text: string): { price: number; remaining: string } {
  let remaining = text;

  for (const [phrase, value] of Object.entries(HUNDREDS).sort(
    ([a], [b]) => b.length - a.length,
  )) {
    if (remaining.includes(phrase)) {
      const afterPhrase = remaining
        .substring(remaining.indexOf(phrase) + phrase.length).trim();
      let addend = 0;
      const addendMatch = afterPhrase.match(
        /^(?:at\s+)?(\d{1,3})\b|^(?:at\s+)?(beinte|beynte|singkuwenta|tres\s*punta)/i,
      );
      if (addendMatch) addend = parseInt(addendMatch[1] ?? '0', 10) || 0;
      const price = value + addend;
      remaining = remaining.replace(phrase, ' ');
      if (addend > 0 && addendMatch) remaining = remaining.replace(addendMatch[0], ' ');
      return { price, remaining: remaining.trim() };
    }
  }

  const spanishBlends: Array<[RegExp, number]> = [
    [/\bbeinte\s*singko\b/i, 25], [/\bbeynte\s*singko\b/i, 25],
    [/\bsingkuwenta\b/i, 50],     [/\bbeinte\b/i, 20],
    [/\bbeynte\b/i, 20],          [/\btres\s*punta\b/i, 30],
  ];
  for (const [re, value] of spanishBlends) {
    if (re.test(remaining)) {
      remaining = remaining.replace(re, ' ');
      return { price: value, remaining: remaining.trim() };
    }
  }

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

  const decimalMatch = remaining.match(/\b(\d{1,5}\.\d{1,2})\b/);
  if (decimalMatch) {
    const candidate = parseFloat(decimalMatch[1]);
    if (candidate > 0 && candidate < 100000) {
      remaining = remaining.replace(decimalMatch[0], ' ');
      return { price: candidate, remaining: remaining.trim() };
    }
  }

  const intMatches = [...remaining.matchAll(/\b(\d{1,5})\b/g)];
  if (intMatches.length > 0) {
    const pricelike = intMatches
      .map(m => ({ match: m, value: parseInt(m[1], 10) }))
      .filter(({ value }) => value >= 1 && value < 100000);
    if (pricelike.length > 0) {
      const best = pricelike[pricelike.length - 1];
      remaining = remaining.replace(best.match[0], ' ');
      return { price: best.value, remaining: remaining.trim() };
    }
  }

  return { price: 0, remaining: remaining.trim() };
}

function cleanProductName(text: string): string {
  return text
    .split(/\s+/)
    .filter(token => {
      const lower = token.toLowerCase().replace(/[^a-z]/g, '');
      return lower.length > 0 && !NOISE_WORDS.has(lower);
    })
    .join(' ')
    .trim()
    .replace(/\b\w/g, c => c.toUpperCase());
}

// ─── Main parser ──────────────────────────────────────────────────────────────
export function parseVoiceInput(transcript: string): VoiceResult {
  const raw = normalize(transcript);
  const { qty, remaining: afterQty }     = extractQuantity(raw);
  const { price, remaining: afterPrice } = extractPrice(afterQty);
  const product = cleanProductName(afterPrice) || transcript;
  return { product, price: price > 0 ? price.toFixed(2) : '', qty };
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
    if (isListening.current) { setState('idle'); isListening.current = false; }
  });

  const requestNativeMicrophonePermission = async () => {
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
          {
            title: 'Microphone Permission',
            message: 'OfflineScanner needs microphone access to parse grocery items via voice.',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          },
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      } catch (err) { console.warn(err); return false; }
    }
    return true;
  };

  const startListening = useCallback(async () => {
    try {
      const hasNative = await requestNativeMicrophonePermission();
      if (!hasNative) {
        Alert.alert('Permission Denied', 'Microphone access is required for voice logging.');
        onError?.('Microphone permission denied.');
        return;
      }
      const { status } = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (status !== 'granted') { onError?.('Microphone permission denied by Expo.'); return; }
      setTranscript('');
      setState('listening');
      isListening.current = true;
      ExpoSpeechRecognitionModule.start({
        lang: 'en-PH', interimResults: true, maxAlternatives: 1, continuous: false,
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
    if (state === 'listening') stopListening();
    else if (state === 'idle') startListening();
  }, [state, startListening, stopListening]);

  return { state, transcript, toggle, startListening, stopListening };
}