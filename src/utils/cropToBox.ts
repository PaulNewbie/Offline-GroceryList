// src/utils/cropToBox.ts
import * as ImageManipulator from 'expo-image-manipulator';

// Must match ScannerOverlay.tsx exactly
const BOX_WIDTH  = 260;
const BOX_HEIGHT = 160;

// Generous padding so tag edges are never clipped
// 80px screen pixels on each side — errs heavily toward including more
const PADDING = 80;

// Safe minimum width — never downscale below this
// 1280px is well above what ML Kit needs for grocery tag text
// including small decimals like ₱52.75 and peso signs
const MIN_CROP_WIDTH = 1280;

export interface BoxCropResult {
  uri:    string;
  width:  number;
  height: number;
}

export const cropPhotoToBox = async (
  photoPath:   string,
  photoWidth:  number,
  photoHeight: number,
  screenWidth:  number,
  screenHeight: number,
): Promise<BoxCropResult> => {

  // Scale factors: how many photo pixels per screen pixel
  const scaleX = photoWidth  / screenWidth;
  const scaleY = photoHeight / screenHeight;

  // Box top-left origin on screen (centered)
  const boxScreenX = (screenWidth  - BOX_WIDTH)  / 2;
  const boxScreenY = (screenHeight - BOX_HEIGHT) / 2;

  // Map to photo pixel coordinates with padding
  const cropX = Math.max(0, (boxScreenX - PADDING) * scaleX);
  const cropY = Math.max(0, (boxScreenY - PADDING) * scaleY);
  const cropW = Math.min(
    photoWidth  - cropX,
    (BOX_WIDTH  + PADDING * 2) * scaleX,
  );
  const cropH = Math.min(
    photoHeight - cropY,
    (BOX_HEIGHT + PADDING * 2) * scaleY,
  );

  // Build operation list — crop always, resize only if genuinely oversized
  const operations: ImageManipulator.Action[] = [
    { crop: { originX: cropX, originY: cropY, width: cropW, height: cropH } },
  ];

  // Only downscale if crop is wider than 1920px
  // Between 1280–1920px: keep native resolution (no resize)
  // Above 1920px: scale to 1600px — still 2.5× above our safe floor
  if (cropW > 1920) {
    operations.push({ resize: { width: 1600 } });
  }

  const result = await ImageManipulator.manipulateAsync(
    `file://${photoPath}`,
    operations,
    {
      compress: 0.94, // high quality — don't trade accuracy for file size
      format: ImageManipulator.SaveFormat.JPEG,
    },
  );

  if (__DEV__) {
    console.log(
      `[Crop] Photo: ${photoWidth}×${photoHeight} →`,
      `Crop region: ${Math.round(cropW)}×${Math.round(cropH)} →`,
      `Output: ${result.width}×${result.height}`,
    );
  }

  return {
    uri:    result.uri,
    width:  result.width,
    height: result.height,
  };
};