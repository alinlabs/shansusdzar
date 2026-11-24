import { useCallback, useRef, useState, type ReactNode } from 'react';

export interface SlideIndicatorItem {
  id: string;
  label: string;
}

export function SlideIndicators({
  items,
  activeIndex,
  ariaLabel,
  onSelect,
}: {
  items: readonly SlideIndicatorItem[];
  activeIndex: number;
  ariaLabel: string;
  onSelect: (index: number) => void;
}) {
  return (
    <div className="flex items-center justify-center gap-0" role="tablist" aria-label={ariaLabel}>
      {items.map((item, idx) => {
        const isActive = idx === activeIndex;
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            aria-label={item.label}
            onClick={() => onSelect(idx)}
            className="inline-flex items-center justify-center h-4 w-2.5 cursor-pointer"
          >
            <span
              aria-hidden="true"
              className={[
                'size-1.5 rounded-full transition-colors duration-200',
                isActive
                  ? 'bg-[var(--accent)]'
                  : 'bg-[var(--border-strong)] hover:bg-[var(--accent-soft)]',
              ].join(' ')}
            />
          </button>
        );
      })}
    </div>
  );
}

export function MobileCardCarousel<T extends { id: string }>({
  items,
  regionLabel,
  indicatorLabel,
  getItemLabel,
  renderCard,
}: {
  items: readonly T[];
  regionLabel: string;
  indicatorLabel: string;
  getItemLabel: (item: T, index: number) => string;
  renderCard: (item: T, isHiddenClone?: boolean) => ReactNode;
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
  } | null>(null);

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
      if (totalItems <= 1) return;
      setIsTransitionEnabled(true);
      setTrackIndex(index + 1);
    },
    [totalItems]
  );

  const finishPointerDrag = useCallback(
    (deltaX: number, containerWidth: number) => {
      const threshold = Math.min(72, Math.max(36, containerWidth * 0.14));
      setIsDragging(false);
      setDragOffsetPx(0);
      pointerStateRef.current = null;

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
      aria-label={regionLabel}
      onKeyDown={(event) => {
        if (event.key === 'ArrowRight') {
          event.preventDefault();
          handleNext();
        } else if (event.key === 'ArrowLeft') {
          event.preventDefault();
          handlePrev();
        }
      }}
      className="space-y-1.5"
    >
      <div
        ref={viewportRef}
        onDragStart={(event) => event.preventDefault()}
        onPointerDown={(event) => {
          if (totalItems <= 1) return;
          if (event.pointerType === 'mouse' && event.button !== 0) return;
          const width = viewportRef.current?.getBoundingClientRect().width || 320;
          pointerStateRef.current = {
            pointerId: event.pointerId,
            startX: event.clientX,
            width,
          };
          event.currentTarget.setPointerCapture?.(event.pointerId);
          setIsDragging(true);
          setIsTransitionEnabled(false);
          setDragOffsetPx(0);
        }}
        onPointerMove={(event) => {
          const activeDrag = pointerStateRef.current;
          if (!activeDrag || activeDrag.pointerId !== event.pointerId) return;
          setDragOffsetPx(event.clientX - activeDrag.startX);
        }}
        onPointerUp={(event) => {
          const activeDrag = pointerStateRef.current;
          if (!activeDrag || activeDrag.pointerId !== event.pointerId) return;
          if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
          }
          finishPointerDrag(event.clientX - activeDrag.startX, activeDrag.width);
        }}
        onPointerCancel={(event) => {
          const activeDrag = pointerStateRef.current;
          if (!activeDrag || activeDrag.pointerId !== event.pointerId) return;
          finishPointerDrag(0, activeDrag.width);
        }}
        className={[
          'overflow-hidden rounded-[var(--radius-md)] touch-pan-y select-none',
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
            if (
              totalItems <= 1 ||
              event.target !== event.currentTarget ||
              event.propertyName !== 'transform'
            ) {
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
            const isClone = totalItems > 1 && (idx === 0 || idx === trackItems.length - 1);
            return (
              <div
                key={`${item.id}-${idx}`}
                aria-hidden={isClone ? true : undefined}
                className="w-full shrink-0 flex"
              >
                {renderCard(item, isClone)}
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
          ariaLabel={indicatorLabel}
          onSelect={handleSelectDot}
        />
      )}
    </div>
  );
}
