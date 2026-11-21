import type { MaterialSpecItem } from '../../../types/cms';
import type { ProductItem, ProductVideoItem } from '../../../types/product';
import { extractBaseMaterialBadges, extractFinishingBadges } from '../katalog/utils';

export type ResolvedVideoSource =
  | { kind: 'native'; src: string }
  | { kind: 'embed'; src: string }
  | { kind: 'invalid'; src: '' };

export interface ProductMediaEntry {
  id: string;
  type: 'image' | 'video';
  src: string;
  poster?: string;
  title: string;
  duration?: string;
}

export type ProductVisualSlide =
  | { id: string; kind: 'image'; src: string | null; title: string }
  | { id: string; kind: 'video'; src: string; poster?: string; title: string }
  | { id: string; kind: 'schematic'; title: string };

export interface ResolvedProductMaterialGroup {
  baseMaterials: MaterialSpecItem[];
  finishes: MaterialSpecItem[];
}

export function resolveVideoSource(rawUrl: string): ResolvedVideoSource {
  const trimmed = rawUrl.trim();
  if (!trimmed) return { kind: 'invalid', src: '' };

  if (trimmed.startsWith('/')) {
    return { kind: 'native', src: trimmed };
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return { kind: 'invalid', src: '' };
    }

    const host = parsed.hostname.toLowerCase();

    if (host === 'youtu.be') {
      const id = parsed.pathname.replace(/^\/+/, '').split('/')[0];
      if (id) {
        return { kind: 'embed', src: `https://www.youtube.com/embed/${encodeURIComponent(id)}` };
      }
    }

    if (host === 'youtube.com' || host === 'www.youtube.com' || host === 'm.youtube.com') {
      const watchId = parsed.searchParams.get('v');
      if (watchId) {
        return {
          kind: 'embed',
          src: `https://www.youtube.com/embed/${encodeURIComponent(watchId)}`,
        };
      }
      const pathParts = parsed.pathname.split('/').filter(Boolean);
      if (
        (pathParts[0] === 'embed' || pathParts[0] === 'shorts') &&
        pathParts[1]
      ) {
        return {
          kind: 'embed',
          src: `https://www.youtube.com/embed/${encodeURIComponent(pathParts[1])}`,
        };
      }
    }

    if (host === 'vimeo.com' || host === 'www.vimeo.com' || host === 'player.vimeo.com') {
      const pathParts = parsed.pathname.split('/').filter(Boolean);
      const id = pathParts[pathParts.length - 1];
      if (id && /^\d+$/.test(id)) {
        return {
          kind: 'embed',
          src: `https://player.vimeo.com/video/${encodeURIComponent(id)}`,
        };
      }
    }

    if (/\.(mp4|webm|ogg|mov)(\?.*)?$/i.test(parsed.pathname)) {
      return { kind: 'native', src: parsed.toString() };
    }

    return { kind: 'native', src: parsed.toString() };
  } catch {
    return { kind: 'invalid', src: '' };
  }
}

export function buildProductMediaItems(product: ProductItem): ProductMediaEntry[] {
  const entries: ProductMediaEntry[] = [];

  product.daftarGambar.forEach((imgUrl, idx) => {
    const cleaned = imgUrl.trim();
    if (!cleaned) return;
    entries.push({
      id: `${product.id}-img-${idx}`,
      type: 'image',
      src: cleaned,
      title: `Foto ${idx + 1} · ${product.nama}`,
    });
  });

  const videos: ProductVideoItem[] = product.daftarVideo ?? [];
  videos.forEach((video, idx) => {
    const resolved = resolveVideoSource(video.url);
    if (resolved.kind === 'invalid') return;
    entries.push({
      id: `${product.id}-vid-${idx}`,
      type: 'video',
      src: video.url.trim(),
      poster: video.poster?.trim() || product.daftarGambar[0] || undefined,
      title: video.judul?.trim() || `Video ${idx + 1} · ${product.nama}`,
      duration: video.durasi?.trim() || undefined,
    });
  });

  return entries;
}

