import type { ReactNode } from 'react';

export interface SectionHeadingProps {
  id?: string;
  eyebrow?: string;
  title: string;
  description?: string;
  as?: 'h1' | 'h2' | 'h3';
  align?: 'left' | 'center';
  action?: ReactNode;
  className?: string;
}

export function SectionHeading({
  id,
  eyebrow,
  title,
  description,
  as: HeadingTag = 'h2',
  align = 'left',
  action,
  className = '',
}: SectionHeadingProps) {
  const isCentered = align === 'center';

  return (
    <div
      className={[
        'flex flex-col gap-3',
        isCentered ? 'items-center text-center mx-auto max-w-2xl' : 'sm:flex-row sm:items-end sm:justify-between',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div className={isCentered ? '' : 'max-w-2xl'}>
        {eyebrow && (
          <p className="text-xs font-medium tracking-wide text-[var(--text-muted)] leading-tight mb-0.5">
            {eyebrow}
          </p>
        )}
        <HeadingTag
          id={id}
          className={
            HeadingTag === 'h1'
              ? 'text-2xl sm:text-4xl font-semibold tracking-tight text-[var(--text)] leading-tight'
              : 'text-xl sm:text-2xl font-semibold tracking-tight text-[var(--text)] leading-snug'
          }
        >
          {title}
        </HeadingTag>
        {description && (
          <p className="mt-2 text-sm sm:text-base text-[var(--text-muted)] leading-relaxed">
            {description}
          </p>
        )}
      </div>
      {action && !isCentered && <div className="shrink-0">{action}</div>}
    </div>
  );
}
