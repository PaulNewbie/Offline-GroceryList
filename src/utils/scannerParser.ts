// src/utils/scannerParser.ts

export interface ParsedProduct {
  product: string;
  price: string;
}

// Restored: Helper function to auto-insert decimals
const formatPrice = (rawStr: string) => {
   let nums = rawStr.replace(/[^0-9]/g, '');
   if (nums.length >= 3 && !rawStr.includes('.')) {
      nums = nums.slice(0, -2) + '.' + nums.slice(-2);
   }
   return `₱${nums}`;
};

export const processScannedText = async (
  blocks: any[],
  photoWidth: number,
  photoHeight: number,
  onnxSession: any // The loaded AI Brain
): Promise<ParsedProduct> => {
  
  // 1. Target Square Dimensions (Your original targeting logic)
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

  // Extract all text lines
  let textLines: string[] = [];
  filteredBlocks.forEach(b => {
    textLines.push(...b.text.split('\n').map((t: string) => t.trim()).filter((t: string) => t.length > 0));
  });

  let finalProduct = "Align tag in box...";
  let finalPrice = "---";

  if (textLines.length === 0) return { product: finalProduct, price: finalPrice };

  // ---------------------------------------------------------
  // 🧠 PHASE 1: THE AI ENGINE (DistilBERT ONNX)
  // ---------------------------------------------------------
  let aiFoundProduct = "";
  let aiFoundPrice = "";

  if (onnxSession) {
    try {
      // NOTE: The bridge is ready! Once you add a JS Tokenizer library 
      // (to convert the text into tensors), the inference call goes right here:
      
      // const tensorInputs = {
      //   input_ids: new onnx.Tensor('int64', inputIdsArray, [1, seqLength]),
      //   attention_mask: new onnx.Tensor('int64', attentionMaskArray, [1, seqLength])
      // };
      // const results = await onnxSession.run(tensorInputs);
      // (Extract BIO tags from results.logits)
      
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
       if (line === "") return false; 
       if (/PUREGOLD|SM|ROBINSONS/i.test(line)) return false;    // Store Names
       if (/\d{1,2}\/\d{1,2}\/\d{2,4}/.test(line)) return false; // Dates
       if (/\d{1,2}:\d{2}\s*(AM|PM)/i.test(line)) return false;  // Times
       if (/^[\d\s\'\-]{8,}$/.test(line)) return false;          // Barcodes
       return true;
    });

    if (validProductLines.length > 0) {
       finalProduct = validProductLines[0];
    }
  }

  return { product: finalProduct, price: finalPrice };
};