import { BUSINESS_CONFIG, buildWhatsAppUrl } from '../../lib/business-config';

export interface WhatsAppMessageParams {
  customerName: string;
  referenceCode: string;
  filename: string;
  totalLineCount: number;
  totalQuantity: number;
  mode: 'native-share' | 'manual-attach';
}

export type HandoffOutcome =
  | 'shared-sheet-completed'
  | 'share-cancelled'
  | 'whatsapp-fallback-opened'
  | 'popup-blocked';

export interface HandoffExecutionResult {
  outcome: HandoffOutcome;
  whatsappUrl: string;
  filename: string;
  downloadedPdf: boolean;
}

export interface ShareNavigatorLike {
  share?: (data: ShareData) => Promise<void>;
  canShare?: (data?: ShareData) => boolean;
}

export interface HandoffEnvironment {
  isSecureContext: boolean;
  navigator?: ShareNavigatorLike;
  downloadBlob: (blob: Blob, filename: string) => void;
  openWindow: (url: string) => Window | null | boolean;
}

/**
 * Builds a concise, privacy-conscious Indonesian message for WhatsApp handoff.
 * Intentionally excludes full street address, customer phone, and GPS coordinates
 * from URL text so personal details stay inside the attached PDF document.
 */
export function buildWhatsAppHandoffMessage(params: WhatsAppMessageParams): string {
  const safeName = params.customerName.trim() || 'Pelanggan';
  const lines = [
    `Halo ${BUSINESS_CONFIG.namaMerek},`,
    '',
    `Saya ${safeName} ingin membagikan ringkasan permintaan furniture & interior.`,
    `Referensi pesanan: ${params.referenceCode}`,
    `Ringkasan pilihan: ${params.totalLineCount} item (${params.totalQuantity} unit)`,
    '',
    params.mode === 'native-share'
      ? `Mohon tinjau dokumen PDF ringkasan (${params.filename}) yang terlampir pada pesan ini untuk konsultasi lebih lanjut.`
      : `Dokumen PDF ringkasan (${params.filename}) telah saya unduh di perangkat saya dan akan saya lampirkan secara manual di chat ini untuk ditinjau.`,
    '',
    'Terima kasih.',
  ];
  return lines.join('\n');
}

export function buildWhatsAppHandoffUrl(params: Omit<WhatsAppMessageParams, 'mode'>): string {
  const text = buildWhatsAppHandoffMessage({
    ...params,
    mode: 'manual-attach',
  });
  return buildWhatsAppUrl(text);
}

export function canUseNativeFileShare(
  file: File,
  nav: ShareNavigatorLike | undefined = typeof navigator !== 'undefined' ? navigator : undefined,
  isSecureContext: boolean = typeof window !== 'undefined' ? window.isSecureContext : false
): boolean {
  if (!isSecureContext || !nav) return false;
  if (typeof nav.share !== 'function' || typeof nav.canShare !== 'function') {
    return false;
  }
  try {
    return nav.canShare({ files: [file] }) === true;
  } catch {
    return false;
  }
}

export function triggerBlobDownload(blob: Blob, filename: string): void {
  if (typeof document === 'undefined' || typeof URL === 'undefined') return;
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = filename;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.setTimeout(() => {
    URL.revokeObjectURL(objectUrl);
  }, 1500);
}

function getDefaultHandoffEnvironment(): HandoffEnvironment {
  return {
    isSecureContext: typeof window !== 'undefined' ? window.isSecureContext : false,
    navigator: typeof navigator !== 'undefined' ? navigator : undefined,
    downloadBlob: triggerBlobDownload,
    openWindow: (url: string) => {
      if (typeof window === 'undefined') return null;
      return window.open(url, '_blank', 'noopener,noreferrer');
    },
  };
}

function isShareAbortError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const errName = 'name' in error ? String((error as { name?: unknown }).name) : '';
  return errName === 'AbortError';
}

export async function executeWhatsAppHandoff(
  params: {
    file: File;
    blob: Blob;
    filename: string;
    customerName: string;
    referenceCode: string;
    totalLineCount: number;
    totalQuantity: number;
  },
  env: HandoffEnvironment = getDefaultHandoffEnvironment()
): Promise<HandoffExecutionResult> {
  const whatsappUrl = buildWhatsAppHandoffUrl({
    customerName: params.customerName,
    referenceCode: params.referenceCode,
    filename: params.filename,
    totalLineCount: params.totalLineCount,
    totalQuantity: params.totalQuantity,
  });

  if (canUseNativeFileShare(params.file, env.navigator, env.isSecureContext) && env.navigator?.share) {
    const shareText = buildWhatsAppHandoffMessage({
      customerName: params.customerName,
      referenceCode: params.referenceCode,
      filename: params.filename,
      totalLineCount: params.totalLineCount,
      totalQuantity: params.totalQuantity,
      mode: 'native-share',
    });

    try {
      await env.navigator.share({
        files: [params.file],
        title: `Ringkasan Permintaan - ${BUSINESS_CONFIG.namaMerek}`,
        text: shareText,
      });

      return {
        outcome: 'shared-sheet-completed',
        whatsappUrl,
        filename: params.filename,
        downloadedPdf: false,
      };
    } catch (error) {
      if (isShareAbortError(error)) {
        return {
          outcome: 'share-cancelled',
          whatsappUrl,
          filename: params.filename,
          downloadedPdf: false,
        };
      }
      // Non-abort share error falls through honestly to download + WhatsApp URL fallback
    }
  }

  env.downloadBlob(params.blob, params.filename);
  const opened = env.openWindow(whatsappUrl);

  const isBlocked =
    !opened ||
    (typeof opened === 'object' && 'closed' in opened && Boolean(opened.closed));

  return {
    outcome: isBlocked ? 'popup-blocked' : 'whatsapp-fallback-opened',
    whatsappUrl,
    filename: params.filename,
    downloadedPdf: true,
  };
}
