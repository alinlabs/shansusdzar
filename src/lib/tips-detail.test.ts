import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_MATERIAL_SPECS } from './cms-defaults';
import { resolveTipsDetailEntry } from './tips-detail';

test('resolveTipsDetailEntry resolves material and finishing IDs cleanly and returns relatedMaterials', () => {
  const matDetail = resolveTipsDetailEntry('mat-pvc', DEFAULT_MATERIAL_SPECS);
  assert.ok(matDetail);
  assert.equal(matDetail.item.nama, 'PVC Board');
  assert.equal(matDetail.relatedMaterials.some((m) => m.id === 'mat-pvc'), false);
  assert.equal(matDetail.relatedMaterials.length, DEFAULT_MATERIAL_SPECS.length - 1);

  const finishDetail = resolveTipsDetailEntry('fin-hpl', DEFAULT_MATERIAL_SPECS);
  assert.ok(finishDetail);
  assert.equal(finishDetail.item.kategori, 'finishing');

  assert.equal(resolveTipsDetailEntry('tip-kitchen-area-basah', DEFAULT_MATERIAL_SPECS), null);
  assert.equal(resolveTipsDetailEntry('tidak-ada', DEFAULT_MATERIAL_SPECS), null);
  assert.equal(resolveTipsDetailEntry(undefined, DEFAULT_MATERIAL_SPECS), null);
});
