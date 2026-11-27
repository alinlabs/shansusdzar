import { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Headset,
  Trash2,
} from 'lucide-react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router';
import { Button, ExternalLinkButton, LinkButton } from '../../components/ui/button';
import { UserProfileForm } from '../../components/ui/user-profile-form';
import { useAnalyticsStore } from '../../store/analytics-store';
import { buildDynamicWhatsAppUrl, useSiteContentStore } from '../../store/site-content-store';
import {
  buildSurveyRequestWhatsAppMessage,
  isUserProfileComplete,
  resolveSafeInternalRedirect,
  useUserProfileStore,
} from '../../store/user-profile-store';
import { SettingsSection } from './components';

interface SectionAkunProps {
  hideSectionHeader?: boolean;
}

export function SectionAkun({ hideSectionHeader = false }: SectionAkunProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const businessConfig = useSiteContentStore((state) => state.businessConfig);
  const profile = useUserProfileStore((state) => state.profile);
  const saveProfile = useUserProfileStore((state) => state.saveProfile);
  const syncProfileActivity = useUserProfileStore((state) => state.syncProfileActivity);
  const clearProfile = useUserProfileStore((state) => state.clearProfile);

  const intent = searchParams.get('intent');
  const safeRedirect = resolveSafeInternalRedirect(searchParams.get('redirect'));
  const isSurveyIntent = intent === 'survei';
  const isOrderIntent = intent === 'pesanan' || safeRedirect === '/pesanan';

  const [savedNotice, setSavedNotice] = useState<'saved' | 'survey-ready' | 'cleared' | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  const sectionAnchorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (location.hash === '#akun' || isSurveyIntent || isOrderIntent) {
      window.requestAnimationFrame(() => {
        sectionAnchorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }
  }, [location.hash, isSurveyIntent, isOrderIntent]);

  const hasSavedProfile = isUserProfileComplete(profile);

  const handleSaved = () => {
    setConfirmClear(false);

    if (isSurveyIntent) {
      setSavedNotice('survey-ready');
      return;
    }

    if (safeRedirect) {
      navigate(safeRedirect, { replace: true });
      return;
    }

    setSavedNotice('saved');
  };

  const handleConfirmClearProfile = () => {
    clearProfile();
    setConfirmClear(false);
    setSavedNotice('cleared');
  };

  const surveyWhatsAppHref = hasSavedProfile
    ? buildDynamicWhatsAppUrl(
        businessConfig,
        buildSurveyRequestWhatsAppMessage({
          brandName: businessConfig.namaMerek,
          profile,
        })
      )
    : '';

  const submitLabel = isSurveyIntent
    ? 'Simpan & Siapkan Survei'
    : safeRedirect
      ? 'Simpan & Lanjutkan'
      : 'Simpan Akun';

  return (
    <div ref={sectionAnchorRef} className="scroll-mt-20">
      <SettingsSection
        id="akun"
        title="Akun & Profil"
        badge={hasSavedProfile ? 'Tersimpan' : undefined}
        hideHeader={hideSectionHeader}
        headerAction={
          <div className="hidden md:block">
            <Button
              type="submit"
              form="user-account-form"
              variant="primary"
              size="md"
              data-testid="akun-save-button-desktop"
            >
              <span>{submitLabel}</span>
              <ArrowRight className="size-4 shrink-0" aria-hidden="true" />
            </Button>
          </div>
        }
      >
        <div className="space-y-5">
          {(isSurveyIntent || isOrderIntent) && savedNotice !== 'survey-ready' && (
            <div className="p-3.5 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-muted)] flex flex-wrap items-center justify-between gap-3 text-xs">
              <p className="text-[var(--text)] leading-relaxed">
                {isSurveyIntent
                  ? 'Lengkapi profil untuk mengirim request survei.'
                  : 'Lengkapi profil untuk mengisi otomatis data pesanan.'}
              </p>
              {safeRedirect && (
                <Link
                  to={safeRedirect}
                  className="inline-flex items-center gap-1 font-medium text-[var(--text)] hover:underline shrink-0"
                >
                  <ArrowLeft className="size-3.5" aria-hidden="true" />
                  <span>Kembali</span>
                </Link>
              )}
            </div>
          )}

          {savedNotice === 'survey-ready' && hasSavedProfile && (
            <div
              role="status"
              aria-live="polite"
              data-testid="akun-survey-ready-banner"
              className="p-4 rounded-[var(--radius-md)] border border-[var(--success-border)] bg-[var(--success-surface)] space-y-3"
            >
              <div className="flex items-start gap-2.5 text-xs text-[var(--text)]">
                <CheckCircle2
                  className="size-4 text-[var(--success)] shrink-0 mt-0.5"
                  aria-hidden="true"
                />
                <div className="space-y-0.5">
                  <p className="font-semibold">Profil siap untuk request survei</p>
                  <p className="text-[var(--text-muted)] leading-relaxed">
                    Kirim detail survei ke WhatsApp dengan data profil Anda.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">
                <ExternalLinkButton
                  href={surveyWhatsAppHref}
                  variant="primary"
                  size="sm"
                  data-testid="akun-send-survey-wa"
                  onClick={() => {
                    syncProfileActivity('Mengajukan request survei lokasi via WhatsApp', [
                      'profil-user',
                      'request-survei',
                    ]);
                    useAnalyticsStore.getState().recordOrderInquiry();
                  }}
                >
                  <Headset className="size-3.5 shrink-0" aria-hidden="true" />
                  <span>Kirim via WhatsApp</span>
                </ExternalLinkButton>

                {safeRedirect && (
                  <LinkButton to={safeRedirect} variant="secondary" size="sm">
                    Kembali
                  </LinkButton>
                )}
              </div>
            </div>
          )}

          {savedNotice === 'saved' && (
            <div
              role="status"
              aria-live="polite"
              data-testid="akun-saved-banner"
              className="p-3.5 rounded-[var(--radius-md)] border border-[var(--success-border)] bg-[var(--success-surface)] flex items-start gap-2.5 text-xs text-[var(--text)]"
            >
              <CheckCircle2
                className="size-4 text-[var(--success)] shrink-0 mt-0.5"
                aria-hidden="true"
              />
              <p className="leading-relaxed">
                Profil tersimpan untuk pesanan dan survei berikutnya.
              </p>
            </div>
          )}

          {savedNotice === 'cleared' && (
            <div
              role="status"
              aria-live="polite"
              className="p-3.5 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-muted)] text-xs text-[var(--text-muted)]"
            >
              Data akun dihapus dari perangkat ini.
            </div>
          )}

          <UserProfileForm
            idPrefix="akun"
            formId="user-account-form"
            profile={profile}
            onSave={(input) => {
              setConfirmClear(false);
              return saveProfile(input);
            }}
            onSaved={handleSaved}
            submitLabel={submitLabel}
            submitTestId="akun-save-button"
            hideSubmitOnDesktop
            extraActions={
              hasSavedProfile && !confirmClear ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setConfirmClear(true)}
                  className="text-[var(--text-muted)] hover:text-[var(--danger)]"
                >
                  <Trash2 className="size-3.5" aria-hidden="true" />
                  <span>Hapus Data</span>
                </Button>
              ) : hasSavedProfile && confirmClear ? (
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => setConfirmClear(false)}
                  >
                    Batal
                  </Button>
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    onClick={handleConfirmClearProfile}
                    className="bg-[var(--danger)] hover:bg-[var(--danger)]/90 text-white"
                  >
                    Hapus
                  </Button>
                </div>
              ) : null
            }
          />
        </div>
      </SettingsSection>
    </div>
  );
}
