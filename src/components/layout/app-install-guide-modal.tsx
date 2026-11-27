import { Smartphone } from 'lucide-react';
import { buildInstallGuideSteps } from '../../lib/app-install';
import { useCachedMediaSrc } from '../../lib/media-cache';
import { Modal } from '../ui/modal';

interface AppInstallGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
  isIOS: boolean;
  appName: string;
}

export function AppInstallGuideModal({
  isOpen,
  onClose,
  isIOS,
  appName,
}: AppInstallGuideModalProps) {
  const guide = buildInstallGuideSteps(isIOS, appName);
  const iconSrc = useCachedMediaSrc('/pwa-192x192.png') ?? '/pwa-192x192.png';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={guide.title}
      size="sm"
      headerLeading={
        <span className="inline-flex items-center justify-center size-10 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--accent)] dark:bg-[#494641] overflow-hidden text-[var(--accent-contrast)]">
          <img
            src={iconSrc}
            alt=""
            aria-hidden="true"
            referrerPolicy="no-referrer"
            onError={(event) => {
              event.currentTarget.style.display = 'none';
            }}
            className="size-full object-cover select-none"
          />
          <Smartphone className="size-4.5 sr-only" aria-hidden="true" />
        </span>
      }
    >
      <ol className="space-y-3">
        {guide.steps.map((step, index) => (
          <li
            key={index}
            className="flex items-start gap-3 p-3 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface-muted)]/40 text-sm text-[var(--text)] leading-relaxed"
          >
            <span className="inline-flex items-center justify-center size-6 rounded-full bg-[var(--accent)] text-[var(--accent-contrast)] text-xs font-semibold tabular-nums shrink-0 mt-0.5">
              {index + 1}
            </span>
            <span>{step}</span>
          </li>
        ))}
      </ol>
    </Modal>
  );
}
