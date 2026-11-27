import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildWhatsAppHandoffMessage,
  buildWhatsAppHandoffUrl,
  canUseNativeFileShare,
  executeWhatsAppHandoff,
} from '../../../src/pages/pesanan/whatsapp-handoff';

function createDummyPdfFile(filename = 'ringkasan-draf.pdf'): File {
  const blob = new Blob(['%PDF-1.4\n%test'], { type: 'application/pdf' });
  return new File([blob], filename, { type: 'application/pdf' });
}

test('buildWhatsAppHandoffMessage includes customer name, reference code, and honest attachment text without leaking PII', () => {
  const msg = buildWhatsAppHandoffMessage({
    customerName: 'Ibu Sari Wulandari',
    referenceCode: 'DRAF-SZ-20261118-1600-1234',
    filename: 'ringkasan-permintaan-draf-sz-20261118-1600-1234.pdf',
    totalLineCount: 3,
    totalQuantity: 5,
    mode: 'manual-attach',
  });

  assert.ok(msg.includes('Ibu Sari Wulandari'));
  assert.ok(msg.includes('DRAF-SZ-20261118-1600-1234'));
  assert.ok(msg.includes('3 item (5 unit)'));
  assert.ok(msg.includes('lampirkan secara manual'));
  assert.equal(msg.includes('Jl. Veteran'), false);
  assert.equal(msg.includes('0857'), false);
});

test('buildWhatsAppHandoffUrl targets exact Shansusdzar WhatsApp destination with encoded text', () => {
  const url = buildWhatsAppHandoffUrl({
    customerName: 'Budi Santoso',
    referenceCode: 'DRAF-SZ-1',
    filename: 'ringkasan.pdf',
    totalLineCount: 1,
    totalQuantity: 2,
  });

  assert.ok(url.startsWith('https://wa.me/6281315000234?text='));
  assert.ok(decodeURIComponent(url).includes('Budi Santoso'));
});

test('canUseNativeFileShare detects secure context and files support safely', () => {
  const file = createDummyPdfFile();

  assert.equal(canUseNativeFileShare(file, { share: async () => {}, canShare: () => true }, false), false);
  assert.equal(canUseNativeFileShare(file, { share: async () => {} }, true), false);
  assert.equal(canUseNativeFileShare(file, { share: async () => {}, canShare: () => false }, true), false);
  assert.equal(
    canUseNativeFileShare(
      file,
      {
        share: async () => {},
        canShare: () => {
          throw new TypeError('Unsupported');
        },
      },
      true
    ),
    false
  );
  assert.equal(canUseNativeFileShare(file, { share: async () => {}, canShare: () => true }, true), true);
});

test('executeWhatsAppHandoff uses native Web Share when supported and keeps fallback idle', async () => {
  const file = createDummyPdfFile();
  let sharedArgs: ShareData | null = null;
  let downloaded = false;
  let openedUrl: string | null = null;

  const result = await executeWhatsAppHandoff(
    {
      file,
      blob: file,
      filename: file.name,
      customerName: 'Sari',
      referenceCode: 'DRAF-SZ-100',
      totalLineCount: 2,
      totalQuantity: 3,
    },
    {
      isSecureContext: true,
      navigator: {
        canShare: () => true,
        share: async (data) => {
          sharedArgs = data;
        },
      },
      downloadBlob: () => {
        downloaded = true;
      },
      openWindow: (url) => {
        openedUrl = url;
        return true;
      },
    }
  );

  assert.equal(result.outcome, 'shared-sheet-completed');
  assert.equal(result.downloadedPdf, false);
  assert.equal(downloaded, false);
  assert.equal(openedUrl, null);
  assert.ok(sharedArgs && Array.isArray((sharedArgs as ShareData).files));
});

test('executeWhatsAppHandoff handles native share AbortError gracefully without forcing fallback', async () => {
  const file = createDummyPdfFile();
  let downloaded = false;

  const result = await executeWhatsAppHandoff(
    {
      file,
      blob: file,
      filename: file.name,
      customerName: 'Sari',
      referenceCode: 'DRAF-SZ-101',
      totalLineCount: 1,
      totalQuantity: 1,
    },
    {
      isSecureContext: true,
      navigator: {
        canShare: () => true,
        share: async () => {
          const err = new Error('User cancelled');
          err.name = 'AbortError';
          throw err;
        },
      },
      downloadBlob: () => {
        downloaded = true;
      },
      openWindow: () => true,
    }
  );

  assert.equal(result.outcome, 'share-cancelled');
  assert.equal(result.downloadedPdf, false);
  assert.equal(downloaded, false);
});

test('executeWhatsAppHandoff falls back to download + WhatsApp when unsupported or non-abort error occurs, and flags blocked popups', async () => {
  const file = createDummyPdfFile('draf-desktop.pdf');
  const events: string[] = [];

  const openedResult = await executeWhatsAppHandoff(
    {
      file,
      blob: file,
      filename: file.name,
      customerName: 'Andi',
      referenceCode: 'DRAF-SZ-102',
      totalLineCount: 1,
      totalQuantity: 2,
    },
    {
      isSecureContext: true,
      navigator: {
        canShare: () => false,
        share: async () => {},
      },
      downloadBlob: (_blob, filename) => {
        events.push(`download:${filename}`);
      },
      openWindow: (url) => {
        events.push(`open:${url.startsWith('https://wa.me/6281315000234?text=')}`);
        return true;
      },
    }
  );

  assert.equal(openedResult.outcome, 'whatsapp-fallback-opened');
  assert.equal(openedResult.downloadedPdf, true);
  assert.deepEqual(events, [
    'download:draf-desktop.pdf',
    'open:true',
  ]);

  const blockedResult = await executeWhatsAppHandoff(
    {
      file,
      blob: file,
      filename: file.name,
      customerName: 'Andi',
      referenceCode: 'DRAF-SZ-103',
      totalLineCount: 1,
      totalQuantity: 2,
    },
    {
      isSecureContext: true,
      navigator: {
        canShare: () => true,
        share: async () => {
          throw new Error('NotAllowedError');
        },
      },
      downloadBlob: () => {},
      openWindow: () => null,
    }
  );

  assert.equal(blockedResult.outcome, 'popup-blocked');
  assert.equal(blockedResult.downloadedPdf, true);
});
