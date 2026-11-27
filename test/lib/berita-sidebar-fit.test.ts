import assert from 'node:assert/strict';
import test from 'node:test';
import { computeFittingNewsCount } from '../../src/lib/berita-sidebar-fit.ts';

test('computeFittingNewsCount trims news list automatically when viewport is compact so items never clip', () => {
  // Laptop pendek (inner 540px): header+footer block = 320px, masing-masing item ~76px
  // 320 + 76*2 = 472 (muat), +76 = 548 (> 540, terpotong!) -> otomatis hanya tampilkan 2
  const count = computeFittingNewsCount({
    containerHeight: 540,
    fixedBlockHeight: 320,
    itemHeights: [76, 76, 76, 76, 76],
    minItems: 1,
  });

  assert.equal(count, 2);
});

test('computeFittingNewsCount shows more news items on standard laptop (720px) and tall desktop (900px)', () => {
  // Laptop 720px (inner 672px): fixed 320px -> sisa 352px -> muat 4 item (304px)
  const laptopCount = computeFittingNewsCount({
    containerHeight: 672,
    fixedBlockHeight: 320,
    itemHeights: [76, 76, 76, 76, 76],
    minItems: 1,
  });
  assert.equal(laptopCount, 4);

  // Desktop 900px (inner 852px): fixed 320px -> sisa 532px -> semua 5 item muat utuh
  const desktopCount = computeFittingNewsCount({
    containerHeight: 852,
    fixedBlockHeight: 320,
    itemHeights: [76, 76, 76, 76, 76],
    minItems: 1,
  });
  assert.equal(desktopCount, 5);
});

test('computeFittingNewsCount respects variable item heights and minItems clamp', () => {
  // Item ke-2 jauh lebih tinggi (110px) sehingga item ke-3 tidak muat di 560px
  const variableCount = computeFittingNewsCount({
    containerHeight: 560,
    fixedBlockHeight: 330,
    itemHeights: [78, 110, 82, 78],
    minItems: 1,
  });
  assert.equal(variableCount, 2);

  // Viewport sangat sempit: tetap jaga minimal 1 berita bila minItems=1
  const fallbackMin = computeFittingNewsCount({
    containerHeight: 350,
    fixedBlockHeight: 330,
    itemHeights: [80, 80, 80],
    minItems: 1,
  });
  assert.equal(fallbackMin, 1);
});

test('computeFittingNewsCount handles empty list or unmeasured zero container height safely', () => {
  assert.equal(
    computeFittingNewsCount({
      containerHeight: 700,
      fixedBlockHeight: 300,
      itemHeights: [],
    }),
    0
  );

  assert.equal(
    computeFittingNewsCount({
      containerHeight: 0,
      fixedBlockHeight: 300,
      itemHeights: [76, 76, 76],
    }),
    3
  );
});
