import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  PencilLine,
} from 'lucide-react';
import { Button, LinkButton } from '../../components/ui/button';
import { useOrderBottomAction } from '../../components/layout/order-bottom-action';
import { SectionHeading } from '../../components/ui/section-heading';
import { useDocumentTitle } from '../../hooks/use-document-title';
import { useAnalyticsStore } from '../../store/analytics-store';
import { calculateCartSummary, useCartStore } from '../../store/cart-store';
import {
  loadPersistedOrderForm,
  savePersistedOrderForm,
} from '../../store/order-form-cache';
import { SectionCustomerForm } from './section-customer-form';
import { SectionOrderSummary } from './section-order-summary';
import {
  SectionWhatsAppHandoff,
  type HandoffUiStatus,
} from './section-whatsapp-handoff';
import type {
  CustomerFormValues,
  GeolocationState,
  ValidatedCustomerData,
} from './types';
import { useOrderPdf } from './use-order-pdf';
import { formatCoordinatesLabel, validateCustomerForm } from './utils';
import {
  buildWhatsAppHandoffUrl,
  executeWhatsAppHandoff,
  triggerBlobDownload,
} from './whatsapp-handoff';

function scrollAppContainerToTop() {
  const container = document.getElementById('app-scroll-container');
  if (container) {
    container.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

export default function PesananPage() {
  useDocumentTitle(
    'Halaman Pesanan | Shansusdzar Indonesia',
    'Lengkapi data pemesan dan tinjau ringkasan lengkap produk serta konfigurasi custom interior Anda sebelum mengirim pesanan.'
  );

  const items = useCartStore((state) => state.items);
  const clearCart = useCartStore((state) => state.clearCart);
  const summary = calculateCartSummary(items);
  const { setAction } = useOrderBottomAction();

  const [initialFormCache] = useState(() => loadPersistedOrderForm());
  const [step, setStep] = useState<1 | 2>(1);
  const [customerValues, setCustomerValues] = useState<CustomerFormValues>(
    () => initialFormCache.values
  );
  const [geolocation, setGeolocation] = useState<GeolocationState>(() => ({
    status: initialFormCache.coordinates ? 'success' : 'idle',
    coordinates: initialFormCache.coordinates,
    message: null,
  }));
  const [validatedCustomer, setValidatedCustomer] =
    useState<ValidatedCustomerData | null>(null);
  const [validationSignal, setValidationSignal] = useState(0);
  const [wasDraftClearedAfterHandoff, setWasDraftClearedAfterHandoff] = useState(false);

  useEffect(() => {
    savePersistedOrderForm(customerValues, geolocation.coordinates);
  }, [customerValues, geolocation.coordinates]);

  const [isSharing, setIsSharing] = useState(false);
  const [handoffStatus, setHandoffStatus] = useState<HandoffUiStatus>({ kind: 'idle' });

  const pdfState = useOrderPdf(items, validatedCustomer);
  const { builtPdf, isBuilding, buildError, dataModel, referenceCode, pdfBlobUrl } = pdfState;

  const handleRequestValidateCustomer = useCallback((): ValidatedCustomerData | null => {
    setValidationSignal((s) => s + 1);
    const check = validateCustomerForm(customerValues);
    if (!check.isValid) return null;

    const validData: ValidatedCustomerData = {
      fullName: customerValues.fullName.trim(),
      rawPhone: customerValues.phone.trim(),
      normalizedPhone: check.normalizedPhone,
      address: customerValues.address.trim(),
      notes: customerValues.notes.trim(),
      coordinates: geolocation.coordinates,
    };
    setValidatedCustomer(validData);
    return validData;
  }, [customerValues, geolocation.coordinates]);

  const handleContinueToSummary = useCallback((validData: ValidatedCustomerData) => {
    setValidatedCustomer(validData);
    setHandoffStatus({ kind: 'idle' });
    setStep(2);
    scrollAppContainerToTop();
  }, []);

  const handleBackToForm = useCallback(() => {
    setStep(1);
    scrollAppContainerToTop();
  }, []);

  const scrollToHandoffFeedback = useCallback(() => {
    window.requestAnimationFrame(() => {
      document.getElementById('whatsapp-handoff-section')?.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      });
    });
  }, []);

  // Reset stale validation / building notices once PDF finishes building
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

  const handleSendOrder = useCallback(async () => {
    if (!validatedCustomer) {
      const checked = handleRequestValidateCustomer();
      if (!checked) {
        setStep(1);
        setHandoffStatus({
          kind: 'validation-required',
          message:
            'Lengkapi dan verifikasi data pemesan (nama, nomor telepon, dan alamat) terlebih dahulu sebelum mengirim pesanan.',
        });
        return;
      }
      setHandoffStatus({
        kind: 'pdf-building',
        message:
          'Dokumen PDF sedang disusun di peramban Anda. Tunggu sebentar lalu tekan "Kirim Pesanan" kembali.',
      });
      scrollToHandoffFeedback();
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
    handleRequestValidateCustomer,
    isBuilding,
    buildError,
    builtPdf,
    referenceCode,
    summary.lineCount,
    summary.totalQuantity,
    scrollToHandoffFeedback,
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

    const link = document.createElement('a');
    link.href = pdfBlobUrl;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
    setHandoffStatus({
      kind: !opened ? 'popup-blocked' : 'whatsapp-fallback-opened',
      whatsappUrl: fallbackUrl,
      filename: builtPdf.filename,
    });
  }, [builtPdf, validatedCustomer, dataModel, referenceCode, summary.lineCount, summary.totalQuantity]);

  const handleConfirmClearDraft = useCallback(() => {
    clearCart();
    setValidatedCustomer(null);
    setHandoffStatus({ kind: 'idle' });
    setStep(1);
    setWasDraftClearedAfterHandoff(true);
  }, [clearCart]);

  const handleContinueFromBottomBar = useCallback(() => {
    const formEl = document.getElementById('customer-order-form');
    if (formEl instanceof HTMLFormElement) {
      formEl.requestSubmit();
      return;
    }
    const valid = handleRequestValidateCustomer();
    if (valid) {
      handleContinueToSummary(valid);
    }
  }, [handleRequestValidateCustomer, handleContinueToSummary]);

  const handleSendOrderRef = useRef(handleSendOrder);
  handleSendOrderRef.current = handleSendOrder;

  const handleOpenPdfBlobRef = useRef(handleOpenPdfBlob);
  handleOpenPdfBlobRef.current = handleOpenPdfBlob;

  const handleContinueFromBottomBarRef = useRef(handleContinueFromBottomBar);
  handleContinueFromBottomBarRef.current = handleContinueFromBottomBar;

  useEffect(() => {
    if (items.length === 0) {
      setAction(null);
      return;
    }

    if (step === 1) {
      setAction({
        label: 'Lanjutkan',
        onSubmit: () => {
          handleContinueFromBottomBarRef.current();
        },
        disabled: false,
        isBusy: false,
      });
      return;
    }

    if (step === 2 && validatedCustomer) {
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
      return;
    }

    setAction(null);
  }, [items.length, step, validatedCustomer, isSharing, isBuilding, pdfBlobUrl, setAction]);

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
                Daftar item pesanan telah dikosongkan sesuai konfirmasi Anda, sementara data pemesan
                tetap tersimpan untuk pesanan berikutnya. Jika belum sempat melampirkan PDF di
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
        title={
          step === 1
            ? 'Lengkapi Data Pemesan'
            : 'Ringkasan Semua Pesanan'
        }
        description={
          step === 1
            ? 'Isi data pemesan dan alamat terlebih dahulu sebelum meninjau ringkasan lengkap pesanan Anda.'
            : 'Periksa kembali data pemesan, daftar item, serta dokumen PDF Anda sebelum menekan tombol Kirim Pesanan di bagian bawah.'
        }
      />

      {step === 1 ? (
        <SectionCustomerForm
          values={customerValues}
          geolocation={geolocation}
          validatedCustomer={validatedCustomer}
          validationSignal={validationSignal}
          itemSummaryLabel={`${summary.lineCount} item terpilih · Total ${summary.totalQuantity} unit`}
          onValuesChange={setCustomerValues}
          onGeolocationChange={setGeolocation}
          onValidated={setValidatedCustomer}
          onContinue={handleContinueToSummary}
        />
      ) : (
        <div className="space-y-8 w-full">
          <div className="flex items-center justify-between gap-4">
            <Button variant="ghost" size="sm" onClick={handleBackToForm}>
              <ArrowLeft className="size-3.5" aria-hidden="true" />
              Kembali ke Formulir Data Pemesan
            </Button>
          </div>

          {validatedCustomer && (
            <section
              aria-labelledby="customer-summary-heading"
              className="pt-5 border-t border-[var(--border)] space-y-5"
            >
              <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-[var(--border)]">
                <div className="space-y-0.5">
                  <h2
                    id="customer-summary-heading"
                    className="text-base sm:text-lg font-semibold text-[var(--text)]"
                  >
                    Data Pemesan &amp; Lokasi
                  </h2>
                  <p className="text-xs text-[var(--text-muted)]">
                    Informasi pemesan yang akan dicantumkan pada dokumen pesanan.
                  </p>
                </div>
                <Button variant="secondary" size="sm" onClick={handleBackToForm}>
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
                  <dt className="text-xs text-[var(--text-muted)]">Alamat</dt>
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
                {validatedCustomer.notes && (
                  <div className="space-y-1 sm:col-span-2">
                    <dt className="text-xs text-[var(--text-muted)]">Catatan Tambahan</dt>
                    <dd className="text-[var(--text)] whitespace-pre-line leading-relaxed">
                      {validatedCustomer.notes}
                    </dd>
                  </div>
                )}
              </dl>
            </section>
          )}

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
