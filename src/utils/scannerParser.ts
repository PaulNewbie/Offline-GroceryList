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

function isHardRejected(line: string): boolean {
  const trimmed   = line.trim();
  const collapsed = trimmed.replace(/\s+/g, '').toUpperCase();
  if (HARD_REJECT_PATTERNS.some(re => re.test(trimmed))) return true;
  if (resemblesStoreName(collapsed)) return true;
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
  'LUCKY', 'PAYLESS', 'NISSIN', 'INDO', 'MIE', 'PANCIT', 'CANTON',
  'OISHI', 'NOVA', 'PRAWN', 'CRACKERS', 'MARTY', 'CHICHARRON',
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
  if (/\d+(\.\d+)?\s*(G|KG|ML|L|OZ|LB)/i.test(trimmed))          score += 10;

  // Philippine grocery brand signal
  if (
    /NESTLE|NESCAFE|MILO|MAGGI|UFC|DATU\s*PUTI|ARGENTINA|SAN\s*MIGUEL|DEL\s*MONTE|LUCKY\s*ME|PAYLESS|OISHI|JACK\s*N\s*JILL|SUNKIST|MONDE|REBISCO|SELECTA|MAGNOLIA|ALASKA|HIGHLAND|CENTURY|MEGA|LIGO|SARDINES|SPAM|CDO|PAMANA|CHAMPION|ARIEL|TIDE|SURF|DOWNY|COLGATE|SAFEGUARD|DOVE|PALMOLIVE|PANTENE|SUNSILK|REJOICE|KOPIKO|GREAT\s*TASTE|NISSIN|SKYFLAKES|FIBISCO|HANSEL|PIATTOS|NOVA|CHICHARRON|KNORR|AJINOMOTO|BARRIO\s*FIESTA|MAMA\s*SITA|MINOLA|MAZOLA|BAGUIO/i
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

  return score;
}


// ─── 7. PRICE EXTRACTOR ───────────────────────────────────────────────────────
//
// PH grocery tags frequently split the price across 2–3 separate OCR blocks:
//
//   [₱ or B or P]   [35]   [.15]
//        ↑              ↑        ↑
//   currency symbol  base    decimal fragment
//   (often misread)  price   (printed with a gap)
//
// Strategy: work from the RAW ML Kit blocks (not flattened lines) so we have
// accurate frame coordinates. We classify each block by role, then assemble.

function formatPriceStr(rawStr: string): string {
  let cleaned = rawStr.replace(/[^0-9.]/g, '');
  if (cleaned.length >= 3 && !cleaned.includes('.')) {
    cleaned = cleaned.slice(0, -2) + '.' + cleaned.slice(-2);
  }
  return `₱${cleaned}`;
}

// ── Block role classifiers ─────────────────────────────────────────────────────

/** Currency symbol block — ₱, P, B (common misread of ₱), PHP */
function isCurrencySymbol(s: string): boolean {
  return /^[₱PBb]$|^PHP$|^Php$|^php$/.test(s.trim());
}

/** Base price block — 1–5 digits, optionally prefixed with currency symbol.
 *  NOT a barcode (≤5 digits), NOT a year (not 19xx/20xx), NOT a time. */
function isBasePriceBlock(s: string): boolean {
  const t = s.trim();
  // Reject obvious non-prices first
  if (/^\d{6,}$/.test(t)) return false;                    // barcode
  if (/^(19|20)\d{2}$/.test(t)) return false;              // year
  if (/\d{1,2}:\d{2}/.test(t)) return false;               // time
  // Accept: optional symbol then 1–5 digits (whole number only)
  return /^[₱PBb]?\s*\d{1,5}$/.test(t);
}

/** Decimal fragment block — exactly ".15" / ",15" / "15" (2 digits), nothing else.
 *  Very strict to avoid false matches with barcodes, times, quantities. */
function isDecimalFragment(s: string): boolean {
  return /^[.,]?\d{2}$/.test(s.trim());
}

// ── Spatial helpers ────────────────────────────────────────────────────────────

function blockCentreY(b: any): number {
  return (b?.frame?.top ?? 0) + (b?.frame?.height ?? 0) / 2;
}
function blockLeft(b: any): number  { return b?.frame?.left ?? 0; }
function blockRight(b: any): number {
  return (b?.frame?.left ?? 0) + (b?.frame?.width ?? 0);
}
function blockHeight(b: any): number { return b?.frame?.height ?? 40; }

/** True when B is on roughly the same horizontal row as A */
function sameRow(bA: any, bB: any): boolean {
  const rowTolerance = Math.max(blockHeight(bA), blockHeight(bB)) * 0.7;
  return Math.abs(blockCentreY(bA) - blockCentreY(bB)) < rowTolerance;
}

/** True when B is to the right of A (with small overlap tolerance) */
function isRightOf(bA: any, bB: any): boolean {
  // bB starts after bA ends, but allow 15px overlap for tight layouts
  return blockLeft(bB) > blockRight(bA) - 15;
}

/** True when B is not absurdly far from A (within 4× bA's height horizontally) */
function isNearRight(bA: any, bB: any): boolean {
  return blockLeft(bB) < blockRight(bA) + blockHeight(bA) * 4;
}

// ── Main extractor ─────────────────────────────────────────────────────────────

interface PriceResult {
  price:          string;
  priceBlock:     any | null;
  priceLineIndex: number;
}

/**
 * Works directly on the RAW ML Kit blocks (passed as `rawBlocks`) in addition
 * to the sanitized flat lines. This gives us reliable frame coordinates for
 * spatial stitching — the flat-line blocks share frames with their parent block
 * but lose precise per-line position.
 *
 * @param flatBlocks  — blocks array parallel to sanitizedLines (flat, 1 per line)
 * @param sanitizedLines — sanitized text per flat line
 * @param rawBlocks   — original ML Kit blocks before flattening (for spatial work)
 */
function extractPrice(
  flatBlocks:     any[],
  sanitizedLines: string[],
  rawBlocks?:     any[],
): PriceResult {

  // ── Debug dump (DEV only) ──────────────────────────────────────────────────
  if (__DEV__) {
    console.log('[Price] ── OCR flat lines ──');
    sanitizedLines.forEach((l, i) => {
      const f = flatBlocks[i]?.frame;
      console.log(`  [${i}] "${l}" | frame: x=${f?.left} y=${f?.top} w=${f?.width} h=${f?.height}`);
    });
    if (rawBlocks) {
      console.log('[Price] ── Raw blocks ──');
      rawBlocks.forEach((b, i) => {
        const f = b?.frame;
        console.log(`  [${i}] "${b.text?.replace(/\n/g,' ')}" | frame: x=${f?.left} y=${f?.top} w=${f?.width} h=${f?.height}`);
      });
    }
  }

  // ── Pass 1: scan flat lines for complete prices (no stitching needed) ──────
  for (let i = 0; i < sanitizedLines.length; i++) {
    const line = sanitizedLines[i];

    // Pattern A — currency symbol immediately followed by digits with decimal
    // e.g. "₱35.15"  "P 35.15"
    const matchA = line.match(/[₱PBb]\s*(\d{1,5}[.,]\d{2})\b/);
    if (matchA) {
      const price = `₱${matchA[1].replace(',', '.')}`;
      if (__DEV__) console.log(`[Price] PatA hit: "${line}" → ${price}`);
      return { price, priceBlock: flatBlocks[i], priceLineIndex: i };
    }

    // Pattern B — naked decimal price already complete
    // e.g. "35.15"  "1,250.00"
    const matchB = line.match(/\b(\d{1,3}(?:,\d{3})*\.\d{2})\b/);
    if (matchB) {
      const price = formatPriceStr(matchB[1]);
      if (__DEV__) console.log(`[Price] PatB hit: "${line}" → ${price}`);
      return { price, priceBlock: flatBlocks[i], priceLineIndex: i };
    }
  }

  // ── Pass 2: spatial stitching for split prices ─────────────────────────────
  // Collect candidate blocks by role from the FLAT lines (frames are good enough
  // because each flat line keeps its parent block's frame).
  interface RoleBlock { text: string; block: any; idx: number; }
  const symbolBlocks:  RoleBlock[] = [];
  const baseBlocks:    RoleBlock[] = [];
  const decimalBlocks: RoleBlock[] = [];

  for (let i = 0; i < sanitizedLines.length; i++) {
    const t = sanitizedLines[i].trim();
    const b = flatBlocks[i];
    if (isCurrencySymbol(t))   symbolBlocks.push({ text: t, block: b, idx: i });
    if (isBasePriceBlock(t))   baseBlocks.push({ text: t, block: b, idx: i });
    if (isDecimalFragment(t))  decimalBlocks.push({ text: t, block: b, idx: i });
  }

  if (__DEV__) {
    console.log('[Price] Symbols:', symbolBlocks.map(r => `"${r.text}"`));
    console.log('[Price] Bases:',   baseBlocks.map(r => `"${r.text}" x=${blockLeft(r.block)}`));
    console.log('[Price] Decimals:',decimalBlocks.map(r => `"${r.text}" x=${blockLeft(r.block)}`));
  }

  // Strategy: for each base-price block, look for a decimal fragment to its right
  // on the same row. Accept the spatially closest one.
  for (const base of baseBlocks) {
    const baseNum = base.text.replace(/[₱PBb\s]/g, '');

    // Find best decimal fragment: same row, to the right, closest
    let bestDec:  RoleBlock | null = null;
    let bestDist  = Infinity;

    for (const dec of decimalBlocks) {
      if (!sameRow(base.block, dec.block)) continue;
      if (!isRightOf(base.block, dec.block)) continue;
      if (!isNearRight(base.block, dec.block)) continue;
      const dist = blockLeft(dec.block) - blockRight(base.block);
      if (dist < bestDist) { bestDist = dist; bestDec = dec; }
    }

    if (bestDec) {
      const cents = bestDec.text.replace(/^[.,]/, '');
      const price = `₱${baseNum}.${cents}`;
      if (__DEV__) console.log(`[Price] Stitched: base="${base.text}" + dec="${bestDec.text}" → ${price}`);
      // Return the base block as anchor (used for spatial scoring of product name)
      return { price, priceBlock: base.block, priceLineIndex: base.idx };
    }

    // No decimal fragment found — but if there is a currency symbol to the LEFT
    // on the same row, this base number is confidently the price (whole peso)
    for (const sym of symbolBlocks) {
      if (!sameRow(base.block, sym.block)) continue;
      // Symbol must be to the LEFT of the base
      if (blockLeft(sym.block) >= blockLeft(base.block)) continue;
      const price = `₱${baseNum}.00`;
      if (__DEV__) console.log(`[Price] Symbol+Base (no decimal): "${sym.text}" + "${base.text}" → ${price}`);
      return { price, priceBlock: base.block, priceLineIndex: base.idx };
    }
  }

  if (__DEV__) console.log('[Price] No price found');
  return { price: '---', priceBlock: null, priceLineIndex: -1 };
}


// ─── 8. SPATIAL BONUS ─────────────────────────────────────────────────────────
function spatialBonus(candidateBlock: any, priceBlock: any): number {
  if (!priceBlock?.frame || !candidateBlock?.frame) return 0;

  const pY = priceBlock.frame.top    ?? 0;
  const pX = priceBlock.frame.left   ?? 0;
  const cY = candidateBlock.frame.top  ?? 0;
  const cX = candidateBlock.frame.left ?? 0;

  let bonus = 0;
  const deltaY = pY - cY;
  if (deltaY > 0 && deltaY < pY * 0.6)   bonus += 30;
  else if (deltaY >= pY * 0.6)            bonus += 10;

  const deltaX = pX - cX;
  if (deltaX >= 0)        bonus += 20;
  else if (deltaX > -50)  bonus += 5;

  return bonus;
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
  'PAYLESS PANCIT CANTON',
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

  // Step 1 — Sort blocks top → bottom
  const sortedBlocks = [...blocks].sort(
    (a, b) => (a.frame?.top ?? 0) - (b.frame?.top ?? 0),
  );

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
    sortedBlocks,   // ← raw blocks with reliable per-block frames
  );

  // Step 4 — Score every non-price line for product candidacy
  const candidates: ScoredLine[] = [];

  for (let i = 0; i < flatLines.length; i++) {
    if (i === priceLineIndex) continue;
    const { text, block } = flatLines[i];
    if (isHardRejected(text)) continue;

    let score = scoreLine(text, block);
    score += spatialBonus(block, priceBlock);
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