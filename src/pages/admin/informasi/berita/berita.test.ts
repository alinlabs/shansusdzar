import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createEmptyNewsDraft,
  normalizeNewsFromDraft,
  toNewsFormDraft,
  validateNewsDraft,
} from './logic';

test('validateNewsDraft checks title, category, excerpt, and bodyText', () => {
  const empty = createEmptyNewsDraft('Aisyah');
  const invalid = validateNewsDraft(empty);
  assert.equal(invalid.valid, false);
  assert.ok(invalid.fieldErrors.judul);
  assert.ok(invalid.fieldErrors.ringkasan);
  assert.ok(invalid.fieldErrors.bodyText);

  const valid = validateNewsDraft({
    ...empty,
    judul: 'Tips Memilih Multipleks Dapur',
    ringkasan: 'Panduan memilih papan inti tahan lembap.',
    bodyText: 'Paragraf pertama.\n\nParagraf kedua.',
  });
  assert.equal(valid.valid, true);
});

test('normalizeNewsFromDraft parses paragraphs, keywords, and fallback SEO metadata', () => {
  const draft = {
    ...createEmptyNewsDraft('Tim Studio'),
    judul: 'Panduan Kitchen Set Minimalis',
    ringkasan: 'Tips desain dapur modern hemat ruang.',
    bodyText: 'Paragraf 1 sangat informatif.\n\nParagraf 2 menjelaskan finishing HPL.',
    keywordsText: 'kitchen set, purwakarta, hpl',
  };
  const normalized = normalizeNewsFromDraft(draft, 'Shansusdzar Indonesia');
  assert.equal(normalized.slug, 'panduan-kitchen-set-minimalis');
  assert.equal(normalized.paragrafKonten.length, 2);
  assert.deepEqual(normalized.kataKunciSeo, ['kitchen set', 'purwakarta', 'hpl']);
  assert.equal(normalized.judulSeo, 'Panduan Kitchen Set Minimalis | Shansusdzar Indonesia');

  const roundTrip = toNewsFormDraft(normalized);
  assert.equal(roundTrip.keywordsText, 'kitchen set, purwakarta, hpl');
});
