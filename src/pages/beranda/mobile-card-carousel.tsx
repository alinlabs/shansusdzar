import { type ReactNode, useCallback, useRef, useState } from 'react';
import { SlideIndicators } from './slide-indicators';

export function MobileCardCarousel<T extends { id: string }>({
  items,
  ariaLabel,
  tablistLabel,
  getItemLabel,
  renderCard,
}: {
  items: readonly T[];
  ariaLabel: string;
  tablistLabel: string;
  getItemLabel: (item: T, index: number) => string;
  renderCard: (item: T, isHiddenClone: boolean) => ReactNode;
}) {
  const totalItems = items.length;
  const trackItems = totalItems > 1 ? [items[totalItems - 1], ...items, items[0]] : [...items];

  const [trackIndex, setTrackIndex] = useState(totalItems > 1 ? 1 : 0);
  const [isTransitionEnabled, setIsTransitionEnabled] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffsetPx, setDragOffsetPx] = useState(0);

  const viewportRef = useRef<HTMLDivElement>(null);
  const pointerStateRef = useRef<{
    pointerId: number;
    startX: number;
    width: number;
    hasDragged: boolean;
  } | null>(null);
  const suppressClickRef = useRef(false);

  const handleNext = useCallback(() => {
    if (totalItems <= 1) return;
    setIsTransitionEnabled(true);
    setTrackIndex((prev) => (prev >= totalItems + 1 ? 2 : prev + 1));
  }, [totalItems]);

  const handlePrev = useCallback(() => {
    if (totalItems <= 1) return;
    setIsTransitionEnabled(true);
    setTrackIndex((prev) => (prev <= 0 ? totalItems - 1 : prev - 1));
  }, [totalItems]);

  const handleSelectDot = useCallback(
    (index: number) => {
      setIsTransitionEnabled(true);
      setTrackIndex(totalItems > 1 ? index + 1 : index);
    },
    [totalItems]
  );

  const finishPointerDrag = useCallback(
    (deltaX: number, containerWidth: number, didDrag: boolean) => {
      const threshold = Math.min(72, Math.max(36, containerWidth * 0.14));
      setIsDragging(false);
      setDragOffsetPx(0);
      pointerStateRef.current = null;

      if (didDrag) {
        suppressClickRef.current = true;
        window.setTimeout(() => {
          suppressClickRef.current = false;
        }, 0);
      }

      if (deltaX <= -threshold) {
        handleNext();
      } else if (deltaX >= threshold) {
        handlePrev();
      } else {
        setIsTransitionEnabled(true);
      }
    },
    [handleNext, handlePrev]
  );

  const activeLogicalIndex =
    totalItems > 1 ? (((trackIndex - 1) % totalItems) + totalItems) % totalItems : 0;

  return (
    <div
      role="region"
      aria-roledescription="carousel"
      aria-label={ariaLabel}
      onKeyDown={(event) => {
        if (event.key === 'ArrowRight') {
          event.preventDefault();
          handleNext();
        } else if (event.key === 'ArrowLeft') {
          event.preventDefault();
          handlePrev();
        }
      }}
      className="space-y-2 md:hidden"
    >
      <div
        ref={viewportRef}
        onDragStart={(event) => event.preventDefault()}
        onClickCapture={(event) => {
          if (suppressClickRef.current) {
            event.preventDefault();
            event.stopPropagation();
            suppressClickRef.current = false;
          }
        }}
        onPointerDown={(event) => {
          if (totalItems <= 1) return;
          if (event.pointerType === 'mouse' && event.button !== 0) return;
          const width = viewportRef.current?.getBoundingClientRect().width || 320;
          suppressClickRef.current = false;
          pointerStateRef.current = {
            pointerId: event.pointerId,
            startX: event.clientX,
            width,
            hasDragged: false,
          };
        }}
        onPointerMove={(event) => {
          const activeDrag = pointerStateRef.current;
          if (!activeDrag || activeDrag.pointerId !== event.pointerId) return;
          const deltaX = event.clientX - activeDrag.startX;
          if (!activeDrag.hasDragged && Math.abs(deltaX) > 6) {
            activeDrag.hasDragged = true;
            event.currentTarget.setPointerCapture?.(event.pointerId);
            setIsDragging(true);
            setIsTransitionEnabled(false);
          }
          if (activeDrag.hasDragged) {
            setDragOffsetPx(deltaX);
          }
        }}
        onPointerUp={(event) => {
          const activeDrag = pointerStateRef.current;
          if (!activeDrag || activeDrag.pointerId !== event.pointerId) return;
          if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
          }
          finishPointerDrag(
            event.clientX - activeDrag.startX,
            activeDrag.width,
            activeDrag.hasDragged
          );
        }}
        onPointerCancel={(event) => {
          const activeDrag = pointerStateRef.current;
          if (!activeDrag || activeDrag.pointerId !== event.pointerId) return;
          finishPointerDrag(0, activeDrag.width, activeDrag.hasDragged);
        }}
        className={[
          'overflow-hidden rounded-[var(--radius-lg)] touch-pan-y select-none',
          isDragging ? 'cursor-grabbing' : 'cursor-grab',
        ].join(' ')}
      >
        <div
          className="flex items-stretch"
          style={{
            transform: `translateX(calc(-${trackIndex * 100}% + ${dragOffsetPx}px))`,
            transition:
              isDragging || !isTransitionEnabled
                ? 'none'
                : 'transform 500ms cubic-bezier(0.16, 1, 0.3, 1)',
          }}
          onTransitionEnd={(event) => {
            if (totalItems <= 1) return;
            if (event.target !== event.currentTarget || event.propertyName !== 'transform') {
              return;
            }
            if (trackIndex >= totalItems + 1) {
              setIsTransitionEnabled(false);
              setTrackIndex(1);
            } else if (trackIndex <= 0) {
              setIsTransitionEnabled(false);
              setTrackIndex(totalItems);
            }
          }}
        >
          {trackItems.map((item, idx) => {
            const isHiddenClone =
              totalItems > 1 && (idx === 0 || idx === trackItems.length - 1);
            return (
              <div
                key={`${item.id}-${idx}`}
                aria-hidden={isHiddenClone ? true : undefined}
                className="w-full shrink-0 flex"
              >
                {renderCard(item, isHiddenClone)}
              </div>
            );
          })}
        </div>
      </div>

      {totalItems > 1 && (
        <SlideIndicators
          items={items.map((item, idx) => ({
            id: item.id,
            label: getItemLabel(item, idx),
          }))}
          activeIndex={activeLogicalIndex}
          ariaLabel={tablistLabel}
          onSelect={handleSelectDot}
        />
      )}
    </div>
  );
}
