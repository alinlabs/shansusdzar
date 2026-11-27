import { useState, type FormEvent } from 'react';
import { Check, Copy } from 'lucide-react';
import { AdminActionButton } from '../../../components/admin/admin-action-buttons';
import { AdminFormSectionCard } from '../../../components/admin/admin-form';
import {
  AdminMobileTabBar,
  type MobileFormTabItem,
  type MobileFormViewMode,
} from '../../../components/admin/mobile-form-tabs';
import {
  FormField,
  FormFieldStyleProvider,
  Input,
  Select,
  Textarea,
} from '../../../components/ui/form-controls';
import { useIsMobileViewport } from '../../../hooks/use-mobile-viewport';
import { DEFAULT_SITE_ORIGIN } from '../../../lib/site-url';
import type { BusinessConfig } from '../../../types/business';
import type { SeoSettingsConfig } from '../../../types/cms';
import { useAdminScrollControl } from '../admin-shell';

const SEO_MOBILE_TABS: readonly MobileFormTabItem[] = [
  { id: 'meta-global', label: 'Meta Global' },
  { id: 'open-graph', label: 'OpenGraph' },
  { id: 'per-halaman', label: 'Per Halaman' },
  { id: 'schema', label: 'Schema.org' },
  { id: 'pratinjau', label: 'Pratinjau' },
] as const;

interface SectionAdminSeoProps {
  formId?: string;
  seoSettings: SeoSettingsConfig;
  businessConfig: BusinessConfig;
  canEdit: boolean;
  mobileViewMode?: MobileFormViewMode;
  onSaveSeo: (next: SeoSettingsConfig) => void;
}

function LengthStatusNote({
  length,
  min,
  max,
}: {
  length: number;
  min: number;
  max: number;
}) {
  const isIdeal = length >= min && length <= max;
  const isLong = length > max;
  return (
    <span
      className={[
        'text-[11px] tabular-nums font-medium shrink-0',
        isIdeal
          ? 'text-[var(--success)]'
          : isLong
            ? 'text-[var(--danger)]'
            : 'text-[var(--text-muted)]',
      ].join(' ')}
    >
      {length} karakter ({min}–{max})
    </span>
  );
}

