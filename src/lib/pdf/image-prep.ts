export interface PreparedPdfImage {
  dataUrl: string;
  width: number;
  height: number;
}

/**
 * Fetches an image, normalizes WebP/PNG transparency onto a crisp #FFFFFF canvas background,
 * downscales proportionally if exceeding maxDimension, and exports compressed JPEG Data URL.
 */
export async function prepareProductImageForPdf(
  imageUrl: string,
  maxDimension = 480,
  quality = 0.82
): Promise<PreparedPdfImage | null> {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return null;
  }

  try {
    const response = await fetch(imageUrl);
    if (!response.ok) return null;

    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);

    return await new Promise<PreparedPdfImage | null>((resolve) => {
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(objectUrl);

        let w = img.naturalWidth || img.width;
        let h = img.naturalHeight || img.height;

        if (!w || !h) {
          resolve(null);
          return;
        }

        if (w > maxDimension || h > maxDimension) {
          if (w >= h) {
            h = Math.max(1, Math.round((h * maxDimension) / w));
            w = maxDimension;
          } else {
            w = Math.max(1, Math.round((w * maxDimension) / h));
            h = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(null);
          return;
        }

        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);

        resolve({
          dataUrl: canvas.toDataURL('image/jpeg', quality),
          width: w,
          height: h,
        });
      };

      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        resolve(null);
      };

      img.src = objectUrl;
    });
  } catch {
    return null;
  }
}

/**
 * Generates a crisp centered color swatch tile JPEG on #FFFFFF for custom interior items in the PDF table.
 */
export function renderColorSwatchForPdf(hexColor: string): PreparedPdfImage | null {
  if (typeof document === 'undefined') return null;

  const size = 180;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.fillStyle = '#F7F6F4';
  ctx.fillRect(0, 0, size, size);

  ctx.fillStyle = /^#[0-9A-Fa-f]{3,8}$/.test(hexColor) ? hexColor : '#999697';
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, 46, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = '#CCC7C0';
  ctx.lineWidth = 4;
  ctx.stroke();

  return {
    dataUrl: canvas.toDataURL('image/jpeg', 0.9),
    width: size,
    height: size,
  };
}
