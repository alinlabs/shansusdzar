import test from 'node:test';
import assert from 'node:assert/strict';
import marketingContactsData from '../../../../data/kontak-marketing.json';
import projectInvoicesData from '../../../../data/invoice-proyek.json';
import cooperationAgreementsData from '../../../../data/dokumen-spks.json';
import type { CooperationAgreementDocument } from '../../../../types/documents';
import type { ProjectInvoice } from '../../../../types/finance';
import type { MarketingContact } from '../../../../types/marketing';
import {
  buildBccMailtoBatches,
  buildMarketingContactsCsv,
  buildPersonalMailtoUrl,
  buildWhatsAppBroadcastUrl,
  createEmptyContactDraft,
  filterMarketingContacts,
  interpolateMarketingTemplate,
  normalizeContactFromDraft,
  normalizeWhatsAppDigits,
  parseCsvContactsInput,
  syncContactsFromWorkshopRecords,
  validateContactDraft,
} from './logic';

const SEED_CONTACTS = marketingContactsData as MarketingContact[];

test('normalizeWhatsAppDigits converts local 08 and +62 numbers to clean 62 format', () => {
  assert.equal(normalizeWhatsAppDigits('0812-8490-3312'), '6281284903312');
  assert.equal(normalizeWhatsAppDigits('+62 857-9718-4059'), '6285797184059');
  assert.equal(normalizeWhatsAppDigits('81390215540'), '6281390215540');
});

test('interpolateMarketingTemplate and buildWhatsAppBroadcastUrl personalize messages cleanly', () => {
  const contact = SEED_CONTACTS[0];
  const msg = interpolateMarketingTemplate(
    'Halo {nama} dari {perusahaan} di {kota} ({segmen})',
    contact
  );
  assert.equal(
    msg,
    'Halo Raka Pratama dari Hunian Griya Asri di Purwakarta (Klien Selesai)'
  );

  const waUrl = buildWhatsAppBroadcastUrl(contact, msg);
  assert.ok(waUrl.startsWith('https://wa.me/6281284903312?text='));
  assert.ok(waUrl.includes('Raka%20Pratama'));
});

test('buildPersonalMailtoUrl and buildBccMailtoBatches split email lists safely', () => {
  const single = buildPersonalMailtoUrl('client@example.id', 'Halo', 'Isi pesan');
  assert.ok(single.startsWith('mailto:client@example.id?'));
  assert.ok(single.includes('subject=Halo'));

  const emails = Array.from({ length: 25 }, (_, i) => `user${i + 1}@example.id`);
  const batches = buildBccMailtoBatches(emails, 'Promo Workshop', 'Detail promo', 'admin@sdi.id', 20);
  assert.equal(batches.length, 2);
  assert.equal(batches[0].emails.length, 20);
  assert.equal(batches[1].emails.length, 5);
  assert.ok(batches[0].mailtoUrl.startsWith('mailto:admin@sdi.id?bcc='));
});

test('validateContactDraft and normalizeContactFromDraft validate required channels and clean payload', () => {
  const empty = createEmptyContactDraft();
  const invalidRes = validateContactDraft(empty);
  assert.equal(invalidRes.valid, false);
  assert.ok(invalidRes.fieldErrors.name);
  assert.ok(invalidRes.fieldErrors.phone);

  const draft = {
    ...empty,
    name: '  Dewi Lestari  ',
    phone: '0812-3456-7890',
    email: 'DEWI@EXAMPLE.ID',
    tagsText: 'kitchen-set, hpl, kitchen-set',
  };
  assert.equal(validateContactDraft(draft).valid, true);

  const normalized = normalizeContactFromDraft(draft);
  assert.equal(normalized.nama, 'Dewi Lestari');
  assert.equal(normalized.teleponTerstandar, '6281234567890');
  assert.equal(normalized.email, 'dewi@example.id');
  assert.deepEqual(normalized.labelTag, ['kitchen-set', 'hpl']);
});

test('filterMarketingContacts filters by segment, channel, and search query', () => {
  const architects = filterMarketingContacts(SEED_CONTACTS, {
    segment: 'Arsitek & Desainer',
  });
  assert.equal(architects.length, 1);
  assert.equal(architects[0].nama, 'Ar. Bagus Santoso');

  const emailReady = filterMarketingContacts(SEED_CONTACTS, {
    channel: 'email',
    search: 'subang',
  });
  assert.equal(emailReady.length, 1);
  assert.equal(emailReady[0].kota, 'Subang');
});

test('syncContactsFromWorkshopRecords deduplicates existing clients and imports new ones', () => {
  const invoices = projectInvoicesData as ProjectInvoice[];
  const agreements = cooperationAgreementsData as CooperationAgreementDocument[];
  const res = syncContactsFromWorkshopRecords([], invoices, agreements);
  assert.ok(res.imported.length >= 1);

  const secondPass = syncContactsFromWorkshopRecords(res.imported, invoices, agreements);
  assert.equal(secondPass.imported.length, 0);
  assert.ok(secondPass.skippedCount >= 1);
});

test('parseCsvContactsInput and buildMarketingContactsCsv handle CSV import/export safely', () => {
  const csv = buildMarketingContactsCsv(SEED_CONTACTS.slice(0, 2));
  assert.ok(csv.includes('Raka Pratama'));

  const parsed = parseCsvContactsInput(
    'Nama,WhatsApp,Email,Kota,Segmen\nBudi Santoso,081299988877,budi@example.id,Bandung,Prospek Baru\nRaka Pratama,081284903312,raka.pratama@example.co.id,Purwakarta,Klien Selesai',
    SEED_CONTACTS
  );
  assert.equal(parsed.imported.length, 1);
  assert.equal(parsed.imported[0].nama, 'Budi Santoso');
  assert.equal(parsed.imported[0].teleponTerstandar, '6281299988877');
  assert.equal(parsed.skippedCount, 1);
});
