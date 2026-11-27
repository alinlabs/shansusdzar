import { useEffect } from 'react';
import { DEFAULT_SEO_SETTINGS } from '../lib/cms-defaults';
import { useSiteContentStore } from '../store/site-content-store';

export interface DocumentSeoOptions {
  ogType?: 'website' | 'article';
  ogImage?: string;
  keywords?: string[];
  robots?: string;
}

function upsertMeta(attribute: 'name' | 'property', key: string, value: string): void {
  let meta = document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${key}"]`);
  if (!meta) {
    meta = document.createElement('meta');
    meta.setAttribute(attribute, key);
    document.head.appendChild(meta);
  }
  meta.setAttribute('content', value);
}

function upsertCanonicalLink(href: string): void {
  let link = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!link) {
    link = document.createElement('link');
    link.setAttribute('rel', 'canonical');
    document.head.appendChild(link);
  }
  link.setAttribute('href', href);
}

export function useDocumentTitle(
  title?: string,
  description?: string,
  options?: DocumentSeoOptions
) {
  const seoSettings = useSiteContentStore((state) => state.seoSettings) ?? DEFAULT_SEO_SETTINGS;
  const businessConfig = useSiteContentStore((state) => state.businessConfig);

  const ogType = options?.ogType ?? seoSettings.tipeOg ?? 'website';
  const ogImage = options?.ogImage ?? seoSettings.urlGambarOg;
  const keywordsJoined = options?.keywords?.filter(Boolean).join(', ') ?? '';
  const explicitRobots = options?.robots;

  useEffect(() => {
    const pathname = typeof window !== 'undefined' ? window.location.pathname.replace(/\/+$/, '') || '/' : '/';
    const isAdminRoute = pathname.startsWith('/admin');
    const override = !isAdminRoute
      ? seoSettings.penyesuaianHalaman.find((p) => (p.jalurRute.replace(/\/+$/, '') || '/') === pathname)
      : undefined;

    const resolvedTitle = isAdminRoute
      ? title?.trim() || businessConfig.namaMerek
      : override?.judulMeta?.trim() || title?.trim() || seoSettings.judulBawaan || businessConfig.namaMerek;

    const resolvedDescription = isAdminRoute
      ? description?.trim() || seoSettings.deskripsiBawaan
      : override?.deskripsiMeta?.trim() || description?.trim() || seoSettings.deskripsiBawaan;

    const resolvedKeywords = keywordsJoined || override?.kataKunciFokus?.trim() || seoSettings.kataKunci;
    const robots = explicitRobots ?? (isAdminRoute ? 'noindex, nofollow' : seoSettings.kebijakanRobots || 'index, follow');

    document.title = resolvedTitle;
    upsertMeta('name', 'description', resolvedDescription);
    upsertMeta('name', 'robots', robots);
    upsertMeta('property', 'og:site_name', seoSettings.namaSitusOg || businessConfig.namaMerek);
    upsertMeta('property', 'og:type', ogType);
    upsertMeta('property', 'og:title', resolvedTitle);
    upsertMeta('property', 'og:description', resolvedDescription);
    upsertMeta('name', 'twitter:card', seoSettings.kartuTwitter || 'summary_large_image');
    upsertMeta('name', 'twitter:title', resolvedTitle);
    upsertMeta('name', 'twitter:description', resolvedDescription);

    if (seoSettings.akunTwitter?.trim()) {
      upsertMeta('name', 'twitter:site', seoSettings.akunTwitter.trim());
    }

    if (resolvedKeywords) {
      upsertMeta('name', 'keywords', resolvedKeywords);
    }

    const googleSiteVerification = seoSettings.verifikasiGoogleSite?.trim();
    if (googleSiteVerification) {
      upsertMeta('name', 'google-site-verification', googleSiteVerification);
    }

    if (typeof window !== 'undefined') {
      const originBase = seoSettings.urlKanonikalDasar?.trim()
        ? seoSettings.urlKanonikalDasar.trim().replace(/\/+$/, '')
        : window.location.origin;
      const currentUrl = `${originBase}${window.location.pathname}`;
      upsertMeta('property', 'og:url', currentUrl);
      upsertMeta('name', 'twitter:url', currentUrl);
      upsertCanonicalLink(currentUrl);

      if (ogImage) {
        const resolvedImage = /^https?:\/\//i.test(ogImage)
          ? ogImage
          : `${window.location.origin}${ogImage.startsWith('/') ? ogImage : `/${ogImage}`}`;
        upsertMeta('property', 'og:image', resolvedImage);
        upsertMeta('name', 'twitter:image', resolvedImage);
      }

      if (!isAdminRoute) {
        let orgScript = document.head.querySelector<HTMLScriptElement>(
          'script[type="application/ld+json"][data-seo-id="global-organization"]'
        );
        if (!orgScript) {
          orgScript = document.createElement('script');
          orgScript.type = 'application/ld+json';
          orgScript.setAttribute('data-seo-id', 'global-organization');
          document.head.appendChild(orgScript);
        }
        const areas = seoSettings.areaLayanan
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean);
        orgScript.textContent = JSON.stringify({
          '@context': 'https://schema.org',
          '@type': seoSettings.tipeSkema || 'FurnitureStore',
          name: businessConfig.namaMerek,
          url: originBase,
          description: seoSettings.deskripsiBawaan,
          telephone: businessConfig.whatsapp.nomorTampil,
          priceRange: seoSettings.kisaranHarga || '$$',
          areaServed: areas,
          address: {
            '@type': 'PostalAddress',
            streetAddress: `${businessConfig.alamat.jalan}, ${businessConfig.alamat.rtRw}, ${businessConfig.alamat.desa}`,
            addressLocality: businessConfig.alamat.kabupaten,
            postalCode: businessConfig.alamat.kodePos,
            addressCountry: 'ID',
          },
        });
      }
    }
  }, [
    title,
    description,
    ogType,
    ogImage,
    keywordsJoined,
    explicitRobots,
    seoSettings,
    businessConfig,
  ]);
}

export function useJsonLdSchema(scriptId: string, schemaData: Record<string, unknown> | null) {
  const serialized = schemaData ? JSON.stringify(schemaData) : '';

  useEffect(() => {
    if (!serialized) return;
    let script = document.head.querySelector<HTMLScriptElement>(
      `script[type="application/ld+json"][data-seo-id="${scriptId}"]`
    );
    if (!script) {
      script = document.createElement('script');
      script.type = 'application/ld+json';
      script.setAttribute('data-seo-id', scriptId);
      document.head.appendChild(script);
    }
    script.textContent = serialized;

    return () => {
      script?.remove();
    };
  }, [scriptId, serialized]);
}
