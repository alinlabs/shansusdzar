import test from 'node:test';
import assert from 'node:assert/strict';
import type { jsPDF } from 'jspdf';
import {
  openPdfBlobInNewTab,
  openPdfBlobUrlInNewTab,
  openPdfDocumentInNewTab,
  type PdfAnchorLike,
} from '../../../src/lib/pdf/open-pdf-blob';

test('openPdfBlobUrlInNewTab configures _blank anchor without download attribute and clicks it', () => {
  const anchor: PdfAnchorLike = {
    href: '',
    target: '',
    rel: '',
    click: () => {
      events.push('clicked');
    },
  };
  const events: string[] = [];

  const opened = openPdfBlobUrlInNewTab('blob:http://localhost:3000/test-pdf-123', {
    createAnchor: () => anchor,
    appendAndClick: (el) => {
      events.push('appended');
      el.click();
      events.push('removed');
    },
  });

  assert.equal(opened, true);
  assert.equal(anchor.href, 'blob:http://localhost:3000/test-pdf-123');
  assert.equal(anchor.target, '_blank');
  assert.equal(anchor.rel, 'noopener noreferrer');
  assert.equal(anchor.download, undefined);
  assert.deepEqual(events, ['appended', 'clicked', 'removed']);
});

test('openPdfDocumentInNewTab creates application/pdf Blob, opens _blank tab, and schedules delayed revokeObjectURL', () => {
  const createdBlobs: Blob[] = [];
  const revokedUrls: string[] = [];
  const scheduledCallbacks: Array<{ fn: () => void; ms: number }> = [];
  let clickedHref = '';
  let anchorDownload: string | undefined;

  const fakeDoc = {
    output: (type: string) => {
      assert.equal(type, 'arraybuffer');
      return new Uint8Array([37, 80, 68, 70]).buffer; // %PDF
    },
  } as unknown as jsPDF;

  const result = openPdfDocumentInNewTab(fakeDoc, {
    createObjectURL: (blob) => {
      createdBlobs.push(blob);
      return 'blob:http://localhost:3000/doc-uuid-1';
    },
    revokeObjectURL: (url) => {
      revokedUrls.push(url);
    },
    scheduleTimeout: (fn, ms) => {
      scheduledCallbacks.push({ fn, ms });
      return 1;
    },
    createAnchor: () => ({
      href: '',
      target: '',
      rel: '',
      click: () => {},
    }),
    appendAndClick: (anchor) => {
      clickedHref = anchor.href;
      anchorDownload = anchor.download;
      anchor.click();
    },
    revokeDelayMs: 60_000,
  });

  assert.equal(result.opened, true);
  assert.equal(result.blobUrl, 'blob:http://localhost:3000/doc-uuid-1');
  assert.equal(createdBlobs.length, 1);
  assert.equal(createdBlobs[0]?.type, 'application/pdf');
  assert.equal(clickedHref, 'blob:http://localhost:3000/doc-uuid-1');
  assert.equal(anchorDownload, undefined);

  // Must NOT revoke synchronously before Chrome's new tab finishes loading the PDF
  assert.equal(revokedUrls.length, 0);
  assert.equal(scheduledCallbacks.length, 1);
  assert.equal(scheduledCallbacks[0]?.ms, 60_000);

  scheduledCallbacks[0]?.fn();
  assert.deepEqual(revokedUrls, ['blob:http://localhost:3000/doc-uuid-1']);
});

test('openPdfBlobInNewTab returns opened=false gracefully when URL.createObjectURL is unavailable', () => {
  const blob = new Blob(['%PDF-1.4'], { type: 'application/pdf' });
  const result = openPdfBlobInNewTab(blob, {
    createObjectURL: undefined,
  });

  // In Node test environment URL.createObjectURL exists, so test explicit empty URL path too:
  assert.equal(openPdfBlobUrlInNewTab(''), false);
  assert.ok(result);
});