export function buildProductVisualSlides(
  product: ProductItem,
  brandName: string
): ProductVisualSlide[] {
  const imageSlides: ProductVisualSlide[] = product.daftarGambar
    .map((imgUrl) => imgUrl.trim())
    .filter(Boolean)
    .map((src, idx) => ({
      id: `${product.id}-slide-img-${idx}`,
      kind: 'image',
      src,
      title: `Foto ${idx + 1} · ${product.nama}`,
    }));

  const validVideos: ProductVisualSlide[] = (product.daftarVideo ?? [])
    .filter((video) => resolveVideoSource(video.url).kind !== 'invalid')
    .map((video, idx) => ({
      id: `${product.id}-slide-vid-${idx}`,
      kind: 'video',
      src: video.url.trim(),
      poster: video.poster?.trim() || product.daftarGambar[0] || '/images/atelier-studio-craft.webp',
      title: video.judul?.trim() || `Video ${idx + 1} · ${product.nama}`,
    }));

  const fallbackVideoSlide: ProductVisualSlide = {
    id: `${product.id}-slide-vid-workshop`,
    kind: 'video',
    src: '/hero.webm',
    poster: '/images/atelier-studio-craft.webp',
    title: `Video Workshop ${brandName}`,
  };

  const schematicSlide: ProductVisualSlide = {
    id: `${product.id}-slide-schematic`,
    kind: 'schematic',
    title: `Skema Proporsi ${product.nama}`,
  };

  if (imageSlides.length > 0) {
    return [
      ...imageSlides,
      ...(validVideos.length > 0 ? validVideos : [fallbackVideoSlide]),
      schematicSlide,
    ];
  }

  if (validVideos.length > 0) {
    return [
      ...validVideos,
      {
        id: `${product.id}-slide-img-placeholder`,
        kind: 'image',
        src: null,
        title: `Referensi ${product.nama}`,
      },
      schematicSlide,
    ];
  }

  return [
    fallbackVideoSlide,
    {
      id: `${product.id}-slide-img-placeholder`,
      kind: 'image',
      src: null,
      title: `Referensi ${product.nama}`,
    },
    schematicSlide,
  ];
}

export function resolveProductMaterialDetails(
  product: ProductItem,
  allMaterials: readonly MaterialSpecItem[]
): ResolvedProductMaterialGroup {
  const baseNames = extractBaseMaterialBadges(product).map((n) => n.toLowerCase());
  const finishNames = extractFinishingBadges(product).map((n) => n.toLowerCase());

  const baseMaterials = allMaterials.filter(
    (mat) =>
      mat.kategori === 'papan' &&
      baseNames.some((name) => mat.nama.toLowerCase() === name || name.includes(mat.nama.toLowerCase()))
  );

  const finishes = allMaterials.filter(
    (mat) =>
      mat.kategori === 'finishing' &&
      finishNames.some(
        (name) => mat.nama.toLowerCase() === name || name.includes(mat.nama.toLowerCase())
      )
  );

  return { baseMaterials, finishes };
}

export function getRelatedProducts(
  currentProduct: ProductItem,
  allProducts: readonly ProductItem[],
  limit = 4
): ProductItem[] {
  const sameCategory = allProducts.filter(
    (item) => item.id !== currentProduct.id && item.kategori === currentProduct.kategori
  );
  const others = allProducts.filter(
    (item) => item.id !== currentProduct.id && item.kategori !== currentProduct.kategori
  );
  return [...sameCategory, ...others].slice(0, Math.max(0, limit));
}

export function buildProductDetailWhatsAppMessage(params: {
  brandName: string;
  productName: string;
  category: string;
  serviceModeLabel?: string | null;
  priceLabel: string | null;
  selectedColorName: string | null;
  selectedOptions: Record<string, string>;
  quantity: number;
  selectedDimensionRef?: string | null;
}): string {
  const optionEntries = Object.entries(params.selectedOptions);
  const optionSummary = optionEntries.map(([k, v]) => `${k}: ${v}`).join(', ');

  return [
    `Halo ${params.brandName},`,
    'Saya ingin memesan / menanyakan unit katalog dengan konfigurasi berikut:',
    `- Produk: ${params.productName}`,
    `- Kategori: ${params.category}`,
    params.serviceModeLabel ? `- Layanan: ${params.serviceModeLabel}` : null,
    params.priceLabel ? `- Estimasi Harga: ${params.priceLabel}` : null,
    params.selectedDimensionRef ? `- Ukuran: ${params.selectedDimensionRef}` : null,
    params.selectedColorName ? `- Warna Pilihan: ${params.selectedColorName}` : null,
    optionSummary ? `- Spesifikasi Pilihan: ${optionSummary}` : null,
    `- Jumlah: ${params.quantity} unit`,
  ]
    .filter(Boolean)
    .join('\n');
}
