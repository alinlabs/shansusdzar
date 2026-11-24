import { useEffect, useRef } from 'react';
import { User } from 'lucide-react';
import {
  isUserProfileComplete,
  resolveProfileModalCopy,
  useUserProfileStore,
} from '../../store/user-profile-store';
import { MODAL_ANIMATION_MS, Modal } from '../ui/modal';
import { UserProfileForm } from '../ui/user-profile-form';

export function UserProfileModal() {
  const profile = useUserProfileStore((state) => state.profile);
  const modalRequest = useUserProfileStore((state) => state.modalRequest);
  const saveProfile = useUserProfileStore((state) => state.saveProfile);
  const closeProfileModal = useUserProfileStore((state) => state.closeProfileModal);
  const openSurveyModal = useUserProfileStore((state) => state.openSurveyModal);

  const handoffTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (handoffTimerRef.current !== null) {
        window.clearTimeout(handoffTimerRef.current);
      }
    };
  }, []);

  const activeRequest = modalRequest ?? { intent: 'general' as const };
  const hasExistingProfile = isUserProfileComplete(profile);
  const copy = resolveProfileModalCopy(activeRequest, hasExistingProfile);

  const handleClose = () => {
    closeProfileModal();
  };

  const handleSaved = () => {
    if (activeRequest.intent === 'survei') {
      const nextSurveyContext = activeRequest.surveyContextLabel;
      const nextSurveyActivityNote = activeRequest.surveyActivityNote;
      closeProfileModal();
      if (handoffTimerRef.current !== null) {
        window.clearTimeout(handoffTimerRef.current);
      }
      handoffTimerRef.current = window.setTimeout(() => {
        handoffTimerRef.current = null;
        openSurveyModal({
          surveyContextLabel: nextSurveyContext,
          surveyActivityNote: nextSurveyActivityNote,
        });
      }, MODAL_ANIMATION_MS + 30);
      return;
    }

    handleClose();
  };

  return (
    <Modal
      isOpen={Boolean(modalRequest)}
      onClose={handleClose}
      size="md"
      closeLabel="Tutup form data akun"
      title={copy.title}
      description={copy.description}
      headerLeading={
        <span className="size-9 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-muted)] flex items-center justify-center text-[var(--text)]">
          <User className="size-4" aria-hidden="true" />
        </span>
      }
    >
      <div data-testid="user-profile-modal-content">
        <UserProfileForm
          idPrefix="modal-akun"
          formId="user-profile-modal-form"
          profile={profile}
          onSave={saveProfile}
          onSaved={handleSaved}
          submitLabel={copy.submitLabel}
          submitTestId="user-profile-modal-submit"
          fullWidthSubmit
          hideSubmitIcon
        />
      </div>
    </Modal>
  );
}
