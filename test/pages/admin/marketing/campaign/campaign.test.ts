import assert from 'node:assert/strict';
import test from 'node:test';
import marketingContactsData from '../../../../../src/data/kontak-marketing.json';
import type { MarketingContact } from '../../../../../src/types/marketing';
import {
  createEmptyCampaignDraft,
  normalizeCampaignFromDraft,
  resolveCampaignRecipients,
  toCampaignFormDraft,
  validateCampaignDraft,
} from '../../../../../src/pages/admin/marketing/campaign/logic';

const CONTACTS = marketingContactsData as MarketingContact[];

test('validateCampaignDraft enforces title, channel selection, and channel bodies', () => {
  const empty = createEmptyCampaignDraft();
  const missingTitle = validateCampaignDraft(empty);
  assert.equal(missingTitle.valid, false);
  assert.ok(missingTitle.fieldErrors.title);

  const noChannels = validateCampaignDraft({
    ...empty,
    title: 'Promo Akhir Tahun',
    enableWhatsApp: false,
    enableEmail: false,
  });
  assert.equal(noChannels.valid, false);
  assert.ok(noChannels.fieldErrors.enableWhatsApp);

  const validBoth = validateCampaignDraft({
    ...empty,
    title: 'Promo Survei Desember',
  });
  assert.equal(validBoth.valid, true);
});

test('normalizeCampaignFromDraft and toCampaignFormDraft preserve round-trip channels & segments', () => {
  const draft = {
    ...createEmptyCampaignDraft('marketing@shansusdzar.id'),
    title: '  Penawaran Kabinet Kantor ',
    targetSegments: ['Korporat / Komersial', 'Arsitek & Desainer'] as const,
    enableWhatsApp: true,
    enableEmail: true,
  };

  const normalized = normalizeCampaignFromDraft({
    ...draft,
    targetSegments: [...draft.targetSegments],
  });
  assert.equal(normalized.judul, 'Penawaran Kabinet Kantor');
  assert.deepEqual(normalized.saluran, ['whatsapp', 'email']);
  assert.deepEqual(normalized.targetSegmen, ['Korporat / Komersial', 'Arsitek & Desainer']);

  const roundTrip = toCampaignFormDraft(normalized);
  assert.equal(roundTrip.enableWhatsApp, true);
  assert.equal(roundTrip.enableEmail, true);
  assert.equal(roundTrip.replyToEmail, 'marketing@shansusdzar.id');
});

test('resolveCampaignRecipients scopes targets by campaign segments and channel readiness', () => {
  const campaign = normalizeCampaignFromDraft({
    ...createEmptyCampaignDraft(),
    title: 'Target Prospek Baru',
    targetSegments: ['Prospek Baru'],
  });

  const waRecipients = resolveCampaignRecipients(campaign, CONTACTS, 'whatsapp');
  assert.equal(waRecipients.length, 1);
  assert.equal(waRecipients[0].nama, 'Siti Rahmawati');

  const allContactsEmail = resolveCampaignRecipients(campaign, CONTACTS, 'email', {
    segmentOverride: 'all',
  });
  assert.equal(allContactsEmail.length, CONTACTS.length);
});
