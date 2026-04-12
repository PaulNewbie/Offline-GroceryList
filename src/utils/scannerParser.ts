// src/utils/scannerParser.ts
// v3.3 — Levenshtein cache added (section 3)

export type ConfidenceLevel = 'high' | 'medium' | 'low';

export interface ParsedProduct {
  product:    string;
  price:      string;
  confidence: ConfidenceLevel;
  rawScore:   number;
}

// ─── 1. OCR SANITIZER ─────────────────────────────────────────────────────────
const sanitizeLine = (raw: string): string =>
  raw
    .replace(/(?<=\d)[Oo](?=\d)/g, '0')
    .replace(/(?<=\d)[Il](?=\d)/g, '1')
    .replace(/(?<=\d)[Ss](?=\d)/g, '5')
    .replace(/(?<=\d)[Bb](?=\d)/g, '8')
    .replace(/^[Bb](?=:\d{2}\s*(AM|PM))/i, '8')
    .replace(/^[Oo](?=:\d{2}\s*(AM|PM))/i, '0')
    .replace(/^[Il](?=:\d{2}\s*(AM|PM))/i, '1')
    .replace(/^[Ss](?=:\d{2}\s*(AM|PM))/i, '5')
    .replace(/(?<=\d)[Bb](?=:\d{2}\s*(AM|PM))/i, '8')
    .replace(/(?<=\d)[Oo](?=:\d{2}\s*(AM|PM))/i, '0')
    .replace(/\s{2,}/g, ' ')
    .trim();


// ─── 2. DIRECT CORRECTIONS MAP ────────────────────────────────────────────────
const DIRECT_CORRECTIONS: Record<string, string> = {
  'MLO': 'MILO', 'MIL0': 'MILO', 'MIIO': 'MILO', 'MILOO': 'MILO', 'MlLO': 'MILO',
  'NESTL': 'NESTLE', 'NSTLE': 'NESTLE', 'NESLE': 'NESTLE', 'NESTIE': 'NESTLE',
  'NESCAF': 'NESCAFE', 'NESCAL': 'NESCAFE',
  'MAGGL': 'MAGGI', 'MAGG1': 'MAGGI', 'MAGG!': 'MAGGI', 'MAGG': 'MAGGI',
  'OISH1': 'OISHI', '0ISHI': 'OISHI', 'O1SHI': 'OISHI', 'OISH': 'OISHI',
  'DEI': 'DEL', 'D3L': 'DEL', 'MONIE': 'MONTE', 'M0NTE': 'MONTE',
  'ARGENTlNA': 'ARGENTINA', 'ARGENT1NA': 'ARGENTINA', 'ARGENTIN': 'ARGENTINA',
  'UEC': 'UFC', 'U.F.C': 'UFC',
  'CENTUPY': 'CENTURY', 'CENT': 'CENTURY',
  'DATU': 'DATU', 'DAT0': 'DATU', 'PUT1': 'PUTI', 'PUTl': 'PUTI',
  'IUCKY': 'LUCKY', 'LUCKE': 'LUCKY', 'LUKY': 'LUCKY',
  'REBSC0': 'REBISCO', 'REBSCO': 'REBISCO', 'REB1SCO': 'REBISCO',
  'MAGNOIIA': 'MAGNOLIA', 'MAGNOL1A': 'MAGNOLIA',
  'SEIECT': 'SELECTA', 'SELCTA': 'SELECTA', 'SELECT': 'SELECTA',
  'SAFEGRD': 'SAFEGUARD', 'SFGUARD': 'SAFEGUARD',
  'COLGAT': 'COLGATE', 'C0LGATE': 'COLGATE',
  'AR1EL': 'ARIEL', 'ARI3L': 'ARIEL',
  'T1DE': 'TIDE', 'D0WNY': 'DOWNY',
  'S4N': 'SAN', 'S@N': 'SAN', 'MIGUEI': 'MIGUEL', 'M1GUEL': 'MIGUEL',
  'M0NDE': 'MONDE', 'MONED': 'MONDE',
  'HIGHL': 'HIGHLAND', 'ALASK': 'ALASKA', 'ALSKA': 'ALASKA',
  'HUNTS': 'HUNTS', 'HUN7S': 'HUNTS',
  'MEG4': 'MEGA', 'L1GO': 'LIGO', 'LIG0': 'LIGO', 'SP4M': 'SPAM',
  'BARRI0': 'BARRIO', 'MAMAS': 'MAMASITA', 'MAMAST': 'MAMASITA',
  'CHAMPIN': 'CHAMPION', 'CHAMP10N': 'CHAMPION',
  'SUR4': 'SURF', 'TOBIER': 'TOBLERONE', 'RIC0A': 'RICOA',
  'SUNKST': 'SUNKIST', 'SUNK1ST': 'SUNKIST',
  'T4NG': 'TANG', 'P0WRADE': 'POWERADE', 'POWRAD': 'POWERADE',
  'GR3AT': 'GREAT', 'GRATE': 'GREAT', 'TAST3': 'TASTE',
  'FRES': 'FRESH', 'FR3SH': 'FRESH',
  'JAK': 'JACK', 'J1LL': 'JILL',
};


