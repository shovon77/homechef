import { Platform } from 'react-native';

const MAX_WIDTH = 1200;
const QUALITY = 0.8;
const OUTPUT_TYPE = 'image/jpeg';

/**
 * Resize an image blob/file on the client before upload.
 *
 * - Web: uses OffscreenCanvas (or <canvas>) to downscale and re-encode as JPEG.
 * - Native: returns the input unchanged (expo-image-picker handles quality/resize).
 * - Falls back to the original if anything fails (unsupported format, memory, etc.).
 *
 * @param input  File | Blob to resize
 * @param maxW   Max width in pixels (default 1200)
 * @returns      { blob, fileName, contentType } ready for upload
 */
export async function resizeImageForUpload(
  input: File | Blob,
  maxW: number = MAX_WIDTH
): Promise<{ blob: Blob; fileName: string; contentType: string }> {
  if (Platform.OS !== 'web') {
    const name = (input as File).name || 'upload.jpg';
    return { blob: input, fileName: name, contentType: input.type || 'image/jpeg' };
  }

  try {
    const bitmap = await createImageBitmap(input);
    const { width: origW, height: origH } = bitmap;

    if (origW <= maxW) {
      const name = (input as File).name || 'upload.jpg';
      bitmap.close();
      return { blob: input, fileName: name, contentType: input.type || 'image/jpeg' };
    }

    const scale = maxW / origW;
    const newW = Math.round(origW * scale);
    const newH = Math.round(origH * scale);

    let resizedBlob: Blob;

    if (typeof OffscreenCanvas !== 'undefined') {
      const canvas = new OffscreenCanvas(newW, newH);
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('No 2d context');
      ctx.drawImage(bitmap, 0, 0, newW, newH);
      bitmap.close();
      resizedBlob = await canvas.convertToBlob({ type: OUTPUT_TYPE, quality: QUALITY });
    } else {
      const canvas = document.createElement('canvas');
      canvas.width = newW;
      canvas.height = newH;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('No 2d context');
      ctx.drawImage(bitmap, 0, 0, newW, newH);
      bitmap.close();
      resizedBlob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error('toBlob returned null'))),
          OUTPUT_TYPE,
          QUALITY
        );
      });
    }

    const origName = (input as File).name || 'upload.jpg';
    const baseName = origName.replace(/\.[^.]+$/, '');
    const fileName = `${baseName}.jpg`;

    return { blob: resizedBlob, fileName, contentType: OUTPUT_TYPE };
  } catch (err) {
    console.warn('Image resize failed, uploading original:', err);
    const name = (input as File).name || 'upload.jpg';
    return { blob: input, fileName: name, contentType: input.type || 'image/jpeg' };
  }
}
