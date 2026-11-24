export type NewsImageDisplayMode = 'crop' | 'fit' | 'full';
export type NewsImageGridCols = 'auto' | '1' | '2' | '3';
export type NewsImageAspectRatio = '16/9' | '4/3' | '1/1' | '4/5' | '3/4' | '21/9';

export interface NewsImageItem {
  url: string;
  mode?: NewsImageDisplayMode;
  ratio?: NewsImageAspectRatio;
  grid?: NewsImageGridCols;
  caption?: string;
  alt?: string;
}

export type NewsContentBlock =
  | {
      type: 'paragraph';
      text: string;
    }
  | {
      type: 'image-group';
      images: NewsImageItem[];
      mode?: NewsImageDisplayMode;
      ratio?: NewsImageAspectRatio;
      grid?: NewsImageGridCols;
      caption?: string;
    };

export interface ResolvedNewsImageGroupLayout {
  mode: NewsImageDisplayMode;
  grid: '1' | '2' | '3';
  ratio: NewsImageAspectRatio;
  gridClassName: string;
  isFullBleed: boolean;
}

const IMAGE_TAG_REGEX = /<image\b([^>]*)>([\s\S]*?)<\/image>/gi;
const ATTR_REGEX = /([a-zA-Z0-9_-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/g;

const VALID_RATIOS = new Set<NewsImageAspectRatio>([
  '16/9',
  '4/3',
  '1/1',
  '4/5',
  '3/4',
  '21/9',
]);

function normalizeDisplayMode(raw?: string): NewsImageDisplayMode | undefined {
  if (!raw) return undefined;
  const val = raw.trim().toLowerCase();
  if (val === 'full' || val === 'bleed' || val === 'lebar' || val === 'full-bleed') {
    return 'full';
  }
  if (val === 'fit' || val === 'natural' || val === 'asli' || val === 'contain') {
    return 'fit';
  }
  if (val === 'crop' || val === 'potong' || val === 'cover') {
    return 'crop';
  }
  return undefined;
}

function normalizeGridCols(raw?: string): NewsImageGridCols | undefined {
  if (!raw) return undefined;
  const val = raw.trim().toLowerCase();
  if (val === '1' || val === '2' || val === '3' || val === 'auto') {
    return val;
  }
  return undefined;
}

function normalizeAspectRatio(raw?: string): NewsImageAspectRatio | undefined {
  if (!raw) return undefined;
  const val = raw.trim().replace(':', '/') as NewsImageAspectRatio;
  return VALID_RATIOS.has(val) ? val : undefined;
}

function parseImageAttributes(rawAttrs: string): Omit<NewsImageItem, 'url'> {
  if (!rawAttrs || !rawAttrs.trim()) return {};
  const result: Omit<NewsImageItem, 'url'> = {};
  const regex = new RegExp(ATTR_REGEX.source, 'g');
  let match: RegExpExecArray | null;

  while ((match = regex.exec(rawAttrs)) !== null) {
    const key = (match[1] ?? '').trim().toLowerCase();
    const rawVal = (match[2] ?? match[3] ?? match[4] ?? '').trim();
    if (!rawVal) continue;

    if (key === 'mode' || key === 'layout' || key === 'display' || key === 'tampilan') {
      const parsedMode = normalizeDisplayMode(rawVal);
      if (parsedMode) result.mode = parsedMode;
    } else if (key === 'grid' || key === 'cols' || key === 'kolom') {
      const parsedGrid = normalizeGridCols(rawVal);
      if (parsedGrid) result.grid = parsedGrid;
    } else if (key === 'ratio' || key === 'aspect' || key === 'rasio') {
      const parsedRatio = normalizeAspectRatio(rawVal);
      if (parsedRatio) result.ratio = parsedRatio;
    } else if (key === 'caption' || key === 'ket' || key === 'sumber') {
      result.caption = rawVal;
    } else if (key === 'alt') {
      result.alt = rawVal;
    }
  }

  return result;
}

/**
 * Memvalidasi URL gambar agar hanya menerima URL aman (`https://`, `http://`, atau path lokal `/...`).
 */
export function sanitizeNewsImageUrl(rawUrl: string): string | null {
  const trimmed = rawUrl.trim();
  if (!trimmed) return null;
  if (/[\r\n\0]/.test(trimmed)) return null;

  if (trimmed.startsWith('/')) {
    if (trimmed.startsWith('//')) return null;
    return trimmed;
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      return parsed.href;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Menghapus seluruh tag `<image>...</image>` dan merapikan spasi untuk ringkasan, pencarian, dan estimasi baca.
 */
export function stripNewsImageTags(value: string): string {
  if (!value) return '';
  return value
    .replace(IMAGE_TAG_REGEX, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Mengurai array `paragrafKonten` berita yang dapat mengandung tag `<image ...>url</image>`
 * dengan opsi atribut kustom (`mode`, `ratio`, `grid`, `caption`, `alt`) menjadi blok
 * teks dan grup gambar terstruktur tanpa menyuntikkan HTML mentah.
 */
export function parseNewsContentBlocks(paragraphs: readonly string[]): NewsContentBlock[] {
  const blocks: NewsContentBlock[] = [];
  let pendingImages: NewsImageItem[] = [];

  const flushImages = () => {
    if (pendingImages.length === 0) return;

    const groupMode = pendingImages.find((img) => img.mode)?.mode;
    const groupRatio = pendingImages.find((img) => img.ratio)?.ratio;
    const groupGrid = pendingImages.find((img) => img.grid)?.grid;
    const groupCaption = pendingImages.find((img) => img.caption)?.caption;

    const block: Extract<NewsContentBlock, { type: 'image-group' }> = {
      type: 'image-group',
      images: pendingImages,
      ...(groupMode ? { mode: groupMode } : {}),
      ...(groupRatio ? { ratio: groupRatio } : {}),
      ...(groupGrid ? { grid: groupGrid } : {}),
      ...(groupCaption ? { caption: groupCaption } : {}),
    };

    blocks.push(block);
    pendingImages = [];
  };

  const shouldSplitPendingGroup = (nextItem: NewsImageItem): boolean => {
    if (pendingImages.length === 0) return false;
    const currentMode = pendingImages.find((img) => img.mode)?.mode;
    const currentGrid = pendingImages.find((img) => img.grid)?.grid;

    if (nextItem.mode === 'full' && (!nextItem.grid || nextItem.grid === '1')) {
      return true;
    }
    if (currentMode === 'full' && (!currentGrid || currentGrid === '1')) {
      return true;
    }
    if (nextItem.mode && currentMode && nextItem.mode !== currentMode) {
      return true;
    }
    if (nextItem.grid && currentGrid && nextItem.grid !== currentGrid) {
      return true;
    }
    return false;
  };

  const pushText = (rawText: string) => {
    const cleaned = rawText.replace(/\s+/g, ' ').trim();
    if (!cleaned) return;
    flushImages();
    blocks.push({
      type: 'paragraph',
      text: cleaned,
    });
  };

  for (const rawParagraph of paragraphs) {
    if (typeof rawParagraph !== 'string' || !rawParagraph.trim()) continue;

    const regex = new RegExp(IMAGE_TAG_REGEX.source, 'gi');
    let lastIndex = 0;
    let bufferedText = '';
    let match: RegExpExecArray | null;

    while ((match = regex.exec(rawParagraph)) !== null) {
      const textBefore = rawParagraph.slice(lastIndex, match.index);
      const attrs = parseImageAttributes(match[1] ?? '');
      const validUrl = sanitizeNewsImageUrl(match[2] ?? '');

      if (validUrl) {
        if (textBefore.trim()) {
          const combined = [bufferedText, textBefore].filter((s) => s.trim()).join(' ');
          bufferedText = '';
          pushText(combined);
        } else if (bufferedText.trim()) {
          pushText(bufferedText);
          bufferedText = '';
        }

        const nextItem: NewsImageItem = {
          url: validUrl,
          ...attrs,
        };

        if (shouldSplitPendingGroup(nextItem)) {
          flushImages();
        }
        pendingImages.push(nextItem);
      } else {
        // Jika tag <image> tidak valid/kosong, gabungkan teks di sekitarnya agar kalimat tetap utuh
        bufferedText = [bufferedText, textBefore].filter((s) => s.trim()).join(' ');
      }

      lastIndex = regex.lastIndex;
    }

    const trailingText = rawParagraph.slice(lastIndex);
    const combinedTrailing = [bufferedText, trailingText].filter((s) => s.trim()).join(' ');
    if (combinedTrailing.trim()) {
      pushText(combinedTrailing);
    }
  }

  flushImages();
  return blocks;
}

/**
 * Menentukan konfigurasi grid dan tampilan final blok gambar berita:
 * - Mobile maksimal 2 card horizontal (`grid-cols-2`)
 * - Desktop mendukung 1, 2, atau 3 card horizontal (`md:grid-cols-3`)
 */
export function resolveNewsImageGroupLayout(
  block: Pick<Extract<NewsContentBlock, { type: 'image-group' }>, 'images' | 'mode' | 'ratio' | 'grid'>
): ResolvedNewsImageGroupLayout {
  const mode: NewsImageDisplayMode = block.mode ?? 'crop';
  const count = block.images.length;

  let grid: '1' | '2' | '3';
  if (block.grid === '1' || block.grid === '2' || block.grid === '3') {
    grid = block.grid;
  } else if (count >= 3) {
    grid = '3';
  } else if (count === 2) {
    grid = '2';
  } else {
    grid = '1';
  }

  const ratio: NewsImageAspectRatio =
    block.ratio ?? (grid === '1' ? '16/9' : '4/3');

  const isFullBleed = mode === 'full';
  const gapClass = isFullBleed ? 'gap-2 sm:gap-3' : 'gap-2.5 sm:gap-4';

  const gridClassName =
    grid === '1'
      ? `grid grid-cols-1 ${gapClass}`
      : grid === '2'
        ? `grid grid-cols-2 ${gapClass}`
        : `grid grid-cols-2 md:grid-cols-3 ${gapClass}`;

  return {
    mode,
    grid,
    ratio,
    gridClassName,
    isFullBleed,
  };
}

export interface BuildNewsImageTagOptions {
  urls: string[];
  mode: NewsImageDisplayMode;
  ratio?: NewsImageAspectRatio;
  grid?: NewsImageGridCols;
  caption?: string;
}

function escapeAttrValue(value: string): string {
  return value.replace(/"/g, "'").replace(/[\r\n]+/g, ' ').trim();
}

/**
 * Menyusun markup tag `<image ...>url</image>` terstruktur dari form admin berita.
 */
export function buildNewsImageTagsMarkup(options: BuildNewsImageTagOptions): string {
  const safeUrls = options.urls
    .map((u) => sanitizeNewsImageUrl(u))
    .filter((u): u is string => Boolean(u));

  if (safeUrls.length === 0) return '';

  const attrs: string[] = [];
  if (options.mode !== 'crop') {
    attrs.push(`mode="${options.mode}"`);
  } else if (options.ratio && options.ratio !== '16/9' && options.ratio !== '4/3') {
    attrs.push(`mode="crop"`);
  }

  if (options.grid && options.grid !== 'auto') {
    attrs.push(`grid="${options.grid}"`);
  }

  if (options.mode !== 'fit' && options.ratio) {
    attrs.push(`ratio="${options.ratio}"`);
  }

  const cleanCaption = options.caption ? escapeAttrValue(options.caption) : '';

  return safeUrls
    .map((url, idx) => {
      const itemAttrs = [...attrs];
      if (idx === 0 && cleanCaption) {
        itemAttrs.push(`caption="${cleanCaption}"`);
      }
      const attrString = itemAttrs.length > 0 ? ` ${itemAttrs.join(' ')}` : '';
      return `<image${attrString}>${url}</image>`;
    })
    .join(' ');
}
