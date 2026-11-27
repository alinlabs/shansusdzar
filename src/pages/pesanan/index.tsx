import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  PencilLine,
  UserCheck,
  UserRoundPlus,
} from 'lucide-react';
import { Button, LinkButton } from '../../components/ui/button';
import { FormField, Textarea } from '../../components/ui/form-controls';
import { useOrderBottomAction } from '../../components/layout/order-bottom-action';
import { SectionHeading } from '../../components/ui/section-heading';
import { useDocumentTitle } from '../../hooks/use-document-title';
import { useAnalyticsStore } from '../../store/analytics-store';
import { calculateCartSummary, useCartStore } from '../../store/cart-store';
import {
  loadPersistedOrderForm,
  savePersistedOrderForm,
} from '../../store/order-form-cache';
import {
  isUserProfileComplete,
  useUserProfileStore,
} from '../../store/user-profile-store';
import { SectionOrderSummary } from './section-order-summary';
import {
  SectionWhatsAppHandoff,
  type HandoffUiStatus,
} from './section-whatsapp-handoff';
import type { ValidatedCustomerData } from './types';
import { useOrderPdf } from './use-order-pdf';
import { openPdfBlobUrlInNewTab } from '../../lib/pdf/open-pdf-blob';
import { formatCoordinatesLabel } from './utils';
import {
  buildWhatsAppHandoffUrl,
  executeWhatsAppHandoff,
  triggerBlobDownload,
} from './whatsapp-handoff';

