export interface ParsedProduct {
  product: string;
  price: string;
}

const formatPrice = (rawStr: string) => {
   let cleaned = rawStr.replace(/[^0-9.]/g, '');
   if (cleaned.length >= 3 && !cleaned.includes('.')) {
      cleaned = cleaned.slice(0, -2) + '.' + cleaned.slice(-2);
   }
   return `₱${cleaned}`;
};

export const processScannedText = async (
  blocks: any[],
  photoWidth: number,
  photoHeight: number
): Promise<ParsedProduct> => {
  
  // 1. Target Square Dimensions
  const minX = photoWidth * 0.15;
  const maxX = photoWidth * 0.85;
  const minY = photoHeight * 0.35;
  const maxY = photoHeight * 0.65;

  let filteredBlocks = blocks.filter(block => {
    const y = block.frame?.top ?? 0;
    const x = block.frame?.left ?? 0;
    return x >= minX && x <= maxX && y >= minY && y <= maxY;
  });

  filteredBlocks.sort((a, b) => (a.frame?.top ?? 0) - (b.frame?.top ?? 0));

  let textLines: string[] = [];
  filteredBlocks.forEach(b => {
    textLines.push(...b.text.split('\n').map((t: string) => t.trim()).filter((t: string) => t.length > 0));
  });

  let finalProduct = "Align tag in box...";
  let finalPrice = "---";

  if (textLines.length === 0) return { product: finalProduct, price: finalPrice };

  // --- EXTRACT THE PRICE ---
  for (let i = 0; i < textLines.length; i++) {
    let line = textLines[i];
    let match = line.match(/(?:P|₱|PHP|Php)\s*(\d+[\.\,]?\d*)/i);
    let nakedMatch = line.match(/\b\d{1,3}(?:,\d{3})*\.\d{2}\b/);

    if (match) {
       finalPrice = formatPrice(match[1]);
       textLines[i] = ""; 
       break;
    } else if (nakedMatch) {
       finalPrice = formatPrice(nakedMatch[0]);
       textLines[i] = ""; 
       break;
    }

    if ((line === 'P' || line === '₱') && i + 1 < textLines.length) {
       let nextLine = textLines[i + 1];
       if (/^\d+[\.\,]?\d*$/.test(nextLine.replace(/\s/g, ''))) {
          finalPrice = formatPrice(nextLine);
          textLines[i] = "";     
          textLines[i + 1] = ""; 
          break;
       }
    }
  }

  // --- EXTRACT THE PRODUCT ---
    let validProductLines = textLines.filter(line => {
       const cleanLine = line.trim().toUpperCase();
       
       if (cleanLine === "") return false; 
       
       // 1. Ignore Store Names 
       if (/PUREGOLD|SM|ROBINSONS|WALTERMART|SAVE MORE|ALFAMART/i.test(cleanLine)) return false;    
       
       // 2. Ignore Dates and Times
       if (/\d{1,2}\/\d{1,2}\/\d{2,4}/.test(cleanLine)) return false; 
       if (/\d{1,2}:\d{2}\s*(AM|PM)/i.test(cleanLine)) return false;  
       
       // 3. Ignore stray Currency markers that got left behind
       if (cleanLine === 'P' || cleanLine === 'PHP' || cleanLine === '₱') return false;

       // 4. STRONGER Number/Barcode filter (Rejects any line that is mostly numbers)
       if (/^[0-9\s\-\.]{4,}$/.test(cleanLine)) return false;          

       // 5. Ignore standalone weights/volumes (e.g., "100G", "500 ML", "1.5 L")
       if (/^\d+(\.\d+)?\s*(G|KG|ML|L|OZ|LB)$/.test(cleanLine)) return false;

       // 6. Ignore random OCR noise (lines with less than 3 characters)
       if (cleanLine.length < 3) return false;

       return true;
    });

    if (validProductLines.length > 0) {
       finalProduct = validProductLines[0];
    }

  return { product: finalProduct, price: finalPrice };
};