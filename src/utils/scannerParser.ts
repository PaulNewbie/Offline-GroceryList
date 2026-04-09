// src/utils/scannerParser.ts
// v2.0 — Spatial Scoring Engine (no ML models required)

export type ConfidenceLevel = 'high' | 'medium' | 'low';

export interface ParsedProduct {
  product: string;
  price: string;
  confidence: ConfidenceLevel;  // derived from winner's raw score
  rawScore: number;             // exposed for debug logging
}

// ─── 1. OCR SANITIZER ──────────────────────────────────────────────────────────
// Fixes common OCR hallucinations. Applied BEFORE any analysis.
// Rule: only substitute in numeric contexts to avoid corrupting brand names.
const sanitizeLine = (raw: string): string => {
  let out = raw
    // ── Numeric-context substitutions (only fire between/around digits) ──
    // e.g. "P1O.OO" → "P10.00"  |  "OISHI" stays "OISHI"
    .replace(/(?<=\d)[Oo](?=\d)/g, '0')   // digit O digit → digit 0 digit
    .replace(/(?<=\d)[Il](?=\d)/g, '1')   // digit I/l digit → digit 1 digit
    .replace(/(?<=\d)[Ss](?=\d)/g, '5')   // digit S digit → digit 5 digit
    .replace(/(?<=\d)[Bb](?=\d)/g, '8')   // digit B digit → digit 8 digit

    // ── Time-context substitutions (fires when lookahead is :MM AM/PM) ──
    // e.g. "B:46 AM" → "8:46 AM", "O:30 PM" → "0:30 PM"
    // Targets only the character(s) immediately before a colon+digits+AM/PM
    .replace(/^[Bb](?=:\d{2}\s*(AM|PM))/i, '8')
    .replace(/^[Oo](?=:\d{2}\s*(AM|PM))/i, '0')
    .replace(/^[Il](?=:\d{2}\s*(AM|PM))/i, '1')
    .replace(/^[Ss](?=:\d{2}\s*(AM|PM))/i, '5')
    // Two-digit hour variant: "1B:30 AM" → "18:30 AM"
    .replace(/(?<=\d)[Bb](?=:\d{2}\s*(AM|PM))/i, '8')
    .replace(/(?<=\d)[Oo](?=:\d{2}\s*(AM|PM))/i, '0')

    .replace(/\s{2,}/g, ' ')              // collapse multi-spaces
    .trim();

  return out;
};

