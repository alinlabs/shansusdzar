import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildSocialPlansCsv,
  createEmptySocialPlan,
  normalizeSocialPlanPayload,
  validateSocialPlanDraft,
} from './logic';

test('validateSocialPlanDraft validates title and scheduledDate', () => {
  const empty = createEmptySocialPlan();
  const invalid = validateSocialPlanDraft(empty);
  assert.equal(invalid.valid, false);
  assert.ok(invalid.fieldErrors.judul);

  const ok = validateSocialPlanDraft({ ...empty, judul: 'Showcase Kitchen Set HPL' });
  assert.equal(ok.valid, true);
});

test('normalizeSocialPlanPayload trims strings and buildSocialPlansCsv escapes quotes', () => {
  const normalized = normalizeSocialPlanPayload({
    ...createEmptySocialPlan(),
    judul: '  Video Proses "HPL" ',
    namaPenanggungJawab: '',
  });
  assert.equal(normalized.judul, 'Video Proses "HPL"');
  assert.equal(normalized.namaPenanggungJawab, 'Tim Konten');

  const csv = buildSocialPlansCsv([normalized]);
  assert.ok(csv.includes('"Video Proses ""HPL"""'));
});