export function SectionAdminSeo({
  formId = 'admin-seo-form',
  seoSettings,
  businessConfig,
  canEdit,
  mobileViewMode = 'tab',
  onSaveSeo,
}: SectionAdminSeoProps) {
  const isMobile = useIsMobileViewport();
  const { scrollMainToTop, scrollMainToFirstError } = useAdminScrollControl();
  const isMobileTabMode = isMobile && mobileViewMode === 'tab';
  const [activeTabId, setActiveTabId] = useState<string>('meta-global');
  const [draft, setDraft] = useState<SeoSettingsConfig>(() => structuredClone(seoSettings));
  const [copiedJsonLd, setCopiedJsonLd] = useState(false);

  const originPreview = (draft.urlKanonikalDasar || DEFAULT_SITE_ORIGIN).replace(
    /\/+$/,
    ''
  );

  const schemaJsonObject = {
    '@context': 'https://schema.org',
    '@type': draft.tipeSkema,
    name: businessConfig.namaMerek,
    url: originPreview,
    description: draft.deskripsiBawaan,
    telephone: businessConfig.whatsapp.nomorTampil,
    priceRange: draft.kisaranHarga || '$$',
    areaServed: draft.areaLayanan
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    address: {
      '@type': 'PostalAddress',
      streetAddress: `${businessConfig.alamat.jalan}, ${businessConfig.alamat.rtRw}, ${businessConfig.alamat.desa}`,
      addressLocality: businessConfig.alamat.kabupaten,
      postalCode: businessConfig.alamat.kodePos,
      addressCountry: 'ID',
    },
  };

  const formattedJsonLd = JSON.stringify(schemaJsonObject, null, 2);

  const handleCopyJsonLd = async () => {
    try {
      await navigator.clipboard.writeText(formattedJsonLd);
      setCopiedJsonLd(true);
      window.setTimeout(() => setCopiedJsonLd(false), 1800);
    } catch {
      // Ignore clipboard failures
    }
  };

  const handleOverrideChange = (
    index: number,
    field: 'judulMeta' | 'deskripsiMeta' | 'kataKunciFokus',
    value: string
  ) => {
    setDraft((prev) => ({
      ...prev,
      penyesuaianHalaman: prev.penyesuaianHalaman.map((item, idx) =>
        idx === index ? { ...item, [field]: value } : item
      ),
    }));
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!canEdit) return;
    onSaveSeo({
      ...draft,
      urlKanonikalDasar: draft.urlKanonikalDasar.trim() || DEFAULT_SITE_ORIGIN,
      judulBawaan: draft.judulBawaan.trim() || businessConfig.namaMerek,
      deskripsiBawaan: draft.deskripsiBawaan.trim(),
    });
  };

  return (
    <FormFieldStyleProvider labelTone="thin" hideHints>
      {isMobileTabMode && (
        <AdminMobileTabBar
          tabs={SEO_MOBILE_TABS}
          activeTabId={activeTabId}
          tabIdPrefix="seo-tab"
          panelIdPrefix="seo-panel"
          onSelectTab={(nextTabId) => {
            setActiveTabId(nextTabId);
            scrollMainToTop();
          }}
        />
      )}

      <div className="[&_input]:font-medium [&_textarea]:font-medium">
        <form
          id={formId}
          onSubmit={handleSubmit}
          onInvalidCapture={() => {
            if (isMobileTabMode && activeTabId !== 'meta-global') {
              setActiveTabId('meta-global');
              requestAnimationFrame(() => scrollMainToFirstError());
            }
          }}
          className="grid grid-cols-1 gap-5 sm:gap-6 max-w-6xl [&>*]:min-w-0"
        >
          {!canEdit && (
            <div className="p-4 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-muted)] text-xs text-[var(--text-muted)]">
              Anda hanya memiliki akses baca-saja untuk pengaturan SEO (`tentang.edit` diperlukan untuk
              menyimpan perubahan).
            </div>
          )}

          <div
            id={isMobileTabMode ? 'seo-panel-pratinjau' : undefined}
            role={isMobileTabMode ? 'tabpanel' : undefined}
            aria-labelledby={isMobileTabMode ? 'seo-tab-pratinjau' : undefined}
            className={
              isMobileTabMode && activeTabId !== 'pratinjau'
                ? 'hidden'
                : 'grid grid-cols-1 lg:grid-cols-2 gap-4'
            }
          >
            <AdminFormSectionCard title="Pratinjau Google">
              <div className="p-3.5 sm:p-4 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)] space-y-1.5">
                <p className="text-xs text-[var(--text-muted)] truncate">{originPreview}</p>
                <p className="text-base font-semibold text-[var(--accent)] leading-snug line-clamp-1">
                  {draft.judulBawaan || businessConfig.namaMerek}
                </p>
                <p className="text-xs text-[var(--text-muted)] leading-relaxed line-clamp-2">
                  {draft.deskripsiBawaan}
                </p>
              </div>
            </AdminFormSectionCard>

            <AdminFormSectionCard title="Pratinjau OpenGraph">
              <div className="rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)] overflow-hidden flex items-stretch">
                <div className="w-24 sm:w-28 bg-[var(--surface-muted)] shrink-0 flex items-center justify-center p-2 border-r border-[var(--border)]">
                  <img
                    src={draft.urlGambarOg || '/metatag.webp'}
                    alt="Pratinjau gambar OpenGraph"
                    className="w-full h-16 object-cover rounded-[var(--radius-sm)]"
                  />
                </div>
                <div className="p-3 min-w-0 space-y-1">
                  <p className="text-[11px] uppercase tracking-wider text-[var(--text-subtle)] truncate">
                    {draft.namaSitusOg}
                  </p>
                  <p className="text-xs sm:text-sm font-semibold text-[var(--text)] line-clamp-1">
                    {draft.judulBawaan}
                  </p>
                  <p className="text-xs text-[var(--text-muted)] line-clamp-2">
                    {draft.deskripsiBawaan}
                  </p>
                </div>
              </div>
            </AdminFormSectionCard>
          </div>

          <div
            id={isMobileTabMode ? 'seo-panel-meta-global' : undefined}
            role={isMobileTabMode ? 'tabpanel' : undefined}
            aria-labelledby={isMobileTabMode ? 'seo-tab-meta-global' : undefined}
            className={isMobileTabMode && activeTabId !== 'meta-global' ? 'hidden' : undefined}
          >
            <AdminFormSectionCard title="Meta Global">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                id="seo-title"
                label="Judul Situs Utama (<title>)"
                required
                labelAction={<LengthStatusNote length={draft.judulBawaan.length} min={30} max={60} />}
              >
                <Input
                  id="seo-title"
                  disabled={!canEdit}
                  value={draft.judulBawaan}
                  onChange={(e) => setDraft((p) => ({ ...p, judulBawaan: e.target.value }))}
                />
              </FormField>

              <FormField id="seo-canonical" label="Domain Kanonikal Utama (Canonical URL)">
                <Input
                  id="seo-canonical"
                  type="url"
                  disabled={!canEdit}
                  value={draft.urlKanonikalDasar}
                  placeholder={DEFAULT_SITE_ORIGIN}
                  onChange={(e) => setDraft((p) => ({ ...p, urlKanonikalDasar: e.target.value }))}
                />
              </FormField>
            </div>

            <FormField
              id="seo-desc"
              label="Meta Deskripsi Utama"
              required
              labelAction={<LengthStatusNote length={draft.deskripsiBawaan.length} min={120} max={160} />}
            >
              <Textarea
                id="seo-desc"
                rows={2}
                disabled={!canEdit}
                value={draft.deskripsiBawaan}
                onChange={(e) => setDraft((p) => ({ ...p, deskripsiBawaan: e.target.value }))}
              />
            </FormField>

            <FormField id="seo-keywords" label="Kata Kunci Utama (pisahkan dengan koma)">
              <Input
                id="seo-keywords"
                disabled={!canEdit}
                placeholder="Contoh: interior purwakarta, furniture custom, kitchen set hpl"
                value={draft.kataKunci}
                onChange={(e) => setDraft((p) => ({ ...p, kataKunci: e.target.value }))}
              />
            </FormField>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField id="seo-robots" label="Kebijakan Indexing Robot">
                <Select
                  id="seo-robots"
                  disabled={!canEdit}
                  value={draft.kebijakanRobots}
                  onChange={(e) =>
                    setDraft((p) => ({
                      ...p,
                      kebijakanRobots: e.target.value as SeoSettingsConfig['kebijakanRobots'],
                    }))
                  }
                >
                  <option value="index, follow">index, follow (Direkomendasikan untuk publik)</option>
                  <option value="index, nofollow">index, nofollow</option>
                  <option value="noindex, nofollow">noindex, nofollow (Sembunyikan dari Google)</option>
                </Select>
              </FormField>

              <FormField id="seo-gsc" label="Kode Verifikasi Google Search Console (Opsional)">
                <Input
                  id="seo-gsc"
                  disabled={!canEdit}
                  value={draft.verifikasiGoogleSite}
                  placeholder="Token meta google-site-verification"
                  onChange={(e) =>
                    setDraft((p) => ({ ...p, verifikasiGoogleSite: e.target.value }))
                  }
                />
              </FormField>
            </div>
          </AdminFormSectionCard>
          </div>

          <div
            id={isMobileTabMode ? 'seo-panel-open-graph' : undefined}
            role={isMobileTabMode ? 'tabpanel' : undefined}
            aria-labelledby={isMobileTabMode ? 'seo-tab-open-graph' : undefined}
            className={isMobileTabMode && activeTabId !== 'open-graph' ? 'hidden' : undefined}
          >
            <AdminFormSectionCard title="OpenGraph & X">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <FormField id="seo-og-site" label="Nama Situs (og:site_name)">
                <Input
                  id="seo-og-site"
                  disabled={!canEdit}
                  value={draft.namaSitusOg}
                  onChange={(e) => setDraft((p) => ({ ...p, namaSitusOg: e.target.value }))}
                />
              </FormField>
              <FormField id="seo-og-img" label="Gambar Pratinjau (og:image)">
                <Input
                  id="seo-og-img"
                  disabled={!canEdit}
                  value={draft.urlGambarOg}
                  onChange={(e) => setDraft((p) => ({ ...p, urlGambarOg: e.target.value }))}
                />
              </FormField>
              <FormField id="seo-tw-card" label="Format Kartu X/Twitter">
                <Select
                  id="seo-tw-card"
                  disabled={!canEdit}
                  value={draft.kartuTwitter}
                  onChange={(e) =>
                    setDraft((p) => ({
                      ...p,
                      kartuTwitter: e.target.value as SeoSettingsConfig['kartuTwitter'],
                    }))
                  }
                >
                  <option value="summary_large_image">summary_large_image (Banner Besar)</option>
                  <option value="summary">summary (Ringkas)</option>
                </Select>
              </FormField>
              <FormField id="seo-tw-handle" label="Akun Sosial (@handle)">
                <Input
                  id="seo-tw-handle"
                  disabled={!canEdit}
                  value={draft.akunTwitter}
                  onChange={(e) => setDraft((p) => ({ ...p, akunTwitter: e.target.value }))}
                />
              </FormField>
            </div>
          </AdminFormSectionCard>
          </div>

          <div
            id={isMobileTabMode ? 'seo-panel-per-halaman' : undefined}
            role={isMobileTabMode ? 'tabpanel' : undefined}
            aria-labelledby={isMobileTabMode ? 'seo-tab-per-halaman' : undefined}
            className={isMobileTabMode && activeTabId !== 'per-halaman' ? 'hidden' : undefined}
          >
            <AdminFormSectionCard title="Meta Tiap Halaman">
            <div className="space-y-4">
              {draft.penyesuaianHalaman.map((page, index) => (
                <div
                  key={page.jalurRute}
                  className="p-3.5 sm:p-4 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)] space-y-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-[var(--text)]">
                      {page.labelHalaman}{' '}
                      <span className="font-mono text-xs text-[var(--text-muted)]">
                        ({page.jalurRute})
                      </span>
                    </p>
                    <LengthStatusNote length={page.judulMeta.length} min={30} max={60} />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <FormField id={`seo-page-title-${index}`} label="Meta Title Halaman">
                      <Input
                        id={`seo-page-title-${index}`}
                        disabled={!canEdit}
                        value={page.judulMeta}
                        onChange={(e) => handleOverrideChange(index, 'judulMeta', e.target.value)}
                      />
                    </FormField>
                    <FormField id={`seo-page-kw-${index}`} label="Fokus Kata Kunci">
                      <Input
                        id={`seo-page-kw-${index}`}
                        disabled={!canEdit}
                        value={page.kataKunciFokus}
                        onChange={(e) => handleOverrideChange(index, 'kataKunciFokus', e.target.value)}
                      />
                    </FormField>
                  </div>

                  <FormField
                    id={`seo-page-desc-${index}`}
                    label="Meta Deskripsi Halaman"
                    labelAction={<LengthStatusNote length={page.deskripsiMeta.length} min={120} max={160} />}
                  >
                    <Textarea
                      id={`seo-page-desc-${index}`}
                      rows={2}
                      disabled={!canEdit}
                      value={page.deskripsiMeta}
                      onChange={(e) => handleOverrideChange(index, 'deskripsiMeta', e.target.value)}
                    />
                  </FormField>
                </div>
              ))}
            </div>
          </AdminFormSectionCard>
          </div>

          <div
            id={isMobileTabMode ? 'seo-panel-schema' : undefined}
            role={isMobileTabMode ? 'tabpanel' : undefined}
            aria-labelledby={isMobileTabMode ? 'seo-tab-schema' : undefined}
            className={isMobileTabMode && activeTabId !== 'schema' ? 'hidden' : undefined}
          >
            <AdminFormSectionCard
              title="Schema.org (JSON-LD)"
            headerAction={
              <AdminActionButton
                variant={copiedJsonLd ? 'success' : 'default'}
                icon={copiedJsonLd ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                label={copiedJsonLd ? 'Disalin' : 'Salin JSON-LD'}
                onClick={handleCopyJsonLd}
              />
            }
          >
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <FormField id="seo-schema-type" label="Tipe Entitas Schema">
                <Select
                  id="seo-schema-type"
                  disabled={!canEdit}
                  value={draft.tipeSkema}
                  onChange={(e) =>
                    setDraft((p) => ({
                      ...p,
                      tipeSkema: e.target.value as SeoSettingsConfig['tipeSkema'],
                    }))
                  }
                >
                  <option value="FurnitureStore">FurnitureStore</option>
                  <option value="HomeAndConstructionBusiness">HomeAndConstructionBusiness</option>
                  <option value="LocalBusiness">LocalBusiness</option>
                </Select>
              </FormField>

              <FormField id="seo-schema-price" label="Rentang Harga (priceRange)">
                <Select
                  id="seo-schema-price"
                  disabled={!canEdit}
                  value={draft.kisaranHarga}
                  onChange={(e) => setDraft((p) => ({ ...p, kisaranHarga: e.target.value }))}
                >
                  <option value="$">$ (Ekonomis)</option>
                  <option value="$$">$$ (Menengah - Custom)</option>
                  <option value="$$$">$$$ (Premium)</option>
                </Select>
              </FormField>

              <FormField id="seo-schema-area" label="Area Layanan (pisahkan koma)">
                <Input
                  id="seo-schema-area"
                  disabled={!canEdit}
                  value={draft.areaLayanan}
                  onChange={(e) => setDraft((p) => ({ ...p, areaLayanan: e.target.value }))}
                />
              </FormField>
            </div>

            <pre className="p-4 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)] text-[11px] leading-relaxed text-[var(--text-muted)] overflow-x-auto font-mono">
              {formattedJsonLd}
            </pre>
            </AdminFormSectionCard>
          </div>
        </form>
      </div>
    </FormFieldStyleProvider>
  );
}