// ─── 2. BLOCKLIST — lines that are NEVER a product name ────────────────────────
const HARD_REJECT_PATTERNS: RegExp[] = [
  // Store chains (Philippines-specific)
  /PUREGOLD|SM\s*MARKET|ROBINSONS|WALTERMART|SAVE\s*MORE|ALFAMART|MINISTOP|7[-\s]?ELEVEN|LANDERS|SHOPWISE/i,
  // Transactional / receipt keywords
  /PROMO|DISCOUNT|SALE|OFF|MARKDOWN|VAT|TAX|TOTAL|SUBTOTAL|RECEIPT|CASHIER|CHANGE|AMOUNT|DUE|THANK\s*YOU/i,
  // Pure dates
  /\b\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\b/,
  // Time stamps — also catches OCR lookalikes in the hour position
  // Matches: "8:46 AM", "B:46 AM", "10:30 PM", "1O:30 PM", etc.
  /\b[0-9BbOoIiSs]{1,2}:\d{2}\s*(AM|PM)\b/i,
  // Barcodes / EAN (long digit-only strings)
  /^\d{6,}$/,
  // Standalone currency markers
  /^[₱P]$|^PHP$|^Php$/,
  // Pure weight / volume lines  (e.g. "100G", "1.5 L", "500ML")
  /^\d+(\.\d+)?\s*(G|KG|ML|L|OZ|LB|PCS|PC)\.?$/i,
  // Very short noise (≤ 2 chars)
  /^.{0,2}$/,
  // Lines that are almost entirely numbers / punctuation
  /^[0-9\s\-\.\,\*#@%]{4,}$/,
];

const isHardRejected = (line: string): boolean =>
  HARD_REJECT_PATTERNS.some((re) => re.test(line.trim()));

// ─── 3. LINE SCORER ────────────────────────────────────────────────────────────
// Returns a numeric score for a candidate product-name line.
// Higher = more likely to be the product name.
// Use multiples of 10 so you can reason about which rule dominated.

interface ScoredLine {
  text: string;
  score: number;
  block: any; // original ML Kit block (carries .frame)
}

const scoreLine = (line: string, block: any): number => {
  let score = 0;
  const trimmed = line.trim();
  const upper = trimmed.toUpperCase();
  const tokenCount = trimmed.split(/\s+/).length;
  const len = trimmed.length;

  // ── Positive signals ──────────────────────────────────
  // All-caps text (common for product names on PH grocery tags)
  if (trimmed === upper && /[A-Z]/.test(upper)) score += 30;

  // Title-case (e.g. "Nestle Milo") — also common
  const isTitleCase = trimmed
    .split(/\s+/)
    .every((w) => /^[A-Z][a-z]*/.test(w) || /^\d/.test(w) || w.length <= 2);
  if (isTitleCase && trimmed !== upper) score += 20;

  // Ideal token count: 2–5 words
  if (tokenCount >= 2 && tokenCount <= 5) score += 20;
  else if (tokenCount === 1 && len >= 4) score += 5; // single long word is okay

  // Ideal character length: 5–40 chars (product names are concise)
  if (len >= 5 && len <= 40) score += 15;
  else if (len > 40 && len <= 60) score += 5;

  // Contains letters (must have alpha content to be a name)
  if (/[A-Za-z]{2,}/.test(trimmed)) score += 10;

  // Contains a unit qualifier inline: "200g", "1.5L" — hints it's a product
  if (/\d+(\.\d+)?\s*(G|KG|ML|L|OZ|LB)/i.test(trimmed)) score += 10;

  // Known Philippine grocery brand signals
  if (/NESTLE|NESCAFE|MILO|MAGGI|UFC|DATU PUTI|ARGENTINA|SAN MIGUEL|PUREFOODS|DEL MONTE|LUCKY ME|PAYLESS|OISHI|JACK N JILL|SUNKIST|MONDE|REBISCO|SELECTA|MAGNOLIA/i.test(trimmed)) score += 40;

  // ── Negative signals ──────────────────────────────────
  // Has PROMO / DISCOUNT / SALE keywords (even partial match)
  if (/PROMO|DISCOUNT|SALE|OFF|MARKDOWN/i.test(trimmed)) score -= 60;

  // High digit ratio (e.g. barcodes, item codes)
  const digitRatio = (trimmed.match(/\d/g) || []).length / len;
  if (digitRatio > 0.5) score -= 40;
  else if (digitRatio > 0.3) score -= 15;

  // Too long — likely a description / disclaimer
  if (len > 60) score -= 30;

  // Single character or random noise
  if (len <= 2) score -= 50;

  // All lowercase is unusual for grocery tags (often noise or watermark)
  if (trimmed === trimmed.toLowerCase() && /[a-z]/.test(trimmed)) score -= 15;

  return score;
};

// ─── 4. PRICE EXTRACTOR ────────────────────────────────────────────────────────
// Returns price string + the block where the price was found (for spatial logic).

const formatPrice = (rawStr: string): string => {
  let cleaned = rawStr.replace(/[^0-9.]/g, '');
  if (cleaned.length >= 3 && !cleaned.includes('.')) {
    cleaned = cleaned.slice(0, -2) + '.' + cleaned.slice(-2);
  }
  return `₱${cleaned}`;
};

interface PriceResult {
  price: string;
  priceBlock: any | null;   // the ML Kit block that contained the price
  priceLineIndex: number;   // index in textLines where price was found (-1 if not)
}

const extractPrice = (
  blocks: any[],
  sanitizedLines: string[],
): PriceResult => {
  for (let i = 0; i < sanitizedLines.length; i++) {
    const line = sanitizedLines[i];
    const block = blocks[i];

    // Pattern A: explicit currency symbol before digits (₱99.00, P99, PHP 99)
    const matchA = line.match(/(?:₱|P|PHP|Php)\s*(\d[\d\,\.]*)/i);
    // Pattern B: naked decimal price (e.g. "99.00", "1,250.00")
    const matchB = line.match(/\b(\d{1,3}(?:,\d{3})*\.\d{2})\b/);

    // Pattern C: currency symbol on one line, digits on the next
    const isSymbolOnly = /^[₱P]$|^PHP$|^Php$/.test(line.trim());
    if (isSymbolOnly && i + 1 < sanitizedLines.length) {
      const next = sanitizedLines[i + 1].replace(/\s/g, '');
      if (/^\d+[\.,]?\d*$/.test(next)) {
        return {
          price: formatPrice(next),
          priceBlock: block,
          priceLineIndex: i,
        };
      }
    }

    if (matchA) {
      return { price: formatPrice(matchA[1]), priceBlock: block, priceLineIndex: i };
    }
    if (matchB) {
      return { price: formatPrice(matchB[1]), priceBlock: block, priceLineIndex: i };
    }
  }

  return { price: '---', priceBlock: null, priceLineIndex: -1 };
};

// ─── 5. SPATIAL BONUS ─────────────────────────────────────────────────────────
// Awards extra score to blocks that are spatially consistent with being a
// product name relative to the detected price block.
//
// PH grocery tag grammar (observed across SM, Puregold, Robinsons):
//   - Product name: top-center or top-left, large font → smaller Y value
//   - Price:        bottom-right or bottom-center     → larger Y value
//
// So the ideal product block has:
//   • a SMALLER top (Y) than the price block         → it is ABOVE the price
//   • a SIMILAR or SMALLER left (X) than the price   → not far to the right

const spatialBonus = (candidateBlock: any, priceBlock: any): number => {
  if (!priceBlock?.frame || !candidateBlock?.frame) return 0;

  const pY = priceBlock.frame.top ?? 0;
  const pX = priceBlock.frame.left ?? 0;
  const cY = candidateBlock.frame.top ?? 0;
  const cX = candidateBlock.frame.left ?? 0;

  let bonus = 0;

  // Above the price block (product names sit higher on the tag)
  const deltaY = pY - cY; // positive = candidate is higher up
  if (deltaY > 0 && deltaY < pY * 0.6) bonus += 30;  // nearby above → big bonus
  else if (deltaY >= pY * 0.6) bonus += 10;           // far above → small bonus
  // deltaY <= 0 means candidate is BELOW the price — no bonus

  // Left of or aligned with the price block
  const deltaX = pX - cX;
  if (deltaX >= 0) bonus += 20;                        // to the left → bonus
  else if (deltaX > -50) bonus += 5;                   // slightly right → tiny bonus

  return bonus;
};

// ─── 6. FUZZY BRAND CORRECTOR ─────────────────────────────────────────────────
// If the winning candidate closely resembles a known brand name, snap it.
// Levenshtein distance keeps this lightweight (no external library needed).

const KNOWN_BRANDS: string[] = [
  'NESTLE MILO', 'NESCAFE CLASSIC', 'NESCAFE 3IN1', 'MAGGI MAGIC SARAP',
  'UFC BANANA KETCHUP', 'DATU PUTI VINEGAR', 'DATU PUTI SOY SAUCE',
  'ARGENTINA CORNED BEEF', 'SAN MIGUEL BEER', 'PUREFOODS TJ HOTDOG',
  'DEL MONTE TOMATO SAUCE', 'LUCKY ME PANCIT CANTON', 'PAYLESS PANCIT CANTON',
  'OISHI PRAWN CRACKERS', 'JACK N JILL NOVA', 'SUNKIST ORANGE JUICE',
  'MONDE MAMON', 'REBISCO CRACKERS', 'SELECTA ICE CREAM', 'MAGNOLIA CHICKEN',
  'CENTURY TUNA', 'HUNT\'S PORK AND BEANS', 'MEGA SARDINES',
  'LIGO SARDINES', 'CHAMPION DETERGENT', 'ARIEL DETERGENT',
  'SURF DETERGENT', 'COLGATE TOOTHPASTE', 'SAFEGUARD SOAP',
];

const levenshtein = (a: string, b: string): number => {
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
};

const fuzzyCorrect = (candidate: string): string => {
  const upper = candidate.toUpperCase();
  let bestMatch = candidate;
  let bestDist = Infinity;

  for (const brand of KNOWN_BRANDS) {
    // Only compare if lengths are in a reasonable ballpark (saves computation)
    if (Math.abs(brand.length - upper.length) > 8) continue;
    const dist = levenshtein(upper, brand);
    const threshold = Math.floor(brand.length * 0.2); // allow 20% edit distance
    if (dist < bestDist && dist <= threshold) {
      bestDist = dist;
      bestMatch = brand;
    }
  }

  return bestMatch;
};

// ─── 7. SOFT EDGE PENALTY ─────────────────────────────────────────────────────
// Replaces the old hard zone filter. Instead of discarding blocks outside a
// strict pixel window (which punishes users who hold the phone slightly off),
// we deduct points from blocks that are far from the centre of the frame.
// The scanner box UI remains as a visual guide — it's just no longer a hard crop.
//
// Penalty tiers (based on distance from centre as % of photo dimension):
//   0–40% from centre → no penalty   (well inside the box)
//   40–55% from centre → -20         (near the edge, possible noise)
//   >55% from centre   → -50         (far outside, almost certainly noise)

const edgePenalty = (
  block: any,
  photoWidth: number,
  photoHeight: number,
): number => {
  const blockCentreX = (block.frame?.left ?? 0) + (block.frame?.width ?? 0) / 2;
  const blockCentreY = (block.frame?.top ?? 0) + (block.frame?.height ?? 0) / 2;

  const photoCentreX = photoWidth / 2;
  const photoCentreY = photoHeight / 2;

  // Normalise distance from centre (0 = dead centre, 1 = at the very edge)
  const normX = Math.abs(blockCentreX - photoCentreX) / (photoWidth / 2);
  const normY = Math.abs(blockCentreY - photoCentreY) / (photoHeight / 2);
  const maxNorm = Math.max(normX, normY);

  if (maxNorm <= 0.40) return 0;
  if (maxNorm <= 0.55) return -20;
  return -50;
};

// ─── 8. CONFIDENCE CLASSIFIER ─────────────────────────────────────────────────
// Translates a raw score into a human-readable confidence level.
// Thresholds tuned so that:
//   high   → parser is very sure, show result normally
//   medium → parser has a best guess, prompt user to verify
//   low    → parser is essentially guessing, prompt user to edit

const classifyConfidence = (score: number): ConfidenceLevel => {
  if (score >= 60) return 'high';
  if (score >= 30) return 'medium';
  return 'low';
};

// ─── 9. MAIN EXPORT ───────────────────────────────────────────────────────────

export const processScannedText = async (
  blocks: any[],
  photoWidth: number,
  photoHeight: number,
): Promise<ParsedProduct> => {
  const FAILED: ParsedProduct = {
    product: 'Align tag in box…',
    price: '---',
    confidence: 'low',
    rawScore: 0,
  };

  if (!blocks || blocks.length === 0) return FAILED;

  // Step 1 — Sort all blocks top → bottom (no hard crop — soft penalty applied later)
  const sortedBlocks = [...blocks].sort(
    (a, b) => (a.frame?.top ?? 0) - (b.frame?.top ?? 0),
  );

  // Step 2 — Sanitize: flatten each block into individual lines.
  //           Keep the original block reference for spatial scoring.
  interface FlatLine { text: string; block: any }
  const flatLines: FlatLine[] = [];

  for (const block of sortedBlocks) {
    const rawLines: string[] = block.text
      .split('\n')
      .map((t: string) => sanitizeLine(t))
      .filter((t: string) => t.length > 0);
    for (const text of rawLines) {
      flatLines.push({ text, block });
    }
  }

  if (flatLines.length === 0) return FAILED;

  // Step 3 — Extract price first (gives us the spatial anchor)
  const sanitizedTexts = flatLines.map((l) => l.text);
  const { price, priceBlock, priceLineIndex } = extractPrice(
    flatLines.map((l) => l.block),
    sanitizedTexts,
  );

  // Step 4 — Score every remaining line for product candidacy
  const candidates: ScoredLine[] = [];

  for (let i = 0; i < flatLines.length; i++) {
    if (i === priceLineIndex) continue;       // never pick the price line itself
    const { text, block } = flatLines[i];
    if (isHardRejected(text)) continue;       // instant disqualify

    let score = scoreLine(text, block);
    score += spatialBonus(block, priceBlock); // +0 if no price block found
    score += edgePenalty(block, photoWidth, photoHeight); // soft zone penalty

    candidates.push({ text, score, block });
  }

  if (candidates.length === 0) {
    return { ...FAILED, price };
  }

  // Step 5 — Pick the winner
  candidates.sort((a, b) => b.score - a.score);
  const winner = candidates[0];

  // Step 6 — Fuzzy brand correction ONLY when confidence is already decent.
  //           Avoids snapping a low-confidence garbage result to a brand name.
  const preCorrectConfidence = classifyConfidence(winner.score);
  const correctedProduct =
    preCorrectConfidence !== 'low'
      ? fuzzyCorrect(winner.text)
      : winner.text;

  // Step 7 — Merge with runner-up if they're on the same horizontal band
  //           (handles two-line names like "LUCKY ME / PANCIT CANTON")
  let finalProduct = correctedProduct;
  if (candidates.length > 1) {
    const runnerUp = candidates[1];
    const winnerY  = winner.block?.frame?.top  ?? 0;
    const runnerY  = runnerUp.block?.frame?.top ?? 0;
    const scoreDiff   = winner.score - runnerUp.score;
    const yProximity  = Math.abs(winnerY - runnerY);

    if (
      scoreDiff < 20 &&
      yProximity < photoHeight * 0.05 &&
      runnerUp.score > 0
    ) {
      const [top, bottom] =
        winnerY <= runnerY
          ? [winner.text, runnerUp.text]
          : [runnerUp.text, winner.text];
      finalProduct = `${top} ${bottom}`.trim();
    }
  }

  // Step 8 — Debug log (only in __DEV__ — zero cost in production)
  if (__DEV__) {
    console.log('[Scanner] Top candidates:', candidates.slice(0, 5).map(c => ({
      text: c.text,
      score: c.score,
    })));
    console.log('[Scanner] Winner:', finalProduct, '| Score:', winner.score, '| Price:', price);
  }

  return {
    product: finalProduct,
    price,
    confidence: classifyConfidence(winner.score),
    rawScore: winner.score,
  };
};