import type {
  NewsArticleContentBlock,
  NewsImageAspectRatio,
  NewsImageBlockFormat,
  NewsImageContentBlock,
  NewsImageDisplayMode,
  NewsImageGridCols,
  NewsTextAlign,
  NewsTextBlockFormat,
  NewsTextContentBlock,
  NewsTextStyle,
} from '../types/cms';

export type {
  NewsArticleContentBlock,
  NewsImageAspectRatio,
  NewsImageBlockFormat,
  NewsImageContentBlock,
  NewsImageDisplayMode,
  NewsImageGridCols,
  NewsTextAlign,
  NewsTextBlockFormat,
  NewsTextContentBlock,
  NewsTextStyle,
};

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
      gaya?: NewsTextStyle;
      rata?: NewsTextAlign;
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

function normalizeTextStyle(raw?: string): NewsTextStyle {
  if (!raw) return 'paragraf';
  const val = raw.trim().toLowerCase();
  if (val === 'subjudul' || val === 'heading' || val === 'judul') return 'subjudul';
  if (val === 'kutipan' || val === 'quote' || val === 'blockquote') return 'kutipan';
  return 'paragraf';
}

function normalizeTextAlign(raw?: string): NewsTextAlign {
  if (!raw) return 'justify';
  const val = raw.trim().toLowerCase();
  if (val === 'left' || val === 'kiri') return 'left';
  return 'justify';
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
 * Mengurai array `paragrafKonten` berita lama yang mengandung tag `<image ...>url</image>`
 * menjadi blok teks dan grup gambar terstruktur.
 */
export function parseNewsContentBlocks(
  paragraphsOrBlocks: readonly (string | NewsArticleContentBlock)[]
): NewsContentBlock[] {
  if (
    paragraphsOrBlocks.length > 0 &&
    typeof paragraphsOrBlocks[0] === 'object' &&
    paragraphsOrBlocks[0] !== null &&
    'jenis' in paragraphsOrBlocks[0]
  ) {
    return resolveNewsContentRenderBlocks(paragraphsOrBlocks as readonly NewsArticleContentBlock[]);
  }

  const paragraphs = paragraphsOrBlocks.filter((p): p is string => typeof p === 'string');
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

export function createDefaultNewsTextFormat(
  partial?: Partial<NewsTextBlockFormat>
): NewsTextBlockFormat {
  return {
    gaya: normalizeTextStyle(partial?.gaya),
    rata: normalizeTextAlign(partial?.rata),
  };
}

export function createDefaultNewsImageFormat(
  partial?: Partial<NewsImageBlockFormat>,
  imageCount = 1
): NewsImageBlockFormat {
  const mode = normalizeDisplayMode(partial?.mode) ?? 'crop';
  const grid = normalizeGridCols(partial?.grid) ?? 'auto';
  const defaultRatio: NewsImageAspectRatio =
    grid === '2' || grid === '3' || imageCount > 1 ? '4/3' : '16/9';
  const ratio = mode === 'fit' ? undefined : (normalizeAspectRatio(partial?.ratio) ?? defaultRatio);
  const caption = typeof partial?.caption === 'string' ? partial.caption.trim() : '';
  const alt = typeof partial?.alt === 'string' ? partial.alt.trim() : '';

  return {
    mode,
    grid,
    ...(ratio ? { ratio } : {}),
    ...(caption ? { caption } : {}),
    ...(alt ? { alt } : {}),
  };
}

/**
 * Mengonversi array `paragrafKonten` lama menjadi struktur array `isi` baru (`jenis`, `isi`, `format`).
 */
export function convertLegacyParagraphsToContentBlocks(
  paragraphs: readonly string[]
): NewsArticleContentBlock[] {
  const legacyBlocks = parseNewsContentBlocks(paragraphs);
  const converted: NewsArticleContentBlock[] = [];

  for (const block of legacyBlocks) {
    if (block.type === 'paragraph') {
      const cleaned = block.text.trim();
      if (!cleaned) continue;
      converted.push({
        jenis: 'teks',
        isi: cleaned,
        format: createDefaultNewsTextFormat(),
      });
      continue;
    }

    const urls = block.images.map((img) => img.url).filter(Boolean);
    if (urls.length === 0) continue;

    const firstAlt = block.images.find((img) => img.alt)?.alt;
    converted.push({
      jenis: 'gambar',
      isi: urls,
      format: createDefaultNewsImageFormat(
        {
          mode: block.mode,
          grid: block.grid,
          ratio: block.ratio,
          caption: block.caption,
          alt: firstAlt,
        },
        urls.length
      ),
    });
  }

  return converted;
}

/**
 * Menormalkan array blok `isi` artikel agar selalu valid, aman, dan berurutan.
 */
export function normalizeNewsContentBlocks(
  rawBlocks: unknown,
  legacyParagraphs?: unknown
): NewsArticleContentBlock[] {
  if (!Array.isArray(rawBlocks)) {
    if (Array.isArray(legacyParagraphs)) {
      const strs = legacyParagraphs.filter((p): p is string => typeof p === 'string');
      return convertLegacyParagraphsToContentBlocks(strs);
    }
    return [];
  }

  const result: NewsArticleContentBlock[] = [];

  for (const raw of rawBlocks) {
    if (!raw || typeof raw !== 'object') continue;
    const entry = raw as Record<string, unknown>;
    const rawJenis = typeof entry.jenis === 'string' ? entry.jenis.trim().toLowerCase() : '';

    if (rawJenis === 'gambar' || rawJenis === 'image') {
      const rawIsi = entry.isi;
      const rawUrls = Array.isArray(rawIsi)
        ? rawIsi.filter((u): u is string => typeof u === 'string')
        : typeof rawIsi === 'string'
          ? rawIsi.split(/[\n,]+/)
          : [];
      const safeUrls = rawUrls
        .map((u) => sanitizeNewsImageUrl(u))
        .filter((u): u is string => Boolean(u));

      if (safeUrls.length === 0) continue;

      const rawFormat =
        entry.format && typeof entry.format === 'object'
          ? (entry.format as Partial<NewsImageBlockFormat>)
          : undefined;

      const block: NewsImageContentBlock = {
        jenis: 'gambar',
        isi: safeUrls,
        format: createDefaultNewsImageFormat(rawFormat, safeUrls.length),
      };
      result.push(block);
      continue;
    }

    const rawText = typeof entry.isi === 'string' ? entry.isi.trim() : '';
    if (!rawText) continue;

    const rawFormat =
      entry.format && typeof entry.format === 'object'
        ? (entry.format as Partial<NewsTextBlockFormat>)
        : undefined;

    const block: NewsTextContentBlock = {
      jenis: 'teks',
      isi: rawText,
      format: createDefaultNewsTextFormat(rawFormat),
    };
    result.push(block);
  }

  return result;
}

/**
 * Mengubah array blok `isi` (`jenis`, `isi`, `format`) menjadi blok tampilan halaman berita sesuai urutan array.
 */
export function resolveNewsContentRenderBlocks(
  contentBlocks: readonly NewsArticleContentBlock[]
): NewsContentBlock[] {
  const result: NewsContentBlock[] = [];

  for (const block of contentBlocks) {
    if (block.jenis === 'teks') {
      const cleaned = block.isi.replace(/\s+/g, ' ').trim();
      if (!cleaned) continue;
      const format = createDefaultNewsTextFormat(block.format);
      result.push({
        type: 'paragraph',
        text: cleaned,
        gaya: format.gaya,
        rata: format.rata,
      });
      continue;
    }

    const safeUrls = (Array.isArray(block.isi) ? block.isi : [])
      .map((u) => sanitizeNewsImageUrl(u))
      .filter((u): u is string => Boolean(u));

    if (safeUrls.length === 0) continue;

    const format = createDefaultNewsImageFormat(block.format, safeUrls.length);
    result.push({
      type: 'image-group',
      mode: format.mode,
      grid: format.grid,
      ...(format.ratio ? { ratio: format.ratio } : {}),
      ...(format.caption ? { caption: format.caption } : {}),
      images: safeUrls.map((url) => ({
        url,
        mode: format.mode,
        grid: format.grid,
        ...(format.ratio ? { ratio: format.ratio } : {}),
        ...(format.caption ? { caption: format.caption } : {}),
        ...(format.alt ? { alt: format.alt } : {}),
      })),
    });
  }

  return result;
}

export function extractNewsPlainTextList(
  content: readonly (string | NewsArticleContentBlock)[]
): string[] {
  const texts: string[] = [];
  for (const item of content) {
    if (typeof item === 'string') {
      const cleaned = stripNewsImageTags(item);
      if (cleaned) texts.push(cleaned);
    } else if (item && item.jenis === 'teks') {
      const cleaned = item.isi.replace(/\s+/g, ' ').trim();
      if (cleaned) texts.push(cleaned);
    }
  }
  return texts;
}

export function getNewsPlainBodyText(
  content: readonly (string | NewsArticleContentBlock)[]
): string {
  return extractNewsPlainTextList(content).join(' ');
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
 * Menyusun markup tag `<image ...>url</image>` terstruktur dari parameter gambar.
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