export default function PesananPage() {
  useDocumentTitle(
    'Halaman Pesanan | Shansusdzar Indonesia',
    'Tinjau ringkasan lengkap produk serta konfigurasi custom interior Anda menggunakan profil tersimpan sebelum mengirim pesanan.'
  );

  const items = useCartStore((state) => state.items);
  const clearCart = useCartStore((state) => state.clearCart);
  const summary = calculateCartSummary(items);
  const { setAction } = useOrderBottomAction();

  const profile = useUserProfileStore((state) => state.profile);
  const openProfileModal = useUserProfileStore((state) => state.openProfileModal);
  const syncProfileActivity = useUserProfileStore((state) => state.syncProfileActivity);
  const profileComplete = isUserProfileComplete(profile);

  const [orderNotes, setOrderNotes] = useState<string>(() => loadPersistedOrderForm().values.notes);
  const [wasDraftClearedAfterHandoff, setWasDraftClearedAfterHandoff] = useState(false);

  useEffect(() => {
    savePersistedOrderForm(
      {
        fullName: profile.fullName,
        phone: profile.phone,
        address: profile.address,
        notes: orderNotes,
      },
      profile.coordinates
    );
  }, [profile.fullName, profile.phone, profile.address, profile.coordinates, orderNotes]);

  const validatedCustomer = useMemo<ValidatedCustomerData | null>(() => {
    if (!profileComplete) return null;
    return {
      fullName: profile.fullName.trim(),
      rawPhone: profile.phone.trim(),
      normalizedPhone: profile.normalizedPhone || profile.phone.trim(),
      address: profile.address.trim(),
      notes: orderNotes.trim(),
      coordinates: profile.coordinates,
    };
  }, [
    profileComplete,
    profile.fullName,
    profile.phone,
    profile.normalizedPhone,
    profile.address,
    profile.coordinates,
    orderNotes,
  ]);

  const [isSharing, setIsSharing] = useState(false);
  const [handoffStatus, setHandoffStatus] = useState<HandoffUiStatus>({ kind: 'idle' });

  const pdfState = useOrderPdf(items, validatedCustomer);
  const { builtPdf, isBuilding, buildError, dataModel, referenceCode, pdfBlobUrl } = pdfState;

  const scrollToHandoffFeedback = useCallback(() => {
    window.requestAnimationFrame(() => {
      document.getElementById('whatsapp-handoff-section')?.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      });
    });
  }, []);

  useEffect(() => {
    if (
      validatedCustomer &&
      builtPdf &&
      !isBuilding &&
      (handoffStatus.kind === 'validation-required' ||
        handoffStatus.kind === 'pdf-building' ||
        handoffStatus.kind === 'pdf-missing')
    ) {
      setHandoffStatus({ kind: 'idle' });
    }
  }, [validatedCustomer, builtPdf, isBuilding, handoffStatus.kind]);

  const handleOpenProfileModal = useCallback(() => {
    openProfileModal({ intent: 'pesanan' });
  }, [openProfileModal]);

  const handleSendOrder = useCallback(async () => {
    if (!validatedCustomer) {
      setHandoffStatus({
        kind: 'validation-required',
        message: 'Lengkapi data profil Anda terlebih dahulu sebelum mengirim pesanan.',
      });
      handleOpenProfileModal();
      return;
    }

    if (isBuilding) {
      setHandoffStatus({
        kind: 'pdf-building',
        message:
          'Dokumen PDF sedang disusun di peramban Anda. Tunggu sesaat lalu tekan "Kirim Pesanan" kembali.',
      });
      scrollToHandoffFeedback();
      return;
    }

    if (buildError || !builtPdf) {
      setHandoffStatus({
        kind: 'pdf-missing',
        message:
          'Dokumen PDF belum tersedia untuk dikirim. Silakan muat ulang pembuatan PDF terlebih dahulu.',
      });
      scrollToHandoffFeedback();
      return;
    }

    setIsSharing(true);
    try {
      const result = await executeWhatsAppHandoff({
        file: builtPdf.file,
        blob: builtPdf.blob,
        filename: builtPdf.filename,
        customerName: validatedCustomer.fullName,
        referenceCode,
        totalLineCount: summary.lineCount,
        totalQuantity: summary.totalQuantity,
      });

      useAnalyticsStore.getState().recordOrderInquiry();
      syncProfileActivity(
        `Mengirim ringkasan pesanan ${referenceCode} (${summary.totalQuantity} unit)`,
        ['profil-user', 'pesanan-web']
      );

      setHandoffStatus({
        kind: result.outcome,
        whatsappUrl: result.whatsappUrl,
        filename: result.filename,
      });
      scrollToHandoffFeedback();
    } finally {
      setIsSharing(false);
    }
  }, [
    validatedCustomer,
    handleOpenProfileModal,
    isBuilding,
    buildError,
    builtPdf,
    referenceCode,
    summary.lineCount,
    summary.totalQuantity,
    scrollToHandoffFeedback,
    syncProfileActivity,
  ]);

  const handleDownloadOnly = useCallback(() => {
    if (!validatedCustomer || isBuilding || buildError || !builtPdf) return;
    triggerBlobDownload(builtPdf.blob, builtPdf.filename);
  }, [validatedCustomer, isBuilding, buildError, builtPdf]);

  const handleOpenPdfBlob = useCallback(() => {
    if (isBuilding) {
      setHandoffStatus({
        kind: 'pdf-building',
        message:
          'Dokumen PDF sedang disiapkan di peramban Anda. Tunggu sebentar lalu tekan ikon cetak kembali.',
      });
      scrollToHandoffFeedback();
      return;
    }

    if (buildError || !pdfBlobUrl) {
      setHandoffStatus({
        kind: 'pdf-missing',
        message:
          'Dokumen PDF belum tersedia untuk ditampilkan. Silakan muat ulang pembuatan PDF terlebih dahulu.',
      });
      scrollToHandoffFeedback();
      return;
    }

    openPdfBlobUrlInNewTab(pdfBlobUrl);
  }, [isBuilding, buildError, pdfBlobUrl, scrollToHandoffFeedback]);

  const handleManualDownloadAndOpenWhatsApp = useCallback(() => {
    if (!builtPdf || !validatedCustomer || !dataModel) return;
    triggerBlobDownload(builtPdf.blob, builtPdf.filename);
    const fallbackUrl = buildWhatsAppHandoffUrl({
      customerName: validatedCustomer.fullName,
      referenceCode,
      filename: dataModel.filename,
      totalLineCount: summary.lineCount,
      totalQuantity: summary.totalQuantity,
    });
    const opened = window.open(fallbackUrl, '_blank', 'noopener,noreferrer');
    useAnalyticsStore.getState().recordOrderInquiry();
    syncProfileActivity(
      `Mengirim ringkasan pesanan ${referenceCode} (${summary.totalQuantity} unit)`,
      ['profil-user', 'pesanan-web']
    );
    setHandoffStatus({
      kind: !opened ? 'popup-blocked' : 'whatsapp-fallback-opened',
      whatsappUrl: fallbackUrl,
      filename: builtPdf.filename,
    });
  }, [
    builtPdf,
    validatedCustomer,
    dataModel,
    referenceCode,
    summary.lineCount,
    summary.totalQuantity,
    syncProfileActivity,
  ]);

  const handleConfirmClearDraft = useCallback(() => {
    clearCart();
    setOrderNotes('');
    setHandoffStatus({ kind: 'idle' });
    setWasDraftClearedAfterHandoff(true);
  }, [clearCart]);

  const handleSendOrderRef = useRef(handleSendOrder);
  handleSendOrderRef.current = handleSendOrder;

  const handleOpenPdfBlobRef = useRef(handleOpenPdfBlob);
  handleOpenPdfBlobRef.current = handleOpenPdfBlob;

  const handleOpenProfileModalRef = useRef(handleOpenProfileModal);
  handleOpenProfileModalRef.current = handleOpenProfileModal;

  useEffect(() => {
    if (items.length === 0) {
      setAction(null);
      return;
    }

    if (!validatedCustomer) {
      setAction({
        label: 'Isi Profil untuk Lanjut',
        onSubmit: () => {
          handleOpenProfileModalRef.current();
        },
        disabled: false,
        isBusy: false,
      });
      return;
    }

    setAction({
      label: 'Kirim Pesanan',
      onSubmit: () => {
        void handleSendOrderRef.current();
      },
      disabled: isSharing,
      isBusy: isSharing,
      secondaryAction: {
        ariaLabel: 'Buka & Cetak PDF',
        onClick: () => {
          handleOpenPdfBlobRef.current();
        },
        disabled: isBuilding && !pdfBlobUrl,
        isBusy: isBuilding,
      },
    });
  }, [items.length, validatedCustomer, isSharing, isBuilding, pdfBlobUrl, setAction]);

  useEffect(() => {
    return () => {
      setAction(null);
    };
  }, [setAction]);

  if (items.length === 0) {
    return (
      <section aria-labelledby="pesanan-empty-heading" className="py-6 sm:py-10">
        <div className="py-8 sm:py-12 border-t border-[var(--border)] w-full text-center space-y-6">
          {wasDraftClearedAfterHandoff && (
            <div
              role="status"
              aria-live="polite"
              className="p-4 rounded-[var(--radius-md)] border border-[var(--success-border)] bg-[var(--success-surface)] flex items-start gap-2.5 text-xs text-left"
            >
              <CheckCircle2
                className="size-4 text-[var(--success)] shrink-0 mt-0.5"
                aria-hidden="true"
              />
              <p className="text-[var(--text)] leading-relaxed">
                Daftar item pesanan telah dikosongkan sesuai konfirmasi Anda, sementara data profil
                Anda tetap tersimpan untuk pesanan berikutnya. Jika belum sempat melampirkan PDF di
                WhatsApp, Anda tetap dapat menggunakan file yang sudah terunduh di perangkat Anda.
              </p>
            </div>
          )}

          <div className="size-12 mx-auto rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-muted)] flex items-center justify-center text-[var(--text-muted)]">
            <ClipboardList className="size-5" aria-hidden="true" />
          </div>

          <SectionHeading
            as="h1"
            id="pesanan-empty-heading"
            align="center"
            title="Daftar Pesanan Masih Kosong"
            description="Anda belum memilih unit furniture maupun menyusun rencana custom interior. Jelajahi daftar produk untuk memulai pesanan Anda."
          />

          <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
            <LinkButton to="/produk" variant="primary" size="lg">
              Jelajahi Produk Furniture
              <ArrowRight className="size-4" aria-hidden="true" />
            </LinkButton>
            <LinkButton to="/produk/custom" variant="secondary" size="lg">
              Hitung Estimasi Custom Interior
            </LinkButton>
          </div>
        </div>
      </section>
    );
  }

  return (
    <div className="space-y-8 sm:space-y-10">
      <SectionHeading
        as="h1"
        id="pesanan-heading"
        align="center"
        eyebrow="Halaman Pesanan"
        title={validatedCustomer ? 'Ringkasan Semua Pesanan' : 'Lengkapi Profil untuk Memesan'}
        description={
          validatedCustomer
            ? 'Data pemesan diambil otomatis dari profil Anda. Periksa kembali rincian item serta dokumen PDF sebelum menekan Kirim Pesanan.'
            : 'Pesanan menggunakan nama, nomor telepon, dan lokasi alamat dari Profil Anda (tanpa perlu password).'
        }
      />

      {!validatedCustomer ? (
        <div className="space-y-8 w-full">
          <section
            aria-labelledby="profile-required-heading"
            data-testid="pesanan-profile-required"
            className="p-5 sm:p-6 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface)] space-y-4"
          >
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="size-10 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-muted)] flex items-center justify-center text-[var(--text)] shrink-0">
                  <UserRoundPlus className="size-4" aria-hidden="true" />
                </div>
                <div className="space-y-1">
                  <h2
                    id="profile-required-heading"
                    className="text-base font-semibold text-[var(--text)]"
                  >
                    Data Profil Belum Tersedia
                  </h2>
                  <p className="text-xs sm:text-sm text-[var(--text-muted)] leading-relaxed">
                    Isi nama, nomor telepon/WhatsApp, dan lokasi alamat sekali saja agar pesanan
                    dan dokumen PDF langsung tersusun otomatis di halaman ini.
                  </p>
                </div>
              </div>

              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={handleOpenProfileModal}
                data-testid="pesanan-fill-profile-btn"
                className="shrink-0 whitespace-nowrap"
              >
                Isi Profil Sekarang
                <ArrowRight className="size-3.5" aria-hidden="true" />
              </Button>
            </div>
          </section>

          <SectionOrderSummary />
        </div>
      ) : (
        <div className="space-y-8 w-full">
          <section
            aria-labelledby="customer-summary-heading"
            data-testid="pesanan-profile-summary"
            className="pt-5 border-t border-[var(--border)] space-y-5"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-[var(--border)]">
              <div className="space-y-0.5">
                <div className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--success)]">
                  <UserCheck className="size-3.5" aria-hidden="true" />
                  <span>Menggunakan Profil Tersimpan</span>
                </div>
                <h2
                  id="customer-summary-heading"
                  className="text-base sm:text-lg font-semibold text-[var(--text)]"
                >
                  Data Pemesan &amp; Lokasi
                </h2>
              </div>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={handleOpenProfileModal}
                data-testid="pesanan-edit-profile-btn"
              >
                <PencilLine className="size-3.5" aria-hidden="true" />
                Ubah Data
              </Button>
            </div>

            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4 text-sm">
              <div className="space-y-1">
                <dt className="text-xs text-[var(--text-muted)]">Nama Lengkap</dt>
                <dd className="font-medium text-[var(--text)]">{validatedCustomer.fullName}</dd>
              </div>
              <div className="space-y-1">
                <dt className="text-xs text-[var(--text-muted)]">Nomor Telepon / WhatsApp</dt>
                <dd className="font-medium text-[var(--text)] tabular-nums">
                  {validatedCustomer.normalizedPhone}
                </dd>
              </div>
              <div className="space-y-1 sm:col-span-2">
                <dt className="text-xs text-[var(--text-muted)]">Lokasi / Alamat</dt>
                <dd className="text-[var(--text)] whitespace-pre-line leading-relaxed">
                  {validatedCustomer.address}
                </dd>
              </div>
              {validatedCustomer.coordinates && (
                <div className="space-y-1 sm:col-span-2">
                  <dt className="text-xs text-[var(--text-muted)]">Titik Koordinat Lokasi</dt>
                  <dd className="font-medium text-[var(--text)] tabular-nums">
                    {formatCoordinatesLabel(validatedCustomer.coordinates)}
                  </dd>
                </div>
              )}
            </dl>

            <div className="pt-2 border-t border-[var(--border)]">
              <FormField id="order-extra-notes" label="Catatan Tambahan Pesanan (Opsional)">
                <Textarea
                  id="order-extra-notes"
                  name="notes"
                  rows={1}
                  autoGrowMaxRows={3}
                  placeholder="Contoh: jadwal survei yang diinginkan, akses jalan, atau permintaan khusus."
                  value={orderNotes}
                  onChange={(e) => setOrderNotes(e.target.value)}
                />
              </FormField>
            </div>
          </section>

          <SectionOrderSummary />

          <SectionWhatsAppHandoff
            validatedCustomer={validatedCustomer}
            pdfState={pdfState}
            totalLineCount={summary.lineCount}
            totalQuantity={summary.totalQuantity}
            uiStatus={handoffStatus}
            onDownloadOnly={handleDownloadOnly}
            onManualDownloadAndOpenWhatsApp={handleManualDownloadAndOpenWhatsApp}
            onConfirmClearDraft={handleConfirmClearDraft}
          />
        </div>
      )}
    </div>
  );
}
