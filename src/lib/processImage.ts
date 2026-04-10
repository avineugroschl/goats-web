// Browser-side image processing for court photos.
//
// Mirrors the on-device pipeline used by the mobile apps
// (Android: ImageUploadHelper.processImage, iOS: ImageProcessing.processImage).
// Same dimensions, same WebP format, same Storage paths so all three
// platforms produce interchangeable photos.
//
// - Card photo:    600 wide,  3:2 crop  → court_photos/{courtId}_card.webp
// - Full photo:    600 wide,  preserved → court_photos/{courtId}_full.webp
// - Gallery photo: 800 wide,  preserved → court_user_photos/{courtId}/{uuid}.webp
//
// Quality: 80 (matches mobile)

import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "./firebase";

const QUALITY = 0.8;
const CARD_MAX_WIDTH = 600;
const FULL_MAX_WIDTH = 600;
const GALLERY_MAX_WIDTH = 800;
const CARD_ASPECT_RATIO = 3 / 2;

/**
 * Decodes a File into an HTMLImageElement, respecting EXIF orientation
 * (browsers handle this automatically when using createImageBitmap).
 */
async function fileToBitmap(file: File): Promise<ImageBitmap> {
  // createImageBitmap honors EXIF orientation by default in modern browsers.
  return await createImageBitmap(file, { imageOrientation: "from-image" });
}

/**
 * Center-crop a bitmap to a target aspect ratio (width / height).
 * Returns a canvas with the cropped image drawn at the desired output width.
 */
function cropAndScale(
  bitmap: ImageBitmap,
  maxWidth: number,
  aspectRatio: number | null
): HTMLCanvasElement {
  const srcW = bitmap.width;
  const srcH = bitmap.height;

  // Compute crop region
  let cropX = 0;
  let cropY = 0;
  let cropW = srcW;
  let cropH = srcH;

  if (aspectRatio !== null) {
    const currentRatio = srcW / srcH;
    if (currentRatio > aspectRatio) {
      // Wider than target — crop sides
      cropW = Math.round(srcH * aspectRatio);
      cropX = Math.round((srcW - cropW) / 2);
    } else {
      // Taller than target — crop top/bottom
      cropH = Math.round(srcW / aspectRatio);
      cropY = Math.round((srcH - cropH) / 2);
    }
  }

  // Compute output size
  const scale = Math.min(1, maxWidth / cropW);
  const outW = Math.round(cropW * scale);
  const outH = Math.round(cropH * scale);

  const canvas = document.createElement("canvas");
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D canvas context unavailable");

  // Draw with high-quality smoothing for the downscale
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, cropX, cropY, cropW, cropH, 0, 0, outW, outH);

  return canvas;
}

/**
 * Encode a canvas as a WebP Blob.
 */
function canvasToWebp(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("WebP encode failed"));
      },
      "image/webp",
      QUALITY
    );
  });
}

/**
 * Process a File into a card-sized WebP Blob (600×400 3:2).
 */
export async function processCourtCardImage(file: File): Promise<Blob> {
  const bitmap = await fileToBitmap(file);
  try {
    const canvas = cropAndScale(bitmap, CARD_MAX_WIDTH, CARD_ASPECT_RATIO);
    return await canvasToWebp(canvas);
  } finally {
    bitmap.close();
  }
}

/**
 * Process a File into a full-sized WebP Blob (600 wide, original aspect).
 */
export async function processCourtFullImage(file: File): Promise<Blob> {
  const bitmap = await fileToBitmap(file);
  try {
    const canvas = cropAndScale(bitmap, FULL_MAX_WIDTH, null);
    return await canvasToWebp(canvas);
  } finally {
    bitmap.close();
  }
}

/**
 * Process a File into a gallery WebP Blob (800 wide, original aspect).
 */
export async function processCourtGalleryImage(file: File): Promise<Blob> {
  const bitmap = await fileToBitmap(file);
  try {
    const canvas = cropAndScale(bitmap, GALLERY_MAX_WIDTH, null);
    return await canvasToWebp(canvas);
  } finally {
    bitmap.close();
  }
}

interface CourtPhotoUrls {
  cardUrl: string;
  fullUrl: string;
}

/**
 * Process and upload BOTH card + full variants for a court's main photo.
 * Storage paths match the mobile pipeline:
 *   court_photos/{courtId}_card.webp
 *   court_photos/{courtId}_full.webp
 */
export async function uploadCourtMainPhoto(
  courtId: string,
  file: File
): Promise<CourtPhotoUrls> {
  const [cardBlob, fullBlob] = await Promise.all([
    processCourtCardImage(file),
    processCourtFullImage(file),
  ]);

  const cardRef = ref(storage, `court_photos/${courtId}_card.webp`);
  const fullRef = ref(storage, `court_photos/${courtId}_full.webp`);

  const metadata = { contentType: "image/webp" };

  await Promise.all([
    uploadBytes(cardRef, cardBlob, metadata),
    uploadBytes(fullRef, fullBlob, metadata),
  ]);

  const [cardUrl, fullUrl] = await Promise.all([
    getDownloadURL(cardRef),
    getDownloadURL(fullRef),
  ]);

  return { cardUrl, fullUrl };
}

/**
 * Process and upload a single gallery photo.
 * Storage path: court_user_photos/{courtId}/{uuid}.webp
 */
export async function uploadCourtGalleryPhoto(
  courtId: string,
  file: File
): Promise<{ url: string; storagePath: string }> {
  const blob = await processCourtGalleryImage(file);
  const photoId = crypto.randomUUID();
  const storagePath = `court_user_photos/${courtId}/${photoId}.webp`;
  const photoRef = ref(storage, storagePath);
  await uploadBytes(photoRef, blob, { contentType: "image/webp" });
  const url = await getDownloadURL(photoRef);
  return { url, storagePath };
}
