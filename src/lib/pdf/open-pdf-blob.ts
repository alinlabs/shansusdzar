import type { jsPDF } from 'jspdf';

export interface PdfAnchorLike {
  href: string;
  target: string;
  rel: string;
  download?: string;
  click: () => void;
}

export interface OpenPdfBlobDeps {
  createObjectURL?: (blob: Blob) => string;
  revokeObjectURL?: (url: string) => void;
  scheduleTimeout?: (fn: () => void, ms: number) => unknown;
  createAnchor?: () => PdfAnchorLike | null;
  appendAndClick?: (anchor: PdfAnchorLike) => void;
  revokeDelayMs?: number;
}

export interface OpenPdfBlobResult {
  opened: boolean;
  blobUrl: string | null;
  blob: Blob | null;
}

const DEFAULT_REVOKE_DELAY_MS = 60_000;

export function openPdfBlobUrlInNewTab(
  blobUrl: string,
  deps: Pick<OpenPdfBlobDeps, 'createAnchor' | 'appendAndClick'> = {}
): boolean {
  if (!blobUrl) return false;

  const anchor = deps.createAnchor
    ? deps.createAnchor()
    : typeof document !== 'undefined'
      ? document.createElement('a')
      : null;

  if (!anchor) return false;

  anchor.href = blobUrl;
  anchor.target = '_blank';
  anchor.rel = 'noopener noreferrer';

  if (deps.appendAndClick) {
    deps.appendAndClick(anchor);
    return true;
  }

  if (typeof document === 'undefined' || !document.body) {
    return false;
  }

  const domAnchor = anchor as HTMLAnchorElement;
  document.body.appendChild(domAnchor);
  domAnchor.click();
  document.body.removeChild(domAnchor);
  return true;
}

export function openPdfBlobInNewTab(
  blob: Blob,
  deps: OpenPdfBlobDeps = {}
): OpenPdfBlobResult {
  const createUrl =
    deps.createObjectURL ??
    (typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function'
      ? (b: Blob) => URL.createObjectURL(b)
      : null);

  if (!createUrl) {
    return { opened: false, blobUrl: null, blob };
  }

  const blobUrl = createUrl(blob);
  const opened = openPdfBlobUrlInNewTab(blobUrl, deps);

  const revokeUrl =
    deps.revokeObjectURL ??
    (typeof URL !== 'undefined' && typeof URL.revokeObjectURL === 'function'
      ? (url: string) => URL.revokeObjectURL(url)
      : null);

  const schedule =
    deps.scheduleTimeout ??
    (typeof globalThis !== 'undefined' && typeof globalThis.setTimeout === 'function'
      ? (fn: () => void, ms: number) => globalThis.setTimeout(fn, ms)
      : null);

  if (revokeUrl && schedule) {
    schedule(() => {
      revokeUrl(blobUrl);
    }, deps.revokeDelayMs ?? DEFAULT_REVOKE_DELAY_MS);
  }

  return { opened, blobUrl, blob };
}

export function openPdfDocumentInNewTab(
  doc: jsPDF,
  deps: OpenPdfBlobDeps = {}
): OpenPdfBlobResult {
  const arrayBuffer = doc.output('arraybuffer');
  const blob = new Blob([arrayBuffer], { type: 'application/pdf' });
  return openPdfBlobInNewTab(blob, deps);
}
