import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CLIENT_REVIEWS_DEMO,
  PORTFOLIO_ITEMS,
  PROCESS_STEPS_DRAFT,
  getNextSlideIndex,
  getPrevSlideIndex,
  getVisibleCarouselWindow,
  pickRandomProducts,
} from './utils';

test('PORTFOLIO_ITEMS and PROCESS_STEPS_DRAFT contain expected reference entries', () => {
  assert.equal(PORTFOLIO_ITEMS.length, 4);
  for (const item of PORTFOLIO_ITEMS) {
    assert.ok(item.judul.length > 0);
    assert.ok(item.gambarUtama.startsWith('/'));
  }
  assert.equal(PROCESS_STEPS_DRAFT.length, 6);
  assert.deepEqual(
    PROCESS_STEPS_DRAFT.map((s) => s.judul),
    ['Konsultasi', 'Survei', 'Design', 'DP (Uang Muka)', 'Produksi', 'Instalasi / Pemasangan']
  );
});

test('CLIENT_REVIEWS_DEMO has 5 rated review cards derived from portfolio projects', () => {
  assert.equal(CLIENT_REVIEWS_DEMO.length, 5);
  for (const review of CLIENT_REVIEWS_DEMO) {
    assert.ok(review.namaKlien.length > 0);
    assert.ok(review.komentar.length > 0);
    assert.ok(review.penilaian >= 1 && review.penilaian <= 5);
    assert.ok((review as { projectSlug?: string }).projectSlug);
  }
});

test('getVisibleCarouselWindow slides 3 desktop cards sequentially and wraps cleanly', () => {
  const cards = ['card 1', 'card 2', 'card 3', 'card 4', 'card 5'];

  assert.deepEqual(getVisibleCarouselWindow(cards, 0, 3), ['card 1', 'card 2', 'card 3']);
  assert.deepEqual(getVisibleCarouselWindow(cards, 1, 3), ['card 2', 'card 3', 'card 4']);
  assert.deepEqual(getVisibleCarouselWindow(cards, 2, 3), ['card 3', 'card 4', 'card 5']);
  assert.deepEqual(getVisibleCarouselWindow(cards, 3, 3), ['card 4', 'card 5', 'card 1']);
  assert.deepEqual(getVisibleCarouselWindow(cards, 4, 3), ['card 5', 'card 1', 'card 2']);

  const wrappedNext = getNextSlideIndex(4, cards.length);
  assert.equal(wrappedNext, 0);
  assert.deepEqual(getVisibleCarouselWindow(cards, wrappedNext, 3), [
    'card 1',
    'card 2',
    'card 3',
  ]);
  assert.equal(getPrevSlideIndex(0, cards.length), 4);
});

test('pickRandomProducts selects unique random items up to requested count and refreshes order', () => {
  const source = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8', 'p9', 'p10'];

  const pickedA = pickRandomProducts(source, 7, () => 0.15);
  const pickedB = pickRandomProducts(source, 7, () => 0.85);

  assert.equal(pickedA.length, 7);
  assert.equal(new Set(pickedA).size, 7);
  assert.equal(pickedB.length, 7);
  assert.equal(new Set(pickedB).size, 7);
  assert.notDeepEqual(pickedA, pickedB);

  assert.deepEqual(pickRandomProducts([], 7), []);
  assert.equal(pickRandomProducts(['a', 'b'], 7).length, 2);
});
