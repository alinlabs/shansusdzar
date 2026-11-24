import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';

export interface AdminFeedbackMessage {
  type: 'ok' | 'err';
  text: string;
}

export function AdminFeedbackBanner({
  feedback,
  onDismiss,
}: {
  feedback: AdminFeedbackMessage | null;
  onDismiss: () => void;
}) {
  if (!feedback) return null;

  return (
    <div
      role={feedback.type === 'err' ? 'alert' : 'status'}
      className={[
        'p-3.5 rounded-[var(--radius-md)] border text-xs font-medium flex items-center justify-between gap-3',
        feedback.type === 'err'
          ? 'border-[var(--danger-border)] bg-[var(--danger-surface)] text-[var(--danger)]'
          : 'border-[var(--success-border)] bg-[var(--success-surface)] text-[var(--success)]',
      ].join(' ')}
    >
      <span>{feedback.text}</span>
      <button
        type="button"
        onClick={onDismiss}
        className="text-xs underline shrink-0 cursor-pointer"
      >
        Tutup
      </button>
    </div>
  );
}

export function useAdminFeedbackState() {
  const location = useLocation();
  const navigate = useNavigate();
  const [feedback, setFeedback] = useState<AdminFeedbackMessage | null>(() => {
    const state = location.state as { feedback?: AdminFeedbackMessage } | null;
    return state?.feedback ?? null;
  });

  useEffect(() => {
    const state = location.state as { feedback?: AdminFeedbackMessage } | null;
    if (state?.feedback) {
      setFeedback(state.feedback);
      navigate(`${location.pathname}${location.search}`, { replace: true, state: null });
    }
  }, [location.pathname, location.search, location.state, navigate]);

  return [feedback, setFeedback] as const;
}
