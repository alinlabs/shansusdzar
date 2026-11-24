import { useMemo, useState } from 'react';
import {
  AlertCircle,
  Download,
  ExternalLink,
  Info,
  MessageSquare,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import { Button, ExternalLinkButton } from '../../components/ui/button';
import { BUSINESS_CONFIG } from '../../lib/business-config';
import type { OrderPdfState } from './use-order-pdf';
import type { ValidatedCustomerData } from './types';
import {
  buildWhatsAppHandoffMessage,
  type HandoffOutcome,
} from './whatsapp-handoff';

export type HandoffUiStatus =
  | { kind: 'idle' }
  | { kind: 'validation-required'; message: string }
  | { kind: 'pdf-building'; message: string }
  | { kind: 'pdf-missing'; message: string }
  | {
      kind: HandoffOutcome;
      whatsappUrl: string;
      filename: string;
    };

export interface SectionWhatsAppHandoffProps {
  validatedCustomer: ValidatedCustomerData | null;
  pdfState: OrderPdfState;
  totalLineCount: number;
  totalQuantity: number;
  uiStatus: HandoffUiStatus;
  onDownloadOnly: () => void;
  onManualDownloadAndOpenWhatsApp: () => void;
  onConfirmClearDraft: () => void;
}

export function SectionWhatsAppHandoff({
  validatedCustomer,
  pdfState,
  totalLineCount,
  totalQuantity,
  uiStatus,
  onDownloadOnly,
  onManualDownloadAndOpenWhatsApp,
  onConfirmClearDraft,
}: SectionWhatsAppHandoffProps) {
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);

  const { dataModel, referenceCode, retryBuild } = pdfState;

  const draftMessagePreview = useMemo(() => {
    if (!validatedCustomer || !dataModel) return null;
    return buildWhatsAppHandoffMessage({
      customerName: validatedCustomer.fullName,
      referenceCode,
      filename: dataModel.filename,
      totalLineCount,
      totalQuantity,
      mode: 'manual-attach',
    });
  }, [validatedCustomer, dataModel, referenceCode, totalLineCount, totalQuantity]);

  const showCompletedHandoffOptions =
    uiStatus.kind === 'shared-sheet-completed' ||
    uiStatus.kind === 'whatsapp-fallback-opened' ||
    uiStatus.kind === 'popup-blocked';

  return (
    <section
      id="whatsapp-handoff-section"
      aria-labelledby="whatsapp-handoff-heading"
      className="pt-6 border-t border-[var(--border)] space-y-5"
    >
      <div className="space-y-1 pb-4 border-b border-[var(--border)]">
        <div className="flex items-center gap-2">
          <MessageSquare className="size-4 text-[var(--text-muted)]" aria-hidden="true" />
          <h2
            id="whatsapp-handoff-heading"
            className="text-base sm:text-lg font-semibold text-[var(--text)]"
          >
            Tujuan Pengiriman WhatsApp
          </h2>
        </div>
        <p className="text-xs sm:text-sm text-[var(--text-muted)]">
          Tujuan resmi:{' '}
          <span className="font-medium text-[var(--text)] tabular-nums">
            {BUSINESS_CONFIG.whatsapp.nomorTampil}
          </span>{' '}
          ({BUSINESS_CONFIG.namaMerek}). Tekan tombol{' '}
          <span className="font-medium text-[var(--text)]">Kirim Pesanan</span> di bagian bawah
          untuk menyiapkan file PDF dan membuka WhatsApp.
        </p>
      </div>

      {draftMessagePreview && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-[var(--text-muted)]">
            Pratinjau Pesan Pengantar WhatsApp (detail alamat lengkap tersimpan di PDF)
          </p>
          <pre className="p-3.5 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] text-xs text-[var(--text)] whitespace-pre-wrap font-sans leading-relaxed">
            {draftMessagePreview}
          </pre>
        </div>
      )}

      {uiStatus.kind === 'validation-required' && (
        <div
          role="alert"
          className="p-4 rounded-[var(--radius-md)] border border-[var(--danger-border)] bg-[var(--danger-surface)] flex items-start gap-2.5 text-xs"
        >
          <AlertCircle className="size-4 text-[var(--danger)] shrink-0 mt-0.5" aria-hidden="true" />
          <p className="text-[var(--danger)] font-medium leading-relaxed">{uiStatus.message}</p>
        </div>
      )}

      {uiStatus.kind === 'pdf-building' && (
        <div
          role="status"
          aria-live="polite"
          className="p-4 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)] flex items-start gap-2.5 text-xs"
        >
          <Info className="size-4 text-[var(--text-muted)] shrink-0 mt-0.5" aria-hidden="true" />
          <p className="text-[var(--text)] leading-relaxed">{uiStatus.message}</p>
        </div>
      )}

      {uiStatus.kind === 'pdf-missing' && (
        <div
          role="alert"
          className="p-4 rounded-[var(--radius-md)] border border-[var(--danger-border)] bg-[var(--danger-surface)] flex flex-wrap items-center justify-between gap-3 text-xs"
        >
          <div className="flex items-start gap-2.5">
            <AlertCircle
              className="size-4 text-[var(--danger)] shrink-0 mt-0.5"
              aria-hidden="true"
            />
            <p className="text-[var(--danger)] font-medium leading-relaxed">{uiStatus.message}</p>
          </div>
          <Button variant="secondary" size="sm" onClick={retryBuild}>
            <RefreshCw className="size-3.5" aria-hidden="true" />
            Muat Ulang PDF
          </Button>
        </div>
      )}

      {uiStatus.kind === 'share-cancelled' && (
        <div
          role="status"
          aria-live="polite"
          className="p-4 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)] space-y-3 text-xs"
        >
          <p className="font-medium text-[var(--text)] leading-relaxed">
            Berbagi dokumen dibatalkan. Daftar pesanan dan data pemesan Anda tetap tersimpan utuh.
          </p>
          <div className="flex flex-wrap items-center gap-2.5">
            <Button variant="secondary" size="sm" onClick={onManualDownloadAndOpenWhatsApp}>
              <Download className="size-3.5" aria-hidden="true" />
              Unduh PDF &amp; Buka WhatsApp Manual
            </Button>
          </div>
        </div>
      )}

      {uiStatus.kind === 'shared-sheet-completed' && (
        <div
          role="status"
          aria-live="polite"
          className="p-4 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--bg)] space-y-3 text-xs"
        >
          <p className="font-medium text-[var(--text)] leading-relaxed">
            Menu berbagi perangkat telah dijalankan untuk file{' '}
            <span className="font-semibold">{uiStatus.filename}</span>. Pastikan Anda telah memilih
            WhatsApp ({BUSINESS_CONFIG.whatsapp.nomorTampil}) dan menyelesaikan pengiriman di
            aplikasi tujuan.
          </p>
          <div className="flex flex-wrap items-center gap-2.5">
            <ExternalLinkButton
              href={uiStatus.whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              variant="secondary"
              size="sm"
            >
              Buka Chat WhatsApp
              <ExternalLink className="size-3.5" aria-hidden="true" />
            </ExternalLinkButton>
          </div>
        </div>
      )}

      {uiStatus.kind === 'whatsapp-fallback-opened' && (
        <div
          role="status"
          aria-live="polite"
          className="p-4 rounded-[var(--radius-md)] border border-[var(--border-strong)] bg-[var(--bg)] space-y-3 text-xs"
        >
          <p className="font-medium text-[var(--text)] leading-relaxed">
            File PDF <span className="font-semibold">{uiStatus.filename}</span> telah diunduh dan
            tautan WhatsApp telah dibuka. Silakan{' '}
            <span className="font-semibold">lampirkan file PDF tersebut secara manual</span> di chat
            WhatsApp lalu kirimkan ke {BUSINESS_CONFIG.whatsapp.nomorTampil}.
          </p>
          <div className="flex flex-wrap items-center gap-2.5">
            <ExternalLinkButton
              href={uiStatus.whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              variant="secondary"
              size="sm"
            >
              Buka Ulang WhatsApp
              <ExternalLink className="size-3.5" aria-hidden="true" />
            </ExternalLinkButton>
            <Button variant="ghost" size="sm" onClick={onDownloadOnly}>
              <Download className="size-3.5" aria-hidden="true" />
              Unduh Ulang PDF
            </Button>
          </div>
        </div>
      )}

      {uiStatus.kind === 'popup-blocked' && (
        <div
          role="alert"
          className="p-4 rounded-[var(--radius-md)] border border-[var(--border-strong)] bg-[var(--surface-muted)] space-y-3 text-xs"
        >
          <p className="font-medium text-[var(--text)] leading-relaxed">
            File PDF <span className="font-semibold">{uiStatus.filename}</span> berhasil diunduh,
            namun peramban memblokir pembukaan tab WhatsApp secara otomatis. Klik tombol di bawah
            untuk membuka WhatsApp, lalu{' '}
            <span className="font-semibold">lampirkan file PDF yang baru diunduh secara manual</span>
            .
          </p>
          <div className="flex flex-wrap items-center gap-2.5">
            <ExternalLinkButton
              href={uiStatus.whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              variant="primary"
              size="sm"
            >
              Buka WhatsApp ({BUSINESS_CONFIG.whatsapp.nomorTampil})
              <ExternalLink className="size-3.5" aria-hidden="true" />
            </ExternalLinkButton>
          </div>
        </div>
      )}

      {showCompletedHandoffOptions && (
        <div className="pt-4 border-t border-[var(--border)] space-y-3">
          {!confirmClearOpen ? (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <p className="text-xs text-[var(--text-muted)] leading-relaxed">
                Daftar pesanan tetap disimpan. Jika Anda sudah selesai mengirim ringkasan di
                WhatsApp, Anda dapat membersihkan daftar secara manual.
              </p>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setConfirmClearOpen(true)}
                className="shrink-0 whitespace-normal text-left"
              >
                <Trash2 className="size-3.5" aria-hidden="true" />
                Kosongkan Daftar Setelah Selesai
              </Button>
            </div>
          ) : (
            <div className="p-4 rounded-[var(--radius-md)] border border-[var(--danger-border)] bg-[var(--danger-surface)] space-y-3 text-xs">
              <p className="text-[var(--text)] leading-relaxed">
                Website tidak dapat memeriksa apakah pesan WhatsApp sudah terkirim. Pastikan Anda
                telah mengirim file PDF di WhatsApp sebelum mengosongkan daftar item pesanan (data
                pemesan Anda tetap tersimpan untuk pesanan berikutnya).
              </p>
              <div className="flex flex-wrap items-center gap-2.5">
                <Button
                  variant="danger"
                  size="sm"
                  onClick={onConfirmClearDraft}
                  className="whitespace-normal text-left"
                >
                  Konfirmasi: Saya Sudah Mengirim, Kosongkan Daftar
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setConfirmClearOpen(false)}>
                  Tetap Simpan Daftar
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
