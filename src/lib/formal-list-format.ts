export type FormalTextBlock =
  | {
      kind: 'paragraph';
      text: string;
    }
  | {
      kind: 'list';
      marker: string;
      body: string;
      level: 0 | 1;
    };

const NUMBERED_TOP_RE = /^\s*(\d{1,3}[.)]|\(\d{1,3}\))\s+(.+)$/;
const BULLET_RE = /^\s*([•‣▪◦–—-])\s+(.+)$/;
const ALPHA_SUB_RE = /^\s*([a-zA-Z][.)]|\([a-zA-Z]\))\s+(.+)$/;
const SUB_BULLET_RE = /^\s{2,}([*•-])\s+(.+)$/;

/**
 * Memecah teks klausul/paragraf dokumen menjadi blok paragraf deskriptif dan butir daftar
 * (nomor urut, huruf sub-poin, atau bullet) agar seluruh renderer PDF, pratinjau cetak,
 * dan ekspor dokumen menerapkan indentasi menjorok ke kanan (hanging indent) + rata kanan-kiri.
 */
export function parseFormalTextBlocks(rawText: string): FormalTextBlock[] {
  if (!rawText || !rawText.trim()) return [];

  const lines = rawText
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+$/g, ''))
    .filter((line) => line.trim().length > 0);

  const blocks: FormalTextBlock[] = [];

  for (const line of lines) {
    const subBulletMatch = line.match(SUB_BULLET_RE);
    if (subBulletMatch) {
      blocks.push({
        kind: 'list',
        marker: subBulletMatch[1] === '*' ? '•' : subBulletMatch[1],
        body: subBulletMatch[2].trim(),
        level: 1,
      });
      continue;
    }

    const numberedMatch = line.match(NUMBERED_TOP_RE);
    if (numberedMatch) {
      blocks.push({
        kind: 'list',
        marker: numberedMatch[1],
        body: numberedMatch[2].trim(),
        level: 0,
      });
      continue;
    }

    const alphaMatch = line.match(ALPHA_SUB_RE);
    if (alphaMatch) {
      blocks.push({
        kind: 'list',
        marker: alphaMatch[1],
        body: alphaMatch[2].trim(),
        level: 1,
      });
      continue;
    }

    const bulletMatch = line.match(BULLET_RE);
    if (bulletMatch) {
      blocks.push({
        kind: 'list',
        marker: bulletMatch[1] === '-' ? '•' : bulletMatch[1],
        body: bulletMatch[2].trim(),
        level: 0,
      });
      continue;
    }

    blocks.push({
      kind: 'paragraph',
      text: line.trim(),
    });
  }

  return blocks;
}