// ─── 3. LEVENSHTEIN + CACHE ───────────────────────────────────────────────────
//
// FIX: Module-level cache prevents recomputing the same (a, b) pair across
// multiple blocks in the same scan. During a single captureAndRead call,
// scannerParser processes every OCR block against the same ~200-word brand
// dictionary. Without a cache, "MILO" vs "MAGNOLIA" gets recomputed once per
// block. With a cache, it's computed once per session and retrieved in O(1).
//
// Cap at 2000 entries — well above any real scan's vocabulary. Clear on cap
// rather than LRU to keep the implementation zero-dependency.
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


// ─── 4. BLOCKLIST ─────────────────────────────────────────────────────────────
const HARD_REJECT_PATTERNS: RegExp[] = [
  /PUREGOLD|SM\s*MARKET|ROBINSONS|WALTERMART|SAVE\s*MORE|ALFAMART|MINISTOP|7[-\s]?ELEVEN|LANDERS|SHOPWISE|HYPERMARKET|SUPERMARKET/i,
  /PROMO|DISCOUNT|SALE|OFF|MARKDOWN|VAT|TAX|TOTAL|SUBTOTAL|RECEIPT|CASHIER|CHANGE|AMOUNT|DUE|THANK\s*YOU|MEMBER|POINTS|LOYALTY|INVOICE|OFFICIAL/i,
  /\b\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}\b/,
  /\b[0-9BbOoIiSs]{1,2}:\d{2}\s*(AM|PM)\b/i,
  /^\d{6,}$/,
  /^[₱P]$|^PHP$|^Php$/,
  /^\d+(\.\d+)?\s*(G|KG|ML|L|OZ|LB|PCS|PC)\.?$/i,
  /^.{0,2}$/,
  /^[0-9\s\-\.\,\*#@%]{4,}$/,
];

