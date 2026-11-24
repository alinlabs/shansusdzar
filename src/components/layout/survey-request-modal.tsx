import { useEffect, useId, useState, type FormEvent } from 'react';
import { CalendarDays, CheckCircle2 } from 'lucide-react';
import { formatDisplayDateId, getTodayIsoDate } from '../../lib/date-utils';
import { useAnalyticsStore } from '../../store/analytics-store';
import { buildDynamicWhatsAppUrl, useSiteContentStore } from '../../store/site-content-store';
import {
  buildSurveyRequestWhatsAppMessage,
  useUserProfileStore,
} from '../../store/user-profile-store';
import { Button, ExternalLinkButton } from '../ui/button';
import { DatePicker } from '../ui/date-picker';
import { Modal } from '../ui/modal';

export function SurveyRequestModal() {
  const businessConfig = useSiteContentStore((state) => state.businessConfig);
  const profile = useUserProfileStore((state) => state.profile);
  const surveyModalRequest = useUserProfileStore((state) => state.surveyModalRequest);
  const syncProfileActivity = useUserProfileStore((state) => state.syncProfileActivity);
  const closeSurveyModal = useUserProfileStore((state) => state.closeSurveyModal);

  const dateFieldId = useId();
  const notesFieldId = useId();

  const [surveyDateIso, setSurveyDateIso] = useState('');
  const [surveyNotes, setSurveyNotes] = useState('');
  const [dateError, setDateError] = useState<string | null>(null);
  const [surveyFallbackUrl, setSurveyFallbackUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!surveyModalRequest) {
      setSurveyDateIso('');
      setSurveyNotes('');
      setDateError(null);
      setSurveyFallbackUrl(null);
    }
  }, [surveyModalRequest]);

  const minDateIso = getTodayIsoDate();

  const handleClose = () => {
    setDateError(null);
    setSurveyFallbackUrl(null);
    closeSurveyModal();
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!surveyDateIso.trim()) {
      setDateError('Pilih tanggal kunjungan survei terlebih dahulu.');
      return;
    }

    setDateError(null);

    const activeRequest = surveyModalRequest ?? {};
    const surveyUrl = buildDynamicWhatsAppUrl(
      businessConfig,
      buildSurveyRequestWhatsAppMessage({
        brandName: businessConfig.namaMerek,
        profile,
        contextLabel: activeRequest.surveyContextLabel,
        surveyDateIso,
        surveyNotes,
      })
    );

    const dateLabel = formatDisplayDateId(surveyDateIso, 'long') || surveyDateIso;
    const baseNote = activeRequest.surveyActivityNote ?? 'Mengajukan request survei lokasi';
    const noteSuffix = surveyNotes.trim() ? ` · Catatan: ${surveyNotes.trim()}` : '';
    syncProfileActivity(`${baseNote} (Jadwal: ${dateLabel}${noteSuffix})`, [
      'profil-user',
      'request-survei',
    ]);
    useAnalyticsStore.getState().recordOrderInquiry();

    const opened = window.open(surveyUrl, '_blank');
    if (opened) {
      try {
        opened.opener = null;
      } catch {
        // Cross-origin window opener clearing safeguard
      }
    }

    if (!opened || opened.closed) {
      setSurveyFallbackUrl(surveyUrl);
      return;
    }

    handleClose();
  };

  return (
    <Modal
      isOpen={Boolean(surveyModalRequest)}
      onClose={handleClose}
      size="md"
      closeLabel="Tutup form permintaan survei"
      title={surveyFallbackUrl ? 'Siap Kirim Survei' : 'Jadwal Survei'}
      headerLeading={
        <span className="size-9 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-muted)] flex items-center justify-center text-[var(--text)]">
          <CalendarDays className="size-4" aria-hidden="true" />
        </span>
      }
    >
      {surveyFallbackUrl ? (
        <div
          role="status"
          aria-live="polite"
          data-testid="survey-request-modal-ready"
          className="space-y-4"
        >
          <div className="p-4 rounded-[var(--radius-md)] border border-[var(--success-border)] bg-[var(--success-surface)] flex items-start gap-2.5 text-xs text-[var(--text)]">
            <CheckCircle2
              className="size-4 text-[var(--success)] shrink-0 mt-0.5"
              aria-hidden="true"
            />
            <div className="space-y-1">
              <p className="font-semibold">Jadwal survei siap dikirim</p>
              <p className="text-[var(--text-muted)] leading-relaxed">
                Lanjutkan pengiriman permintaan survei melalui WhatsApp.
              </p>
            </div>
          </div>

          <ExternalLinkButton
            href={surveyFallbackUrl}
            variant="primary"
            size="md"
            fullWidth
            data-testid="survey-request-modal-wa-btn"
            onClick={handleClose}
          >
            Kirim Request Survei via WhatsApp
          </ExternalLinkButton>
        </div>
      ) : (
        <form
          id="survey-request-modal-form"
          onSubmit={handleSubmit}
          noValidate
          data-testid="survey-request-modal-content"
          className="space-y-4"
        >
          <div className="space-y-1.5">
            <label
              htmlFor={dateFieldId}
              className="block text-xs font-medium text-[var(--text)]"
            >
              Tanggal Survei <span className="text-[var(--danger)]">*</span>
            </label>
            <DatePicker
              id={dateFieldId}
              value={surveyDateIso}
              minDate={minDateIso}
              onValueChange={(nextIso) => {
                setSurveyDateIso(nextIso);
                if (dateError) setDateError(null);
              }}
              hasError={Boolean(dateError)}
              required
              clearable
              placeholder="Pilih tanggal survei..."
            />
            {dateError && (
              <p className="text-xs text-[var(--danger)]" role="alert">
                {dateError}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor={notesFieldId}
              className="block text-xs font-medium text-[var(--text)]"
            >
              Catatan
            </label>
            <textarea
              id={notesFieldId}
              rows={3}
              value={surveyNotes}
              onChange={(event) => setSurveyNotes(event.target.value)}
              placeholder="Contoh: Kebutuhan kitchen set, waktu kunjungan yang nyaman, atau patokan lokasi"
              className="w-full px-3.5 py-2.5 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] text-sm text-[var(--text)] placeholder:text-[var(--text-subtle)] focus:border-[var(--border-strong)] transition-colors duration-150 resize-y min-h-[5.5rem]"
            />
          </div>

          <div className="pt-1">
            <Button
              type="submit"
              variant="primary"
              size="md"
              fullWidth
              data-testid="survey-request-modal-submit"
            >
              Kirim Request Survei
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}
