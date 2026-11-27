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

export const WORKSHOP_BRAND_ASSETS = {
  logoUrl: '/logo-gelap.webp',
  ownerSignatureUrl: '/ttd-owner.webp',
  companyStampUrl: '/stempel.webp',
  bniLogoUrl: '/bni.webp',
  bsiLogoUrl: '/bsi.webp',
} as const;

export interface WorkshopBrandPdfAssets {
  logo: PreparedPdfImage | null;
  ownerSignature: PreparedPdfImage | null;
  companyStamp: PreparedPdfImage | null;
  bniLogo?: PreparedPdfImage | null;
  bsiLogo?: PreparedPdfImage | null;
}

const EMPTY_BRAND_ASSETS: WorkshopBrandPdfAssets = {
  logo: null,
  ownerSignature: null,
  companyStamp: null,
  bniLogo: null,
  bsiLogo: null,
};

let cachedBrandAssets: WorkshopBrandPdfAssets | null = null;
let pendingBrandAssetsPromise: Promise<WorkshopBrandPdfAssets> | null = null;

/**
 * Menghasilkan logo BNI (Bank Negara Indonesia) beresolusi tinggi via Canvas 2D
 * dengan warna korporat resmi (#005E6A & #F15A23) agar bebas CORS dan tajam di PDF.
 */
export function renderBniLogoForPdf(): PreparedPdfImage | null {
  if (typeof document === 'undefined') return null;

  const width = 420;
  const height = 140;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.clearRect(0, 0, width, height);

  // Orange diagonal emblem (46 motif) on the left
  ctx.save();
  ctx.fillStyle = '#F15A23';
  ctx.beginPath();
  ctx.moveTo(22, 112);
  ctx.lineTo(54, 28);
  ctx.lineTo(94, 28);
  ctx.lineTo(62, 112);
  ctx.closePath();
  ctx.fill();

  // Inner white slash accent inside orange emblem
  ctx.fillStyle = '#FFFFFF';
  ctx.beginPath();
  ctx.moveTo(51, 96);
  ctx.lineTo(66, 56);
  ctx.lineTo(75, 56);
  ctx.lineTo(60, 96);
  ctx.closePath();
  ctx.fill();

  // Teal bold "BNI" wordmark
  ctx.fillStyle = '#005E6A';
  ctx.font = '900 84px Arial, Helvetica, sans-serif';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('BNI', 108, 102);

  // Subtle subtitle "Bank Negara Indonesia"
  ctx.fillStyle = '#005E6A';
  ctx.font = '700 18px Arial, Helvetica, sans-serif';
  ctx.fillText('BANK NEGARA INDONESIA', 112, 126);
  ctx.restore();

  return {
    dataUrl: canvas.toDataURL('image/png'),
    width,
    height,
  };
}

/**
 * Menghasilkan logo BSI (Bank Syariah Indonesia) via Canvas 2D dengan warna korporat (#00A39D & #F9A01B).
 */
export function renderBsiLogoForPdf(): PreparedPdfImage | null {
  if (typeof document === 'undefined') return null;

  const width = 420;
  const height = 140;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.clearRect(0, 0, width, height);

  // Teal bold "BSI" wordmark
  ctx.save();
  ctx.fillStyle = '#00A39D';
  ctx.font = '900 92px Arial, Helvetica, sans-serif';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText('BSI', 24, 108);

  // Amber/Gold 4-point star top-right
  const cx = 232;
  const cy = 34;
  const outerR = 22;
  const innerR = 9;
  ctx.fillStyle = '#F9A01B';
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const r = i % 2 === 0 ? outerR : innerR;
    const angle = (i * Math.PI) / 4 - Math.PI / 8;
    const px = cx + Math.cos(angle) * r;
    const py = cy + Math.sin(angle) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#00A39D';
  ctx.font = '700 18px Arial, Helvetica, sans-serif';
  ctx.fillText('BANK SYARIAH INDONESIA', 26, 130);
  ctx.restore();

  return {
    dataUrl: canvas.toDataURL('image/png'),
    width,
    height,
  };
}

/**
 * Menghitung dimensi gambar proporsional agar pas di dalam kotak tanpa distorsi.
 */
export function fitImageInBox(
  naturalWidth: number,
  naturalHeight: number,
  maxWidth: number,
  maxHeight: number
): { width: number; height: number } {
  if (naturalWidth <= 0 || naturalHeight <= 0 || maxWidth <= 0 || maxHeight <= 0) {
    return { width: maxWidth, height: maxHeight };
  }
  const scale = Math.min(maxWidth / naturalWidth, maxHeight / naturalHeight);
  return {
    width: naturalWidth * scale,
    height: naturalHeight * scale,
  };
}

/**
 * Memuat aset WebP/PNG transparan (logo, stempel) dan mengekspornya sebagai PNG berkanal alfa.
 */
export async function prepareTransparentAssetForPdf(
  imageUrl: string,
  maxDimension = 640,
  alphaMultiplier = 1
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

        ctx.clearRect(0, 0, w, h);
        ctx.globalAlpha = Math.max(0, Math.min(1, alphaMultiplier));
        ctx.drawImage(img, 0, 0, w, h);
        ctx.globalAlpha = 1;

        resolve({
          dataUrl: canvas.toDataURL('image/png'),
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

export function getCachedWorkshopBrandPdfAssets(): WorkshopBrandPdfAssets | null {
  return cachedBrandAssets;
}

export async function loadWorkshopBrandPdfAssets(): Promise<WorkshopBrandPdfAssets> {
  if (cachedBrandAssets) {
    return cachedBrandAssets;
  }

  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return EMPTY_BRAND_ASSETS;
  }

  if (!pendingBrandAssetsPromise) {
    pendingBrandAssetsPromise = Promise.all([
      prepareTransparentAssetForPdf(WORKSHOP_BRAND_ASSETS.logoUrl, 260, 1),
      prepareTransparentAssetForPdf(WORKSHOP_BRAND_ASSETS.companyStampUrl, 420, 0.4),
      prepareTransparentAssetForPdf(WORKSHOP_BRAND_ASSETS.bniLogoUrl, 640, 1),
      prepareTransparentAssetForPdf(WORKSHOP_BRAND_ASSETS.bsiLogoUrl, 640, 1),
    ])
      .then(([logo, companyStamp, bniLogo, bsiLogo]) => {
        const result: WorkshopBrandPdfAssets = {
          logo,
          ownerSignature: null,
          companyStamp,
          bniLogo: bniLogo ?? renderBniLogoForPdf(),
          bsiLogo: bsiLogo ?? renderBsiLogoForPdf(),
        };
        cachedBrandAssets = result;
        return result;
      })
      .finally(() => {
        pendingBrandAssetsPromise = null;
      });
  }

  return pendingBrandAssetsPromise;
}

export function preloadWorkshopBrandPdfAssets(): void {
  if (typeof window === 'undefined' || cachedBrandAssets) return;
  void loadWorkshopBrandPdfAssets();
}

