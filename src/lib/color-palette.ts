import colorPaletteJson from '../data/pilihan-warna.json';
import type { ProductColorOption } from '../types/product';

interface RawColorPaletteDocument {
  versiSkema?: number;
  diperbaruiPada?: string;
  catatan?: string;
  daftarWarna?: unknown[];
}

function parseUniversalColorPalette(raw: unknown): ProductColorOption[] {
  const doc = raw as RawColorPaletteDocument | null;
  if (!doc || !Array.isArray(doc.daftarWarna)) return [];

  const result: ProductColorOption[] = [];
  for (const item of doc.daftarWarna) {
    if (!item || typeof item !== 'object') continue;
    const entry = item as Record<string, unknown>;
    const id = typeof entry.id === 'string' ? entry.id.trim() : '';
    const nama = typeof entry.nama === 'string' ? entry.nama.trim() : '';
    const hex = typeof entry.hex === 'string' ? entry.hex.trim() : '';
    const catatanNuansa =
      typeof entry.catatanNuansa === 'string' && entry.catatanNuansa.trim()
        ? entry.catatanNuansa.trim()
        : undefined;

    if (id && nama && /^#[0-9A-Fa-f]{3,8}$/.test(hex)) {
      result.push({
        id,
        nama,
        hex,
        ...(catatanNuansa ? { catatanNuansa } : {}),
      });
    }
  }
  return result;
}

export const UNIVERSAL_COLOR_PALETTE: ProductColorOption[] =
  parseUniversalColorPalette(colorPaletteJson);

export const DEFAULT_UNIVERSAL_COLOR: ProductColorOption = UNIVERSAL_COLOR_PALETTE[0] ?? {
  id: 'gading-hangat',
  nama: 'Gading Hangat',
  hex: '#EAE5DC',
  catatanNuansa: 'Terang netral',
};

export function findUniversalColor(idOrName?: string | null): ProductColorOption {
  if (!idOrName) return DEFAULT_UNIVERSAL_COLOR;
  const norm = idOrName.trim().toLowerCase();
  return (
    UNIVERSAL_COLOR_PALETTE.find(
      (c) => c.id.toLowerCase() === norm || c.nama.toLowerCase() === norm
    ) ?? DEFAULT_UNIVERSAL_COLOR
  );
}

export function isLightHexColor(hex: string): boolean {
  const clean = hex.replace('#', '');
  const full =
    clean.length === 3
      ? clean
          .split('')
          .map((ch) => ch + ch)
          .join('')
      : clean.slice(0, 6);
  if (!/^[0-9A-Fa-f]{6}$/.test(full)) return false;
  const r = Number.parseInt(full.slice(0, 2), 16);
  const g = Number.parseInt(full.slice(2, 4), 16);
  const b = Number.parseInt(full.slice(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.62;
}

export function filterColorOptions(
  colors: readonly ProductColorOption[],
  query: string
): ProductColorOption[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return [...colors];

  const tokens = normalized.split(/\s+/).filter(Boolean);
  return colors.filter((color) => {
    const haystack = `${color.nama} ${color.catatanNuansa ?? ''} ${color.hex}`.toLowerCase();
    return tokens.every((token) => haystack.includes(token));
  });
}

