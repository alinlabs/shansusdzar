import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CLIENT_REVIEWS_DEMO,
  PORTFOLIO_ITEMS,
  PROCESS_STEPS_DRAFT,
  getNextSlideIndex,
  getPrevSlideIndex,
  getVisibleCarouselWindow,
} from './utils';

test('PORTFOLIO_ITEMS and PROCESS_STEPS_DRAFT contain expected reference entries', () => {
  assert.equal(PORTFOLIO_ITEMS.length, 4);
  for (const item of PORTFOLIO_ITEMS) {
    assert.ok(item.judul.length > 0);
    assert.ok(item.gambarUtama.startsWith('/'));
  }
  assert.equal(PROCESS_STEPS_DRAFT.length, 4);
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
