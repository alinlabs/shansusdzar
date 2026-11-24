import { useCallback, useLayoutEffect, useState, type CSSProperties, type RefObject } from 'react';

export interface PopoverPositionOptions {
  isOpen: boolean;
  triggerRef: RefObject<HTMLElement | null>;
  panelRef: RefObject<HTMLElement | null>;
  preferredMaxHeight?: number;
  minWidth?: number;
  matchTriggerWidth?: boolean;
  align?: 'start' | 'end';
  offset?: number;
}

export interface PopoverLayout {
  style: CSSProperties;
  placement: 'bottom' | 'top';
  maxHeight: number;
}

const VIEWPORT_MARGIN = 8;

export function usePopoverPosition({
  isOpen,
  triggerRef,
  panelRef,
  preferredMaxHeight = 320,
  minWidth = 0,
  matchTriggerWidth = true,
  align = 'start',
  offset = 6,
}: PopoverPositionOptions): PopoverLayout {
  const [layout, setLayout] = useState<PopoverLayout>({
    style: { position: 'fixed', top: 0, left: 0, visibility: 'hidden' },
    placement: 'bottom',
    maxHeight: preferredMaxHeight,
  });

  const updatePosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;

    const rect = trigger.getBoundingClientRect();
    const viewportW = window.innerWidth;
    const viewportH = window.innerHeight;

    const panelRect = panelRef.current?.getBoundingClientRect();
    const desiredWidth = Math.max(
      matchTriggerWidth ? rect.width : 0,
      minWidth,
      matchTriggerWidth ? 0 : (panelRect?.width ?? minWidth)
    );
    const maxAllowedWidth = Math.max(180, viewportW - VIEWPORT_MARGIN * 2);
    const width = Math.min(desiredWidth || rect.width, maxAllowedWidth);

    const spaceBelow = viewportH - rect.bottom - offset - VIEWPORT_MARGIN;
    const spaceAbove = rect.top - offset - VIEWPORT_MARGIN;
    const measuredHeight = panelRect?.height ?? preferredMaxHeight;

    const shouldFlipTop = spaceBelow < Math.min(measuredHeight, preferredMaxHeight) && spaceAbove > spaceBelow;
    const placement: 'bottom' | 'top' = shouldFlipTop ? 'top' : 'bottom';
    const availableVertical = Math.max(160, shouldFlipTop ? spaceAbove : spaceBelow);
    const maxHeight = Math.min(preferredMaxHeight, Math.floor(availableVertical));

    let left = align === 'end' ? rect.right - width : rect.left;
    if (left + width > viewportW - VIEWPORT_MARGIN) {
      left = viewportW - VIEWPORT_MARGIN - width;
    }
    if (left < VIEWPORT_MARGIN) {
      left = VIEWPORT_MARGIN;
    }

    const style: CSSProperties =
      placement === 'bottom'
        ? {
            position: 'fixed',
            top: Math.round(rect.bottom + offset),
            left: Math.round(left),
            width: matchTriggerWidth ? Math.round(width) : undefined,
            minWidth: !matchTriggerWidth && minWidth > 0 ? Math.min(minWidth, maxAllowedWidth) : undefined,
            maxWidth: maxAllowedWidth,
          }
        : {
            position: 'fixed',
            bottom: Math.round(viewportH - rect.top + offset),
            left: Math.round(left),
            width: matchTriggerWidth ? Math.round(width) : undefined,
            minWidth: !matchTriggerWidth && minWidth > 0 ? Math.min(minWidth, maxAllowedWidth) : undefined,
            maxWidth: maxAllowedWidth,
          };

    setLayout({ style, placement, maxHeight });
  }, [align, matchTriggerWidth, minWidth, offset, panelRef, preferredMaxHeight, triggerRef]);

  useLayoutEffect(() => {
    if (!isOpen) return;

    updatePosition();
    const raf = window.requestAnimationFrame(updatePosition);

    const handleReposition = () => updatePosition();
    window.addEventListener('resize', handleReposition);
    window.addEventListener('scroll', handleReposition, true);

    return () => {
      window.cancelAnimationFrame(raf);
      window.removeEventListener('resize', handleReposition);
      window.removeEventListener('scroll', handleReposition, true);
    };
  }, [isOpen, updatePosition]);

  return layout;
}
