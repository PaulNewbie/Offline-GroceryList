// src/utils/scannerParser.ts
// v3.2 — Robust split-price stitching + price debug logging

export type ConfidenceLevel = 'high' | 'medium' | 'low';

export interface ParsedProduct {
  product:    string;
  price:      string;
  confidence: ConfidenceLevel;
  rawScore:   number;
}

// ─── 1. OCR SANITIZER ─────────────────────────────────────────────────────────
// Fixes common OCR hallucinations. Applied BEFORE any analysis.
const sanitizeLine = (raw: string): string =>
  raw
    // Numeric-context substitutions (only fire between/around digits)
    .replace(/(?<=\d)[Oo](?=\d)/g, '0')
    .replace(/(?<=\d)[Il](?=\d)/g, '1')
    .replace(/(?<=\d)[Ss](?=\d)/g, '5')
    .replace(/(?<=\d)[Bb](?=\d)/g, '8')
    // Time-context substitutions
    .replace(/^[Bb](?=:\d{2}\s*(AM|PM))/i, '8')
    .replace(/^[Oo](?=:\d{2}\s*(AM|PM))/i, '0')
    .replace(/^[Il](?=:\d{2}\s*(AM|PM))/i, '1')
    .replace(/^[Ss](?=:\d{2}\s*(AM|PM))/i, '5')
    .replace(/(?<=\d)[Bb](?=:\d{2}\s*(AM|PM))/i, '8')
    .replace(/(?<=\d)[Oo](?=:\d{2}\s*(AM|PM))/i, '0')
    .replace(/\s{2,}/g, ' ')
    .trim();


// ─── 2. DIRECT CORRECTIONS MAP ────────────────────────────────────────────────
// Only for short tokens where Levenshtein alone is unreliable (≤5 chars).
// These are high-frequency, deterministic OCR mistakes seen in PH grocery stores.
// Key = uppercase OCR mistake, Value = corrected brand word (uppercase).
const DIRECT_CORRECTIONS: Record<string, string> = {
  // ── MILO / NESTLE family ──
  'MLO':     'MILO',
  'MIL0':    'MILO',
  'MIIO':    'MILO',
  'MILOO':   'MILO',
  'MlLO':    'MILO',
  'NESTL':   'NESTLE',
  'NSTLE':   'NESTLE',
  'NESLE':   'NESTLE',
  'NESTIE':  'NESTLE',
  'NESCAF':  'NESCAFE',
  'NESCAL':  'NESCAFE',
  'MAGGL':   'MAGGI',
  'MAGG1':   'MAGGI',
  'MAGG!':   'MAGGI',
  'MAGG':    'MAGGI',
  // ── OISHI ──
  'OISH1':   'OISHI',
  '0ISHI':   'OISHI',
  'O1SHI':   'OISHI',
  'OISH':    'OISHI',
  // ── DEL MONTE ──
  'DEI':     'DEL',
  'D3L':     'DEL',
  'MONIE':   'MONTE',
  'M0NTE':   'MONTE',
  // ── ARGENTINA ──
  'ARGENTlNA': 'ARGENTINA',
  'ARGENT1NA': 'ARGENTINA',
  'ARGENTIN':  'ARGENTINA',
  // ── UFC ──
  'UEC':     'UFC',
  'U.F.C':   'UFC',
  // ── CENTURY ──
  'CENTUPY': 'CENTURY',
  'CENT':    'CENTURY',
  // ── DATU PUTI ──
  'DATU':    'DATU',
  'DAT0':    'DATU',
  'PUT1':    'PUTI',
  'PUTl':    'PUTI',
  // ── LUCKY ME ──
  'IUCKY':   'LUCKY',
  'LUCKE':   'LUCKY',
  'LUKY':    'LUCKY',
  // ── REBISCO ──
  'REBSC0':  'REBISCO',
  'REBSCO':  'REBISCO',
  'REB1SCO': 'REBISCO',
  // ── MAGNOLIA ──
  'MAGNOIIA':'MAGNOLIA',
  'MAGNOL1A':'MAGNOLIA',
  // ── SELECTA ──
  'SEIECT':  'SELECTA',
  'SELCTA':  'SELECTA',
  'SELECT':  'SELECTA',
  // ── SAFEGUARD ──
  'SAFEGRD': 'SAFEGUARD',
  'SFGUARD': 'SAFEGUARD',
  // ── COLGATE ──
  'COLGAT':  'COLGATE',
  'C0LGATE': 'COLGATE',
  // ── ARIEL ──
  'AR1EL':   'ARIEL',
  'ARI3L':   'ARIEL',
  // ── TIDE ──
  'T1DE':    'TIDE',
  // ── DOWNY ──
  'D0WNY':   'DOWNY',
  // ── SAN MIGUEL ──
  'S4N':     'SAN',
  'S@N':     'SAN',
  'MIGUEI':  'MIGUEL',
  'M1GUEL':  'MIGUEL',
  // ── MONDE / REBISCO ──
  'M0NDE':   'MONDE',
  'MONED':   'MONDE',
  // ── HIGHLAND / ALASKA ──
  'HIGHL':   'HIGHLAND',
  'ALASK':   'ALASKA',
  'ALSKA':   'ALASKA',
  // ── HUNT'S ──
  'HUNTS':   'HUNTS',
  'HUN7S':   'HUNTS',
  // ── MEGA ──
  'MEG4':    'MEGA',
  // ── LIGO ──
  'L1GO':    'LIGO',
  'LIG0':    'LIGO',
  // ── SPAM ──
  'SP4M':    'SPAM',
  // ── BARRIO FIESTA / MAMA SITA ──
  'BARRI0':  'BARRIO',
  'MAMAS':   'MAMASITA',
  'MAMAST':  'MAMASITA',
  // ── CHAMPION ──
  'CHAMPIN': 'CHAMPION',
  'CHAMP10N':'CHAMPION',
  // ── SURF ──
  'SUR4':    'SURF',
  // ── TOBLERONE / RICOA ──
  'TOBIER':  'TOBLERONE',
  'RIC0A':   'RICOA',
  // ── SUNKIST ──
  'SUNKST':  'SUNKIST',
  'SUNK1ST': 'SUNKIST',
  // ── TANG / C2 / POWERADE ──
  'T4NG':    'TANG',
  'P0WRADE': 'POWERADE',
  'POWRAD':  'POWERADE',
  // ── GREAT TASTE ──
  'GR3AT':   'GREAT',
  'GRATE':   'GREAT',
  'TAST3':   'TASTE',
  // ── BIO FRESH / FRESH ──
  'FRES':    'FRESH',
  'FR3SH':   'FRESH',
  // ── JACK N JILL ──
  'JAK':     'JACK',
  'J1LL':    'JILL',
};