const PRICE_CONTEXT_PATTERNS: RegExp[] = [
  /\bprice\b/i, /\bprice\s*per\s*(piece|pc|pcs|kilo|kg|gram|g|liter|litre|l|pack|sachet)\b/i,
  /\bper\s*(piece|pc|pcs|kilo|kg|gram|g|unit|pack)\b/i,
  /\bretail\s*price\b/i, /\bsrp\b/i, /\bregular\s*price\b/i,
  /\bspecial\s*price\b/i, /\bmember('?s)?\s*price\b/i, /\bpromo\s*price\b/i,
  /\bsale\s*price\b/i, /\bunit\s*price\b/i, /\bprice\s*tag\b/i,
  /\bpresyo\b/i, /\bhalaga\b/i, /\bper\s*\d+\s*(g|kg|ml|l|oz|lb)\b/i,
  /\b\d+\s*for\s*[₱P]/i, /\bbuy\s*\d+\s*(get|take)\s*\d+\b/i,
  /^[₱P]\s*\d+(\.\d{1,2})?$/, /^(php|peso)\s*\d+/i,
];

const PRICE_FUZZY_WORDS = [
  'PRICE','PRISE','PRICC','PRICY','PRICA','PRECE',
  'PIECE','PIECA','PIEC','PEICE','PEECE',
  'PRESYO','HALAGA','RETAIL','MEMBER',
];

const fuzzyPriceEditThreshold = (len: number) =>
  len <= 4 ? 1 : len <= 6 ? 2 : 3;

const hasFuzzyPriceWord = (line: string): boolean => {
  const tokens = line.trim().toUpperCase().split(/\s+/);
  for (const token of tokens) {
    const clean = token.replace(/[^A-Z]/g, '');
    if (clean.length < 3) continue;
    for (const pw of PRICE_FUZZY_WORDS) {
      if (Math.abs(clean.length - pw.length) > 3) continue;
      if (levenshtein(clean, pw) <= fuzzyPriceEditThreshold(pw.length)) return true;
    }
  }
  return false;
};

const isPriceContextLine = (line: string): boolean =>
  PRICE_CONTEXT_PATTERNS.some(re => re.test(line.trim())) || hasFuzzyPriceWord(line);

const STORE_NAME_TOKENS = [
  'PUREGOLD','PUREGOLDJR','PUREGOLDMARKET',
  'SMMARKET','SMHYPERMARKET','SMSUPERMARKET','SMSAVEMOREMARKET',
  'ROBINSONS','ROBINSONSSUPERMARKET',
  'WALTERMART','SAVEMORE','ALFAMART','MINISTOP',
  'SEVENELEVEN','7ELEVEN','711',
  'LANDERS','SHOPWISE','HYPERMARKET','SUPERMARKET',
  'MISSIONFOODS','CPCENTRALMARKET','MARKETMARKET',
];

function resemblesStoreName(collapsed: string): boolean {
  for (const token of STORE_NAME_TOKENS) {
    if (collapsed.includes(token)) return true;
    if (Math.abs(collapsed.length - token.length) <= 4 && collapsed.length >= 5) {
      if (collapsed[0] === token[0] && collapsed[1] === token[1]) {
        if (levenshtein(collapsed, token) <= Math.max(2, Math.floor(token.length * 0.18)))
          return true;
      }
    }
  }
  return false;
}

function isHardRejected(line: string): boolean {
  const trimmed   = line.trim();
  const collapsed = trimmed.replace(/\s+/g, '').toUpperCase();
  if (HARD_REJECT_PATTERNS.some(re => re.test(trimmed))) return true;
  if (resemblesStoreName(collapsed))                      return true;
  if (isPriceContextLine(trimmed))                        return true;
  return false;
}


// ─── 5. TOKEN-LEVEL FUZZY CORRECTOR ──────────────────────────────────────────
const BRAND_WORD_DICTIONARY: string[] = [
  'ALASKA','HIGHLAND','MAGNOLIA','SELECTA','SUNKIST',
  'MILO','NESTLE','NESCAFE','NESCAO','OVALTINE','HORLICKS',
  'POWERADE','GATORADE','POCARI','SWEAT','COBRA','STING',
  'C2','LIPTON','ZESTO','SUNPRIDE','MINUTE','MAID',
  'ROYAL','PEPSI','SPRITE','COKE','COLA',
  'RED','BULL','KOPIKO','GREAT','TASTE',
  'TANG','EIGHT','OCLOCK','SAGADA',
  'LUCKY','NISSIN','INDO','MIE','PANCIT','CANTON',
  'OISHI','NOVA','PRAWN','CRACKERS','MARTY',
  'JACK','JILL','PIATTOS','TORTILLOS','CLOVER','CHIPS',
  'REBISCO','MONDE','MAMON','CREAM','PUFF','SODA',
  'SKYFLAKES','FIBISCO','HANSEL','RICHEESE','RICOA','FLAT','TOPS',
  'UFC','BANANA','KETCHUP','CATSUP',
  'DATU','PUTI','VINEGAR','TOYO','SUKA',
  'MAMA','SITA','MAMASITA','BARRIO','FIESTA',
  'DEL','MONTE','HUNT','HUNTS','CONTADINA',
  'LADYFINGER','HEINZ','LEA','PERRINS',
  'KNORR','AJINOMOTO','VETSIN','MAGIC','SARAP','MAGGI','MASARAP',
  'ARGENTINA','SAN','MIGUEL','SPAM','TULIP',
  'CENTURY','TUNA','MEGA','LIGO','SARDINES','MACKEREL',
  'MALING','DELIMONDO','PRINCESS','CDO','PAMANA','TRIDENT','AYAM','FRESCA',
  'SINANDOMENG','DINORADO','JASMINE','GANADOR',
  'MINOLA','BAGUIO','PALM','GOLDEN','CORONA','MAZOLA','CANOLA','WESSON','CRISCO',
  'SAFEGUARD','DOVE','LUX','PALMOLIVE','DIAL',
  'COLGATE','HAPEE','CLOSEUP','PEPSODENT',
  'ARIEL','TIDE','SURF','CHAMPION','BREEZE',
  'DOWNY','COMFORT','SMART','ZONROX','DOMEX',
  'LYSOL','SCOTCH','BRITE','JOY','DAWN',
  'REJOICE','PANTENE','HEAD','SHOULDERS','SUNSILK',
  'VASELINE','NIVEA','POND',
];

const CORRECTION_SAFELIST = new Set([
  'MANG','MANANG','INASAL','INIHAW','ADOBO','SINIGANG','KARE',
  'PORK','BEEF','CHICKEN','FISH','TILAPIA','BANGUS',
  'RICE','CORN','SALT','SUGAR','FLOUR',
  'SOAP','GEL','BAR','CAN','BOX','BAG','PACK','SACHET',
  'BIG','SMALL','LARGE','MINI','SUPER','ULTRA','EXTRA',
  'RED','BLUE','GREEN','WHITE','BLACK','GOLD','SILVER',
  'HOT','COLD','SWEET','SOUR','SPICY','LIGHT','DARK',
  'NET','GROSS','WT','VOL','PCS','SET','KIT',
  'NEW','OLD','BEST','GOOD','FINE','PURE','REAL','RICH',
  'NOVA','CHILI','CHIPS','SWEET','CHEESE','CREAM',
  'JNJ','JNG','SNJ',
]);

function correctToken(token: string): string {
  const upper = token.toUpperCase();
  if (token.length < 3 || /^[\d\.\,₱\-\/\(\)]+$/.test(token)) return token;
  if (CORRECTION_SAFELIST.has(upper)) return token;
  if (DIRECT_CORRECTIONS[upper]) return DIRECT_CORRECTIONS[upper];
  if (upper.length <= 4) return token;

  const maxEdits = upper.length <= 6 ? 1 : upper.length <= 9 ? 2 : 3;
  let bestWord = token;
  let bestDist = Infinity;

  for (const word of BRAND_WORD_DICTIONARY) {
    if (Math.abs(word.length - upper.length) > maxEdits + 1) continue;
    if (word.length < upper.length - 1) continue;
    const dist = levenshtein(upper, word);
    if (dist < bestDist && dist <= maxEdits) { bestDist = dist; bestWord = word; }
  }
  return bestWord;
}

function correctLine(line: string): string {
  return line.split(/\s+/).map(correctToken).join(' ');
}


// ─── 6. LINE SCORER ───────────────────────────────────────────────────────────
interface ScoredLine { text: string; score: number; block: any; }

function scoreLine(line: string, _block: any): number {
  let score = 0;
  const trimmed    = line.trim();
  const upper      = trimmed.toUpperCase();
  const tokenCount = trimmed.split(/\s+/).length;
  const len        = trimmed.length;

  if (trimmed === upper && /[A-Z]/.test(upper))                    score += 30;
  const isTitleCase = trimmed.split(/\s+/).every(
    w => /^[A-Z][a-z]*/.test(w) || /^\d/.test(w) || w.length <= 2,
  );
  if (isTitleCase && trimmed !== upper)                             score += 20;
  if (tokenCount >= 2 && tokenCount <= 5)                          score += 20;
  else if (tokenCount === 1 && len >= 4)                           score += 5;
  if (len >= 5 && len <= 40)                                       score += 15;
  else if (len > 40 && len <= 60)                                  score += 5;
  if (/[A-Za-z]{2,}/.test(trimmed))                               score += 10;
  if (/\d+\s*(pcs?|pieces?|sets?|pack|sachets?|g|kg|ml|l|oz|lb)\b/i.test(trimmed))
                                                                    score += 25;
  if (isTitleCase && tokenCount >= 2 && !/\d/.test(trimmed))      score += 15;
  if (/NESTLE|NESCAFE|MILO|MAGGI|UFC|DATU\s*PUTI|ARGENTINA|SAN\s*MIGUEL|DEL\s*MONTE|LUCKY\s*ME|OISHI|JACK\s*N\s*JILL|SUNKIST|MONDE|REBISCO|SELECTA|MAGNOLIA|ALASKA|HIGHLAND|CENTURY|MEGA|LIGO|SARDINES|SPAM|CDO|PAMANA|CHAMPION|ARIEL|TIDE|SURF|DOWNY|COLGATE|SAFEGUARD|DOVE|PALMOLIVE|PANTENE|SUNSILK|REJOICE|KOPIKO|GREAT\s*TASTE|NISSIN|SKYFLAKES|FIBISCO|HANSEL|PIATTOS|NOVA|KNORR|AJINOMOTO|BARRIO\s*FIESTA|MAMA\s*SITA|MINOLA|MAZOLA|BAGUIO/i.test(trimmed))
                                                                    score += 40;
  if (/PROMO|DISCOUNT|SALE|OFF|MARKDOWN/i.test(trimmed))           score -= 60;
  const digitRatio = (trimmed.match(/\d/g) || []).length / len;
  if (digitRatio > 0.5)       score -= 40;
  else if (digitRatio > 0.3)  score -= 15;
  if (len > 60)               score -= 30;
  if (len <= 2)               score -= 50;
  if (trimmed === trimmed.toLowerCase() && /[a-z]/.test(trimmed))  score -= 15;
  if (/\bprice\b|\bpresyo\b|\bhalaga\b|\bsrp\b|\bper\s*(pc|piece|kilo|kg)\b/i.test(trimmed))
                                                                    score -= 80;
  if (/^(regular|special|member|promo|sale|retail|unit)[\s:]/i.test(trimmed))
                                                                    score -= 60;
  return score;
}


// ─── 7. PRICE EXTRACTOR ───────────────────────────────────────────────────────
function formatPriceStr(base: string, cents?: string): string {
  return `₱${base.replace(/[^0-9]/g, '')}.${cents ? cents.replace(/[^0-9]/g, '') : '00'}`;
}

interface PriceResult { price: string; priceBlock: any | null; priceLineIndex: number; }

function extractPrice(blocks: any[], sanitizedLines: string[]): PriceResult {
  const validPrices: PriceResult[] = [];

  for (let i = 0; i < sanitizedLines.length; i++) {
    const windowText = `${sanitizedLines[i]} ${sanitizedLines[i+1]??''} ${sanitizedLines[i+2]??''}`.trim();
    let extracted: string | null = null;

    const matchA = windowText.match(/(?:^|\s)(?:₱|P|PHP|Php|B|b)\s*(\d{1,5})\s*[.,]?\s*(\d{2})\b/i);
    if (matchA) {
      extracted = formatPriceStr(matchA[1], matchA[2]);
    } else {
      const matchB = windowText.match(/\b(\d{1,3}(?:,\d{3})*)\s*[.,]\s*(\d{2})\b/);
      if (matchB) {
        extracted = formatPriceStr(matchB[1], matchB[2]);
      } else {
        const matchC = windowText.match(/(?:^|\s)(?:₱|P|PHP|Php|B|b)\s*(\d{1,5})\b/i);
        if (matchC) extracted = formatPriceStr(matchC[1], '00');
      }
    }

    if (extracted && !validPrices.some(p => p.priceLineIndex === i)) {
      validPrices.push({ price: extracted, priceBlock: blocks[i], priceLineIndex: i });
    }
  }

  if (validPrices.length === 0)
    return { price: '---', priceBlock: null, priceLineIndex: -1 };

  validPrices.sort((a, b) => {
    const hA = a.priceBlock?.frame?.height || 0;
    const hB = b.priceBlock?.frame?.height || 0;
    return hA !== hB ? hB - hA : b.priceLineIndex - a.priceLineIndex;
  });
  return validPrices[0];
}


// ─── 8. EDGE PENALTY ──────────────────────────────────────────────────────────
function edgePenalty(block: any, photoWidth: number, photoHeight: number): number {
  const cx = (block.frame?.left ?? 0) + (block.frame?.width  ?? 0) / 2;
  const cy = (block.frame?.top  ?? 0) + (block.frame?.height ?? 0) / 2;
  const normX = Math.abs(cx - photoWidth  / 2) / (photoWidth  / 2);
  const normY = Math.abs(cy - photoHeight / 2) / (photoHeight / 2);
  const m = Math.max(normX, normY);
  return m <= 0.40 ? 0 : m <= 0.55 ? -20 : -50;
}


// ─── 9. CONFIDENCE CLASSIFIER ─────────────────────────────────────────────────
function classifyConfidence(score: number): ConfidenceLevel {
  if (score >= 60) return 'high';
  if (score >= 30) return 'medium';
  return 'low';
}


// ─── 10. FUZZY BRAND PHRASE CORRECTOR ─────────────────────────────────────────
const KNOWN_BRAND_PHRASES: string[] = [
  'NESTLE MILO','NESCAFE CLASSIC','NESCAFE 3IN1','NESCAFE GOLD',
  'MAGGI MAGIC SARAP','MAGGI SAVOR',
  'UFC BANANA KETCHUP','UFC TOMATO KETCHUP',
  'DATU PUTI VINEGAR','DATU PUTI SOY SAUCE','DATU PUTI PATIS',
  'ARGENTINA CORNED BEEF','ARGENTINA LUNCHEON MEAT',
  'SAN MIGUEL BEER','SAN MIGUEL PALE PILSEN',
  'DEL MONTE TOMATO SAUCE','DEL MONTE SPAGHETTI SAUCE','DEL MONTE FRUIT COCKTAIL',
  'LUCKY ME PANCIT CANTON','LUCKY ME INSTANT NOODLES','LUCKY ME SUPREME',
  'NISSIN PANCIT CANTON','NISSIN CUP NOODLES',
  'OISHI PRAWN CRACKERS','OISHI MARTY','OISHI RIDGES',
  'JACK N JILL NOVA','JACK N JILL PIATTOS','JACK N JILL TORTILLOS',
  'SUNKIST ORANGE JUICE','SUNKIST JUICE DRINK',
  'MONDE MAMON','MONDE SPECIAL ENSAYMADA',
  'REBISCO CRACKERS','REBISCO SANDWICH',
  'SELECTA ICE CREAM','SELECTA CORNETTO',
  'MAGNOLIA CHICKEN','MAGNOLIA PURESKIM',
  'ALASKA EVAPORATED MILK','ALASKA POWDERED MILK','ALASKA CONDENSED MILK',
  'HIGHLAND EVAPORATED MILK','HIGHLAND CONDENSED MILK',
  'CENTURY TUNA','CENTURY TUNA FLAKES',
  'MEGA SARDINES','MEGA TUNA',
  'LIGO SARDINES','LIGO CORNED BEEF',
  'SPAM CLASSIC','SPAM LITE',
  'CDO ULAM BURGER','CDO CHORIZO',
  'PAMANA CORNED BEEF',
  'GREAT TASTE WHITE','GREAT TASTE COFFEE',
  'KOPIKO BROWN COFFEE','KOPIKO BLACK',
  'CHAMPION DETERGENT','CHAMPION BAR',
  'ARIEL DETERGENT','ARIEL POWDER',
  'TIDE PLUS','TIDE DETERGENT',
  'SURF DETERGENT','SURF POWDER',
  'DOWNY FABRIC CONDITIONER','DOWNY PASSION',
  'COMFORT FABRIC CONDITIONER',
  'COLGATE TOOTHPASTE','COLGATE TOTAL','COLGATE OPTIC WHITE',
  'HAPEE TOOTHPASTE','CLOSEUP TOOTHPASTE',
  'SAFEGUARD SOAP','SAFEGUARD BAR',
  'DOVE SOAP','DOVE BODY WASH','DOVE SHAMPOO',
  'PALMOLIVE SOAP','PALMOLIVE SHAMPOO','PALMOLIVE NATURALS',
  'PANTENE SHAMPOO','PANTENE PRO-V',
  'SUNSILK SHAMPOO','SUNSILK BLACK SHINE',
  'HEAD SHOULDERS SHAMPOO','REJOICE SHAMPOO',
  'VASELINE LOTION','VASELINE PETROLEUM JELLY',
  'NIVEA LOTION','NIVEA CREAM',
  'KNORR BROTH','KNORR LIQUID SEASONING','KNORR SINIGANG MIX',
  'AJINOMOTO GINISA MIX',
  'BARRIO FIESTA BAGOONG',
  'MAMA SITA ADOBO MIX','MAMA SITA SINIGANG MIX',
  'MINOLA COOKING OIL','BAGUIO COOKING OIL','MAZOLA CORN OIL',
  'SKYFLAKES CRACKERS','FIBISCO BUTTER COOKIES','HANSEL CRACKERS',
  'TANG ORANGE','TANG FOUR SEASONS',
  'ZESTO ORANGE JUICE','POWERADE ION4','POCARI SWEAT',
  'COBRA ENERGY DRINK','STING ENERGY DRINK','RED BULL ENERGY DRINK',
];

function fuzzyCorrectPhrase(candidate: string): string {
  const upper = candidate.toUpperCase();
  let bestMatch = candidate, bestDist = Infinity;
  for (const phrase of KNOWN_BRAND_PHRASES) {
    if (Math.abs(phrase.length - upper.length) > 10) continue;
    const dist = levenshtein(upper, phrase);
    const threshold = Math.floor(phrase.length * 0.2);
    if (dist < bestDist && dist <= threshold) { bestDist = dist; bestMatch = phrase; }
  }
  return bestMatch;
}


// ─── 11. MAIN EXPORT ──────────────────────────────────────────────────────────
export async function processScannedText(
  blocks: any[], photoWidth: number, photoHeight: number,
): Promise<ParsedProduct> {
  const FAILED: ParsedProduct = {
    product: 'Align tag in box…', price: '---', confidence: 'low', rawScore: 0,
  };
  if (!blocks || blocks.length === 0) return FAILED;

  const sortedBlocks = [...blocks].sort((a, b) => {
    const yDiff = (a.frame?.top ?? 0) - (b.frame?.top ?? 0);
    const rowTolerance = Math.max(a.frame?.height ?? 0, b.frame?.height ?? 0) * 0.5 || 15;
    return Math.abs(yDiff) < rowTolerance
      ? (a.frame?.left ?? 0) - (b.frame?.left ?? 0)
      : yDiff;
  });

  interface FlatLine { text: string; block: any }
  const flatLines: FlatLine[] = [];
  for (const block of sortedBlocks) {
    const rawLines: string[] = block.text
      .split('\n')
      .map((t: string) => correctLine(sanitizeLine(t)))
      .filter((t: string) => t.length > 0);
    for (const text of rawLines) flatLines.push({ text, block });
  }
  if (flatLines.length === 0) return FAILED;

  const sanitizedTexts = flatLines.map(l => l.text);
  const { price, priceLineIndex } = extractPrice(flatLines.map(l => l.block), sanitizedTexts);

  const candidates: ScoredLine[] = [];
  for (let i = 0; i < flatLines.length; i++) {
    if (i === priceLineIndex) continue;
    const { text, block } = flatLines[i];
    if (isHardRejected(text)) continue;
    candidates.push({ text, score: scoreLine(text, block) + edgePenalty(block, photoWidth, photoHeight), block });
  }
  if (candidates.length === 0) return { ...FAILED, price };

  candidates.sort((a, b) => b.score - a.score);
  const winner = candidates[0];

  const correctedProduct = classifyConfidence(winner.score) !== 'low'
    ? fuzzyCorrectPhrase(winner.text)
    : winner.text;

  let finalProduct = correctedProduct;
  if (candidates.length > 1) {
    const runnerUp  = candidates[1];
    const winnerY   = winner.block?.frame?.top  ?? 0;
    const runnerY   = runnerUp.block?.frame?.top ?? 0;
    if (
      winner.score - runnerUp.score < 20 &&
      Math.abs(winnerY - runnerY) < photoHeight * 0.05 &&
      runnerUp.score > 0
    ) {
      const [top, bottom] = winnerY <= runnerY
        ? [winner.text, runnerUp.text] : [runnerUp.text, winner.text];
      finalProduct = `${top} ${bottom}`.trim();
    }
  }

  if (__DEV__) {
    console.log('[Scanner] Top candidates:', candidates.slice(0, 5).map(c => ({ text: c.text, score: c.score })));
    console.log('[Scanner] Winner:', finalProduct, '| Score:', winner.score, '| Price:', price);
  }

  return {
    product: finalProduct,
    price,
    confidence: classifyConfidence(winner.score),
    rawScore: winner.score,
  };
}