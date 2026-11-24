import test from 'node:test';
import assert from 'node:assert/strict';
import { computeFloatingThumbMetrics, computeScrollTopFromTrackY } from './floating-scrollbar';

test('computeFloatingThumbMetrics returns non-scrollable when content fits viewport', () => {
  assert.deepEqual(
    computeFloatingThumbMetrics({
      scrollTop: 0,
      scrollHeight: 600,
      clientHeight: 600,
      trackHeight: 600,
    }),
    {
      scrollable: false,
      thumbHeight: 0,
      thumbOffset: 0,
      progress: 0,
    }
  );
});

test('computeFloatingThumbMetrics computes proportional thumb size and offset across scroll progress', () => {
  const start = computeFloatingThumbMetrics({
    scrollTop: 0,
    scrollHeight: 2000,
    clientHeight: 500,
    trackHeight: 500,
    edgeInset: 6,
  });
  assert.equal(start.scrollable, true);
  assert.equal(start.progress, 0);
  assert.equal(start.thumbOffset, 6);
  // usableTrack = 488; 500/2000 * 488 = 122
  assert.equal(start.thumbHeight, 122);

  const mid = computeFloatingThumbMetrics({
    scrollTop: 750,
    scrollHeight: 2000,
    clientHeight: 500,
    trackHeight: 500,
    edgeInset: 6,
  });
  assert.equal(mid.progress, 0.5);
  assert.equal(mid.thumbOffset, 6 + (488 - 122) * 0.5);

  const end = computeFloatingThumbMetrics({
    scrollTop: 1500,
    scrollHeight: 2000,
    clientHeight: 500,
    trackHeight: 500,
    edgeInset: 6,
  });
  assert.equal(end.progress, 1);
  assert.equal(end.thumbOffset, 6 + (488 - 122));
});

test('computeFloatingThumbMetrics enforces minimum thumb height on very long documents', () => {
  const metrics = computeFloatingThumbMetrics({
    scrollTop: 0,
    scrollHeight: 50000,
    clientHeight: 500,
    trackHeight: 500,
    minThumbHeight: 40,
    edgeInset: 6,
  });
  assert.equal(metrics.scrollable, true);
  assert.equal(metrics.thumbHeight, 40);
});

test('computeScrollTopFromTrackY maps pointer drag Y back to accurate scrollTop', () => {
  const atStart = computeScrollTopFromTrackY({
    pointerY: 0,
    trackTop: 0,
    trackHeight: 500,
    thumbHeight: 122,
    scrollHeight: 2000,
    clientHeight: 500,
    grabOffsetRatio: 0.5,
    edgeInset: 6,
  });
  assert.equal(atStart, 0);

  const atMiddle = computeScrollTopFromTrackY({
    pointerY: 250,
    trackTop: 100,
    trackHeight: 500,
    thumbHeight: 122,
    scrollHeight: 2000,
    clientHeight: 500,
    grabOffsetRatio: 0.5,
    edgeInset: 6,
  });
  // Center of track (100 + 250 = 350) would be mid; pointerY=250 -> 150 - 6 - 61 = 83; maxTravel=366 -> 83/366 * 1500 = 340
  assert.equal(atMiddle, 340);

  const atEnd = computeScrollTopFromTrackY({
    pointerY: 999,
    trackTop: 0,
    trackHeight: 500,
    thumbHeight: 122,
    scrollHeight: 2000,
    clientHeight: 500,
    grabOffsetRatio: 0.5,
    edgeInset: 6,
  });
  assert.equal(atEnd, 1500);
});
