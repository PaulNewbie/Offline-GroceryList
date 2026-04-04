// src/utils/scannerParser.ts

export interface ParsedProduct {
  product: string;
  price: string;
}

export const processScannedText = (
  blocks: any[],
  photoWidth: number,
  photoHeight: number
): ParsedProduct => {
  // 1. Target Square Dimensions
  const minX = photoWidth * 0.15;
  const maxX = photoWidth * 0.85;
  const minY = photoHeight * 0.35;
  const maxY = photoHeight * 0.65;

  // 2. Filter out anything outside the green box
  let filteredBlocks = blocks.filter(block => {
    const y = block.frame?.top ?? 0;
    const x = block.frame?.left ?? 0;
    return x >= minX && x <= maxX && y >= minY && y <= maxY;
  });

  // Sort top-to-bottom
  filteredBlocks.sort((a, b) => (a.frame?.top ?? 0) - (b.frame?.top ?? 0));

  // Extract all text lines (ML Kit blocks often have hidden newlines)
  let textLines: string[] = [];
  filteredBlocks.forEach(b => {
    textLines.push(...b.text.split('\n').map((t: string) => t.trim()).filter((t: string) => t.length > 0));
  });

  let finalProduct = "Align tag in box...";
  let finalPrice = "---";

  if (textLines.length > 0) {
    // --- STEP 1: EXTRACT THE PRICE ---
    for (let i = 0; i < textLines.length; i++) {
      let line = textLines[i];

      // Match A: "P 2750" or "₱ 27.50" on the same line
      let match = line.match(/(?:P|₱)\s*(\d+[\.\,]?\d*)/i);
      if (match) {
         finalPrice = formatPrice(match[1]);
         textLines[i] = ""; // Delete from array so it isn't used as the product
         break;
      }

      // Match B: "P" is on one line, and the numbers "2750" are on the next line
      if ((line === 'P' || line === '₱') && i + 1 < textLines.length) {
         let nextLine = textLines[i + 1];
         if (/^\d+[\.\,]?\d*$/.test(nextLine.replace(/\s/g, ''))) {
            finalPrice = formatPrice(nextLine);
            textLines[i] = "";     // Delete the 'P'
            textLines[i + 1] = ""; // Delete the '2750'
            break;
         }
      }
    }

    // --- STEP 2: EXTRACT THE PRODUCT ---
    // Filter out the known semantic "noise" on the tag using Regex
    let validProductLines = textLines.filter(line => {
       if (line === "") return false; // Skip the price we already deleted
       if (/PUREGOLD/i.test(line)) return false; // Store Name
       if (/\d{1,2}\/\d{1,2}\/\d{2,4}/.test(line)) return false; // Dates (07/13/24)
       if (/\d{1,2}:\d{2}\s*(AM|PM)/i.test(line)) return false;  // Times (8:46 AM)
       if (/^[\d\s\'\-]{8,}$/.test(line)) return false;          // Barcodes (8 901233 026497)
       return true;
    });

    // The product name should be the first remaining line after the noise is filtered
    if (validProductLines.length > 0) {
       finalProduct = validProductLines[0];
    }
  }

  return { product: finalProduct, price: finalPrice };
};

// Helper function to auto-insert decimals if the OCR missed them
const formatPrice = (rawStr: string) => {
   let nums = rawStr.replace(/[^0-9]/g, '');
   if (nums.length >= 3 && !rawStr.includes('.')) {
      nums = nums.slice(0, -2) + '.' + nums.slice(-2);
   }
   return `₱${nums}`;
};