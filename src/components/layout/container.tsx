import type { ElementType, ReactNode } from 'react';

export type ContainerWidth = 'narrow' | 'default' | 'wide';

const WIDTH_CLASSES: Record<ContainerWidth, string> = {
  narrow: 'w-full lg:max-w-[var(--container-max)]',
  default: 'w-full lg:max-w-[var(--container-max)]',
  wide: 'w-full lg:max-w-[var(--container-max)]',
};

export interface ContainerProps {
  as?: ElementType;
  width?: ContainerWidth;
  className?: string;
  children: ReactNode;
}

export function Container({
  as: Component = 'div',
  width = 'default',
  className = '',
  children,
}: ContainerProps) {
  return (
    <Component
      className={`mx-auto pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] sm:pl-[max(1.5rem,env(safe-area-inset-left))] sm:pr-[max(1.5rem,env(safe-area-inset-right))] lg:pl-[max(2rem,env(safe-area-inset-left))] lg:pr-[max(2rem,env(safe-area-inset-right))] ${WIDTH_CLASSES[width]} ${className}`}
    >
      {children}
    </Component>
  );
}
