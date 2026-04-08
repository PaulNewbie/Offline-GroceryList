// src/utils/scannerParser.ts
import { Tensor } from 'onnxruntime-react-native';

export interface ParsedProduct {
  product: string;
  price: string;
}

// Helper function to auto-insert decimals and format price
const formatPrice = (rawStr: string) => {
   let cleaned = rawStr.replace(/[^0-9.]/g, '');
   if (cleaned.length >= 3 && !cleaned.includes('.')) {
      cleaned = cleaned.slice(0, -2) + '.' + cleaned.slice(-2);
   }
   return `₱${cleaned}`;
};

// Helper function to clean BERT subwords (e.g., turning "straw" + "##berry" into "strawberry")
const cleanBertTokens = (tokens: string[]) => {
  return tokens.reduce((acc, token) => {
    if (token.startsWith('##')) {
      return acc + token.replace('##', '');
    }
    return acc + (acc ? ' ' : '') + token;
  }, "");
};

export const processScannedText = async (
  blocks: any[],
  photoWidth: number,
  photoHeight: number,
  onnxSession: any,     // The loaded AI Brain
  vocabText: string | null // The Dictionary
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

// ---------------------------------------------------------
  // 🧠 PHASE 1: THE AI ENGINE (DistilBERT ONNX Token Classification)
  // ---------------------------------------------------------
  let aiFoundProduct = "";
  let aiFoundPrice = "";

  if (onnxSession && vocabText) {
    try {
      // 1. BUILD OUR OWN DICTIONARY (No external libraries needed!)
      const vocabLines = vocabText.split(/\r?\n/);
      const vocabMap = new Map<string, number>();
      vocabLines.forEach((word, index) => {
          if (word) vocabMap.set(word.trim(), index);
      });

      // 2. NATIVE TOKENIZATION
      // Combine text, make it lowercase (like BERT expects), and split into words/punctuation
      const rawText = textLines.join(" ").toLowerCase();
      const tokens = rawText.match(/\w+|[^\w\s]/g) || [];

      // 3. TRANSLATE TO IDs
      const unkId = vocabMap.get('[UNK]') ?? 100;
      const rawInputIds = tokens.map((t: string) => vocabMap.get(t) ?? unkId);
      
      // 4. ADD SPECIAL BOUNDARY TOKENS [CLS] (101) and [SEP] (102)
      const inputIds = [101, ...rawInputIds, 102];
      const attentionMask = new Array(inputIds.length).fill(1);

      // 5. CREATE TENSORS
      const tensorInputs = {
        input_ids: new Tensor('int64', BigInt64Array.from(inputIds.map((n: number) => BigInt(n))), [1, inputIds.length]),
        attention_mask: new Tensor('int64', BigInt64Array.from(attentionMask.map((n: number) => BigInt(n))), [1, attentionMask.length])
      };

      // 6. RUN THE BRAIN!
      const results = await onnxSession.run(tensorInputs);
      
      // 7. DECODE THE OUTPUT safely
      const resultKeys = Object.keys(results);
      if (resultKeys.length > 0) {
        const outputTensor = results[resultKeys[0]]; 
        const logits = outputTensor.data as Float32Array; 
        
        if (logits && logits.length > 0) {
          const seqLength = inputIds.length;
          const numClasses = logits.length / seqLength; 

          let productTokens: string[] = [];
          let priceTokens: string[] = [];

          for (let i = 0; i < seqLength; i++) {
            if (i === 0 || i === seqLength - 1) continue;

            let maxScore = -Infinity;
            let bestClass = 0;

            for (let c = 0; c < numClasses; c++) {
                const score = logits[i * numClasses + c];
                if (score > maxScore) {
                    maxScore = score;
                    bestClass = c;
                }
            }

            const tokenId = inputIds[i];
            const currentWord = vocabLines[tokenId] || "";

            // Assuming 1/2 = Product, 3/4 = Price 
            if (bestClass === 1 || bestClass === 2) {
                productTokens.push(currentWord);
            } else if (bestClass === 3 || bestClass === 4) {
                priceTokens.push(currentWord);
            }
          }

          if (productTokens.length > 0) aiFoundProduct = cleanBertTokens(productTokens).toUpperCase();
          if (priceTokens.length > 0) aiFoundPrice = cleanBertTokens(priceTokens);
        }
      }
    } catch (e) {
      console.error("AI Inference error:", e);
    }
  }

  // ---------------------------------------------------------
  // 🛡️ PHASE 2: THE FALLBACK (Your restored code + Naked Price Fix)
  // ---------------------------------------------------------
  
  // If the AI found a price, use it. Otherwise, run your Regex rules.
  if (aiFoundPrice) {
    finalPrice = `₱${aiFoundPrice}`;
  } else {
    // --- STEP 1: EXTRACT THE PRICE ---
    for (let i = 0; i < textLines.length; i++) {
      let line = textLines[i];

      // Match A: "P 2750", "₱ 27.50", or "PHP 14.50"
      let match = line.match(/(?:P|₱|PHP|Php)\s*(\d+[\.\,]?\d*)/i);
      
      // Match C (THE NEW FIX): Naked Decimal Price (e.g., 125.50 or 1,250.00)
      let nakedMatch = line.match(/\b\d{1,3}(?:,\d{3})*\.\d{2}\b/);

      if (match) {
         finalPrice = formatPrice(match[1]);
         textLines[i] = ""; // Delete from array
         break;
      } else if (nakedMatch) {
         finalPrice = formatPrice(nakedMatch[0]);
         textLines[i] = ""; // Delete from array
         break;
      }

      // Match B: "P" is on one line, and the numbers "2750" are on the next line
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
  }

  // If the AI found a product, use it. Otherwise, run your noise filters.
  if (aiFoundProduct) {
    finalProduct = aiFoundProduct;
  } else {
    // --- STEP 2: EXTRACT THE PRODUCT ---
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
  }

  return { product: finalProduct, price: finalPrice };
};