// ─── 3. LEVENSHTEIN ───────────────────────────────────────────────────────────
// Declared as a function (not const arrow) so it is hoisted and available
// to BOTH the store-reject logic (section 4) and the token corrector (section 5).
function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
  return dp[m][n];
}


// ─── 4. BLOCKLIST ─────────────────────────────────────────────────────────────
const HARD_REJECT_PATTERNS: RegExp[] = [
  // Store chains — also covered by fuzzy check below
  /PUREGOLD|SM\s*MARKET|ROBINSONS|WALTERMART|SAVE\s*MORE|ALFAMART|MINISTOP|7[-\s]?ELEVEN|LANDERS|SHOPWISE|HYPERMARKET|SUPERMARKET/i,
  // Transactional / receipt keywords
  /PROMO|DISCOUNT|SALE|OFF|MARKDOWN|VAT|TAX|TOTAL|SUBTOTAL|RECEIPT|CASHIER|CHANGE|AMOUNT|DUE|THANK\s*YOU|MEMBER|POINTS|LOYALTY|INVOICE|OFFICIAL/i,
  // Pure dates
  /\b\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\b/,
  // Time stamps (including OCR lookalikes: "B:46 AM")
  /\b[0-9BbOoIiSs]{1,2}:\d{2}\s*(AM|PM)\b/i,
  // Barcodes / EAN
  /^\d{6,}$/,
  // Standalone currency markers
  /^[₱P]$|^PHP$|^Php$/,
  // Pure weight / volume lines
  /^\d+(\.\d+)?\s*(G|KG|ML|L|OZ|LB|PCS|PC)\.?$/i,
  // Very short noise
  /^.{0,2}$/,
  // Mostly numbers / punctuation
  /^[0-9\s\-\.\,\*#@%]{4,}$/,
];

// ─── 4b. PRICE-CONTEXT REJECT PATTERNS ───────────────────────────────────────

const PRICE_CONTEXT_PATTERNS: RegExp[] = [
  /\bprice\b/i,
  /\bprice\s*per\s*(piece|pc|pcs|kilo|kg|gram|g|liter|litre|l|pack|sachet)\b/i,
  /\bper\s*(piece|pc|pcs|kilo|kg|gram|g|unit|pack)\b/i,
  /\bretail\s*price\b/i,
  /\bsrp\b/i,
  /\bregular\s*price\b/i,
  /\bspecial\s*price\b/i,
  /\bmember('?s)?\s*price\b/i,
  /\bpromo\s*price\b/i,
  /\bsale\s*price\b/i,
  /\bunit\s*price\b/i,
  /\bprice\s*tag\b/i,
  /\bpresyo\b/i,
  /\bhalaga\b/i,
  /\bper\s*\d+\s*(g|kg|ml|l|oz|lb)\b/i,
  /\b\d+\s*for\s*[₱P]/i,
  /\bbuy\s*\d+\s*(get|take)\s*\d+\b/i,
  /^[₱P]\s*\d+(\.\d{1,2})?$/,
  /^(php|peso)\s*\d+/i,
];

// Canonical price-context words to fuzzy-match against.
// Covers the most common OCR corruptions of "price" and "piece/pieca/piec".
const PRICE_FUZZY_WORDS: string[] = [
  'PRICE', 'PRISE', 'PRICC', 'PRICY', 'PRICA', 'PRECE',
  'PIECE', 'PIECA', 'PIEC', 'PEICE', 'PEECE',
  'PRESYO', 'HALAGA', 'RETAIL', 'MEMBER',
];

// How many edits we tolerate per word length
const fuzzyPriceEditThreshold = (len: number) => {
  if (len <= 4) return 1;
  if (len <= 6) return 2;
  return 3;
};

// Check if any token in the line fuzzy-matches a price-context word
const hasFuzzyPriceWord = (line: string): boolean => {
  const tokens = line.trim().toUpperCase().split(/\s+/);
  for (const token of tokens) {
    // Strip non-alpha so "Prica." and "Pricc," still match
    const clean = token.replace(/[^A-Z]/g, '');
    if (clean.length < 3) continue;
    for (const priceWord of PRICE_FUZZY_WORDS) {
      if (Math.abs(clean.length - priceWord.length) > 3) continue;
      const dist = levenshtein(clean, priceWord);
      if (dist <= fuzzyPriceEditThreshold(priceWord.length)) return true;
    }
  }
  return false;
};

const isPriceContextLine = (line: string): boolean => {
  if (PRICE_CONTEXT_PATTERNS.some(re => re.test(line.trim()))) return true;
  if (hasFuzzyPriceWord(line)) return true;
  return false;
};

// ─── 4a. Based-CONTEXT REJECT PATTERNS ───────────────────────────────────────
// Store-name tokens checked against the *space-stripped, uppercased* line.
// Catches OCR fragments like "PU REgi OLD" → collapsed "PUREGIOLD" → fuzzy match.
const STORE_NAME_TOKENS: string[] = [
  'PUREGOLD', 'PUREGOLDJR', 'PUREGOLDMARKET',
  'SMMARKET', 'SMHYPERMARKET', 'SMSUPERMARKET', 'SMSAVEMOREMARKET',
  'ROBINSONS', 'ROBINSONSSUPERMARKET',
  'WALTERMART', 'SAVEMORE',
  'ALFAMART', 'MINISTOP',
  'SEVENELEVEN', '7ELEVEN', '711',
  'LANDERS', 'SHOPWISE',
  'HYPERMARKET', 'SUPERMARKET',
  'MISSIONFOODS', 'CPCENTRALMARKET', 'MARKETMARKET',
];

function resemblesStoreName(collapsed: string): boolean {
  for (const token of STORE_NAME_TOKENS) {
    if (collapsed.includes(token)) return true;
    if (Math.abs(collapsed.length - token.length) <= 4 && collapsed.length >= 5) {
      if (collapsed[0] === token[0] && collapsed[1] === token[1]) {
        const dist = levenshtein(collapsed, token);
        if (dist <= Math.max(2, Math.floor(token.length * 0.18))) return true;
      }
    }
  }
  return false;
}

// ─── 4. BLOCKLIST ─────────────────────────────────────────────────────────────
function isHardRejected(line: string): boolean {
  const trimmed   = line.trim();
  const collapsed = trimmed.replace(/\s+/g, '').toUpperCase();
  if (HARD_REJECT_PATTERNS.some(re => re.test(trimmed))) return true;
  if (resemblesStoreName(collapsed))                      return true;
  if (isPriceContextLine(trimmed))                        return true; 
  return false;
}


// ─── 5. TOKEN-LEVEL FUZZY CORRECTOR ──────────────────────────────────────────
// Individual brand words (not full phrases).
// Correction is per-token — far more accurate than whole-line comparison.
const BRAND_WORD_DICTIONARY: string[] = [
  // ── Dairy / Beverages ──────────────────────────────────────────────────────
  'ALASKA', 'HIGHLAND', 'MAGNOLIA', 'SELECTA', 'SUNKIST',
  'MILO', 'NESTLE', 'NESCAFE', 'NESCAO', 'OVALTINE', 'HORLICKS',
  'POWERADE', 'GATORADE', 'POCARI', 'SWEAT', 'COBRA', 'STING',
  'C2', 'LIPTON', 'ZESTO', 'SUNPRIDE', 'MINUTE', 'MAID',
  'ROYAL', 'PEPSI', 'SPRITE', 'COKE', 'COLA',
  'RED', 'BULL', 'KOPIKO', 'GREAT', 'TASTE',
  'TANG', 'EIGHT', 'OCLOCK', 'SAGADA',
  // ── Instant noodles / Snacks ───────────────────────────────────────────────
  'LUCKY', 'NISSIN', 'INDO', 'MIE', 'PANCIT', 'CANTON',
  'OISHI', 'NOVA', 'PRAWN', 'CRACKERS', 'MARTY',
  'JACK', 'JILL', 'PIATTOS', 'TORTILLOS', 'CLOVER', 'CHIPS',
  'REBISCO', 'MONDE', 'MAMON', 'CREAM', 'PUFF', 'SODA',
  'SKYFLAKES', 'FIBISCO', 'HANSEL',
  'RICHEESE', 'RICOA', 'FLAT', 'TOPS',
  // ── Condiments / Sauces ───────────────────────────────────────────────────
  'UFC', 'BANANA', 'KETCHUP', 'CATSUP',
  'DATU', 'PUTI', 'VINEGAR', 'TOYO', 'SUKA',
  'MAMA', 'SITA', 'MAMASITA', 'BARRIO', 'FIESTA',
  'DEL', 'MONTE', 'HUNT', 'HUNTS', 'CONTADINA',
  'LADYFINGER', 'HEINZ', 'LEA', 'PERRINS',
  'KNORR', 'AJINOMOTO', 'VETSIN', 'MAGIC', 'SARAP',
  'MAGGI', 'MASARAP',
  // ── Canned goods ──────────────────────────────────────────────────────────
  'ARGENTINA', 'SAN', 'MIGUEL', 'SPAM', 'TULIP',
  'CENTURY', 'TUNA', 'MEGA', 'LIGO', 'SARDINES', 'MACKEREL',
  'MALING', 'DELIMONDO', 'PRINCESS', 'CDO', 'PAMANA',
  'TRIDENT', 'AYAM', 'FRESCA',
  // ── Rice / Grains / Oil ───────────────────────────────────────────────────
  'SINANDOMENG', 'DINORADO', 'JASMINE', 'GANADOR',
  'MINOLA', 'BAGUIO', 'PALM', 'GOLDEN', 'CORONA',
  'MAZOLA', 'CANOLA', 'WESSON', 'CRISCO',
  // ── Personal care / Household ─────────────────────────────────────────────
  'SAFEGUARD', 'DOVE', 'LUX', 'PALMOLIVE', 'DIAL',
  'COLGATE', 'HAPEE', 'CLOSEUP', 'PEPSODENT',
  'ARIEL', 'TIDE', 'SURF', 'CHAMPION', 'BREEZE',
  'DOWNY', 'COMFORT', 'SMART', 'ZONROX', 'DOMEX',
  'LYSOL', 'SCOTCH', 'BRITE', 'JOY', 'DAWN',
  'REJOICE', 'PANTENE', 'HEAD', 'SHOULDERS', 'SUNSILK',
  'VASELINE', 'NIVEA', 'POND',
  // ── Common product descriptor words (prevent over-correction) ─────────────
  // (These are intentionally NOT in the list — ordinary English words like
  //  "BIG", "PACK", "NET", "WT" should never be snapped to a brand.)
];

// Words that should NEVER be fuzzy-corrected to a brand, no matter how close.
// These are common Filipino/English words that produce false positives.
// e.g. "MANG" → "TANG" (1 edit) and "INASAL" are real words, not OCR errors.
const CORRECTION_SAFELIST = new Set([
  // Filipino words common on grocery tags / product names
  'MANG', 'MANANG', 'INASAL', 'INIHAW', 'ADOBO', 'SINIGANG', 'KARE',
  'PORK', 'BEEF', 'CHICKEN', 'FISH', 'TILAPIA', 'BANGUS',
  'RICE', 'CORN', 'SALT', 'SUGAR', 'FLOUR',
  'SOAP', 'GEL', 'BAR', 'CAN', 'BOX', 'BAG', 'PACK', 'SACHET',
  'BIG', 'SMALL', 'LARGE', 'MINI', 'SUPER', 'ULTRA', 'EXTRA',
  'RED', 'BLUE', 'GREEN', 'WHITE', 'BLACK', 'GOLD', 'SILVER',
  'HOT', 'COLD', 'SWEET', 'SOUR', 'SPICY', 'LIGHT', 'DARK',
  'NET', 'GROSS', 'WT', 'VOL', 'PCS', 'SET', 'KIT',
  'NEW', 'OLD', 'BEST', 'GOOD', 'FINE', 'PURE', 'REAL', 'RICH',
  'NOVA', 'CHILI', 'CHIPS', 'SWEET', 'CHEESE', 'CREAM',
  // Brand abbreviations that look like other-brand typos
  'JNJ', 'JNG', 'SNJ',
]);

function correctToken(token: string): string {
  const upper = token.toUpperCase();

  // Skip pure numbers, punctuation, and very short tokens (≤2 chars)
  if (token.length < 3 || /^[\d\.\,₱\-\/\(\)]+$/.test(token)) return token;

  // Never correct tokens in the safelist — these are real words, not OCR errors
  if (CORRECTION_SAFELIST.has(upper)) return token;

  // 1. Direct corrections map — exact key match only, handles deterministic errors
  if (DIRECT_CORRECTIONS[upper]) return DIRECT_CORRECTIONS[upper];

  // 2. Levenshtein against brand word dictionary
  //
  //    Thresholds are deliberately conservative to avoid false positives like
  //    "MANG" → "TANG" or "NOVA" → "DOVE". Rules:
  //      ≤4 chars  → NO fuzzy (too ambiguous — map only)
  //      5–6 chars → 1 edit max  ("NESTIE" → "NESTLE")
  //      7–9 chars → 2 edits max ("SAFGUARD" → "SAFEGUARD")
  //      10+ chars → 3 edits max ("ARGENTNA" → "ARGENTINA")
  //
  //    We also never shorten a token via fuzzy — brand word must be ≥ token length - 1.
  if (upper.length <= 4) return token; // too short for Levenshtein — map only

  const maxEdits =
    upper.length <= 6 ? 1 :
    upper.length <= 9 ? 2 : 3;

  let bestWord = token;
  let bestDist = Infinity;

  for (const word of BRAND_WORD_DICTIONARY) {
    if (Math.abs(word.length - upper.length) > maxEdits + 1) continue;
    if (word.length < upper.length - 1) continue; // never shorten

    const dist = levenshtein(upper, word);
    if (dist < bestDist && dist <= maxEdits) {
      bestDist = dist;
      bestWord = word;
    }
  }

  return bestWord;
}

// Apply token correction to a full line
function correctLine(line: string): string {
  return line
    .split(/\s+/)
    .map(correctToken)
    .join(' ');
}


// ─── 6. LINE SCORER ───────────────────────────────────────────────────────────
interface ScoredLine {
  text:  string;
  score: number;
  block: any;
}

function scoreLine(line: string, _block: any): number {
  let score = 0;
  const trimmed    = line.trim();
  const upper      = trimmed.toUpperCase();
  const tokenCount = trimmed.split(/\s+/).length;
  const len        = trimmed.length;

  // ── Positive signals ──────────────────────────────────────────────────────
  if (trimmed === upper && /[A-Z]/.test(upper))                    score += 30;

  const isTitleCase = trimmed
    .split(/\s+/)
    .every(w => /^[A-Z][a-z]*/.test(w) || /^\d/.test(w) || w.length <= 2);
  if (isTitleCase && trimmed !== upper)                             score += 20;

  if (tokenCount >= 2 && tokenCount <= 5)                          score += 20;
  else if (tokenCount === 1 && len >= 4)                           score += 5;

  if (len >= 5 && len <= 40)                                       score += 15;
  else if (len > 40 && len <= 60)                                  score += 5;

  if (/[A-Za-z]{2,}/.test(trimmed))                               score += 10;

  // ── NEW: Quantity suffix is a strong product name signal ─────────────────
  // "Glasses Set 3pcs", "Biscuit 200g", "Shampoo 250ml" — these are almost
  // certainly product names, not price labels. Reward them explicitly.
  if (/\d+\s*(pcs?|pieces?|sets?|pack|sachets?|g|kg|ml|l|oz|lb)\b/i.test(trimmed)) {
    score += 25;
  }

  // ── NEW: Title-case multi-word lines with no digits score higher ──────────
  // "Glasses Set", "Household Use", "Corned Beef" — clean product descriptors
  if (isTitleCase && tokenCount >= 2 && !/\d/.test(trimmed)) {
    score += 15;
  }

  if (
    /NESTLE|NESCAFE|MILO|MAGGI|UFC|DATU\s*PUTI|ARGENTINA|SAN\s*MIGUEL|DEL\s*MONTE|LUCKY\s*ME|OISHI|JACK\s*N\s*JILL|SUNKIST|MONDE|REBISCO|SELECTA|MAGNOLIA|ALASKA|HIGHLAND|CENTURY|MEGA|LIGO|SARDINES|SPAM|CDO|PAMANA|CHAMPION|ARIEL|TIDE|SURF|DOWNY|COLGATE|SAFEGUARD|DOVE|PALMOLIVE|PANTENE|SUNSILK|REJOICE|KOPIKO|GREAT\s*TASTE|NISSIN|SKYFLAKES|FIBISCO|HANSEL|PIATTOS|NOVA|KNORR|AJINOMOTO|BARRIO\s*FIESTA|MAMA\s*SITA|MINOLA|MAZOLA|BAGUIO/i
    .test(trimmed)
  )                                                                score += 40;

  // ── Negative signals ──────────────────────────────────────────────────────
  if (/PROMO|DISCOUNT|SALE|OFF|MARKDOWN/i.test(trimmed))           score -= 60;

  const digitRatio = (trimmed.match(/\d/g) || []).length / len;
  if (digitRatio > 0.5)                                            score -= 40;
  else if (digitRatio > 0.3)                                       score -= 15;

  if (len > 60)                                                    score -= 30;
  if (len <= 2)                                                    score -= 50;

  if (trimmed === trimmed.toLowerCase() && /[a-z]/.test(trimmed))  score -= 15;

  if (/\bprice\b|\bpresyo\b|\bhalaga\b|\bsrp\b|\bper\s*(pc|piece|kilo|kg)\b/i.test(trimmed)) {
    score -= 80;
  }

  if (/^(regular|special|member|promo|sale|retail|unit)[\s:]/i.test(trimmed)) {
    score -= 60;
  }

  return score;
}

// ─── 7. PRICE EXTRACTOR ───────────────────────────────────────────────────────

function formatPriceStr(base: string, cents?: string): string {
  const cleanBase = base.replace(/[^0-9]/g, '');
  const cleanCents = cents ? cents.replace(/[^0-9]/g, '') : '00';
  return `₱${cleanBase}.${cleanCents}`;
}

interface PriceResult {
  price:          string;
  priceBlock:     any | null;
  priceLineIndex: number;
}

function extractPrice(
  blocks:         any[],
  sanitizedLines: string[]
): PriceResult {
  const validPrices: PriceResult[] = [];

  for (let i = 0; i < sanitizedLines.length; i++) {
    const block = blocks[i];
    
    // Lookahead window: stitch the current line and the next two lines 
    // to catch split blocks (fixes the "huge gap" decimal issue)
    const line1 = sanitizedLines[i];
    const line2 = sanitizedLines[i + 1] || '';
    const line3 = sanitizedLines[i + 2] || '';
    const windowText = `${line1} ${line2} ${line3}`.trim();

    let extracted: string | null = null;

    // Pattern A: Symbol + Base + Decimal (e.g., "₱ 7 .15", "P7.15", "P 2750")
    // Note: The [.,]? means it will gracefully handle a missing dot!
    const matchA = windowText.match(/(?:^|\s)(?:₱|P|PHP|Php|B|b)\s*(\d{1,5})\s*[.,]?\s*(\d{2})\b/i);
    if (matchA) {
      extracted = formatPriceStr(matchA[1], matchA[2]);
    } else {
      // Pattern B: Naked decimal price without a symbol (e.g., "35 . 15", "1,250.00")
      const matchB = windowText.match(/\b(\d{1,3}(?:,\d{3})*)\s*[.,]\s*(\d{2})\b/);
      if (matchB) {
        extracted = formatPriceStr(matchB[1], matchB[2]);
      } else {
        // Pattern C: Whole number with symbol, NO decimal (e.g., "₱ 35")
        const matchC = windowText.match(/(?:^|\s)(?:₱|P|PHP|Php|B|b)\s*(\d{1,5})\b/i);
        if (matchC) {
          extracted = formatPriceStr(matchC[1], '00');
        }
      }
    }

    if (extracted) {
      // Save it as a valid candidate
      if (!validPrices.some(p => p.priceLineIndex === i)) {
        validPrices.push({ price: extracted, priceBlock: block, priceLineIndex: i });
      }
    }
  }

  if (validPrices.length === 0) {
    return { price: '---', priceBlock: null, priceLineIndex: -1 };
  }

  // ── THE FIX ── 
  // Sort all found prices. The Retail Price has the largest text (highest frame.height).
  // If heights are a tie, we pick the lowest block on the tag (highest index).
  validPrices.sort((a, b) => {
    const heightA = a.priceBlock?.frame?.height || 0;
    const heightB = b.priceBlock?.frame?.height || 0;
    if (heightA !== heightB) {
       return heightB - heightA; // largest height wins
    }
    return b.priceLineIndex - a.priceLineIndex;
  });

  return validPrices[0];
}

// ─── 9. SOFT EDGE PENALTY ─────────────────────────────────────────────────────
function edgePenalty(block: any, photoWidth: number, photoHeight: number): number {
  const blockCentreX = (block.frame?.left  ?? 0) + (block.frame?.width  ?? 0) / 2;
  const blockCentreY = (block.frame?.top   ?? 0) + (block.frame?.height ?? 0) / 2;

  const normX   = Math.abs(blockCentreX - photoWidth  / 2) / (photoWidth  / 2);
  const normY   = Math.abs(blockCentreY - photoHeight / 2) / (photoHeight / 2);
  const maxNorm = Math.max(normX, normY);

  if (maxNorm <= 0.40) return 0;
  if (maxNorm <= 0.55) return -20;
  return -50;
}


// ─── 10. CONFIDENCE CLASSIFIER ────────────────────────────────────────────────
function classifyConfidence(score: number): ConfidenceLevel {
  if (score >= 60) return 'high';
  if (score >= 30) return 'medium';
  return 'low';
}


// ─── 11. FUZZY BRAND PHRASE CORRECTOR ─────────────────────────────────────────
// Applied to the WINNER only — snaps whole product phrases to known brands.
// Uses the same levenshtein() declared above (hoisted).
const KNOWN_BRAND_PHRASES: string[] = [
  'NESTLE MILO', 'NESCAFE CLASSIC', 'NESCAFE 3IN1', 'NESCAFE GOLD',
  'MAGGI MAGIC SARAP', 'MAGGI SAVOR',
  'UFC BANANA KETCHUP', 'UFC TOMATO KETCHUP',
  'DATU PUTI VINEGAR', 'DATU PUTI SOY SAUCE', 'DATU PUTI PATIS',
  'ARGENTINA CORNED BEEF', 'ARGENTINA LUNCHEON MEAT',
  'SAN MIGUEL BEER', 'SAN MIGUEL PALE PILSEN',
  'DEL MONTE TOMATO SAUCE', 'DEL MONTE SPAGHETTI SAUCE', 'DEL MONTE FRUIT COCKTAIL',
  'LUCKY ME PANCIT CANTON', 'LUCKY ME INSTANT NOODLES', 'LUCKY ME SUPREME',
  'NISSIN PANCIT CANTON', 'NISSIN CUP NOODLES',
  'OISHI PRAWN CRACKERS', 'OISHI MARTY', 'OISHI RIDGES',
  'JACK N JILL NOVA', 'JACK N JILL PIATTOS', 'JACK N JILL TORTILLOS',
  'SUNKIST ORANGE JUICE', 'SUNKIST JUICE DRINK',
  'MONDE MAMON', 'MONDE SPECIAL ENSAYMADA',
  'REBISCO CRACKERS', 'REBISCO SANDWICH',
  'SELECTA ICE CREAM', 'SELECTA CORNETTO',
  'MAGNOLIA CHICKEN', 'MAGNOLIA PURESKIM',
  'ALASKA EVAPORATED MILK', 'ALASKA POWDERED MILK', 'ALASKA CONDENSED MILK',
  'HIGHLAND EVAPORATED MILK', 'HIGHLAND CONDENSED MILK',
  'CENTURY TUNA', 'CENTURY TUNA FLAKES',
  'MEGA SARDINES', 'MEGA TUNA',
  'LIGO SARDINES', 'LIGO CORNED BEEF',
  'SPAM CLASSIC', 'SPAM LITE',
  'CDO ULAM BURGER', 'CDO CHORIZO',
  'PAMANA CORNED BEEF',
  'GREAT TASTE WHITE', 'GREAT TASTE COFFEE',
  'KOPIKO BROWN COFFEE', 'KOPIKO BLACK',
  'CHAMPION DETERGENT', 'CHAMPION BAR',
  'ARIEL DETERGENT', 'ARIEL POWDER',
  'TIDE PLUS', 'TIDE DETERGENT',
  'SURF DETERGENT', 'SURF POWDER',
  'DOWNY FABRIC CONDITIONER', 'DOWNY PASSION',
  'COMFORT FABRIC CONDITIONER',
  'COLGATE TOOTHPASTE', 'COLGATE TOTAL', 'COLGATE OPTIC WHITE',
  'HAPEE TOOTHPASTE',
  'CLOSEUP TOOTHPASTE',
  'SAFEGUARD SOAP', 'SAFEGUARD BAR',
  'DOVE SOAP', 'DOVE BODY WASH', 'DOVE SHAMPOO',
  'PALMOLIVE SOAP', 'PALMOLIVE SHAMPOO', 'PALMOLIVE NATURALS',
  'PANTENE SHAMPOO', 'PANTENE PRO-V',
  'SUNSILK SHAMPOO', 'SUNSILK BLACK SHINE',
  'HEAD SHOULDERS SHAMPOO',
  'REJOICE SHAMPOO',
  'VASELINE LOTION', 'VASELINE PETROLEUM JELLY',
  'NIVEA LOTION', 'NIVEA CREAM',
  'KNORR BROTH', 'KNORR LIQUID SEASONING', 'KNORR SiniGANG MIX',
  'AJINOMOTO GINISA MIX',
  'BARRIO FIESTA BAGOONG',
  'MAMA SITA ADOBO MIX', 'MAMA SITA SINIGANG MIX',
  'MINOLA COOKING OIL',
  'BAGUIO COOKING OIL',
  'MAZOLA CORN OIL',
  'SKYFLAKES CRACKERS',
  'FIBISCO BUTTER COOKIES',
  'HANSEL CRACKERS',
  'TANG ORANGE', 'TANG FOUR SEASONS',
  'ZESTO ORANGE JUICE',
  'POWERADE ION4',
  'POCARI SWEAT',
  'COBRA ENERGY DRINK',
  'STING ENERGY DRINK',
  'RED BULL ENERGY DRINK',
];

function fuzzyCorrectPhrase(candidate: string): string {
  const upper = candidate.toUpperCase();
  let bestMatch = candidate;
  let bestDist  = Infinity;

  for (const phrase of KNOWN_BRAND_PHRASES) {
    if (Math.abs(phrase.length - upper.length) > 10) continue;
    const dist      = levenshtein(upper, phrase);
    const threshold = Math.floor(phrase.length * 0.2);
    if (dist < bestDist && dist <= threshold) {
      bestDist  = dist;
      bestMatch = phrase;
    }
  }
  return bestMatch;
}


// ─── 12. MAIN EXPORT ──────────────────────────────────────────────────────────
export async function processScannedText(
  blocks:      any[],
  photoWidth:  number,
  photoHeight: number,
): Promise<ParsedProduct> {
  const FAILED: ParsedProduct = {
    product:    'Align tag in box…',
    price:      '---',
    confidence: 'low',
    rawScore:   0,
  };

  if (!blocks || blocks.length === 0) return FAILED;

  // Step 1 — Sort all blocks top → bottom, and left → right for blocks on the same row
  const sortedBlocks = [...blocks].sort((a, b) => {
    const yDiff = (a.frame?.top ?? 0) - (b.frame?.top ?? 0);
    // Dynamic row tolerance based on the actual size of the font on the tag
    const rowTolerance = Math.max(a.frame?.height ?? 0, b.frame?.height ?? 0) * 0.5 || 15;
    
    // If blocks are on the same horizontal row, sort them left-to-right
    if (Math.abs(yDiff) < rowTolerance) {
      return (a.frame?.left ?? 0) - (b.frame?.left ?? 0);
    }
    return yDiff;
  });

  // Step 2 — Sanitize → correct → flatten into individual lines
  interface FlatLine { text: string; block: any }
  const flatLines: FlatLine[] = [];

  for (const block of sortedBlocks) {
    const rawLines: string[] = block.text
      .split('\n')
      .map((t: string) => correctLine(sanitizeLine(t)))   // sanitize THEN correct
      .filter((t: string) => t.length > 0);
    for (const text of rawLines) {
      flatLines.push({ text, block });
    }
  }

  if (flatLines.length === 0) return FAILED;

  // Step 3 — Extract price (gives us the spatial anchor)
  // Pass sortedBlocks as rawBlocks so extractPrice has original frame data
  const sanitizedTexts = flatLines.map(l => l.text);
  const { price, priceBlock, priceLineIndex } = extractPrice(
    flatLines.map(l => l.block),
    sanitizedTexts,
  );

  // Step 4 — Score every non-price line for product candidacy
  const candidates: ScoredLine[] = [];

  for (let i = 0; i < flatLines.length; i++) {
    if (i === priceLineIndex) continue;
    const { text, block } = flatLines[i];
    if (isHardRejected(text)) continue;

    let score = scoreLine(text, block);
    score += edgePenalty(block, photoWidth, photoHeight);

    candidates.push({ text, score, block });
  }

  if (candidates.length === 0) return { ...FAILED, price };

  // Step 5 — Pick the winner
  candidates.sort((a, b) => b.score - a.score);
  const winner = candidates[0];

  // Step 6 — Phrase-level fuzzy correction (only when confidence is decent)
  const preCorrectConfidence = classifyConfidence(winner.score);
  const correctedProduct =
    preCorrectConfidence !== 'low'
      ? fuzzyCorrectPhrase(winner.text)
      : winner.text;

  // Step 7 — Merge with runner-up if on same horizontal band (two-line names)
  let finalProduct = correctedProduct;
  if (candidates.length > 1) {
    const runnerUp   = candidates[1];
    const winnerY    = winner.block?.frame?.top  ?? 0;
    const runnerY    = runnerUp.block?.frame?.top ?? 0;
    const scoreDiff  = winner.score - runnerUp.score;
    const yProximity = Math.abs(winnerY - runnerY);

    if (
      scoreDiff   <  20 &&
      yProximity  <  photoHeight * 0.05 &&
      runnerUp.score > 0
    ) {
      const [top, bottom] = winnerY <= runnerY
        ? [winner.text,   runnerUp.text]
        : [runnerUp.text, winner.text];
      finalProduct = `${top} ${bottom}`.trim();
    }
  }

  // Step 8 — Debug log (zero cost in production)
  if (__DEV__) {
    console.log('[Scanner] Top candidates:', candidates.slice(0, 5).map(c => ({
      text: c.text, score: c.score,
    })));
    console.log('[Scanner] Winner:', finalProduct, '| Score:', winner.score, '| Price:', price);
  }

  return {
    product:    finalProduct,
    price,
    confidence: classifyConfidence(winner.score),
    rawScore:   winner.score,
  };
}