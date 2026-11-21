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
    <Component className={`mx-auto px-4 sm:px-6 lg:px-8 ${WIDTH_CLASSES[width]} ${className}`}>
      {children}
    </Component>
  );
}
