/**
 * Client-Side Image Compression & Upload Limiter
 *
 * Enforces an 8MB file size ceiling to protect storage and network bandwidth.
 * Scales dimensions (default max 1200px) and compresses to high-quality JPEG
 * so images are crystal clear on mobile screens while shrinking payload by ~90-95%.
 */

export interface CompressImageOptions {
  maxDimension?: number;
  quality?: number;
  maxSizeBytes?: number;
}

export interface CompressedImageResult {
  dataUrl: string;
  originalSize: number;
  compressedSize: number;
  mimeType: string;
}

export const MAX_UPLOAD_SIZE_BYTES = 8 * 1024 * 1024; // 8 Megabytes

export async function compressImageFile(
  file: File,
  options: CompressImageOptions = {}
): Promise<CompressedImageResult> {
  const maxSizeBytes = options.maxSizeBytes ?? MAX_UPLOAD_SIZE_BYTES;
  const maxDimension = options.maxDimension ?? 1200;
  const quality = options.quality ?? 0.82;

  // 1. Enforce strict upload ceiling
  if (file.size > maxSizeBytes) {
    const maxMb = Math.round(maxSizeBytes / (1024 * 1024));
    throw new Error(`Image size exceeds the ${maxMb}MB limit. Please choose a photo under ${maxMb}MB.`);
  }

  // 2. Validate MIME type
  if (!file.type.startsWith("image/")) {
    throw new Error("Invalid file type. Please upload a valid JPG, PNG, or WebP image.");
  }

  // 3. Load image into memory
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("Failed to read image file."));
    reader.readAsDataURL(file);
  });

  // 4. Create image element and offscreen canvas for resizing & compression
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;

      // Scale down proportionally if larger than maxDimension
      if (width > maxDimension || height > maxDimension) {
        if (width > height) {
          height = Math.round((height * maxDimension) / width);
          width = maxDimension;
        } else {
          width = Math.round((width * maxDimension) / height);
          height = maxDimension;
        }
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        // Fallback to original dataUrl if canvas context fails
        resolve({
          dataUrl,
          originalSize: file.size,
          compressedSize: dataUrl.length,
          mimeType: file.type,
        });
        return;
      }

      // Smooth bicubic resampling
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, 0, 0, width, height);

      // Export compressed format (prefer JPEG for photos)
      const compressedDataUrl = canvas.toDataURL("image/jpeg", quality);
      const approxCompressedBytes = Math.round((compressedDataUrl.length * 3) / 4);

      resolve({
        dataUrl: compressedDataUrl,
        originalSize: file.size,
        compressedSize: approxCompressedBytes,
        mimeType: "image/jpeg",
      });
    };

    img.onerror = () => {
      // Fallback if image tag cannot decode
      resolve({
        dataUrl,
        originalSize: file.size,
        compressedSize: dataUrl.length,
        mimeType: file.type,
      });
    };

    img.src = dataUrl;
  });
}

