import assert from 'node:assert/strict';
import test from 'node:test';
import { DEFAULT_NEWS_ARTICLES } from '../../../../../src/lib/cms-defaults';
import {
  createEmptyImageContentBlock,
  createEmptyNewsDraft,
  createEmptyTextContentBlock,
  getNewsSlug,
  normalizeNewsFromDraft,
  toNewsFormDraft,
  validateNewsDraft,
} from '../../../../../src/pages/admin/informasi/berita/logic';

test('createEmptyNewsDraft generates sequential news-000 ID without slug or terbit fields', () => {
  const empty = createEmptyNewsDraft(DEFAULT_NEWS_ARTICLES);
  assert.match(empty.id, /^news-\d{3}$/);
  assert.equal(empty.id, 'news-010');
  assert.equal('slug' in empty, false);
  assert.equal('terbit' in empty, false);
  assert.equal(empty.isi.length, 1);
  assert.equal(empty.isi[0].jenis, 'teks');
});

test('validateNewsDraft checks title, duplicate slug, category, excerpt, and structured isi blocks', () => {
  const empty = createEmptyNewsDraft(DEFAULT_NEWS_ARTICLES);
  const invalid = validateNewsDraft(empty, DEFAULT_NEWS_ARTICLES);
  assert.equal(invalid.valid, false);
  assert.ok(invalid.fieldErrors.judul);
  assert.ok(invalid.fieldErrors.ringkasan);
  assert.ok(invalid.fieldErrors['isi.0']);

  const duplicateTitle = validateNewsDraft(
    {
      ...empty,
      judul: DEFAULT_NEWS_ARTICLES[0].judul,
      ringkasan: 'Ringkasan valid.',
      isi: [createEmptyTextContentBlock('Isi paragraf valid.')],
    },
    DEFAULT_NEWS_ARTICLES
  );
  assert.equal(duplicateTitle.valid, false);
  assert.ok(duplicateTitle.fieldErrors.judul);

  const invalidImageBlock = validateNewsDraft(
    {
      ...empty,
      judul: 'Tips Memilih Multipleks Dapur',
      ringkasan: 'Panduan memilih papan inti tahan lembap.',
      isi: [
        createEmptyTextContentBlock('Paragraf pembuka valid.'),
        createEmptyImageContentBlock(['javascript:alert(1)']),
      ],
    },
    DEFAULT_NEWS_ARTICLES
  );
  assert.equal(invalidImageBlock.valid, false);
  assert.ok(invalidImageBlock.fieldErrors['isi.1']);

  const valid = validateNewsDraft(
    {
      ...empty,
      judul: 'Tips Memilih Multipleks Dapur',
      ringkasan: 'Panduan memilih papan inti tahan lembap.',
      isi: [
        createEmptyTextContentBlock('Paragraf pertama.'),
        createEmptyImageContentBlock(['/sample-produk/gambar/kitchen-set-detail.webp']),
        {
          jenis: 'teks',
          isi: 'Subjudul Pengujian',
          format: { gaya: 'subjudul', rata: 'left' },
        },
      ],
    },
    DEFAULT_NEWS_ARTICLES
  );
  assert.equal(valid.valid, true);
});

test('normalizeNewsFromDraft preserves structured isi block order and computes slug dynamically', () => {
  const draft = {
    ...createEmptyNewsDraft(DEFAULT_NEWS_ARTICLES),
    judul: 'Panduan Kitchen Set Minimalis',
    ringkasan: 'Tips desain dapur modern hemat ruang.',
    isi: [
      createEmptyTextContentBlock('Paragraf 1 sangat informatif.'),
      createEmptyImageContentBlock(['/sample-produk/gambar/kitchen-set-detail.webp']),
      {
        jenis: 'teks' as const,
        isi: 'Kutipan penting workshop.',
        format: { gaya: 'kutipan' as const, rata: 'left' as const },
      },
    ],
    keywordsText: 'kitchen set, purwakarta, hpl',
  };

  const normalized = normalizeNewsFromDraft(draft, 'Shansus Dzar Indonesia', DEFAULT_NEWS_ARTICLES);
  const raw = normalized as unknown as Record<string, unknown>;
  assert.equal('slug' in raw, false);
  assert.equal('terbit' in raw, false);
  assert.equal('paragrafKonten' in raw, false);
  assert.equal(normalized.id, 'news-010');
  assert.equal(getNewsSlug(normalized), 'panduan-kitchen-set-minimalis');
  assert.equal(normalized.isi.length, 3);
  assert.equal(normalized.isi[0].jenis, 'teks');
  assert.equal(normalized.isi[1].jenis, 'gambar');
  assert.equal(normalized.isi[2].jenis, 'teks');
  assert.equal(normalized.isi[2].format.gaya, 'kutipan');
  assert.deepEqual(normalized.kataKunciSeo, ['kitchen set', 'purwakarta', 'hpl']);
  assert.equal(normalized.judulSeo, 'Panduan Kitchen Set Minimalis | Shansus Dzar Indonesia');

  const roundTrip = toNewsFormDraft(normalized);
  assert.equal(roundTrip.keywordsText, 'kitchen set, purwakarta, hpl');
  assert.equal(roundTrip.isi.length, 3);
});
