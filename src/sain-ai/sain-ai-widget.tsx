import {
  Suspense,
  lazy,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { useModalMotionState } from '../components/ui/modal';
import { useIsMobileViewport } from '../hooks/use-mobile-viewport';
import {
  clampFloatingChatPosition,
  getDefaultFloatingChatPosition,
  type FloatingPoint,
} from './drag-bounds';
import { SainAiBubble } from './sain-ai-bubble';
import { useSainAiStore } from './sain-ai-store';

const SainAiChatPanel = lazy(() =>
  import('./sain-ai-chat-panel').then((mod) => ({ default: mod.SainAiChatPanel }))
);

export function SainAiWidget() {
  const isMobileViewport = useIsMobileViewport();
  const isOpen = useSainAiStore((state) => state.isOpen);
  const isTyping = useSainAiStore((state) => state.isTyping);
  const messages = useSainAiStore((state) => state.messages);
  const desktopPosition = useSainAiStore((state) => state.desktopPosition);
  const isDesktopExpanded = useSainAiStore((state) => state.isDesktopExpanded);
  const openChat = useSainAiStore((state) => state.openChat);
  const closeChat = useSainAiStore((state) => state.closeChat);
  const sendMessage = useSainAiStore((state) => state.sendMessage);
  const resetConversation = useSainAiStore((state) => state.resetConversation);
  const toggleDesktopExpanded = useSainAiStore((state) => state.toggleDesktopExpanded);
  const setDesktopPosition = useSainAiStore((state) => state.setDesktopPosition);

  const desktopWindowRef = useRef<HTMLDivElement>(null);
  const dragSessionRef = useRef<{
    pointerId: number;
    startPointerX: number;
    startPointerY: number;
    startOrigin: FloatingPoint;
  } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [hasEverOpened, setHasEverOpened] = useState(isOpen);

  useEffect(() => {
    if (isOpen) {
      setHasEverOpened(true);
    }
  }, [isOpen]);

  const { isMounted: isMobileMounted, motionState: mobileMotionState } = useModalMotionState(
    isOpen && isMobileViewport
  );

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeChat();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, closeChat]);

  const measurePanelSize = () => {
    const el = desktopWindowRef.current;
    const fallbackWidth = isDesktopExpanded ? 470 : 400;
    const fallbackHeight = isDesktopExpanded ? 640 : 560;
    return {
      width: el?.offsetWidth || fallbackWidth,
      height: el?.offsetHeight || fallbackHeight,
    };
  };

  useEffect(() => {
    if (!isOpen || isMobileViewport) return;

    const syncBounds = () => {
      const viewport = { width: window.innerWidth, height: window.innerHeight };
      const panel = measurePanelSize();
      const latestPosition = useSainAiStore.getState().desktopPosition;
      const current = latestPosition ?? getDefaultFloatingChatPosition(viewport, panel, 24);
      const clamped = clampFloatingChatPosition(current, viewport, panel, 16);
      setDesktopPosition(clamped);
    };

    const rafId = window.requestAnimationFrame(syncBounds);
    window.addEventListener('resize', syncBounds);
    return () => {
      window.cancelAnimationFrame(rafId);
      window.removeEventListener('resize', syncBounds);
    };
  }, [isOpen, isMobileViewport, isDesktopExpanded, setDesktopPosition]);

  const handleDesktopHeaderPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (isMobileViewport) return;
    const target = event.target as HTMLElement | null;
    if (target?.closest('[data-no-drag="true"]')) {
      return;
    }

    const panel = measurePanelSize();
    const viewport = { width: window.innerWidth, height: window.innerHeight };
    const origin =
      desktopPosition ?? getDefaultFloatingChatPosition(viewport, panel, 24);

    dragSessionRef.current = {
      pointerId: event.pointerId,
      startPointerX: event.clientX,
      startPointerY: event.clientY,
      startOrigin: origin,
    };
    setIsDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  useEffect(() => {
    if (!isDragging) return;

    const handlePointerMove = (event: PointerEvent) => {
      const session = dragSessionRef.current;
      if (!session || event.pointerId !== session.pointerId) return;

      const deltaX = event.clientX - session.startPointerX;
      const deltaY = event.clientY - session.startPointerY;
      const next = clampFloatingChatPosition(
        {
          x: session.startOrigin.x + deltaX,
          y: session.startOrigin.y + deltaY,
        },
        { width: window.innerWidth, height: window.innerHeight },
        measurePanelSize(),
        16
      );
      setDesktopPosition(next);
    };

    const stopDragging = (event: PointerEvent) => {
      const session = dragSessionRef.current;
      if (!session || event.pointerId !== session.pointerId) return;
      dragSessionRef.current = null;
      setIsDragging(false);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', stopDragging);
    window.addEventListener('pointercancel', stopDragging);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', stopDragging);
      window.removeEventListener('pointercancel', stopDragging);
    };
  }, [isDragging, setDesktopPosition]);

  const handleResetDesktopPosition = () => {
    const defaultPos = getDefaultFloatingChatPosition(
      { width: window.innerWidth, height: window.innerHeight },
      measurePanelSize(),
      24
    );
    setDesktopPosition(defaultPos);
  };

  const resolvedDesktopPoint =
    desktopPosition ??
    (typeof window !== 'undefined'
      ? getDefaultFloatingChatPosition(
          { width: window.innerWidth, height: window.innerHeight },
          {
            width: isDesktopExpanded ? 470 : 400,
            height: isDesktopExpanded ? 640 : 560,
          },
          24
        )
      : { x: 24, y: 24 });

  return (
    <>
      <SainAiBubble isOpen={isOpen} onOpen={() => openChat()} />

      {/* Desktop: Floating social-media style chat yang bisa digeser & diperluas */}
      {hasEverOpened && isOpen && !isMobileViewport && (
        <div
          ref={desktopWindowRef}
          role="dialog"
          aria-modal="false"
          aria-label="Sain Ai — Sahabat Interior"
          data-testid="sain-ai-desktop-chat"
          style={{
            transform: `translate3d(${resolvedDesktopPoint.x}px, ${resolvedDesktopPoint.y}px, 0)`,
          }}
          className={[
            'hidden md:flex fixed top-0 left-0 z-50 flex-col overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border-strong)] bg-[var(--surface)] shadow-[var(--shadow-md)] print:hidden',
            isDesktopExpanded
              ? 'w-[min(470px,calc(100vw-2rem))] h-[min(640px,calc(100dvh-2.5rem))]'
              : 'w-[min(400px,calc(100vw-2rem))] h-[min(560px,calc(100dvh-2.5rem))]',
          ].join(' ')}
        >
          <Suspense fallback={null}>
            <SainAiChatPanel
              messages={messages}
              isTyping={isTyping}
              variant="desktop"
              onSendMessage={sendMessage}
              onResetConversation={resetConversation}
              onClose={closeChat}
              onHeaderPointerDown={handleDesktopHeaderPointerDown}
              onHeaderDoubleClick={handleResetDesktopPosition}
              isDragging={isDragging}
              isExpanded={isDesktopExpanded}
              onToggleExpand={toggleDesktopExpanded}
            />
          </Suspense>
        </div>
      )}

      {/* Mobile: Bottom Sheet */}
      {hasEverOpened && isMobileMounted && isMobileViewport && (
        <div className="md:hidden fixed inset-0 z-50 flex items-end justify-center pt-[env(safe-area-inset-top)] print:hidden">
          <div
            aria-hidden="true"
            data-state={mobileMotionState}
            onClick={closeChat}
            className="fixed inset-0 modal-backdrop-motion"
          />

          <div
            role="dialog"
            aria-modal="true"
            aria-label="Sain Ai — Sahabat Interior"
            data-testid="sain-ai-mobile-sheet"
            data-state={mobileMotionState}
            className="relative z-10 w-full h-[min(88dvh,680px)] flex flex-col overflow-hidden rounded-t-[var(--radius-lg)] border-t border-x border-[var(--border)] bg-[var(--surface)] text-[var(--text)] shadow-[var(--shadow-md)] modal-panel-motion"
          >
            <Suspense fallback={null}>
              <SainAiChatPanel
                messages={messages}
                isTyping={isTyping}
                variant="mobile"
                onSendMessage={sendMessage}
                onResetConversation={resetConversation}
                onClose={closeChat}
              />
            </Suspense>
          </div>
        </div>
      )}
    </>
  );
}
