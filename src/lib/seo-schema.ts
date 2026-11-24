import type { BusinessConfig } from '../types/business';
import type {
  FaqItem,
  MaterialSpecItem,
  NewsArticleItem,
  PaymentSchemeConfig,
  PortfolioCaseStudy,
} from '../types/cms';
import type { ProductItem } from '../types/product';
import { resolveCatalogStartingPrice } from './catalog-pricing';
import { stripNewsImageTags } from './news-content';
import { formatPaymentSchemeSummary } from './payment-scheme';
import { getProductImageUrls, getProductSlug } from './product-catalog';

function resolveAbsoluteUrl(originUrl: string, pathOrUrl: string): string {
  if (!pathOrUrl) return originUrl;
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  const cleanOrigin = originUrl.replace(/\/+$/, '');
  const cleanPath = pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`;
  return `${cleanOrigin}${cleanPath}`;
}

export function buildArticleJsonLd(
  article: NewsArticleItem,
  businessConfig: BusinessConfig,
  originUrl: string
): Record<string, unknown> {
  const articleUrl = resolveAbsoluteUrl(originUrl, `/berita/${article.slug}`);
  const imageUrl = resolveAbsoluteUrl(originUrl, article.gambarSampul || '/metatag.webp');

  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: article.judulSeo.trim() || article.judul,
    description: stripNewsImageTags(article.deskripsiSeo.trim() || article.ringkasan),
    image: [imageUrl],
    datePublished: article.tanggalTerbit,
    dateModified: article.tanggalTerbit,
    articleSection: article.kategori,
    keywords: article.kataKunciSeo.join(', '),
    inLanguage: 'id-ID',
    author: {
      '@type': 'Organization',
      name: article.namaPenulis?.trim() || businessConfig.namaMerek,
    },
    publisher: {
      '@type': 'Organization',
      name: businessConfig.namaMerek,
      logo: {
        '@type': 'ImageObject',
        url: resolveAbsoluteUrl(originUrl, '/logo-white.webp'),
      },
    },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': articleUrl,
    },
  };
}

export function buildBeritaListJsonLd(
  articles: readonly NewsArticleItem[],
  businessConfig: BusinessConfig,
  originUrl: string
): Record<string, unknown> {
  const publishedArticles = articles.filter((a) => a.terbit);
  const pageUrl = resolveAbsoluteUrl(originUrl, '/berita');

  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    '@id': pageUrl,
    name: `Berita & Publikasi Resmi | ${businessConfig.namaMerek}`,
    description:
      'Kumpulan berita terbaru workshop, jadwal survei interior custom, dan artikel publikasi resmi Shansus Dzar Indonesia.',
    inLanguage: 'id-ID',
    mainEntity: {
      '@type': 'ItemList',
      itemListElement: publishedArticles.map((article, index) => ({
        '@type': 'ListItem',
        position: index + 1,
        url: resolveAbsoluteUrl(originUrl, `/berita/${article.slug}`),
        name: article.judul,
      })),
    },
  };
}

export function buildTipsInteriorJsonLd(
  materialsOrLegacy: readonly (MaterialSpecItem | NewsArticleItem)[],
  businessConfig: BusinessConfig,
  originUrl: string
): Record<string, unknown> {
  const pageUrl = resolveAbsoluteUrl(originUrl, '/tips-interior');
  const materialElements = materialsOrLegacy.map((entry, index) => {
    const label = 'nama' in entry ? entry.nama : entry.judul;
    const anchor = 'nama' in entry ? entry.id : entry.slug;
    return {
      '@type': 'ListItem',
      position: index + 1,
      url: `${pageUrl}/${encodeURIComponent(anchor)}`,
      name: label,
    };
  });

  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    '@id': pageUrl,
    name: `Tips Material & Finishing Interior | ${businessConfig.namaMerek}`,
    description:
      'Informasi komposisi material utama berketebalan seragam 18 mm (Blockboard, Multipleks, PVC Board) dan finishing/laminasi (HPL, Cat Duco) untuk interior custom.',
    inLanguage: 'id-ID',
    mainEntity: {
      '@type': 'ItemList',
      itemListElement: materialElements,
    },
  };
}

export function buildFaqPageJsonLd(
  faqs: readonly FaqItem[],
  originUrl: string,
  paymentScheme?: PaymentSchemeConfig
): Record<string, unknown> {
  const publishedFaqs = faqs.filter((f) => f.terbit);
  const pageUrl = resolveAbsoluteUrl(originUrl, '/faq');
  const schemeSummary = paymentScheme ? formatPaymentSchemeSummary(paymentScheme) : '';

  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    '@id': pageUrl,
    inLanguage: 'id-ID',
    mainEntity: publishedFaqs.map((faq) => {
      const enrichedAnswer =
        faq.id === 'faq-pembayaran' && schemeSummary
          ? `${faq.jawaban} Skema termin aktif: ${schemeSummary}.`
          : faq.jawaban;
      return {
        '@type': 'Question',
        name: faq.pertanyaan,
        acceptedAnswer: {
          '@type': 'Answer',
          text: enrichedAnswer,
        },
      };
    }),
  };
}

export function buildInformasiHubJsonLd(
  articles: readonly NewsArticleItem[],
  faqs: readonly FaqItem[],
  businessConfig: BusinessConfig,
  originUrl: string
): Record<string, unknown> {
  const publishedArticles = articles.filter((a) => a.terbit);
  const publishedFaqs = faqs.filter((f) => f.terbit);
  const hubUrl = resolveAbsoluteUrl(originUrl, '/berita');

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'CollectionPage',
        '@id': hubUrl,
        name: `Pusat Berita, Informasi & Panduan Material | ${businessConfig.namaMerek}`,
        description:
          'Berita terbaru, artikel edukasi interior & material furniture custom, serta panduan layanan resmi dari Shansus Dzar Indonesia.',
        inLanguage: 'id-ID',
        mainEntity: {
          '@type': 'ItemList',
          itemListElement: publishedArticles.map((article, index) => ({
            '@type': 'ListItem',
            position: index + 1,
            url: resolveAbsoluteUrl(originUrl, `/berita/${article.slug}`),
            name: article.judul,
          })),
        },
      },
      ...(publishedFaqs.length > 0
        ? [
            {
              '@type': 'FAQPage',
              mainEntity: publishedFaqs.map((faq) => ({
                '@type': 'Question',
                name: faq.pertanyaan,
                acceptedAnswer: {
                  '@type': 'Answer',
                  text: faq.jawaban,
                },
              })),
            },
          ]
        : []),
    ],
  };
}

export function buildPortfolioProjectJsonLd(
  project: PortfolioCaseStudy,
  businessConfig: BusinessConfig,
  originUrl: string
): Record<string, unknown> {
  const projectUrl = resolveAbsoluteUrl(originUrl, `/portofolio/${project.slug}`);
  const galleryUrls = (
    project.galeriGambar.length > 0 ? project.galeriGambar : [project.gambarUtama]
  ).map((img) => resolveAbsoluteUrl(originUrl, img || '/metatag.webp'));

  return {
    '@context': 'https://schema.org',
    '@type': 'CreativeWork',
    name: project.judul,
    headline: project.judul,
    description: project.deskripsi,
    image: galleryUrls,
    genre: project.kategori,
    locationCreated: {
      '@type': 'Place',
      name: project.lokasi,
    },
    keywords: [project.kategori, project.cakupan, project.lokasi, ...project.materialDigunakan]
      .filter(Boolean)
      .join(', '),
    inLanguage: 'id-ID',
    creator: {
      '@type': 'Organization',
      name: businessConfig.namaMerek,
    },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': projectUrl,
    },
  };
}

export function buildLegalPageJsonLd(options: {
  path: string;
  name: string;
  description: string;
  dateModified: string;
  businessConfig: BusinessConfig;
  originUrl: string;
}): Record<string, unknown> {
  const pageUrl = resolveAbsoluteUrl(options.originUrl, options.path);
  const homeUrl = resolveAbsoluteUrl(options.originUrl, '/');

  return {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    '@id': pageUrl,
    url: pageUrl,
    name: options.name,
    description: options.description,
    inLanguage: 'id-ID',
    dateModified: options.dateModified,
    isPartOf: {
      '@type': 'WebSite',
      name: options.businessConfig.namaMerek,
      url: homeUrl,
    },
    publisher: {
      '@type': 'Organization',
      name: options.businessConfig.namaMerek,
      url: homeUrl,
      telephone: options.businessConfig.whatsapp.nomorTampil,
    },
    breadcrumb: {
      '@type': 'BreadcrumbList',
      itemListElement: [
        {
          '@type': 'ListItem',
          position: 1,
          name: 'Beranda',
          item: homeUrl,
        },
        {
          '@type': 'ListItem',
          position: 2,
          name: options.name,
          item: pageUrl,
        },
      ],
    },
  };
}

export function buildProductJsonLd(
  product: ProductItem,
  businessConfig: BusinessConfig,
  originUrl: string
): Record<string, unknown> {
  const productUrl = resolveAbsoluteUrl(
    originUrl,
    `/produk/${encodeURIComponent(getProductSlug(product))}`
  );
  const catalogUrl = resolveAbsoluteUrl(originUrl, '/produk');
  const homeUrl = resolveAbsoluteUrl(originUrl, '/');
  const rawImages = getProductImageUrls(product);
  const images = (rawImages.length > 0 ? rawImages : ['/metatag.webp']).map((img) =>
    resolveAbsoluteUrl(originUrl, img)
  );
  const effectivePrice = resolveCatalogStartingPrice(product).numericPrice;

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Product',
        '@id': productUrl,
        name: product.nama,
        description: product.deskripsiSingkat,
        category: product.kategori,
        image: images,
        brand: {
          '@type': 'Brand',
          name: businessConfig.namaMerek,
        },
        ...(effectivePrice !== null && effectivePrice > 0
          ? {
              offers: {
                '@type': 'Offer',
                url: productUrl,
                priceCurrency: 'IDR',
                price: effectivePrice,
                availability: 'https://schema.org/InStock',
              },
            }
          : {}),
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Beranda', item: homeUrl },
          { '@type': 'ListItem', position: 2, name: 'Produk', item: catalogUrl },
          { '@type': 'ListItem', position: 3, name: product.nama, item: productUrl },
        ],
      },
    ],
  };
}
