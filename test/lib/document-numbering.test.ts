import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatClientCode,
  formatTerminDocumentNumber,
  formatWorkshopDocumentNumber,
  isSpkDocumentNumber,
  migrateLegacyProjectId,
  resolveNextClientCode,
  resolveNextClientSequence,
  resolveProjectClientDigits,
  resolveProjectIdFromClientCode,
  sanitizeNumberForFilename,
  toRomanMonth,
} from '../../src/lib/document-numbering';

test('Roman month conversion covers all 12 months accurately', () => {
  assert.equal(toRomanMonth(1), 'I');
  assert.equal(toRomanMonth(9), 'IX');
  assert.equal(toRomanMonth(10), 'X');
  assert.equal(toRomanMonth(11), 'XI');
  assert.equal(toRomanMonth(12), 'XII');
});

test('resolveNextClientCode assigns K-008 when 7 clients exist and advances to K-009', () => {
  const sevenClients = [
    { kodeKlien: 'K-001' },
    { kodeKlien: 'K-002' },
    { kodeKlien: 'K-003' },
    { kodeKlien: 'K-004' },
    { kodeKlien: 'K-005' },
    { kodeKlien: 'K-006' },
    { kodeKlien: 'K-007' },
  ];
  assert.equal(resolveNextClientSequence(sevenClients), 8);
  assert.equal(resolveNextClientCode(sevenClients), 'K-008');

  // Even if contacts array lacks kodeKlien, count still yields 8
  assert.equal(resolveNextClientCode(Array.from({ length: 7 }, () => ({}))), 'K-008');

  // When 8th client exists in contacts or projects, next is K-009
  assert.equal(resolveNextClientCode([...sevenClients, { kodeKlien: 'K-008' }]), 'K-009');
  assert.equal(resolveNextClientCode(sevenClients, [{ id: 'K-008' }]), 'K-009');
});

test('formatWorkshopDocumentNumber formats all document types by creation date and client number without K', () => {
  const dateIso = '2026-11-26T08:00:00.000Z';
  assert.equal(
    formatWorkshopDocumentNumber('QUO', { clientCodeOrSeq: 'K-008', date: dateIso }),
    'QUO/SDI-K/008/XI/2026'
  );
  assert.equal(
    formatWorkshopDocumentNumber('SPK', { clientCodeOrSeq: 'K-008', date: dateIso }),
    'SPK/SDI-K/008/XI/2026'
  );
  assert.equal(
    formatWorkshopDocumentNumber('SJI', { clientCodeOrSeq: 'K-008', date: dateIso }),
    'SJI/SDI-K/008/XI/2026'
  );
  assert.equal(
    formatWorkshopDocumentNumber('BST', { clientCodeOrSeq: 'K-008', date: dateIso }),
    'BST/SDI-K/008/XI/2026'
  );
  assert.equal(
    formatWorkshopDocumentNumber('INV', { clientCodeOrSeq: 'K-008', date: dateIso }),
    'INV/SDI-K/008/XI/2026'
  );

  // Month boundary check (UTC midnight start of month remains XI)
  assert.equal(
    formatWorkshopDocumentNumber('QUO', { clientCodeOrSeq: 8, date: '2026-11-01T00:00:00.000Z' }),
    'QUO/SDI-K/008/XI/2026'
  );
});

test('formatTerminDocumentNumber formats INV-T1..T4 preserving client/month/year segments', () => {
  const baseInvoice = 'INV/SDI-K/008/XI/2026';
  assert.equal(formatTerminDocumentNumber(baseInvoice, 0), 'INV-T1/SDI-K/008/XI/2026');
  assert.equal(formatTerminDocumentNumber(baseInvoice, 1), 'INV-T2/SDI-K/008/XI/2026');
  assert.equal(formatTerminDocumentNumber(baseInvoice, 2), 'INV-T3/SDI-K/008/XI/2026');
  assert.equal(formatTerminDocumentNumber(baseInvoice, 3), 'INV-T4/SDI-K/008/XI/2026');
});

test('helper utilities handle SPK prefixes, client code resolution, and filenames', () => {
  assert.equal(formatClientCode(8), 'K-008');
  assert.equal(resolveProjectClientDigits({ id: 'K-008' }), '008');
  assert.equal(resolveProjectClientDigits({ id: 'prj-005' }), '005');
  assert.equal(isSpkDocumentNumber('SPK/SDI-K/008/XI/2026'), true);
  assert.equal(isSpkDocumentNumber('SPKS-SDI-2026-001'), true);
  assert.equal(isSpkDocumentNumber('QUO/SDI-K/008/XI/2026'), false);
  assert.equal(sanitizeNumberForFilename('INV/SDI-K/008/XI/2026'), 'inv-sdi-k-008-xi-2026');
  assert.equal(resolveProjectIdFromClientCode('K-008', [{ id: 'K-001' }]), 'K-008');
  assert.equal(resolveProjectIdFromClientCode('K-001', [{ id: 'K-001' }]), 'K-001-2');
  assert.equal(
    resolveProjectIdFromClientCode('K-001', [{ id: 'K-001' }, { id: 'K-001-2' }]),
    'K-001-3'
  );
  assert.equal(migrateLegacyProjectId('prj-001'), 'K-003');
  assert.equal(migrateLegacyProjectId('K-008'), 'K-008');
});
