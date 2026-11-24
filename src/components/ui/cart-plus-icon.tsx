import type { SVGProps } from 'react';

export function CartPlusIcon({
  className = 'size-4 shrink-0',
  'aria-hidden': ariaHidden = true,
  ...props
}: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={ariaHidden}
      className={className}
      {...props}
    >
      <circle cx="8.5" cy="20.5" r="1" />
      <circle cx="18.5" cy="20.5" r="1" />
      <path d="M2 3h2.2l2.5 12.2a2 2 0 0 0 2 1.6h9.6a2 2 0 0 0 1.95-1.56L21.5 9H5.4" />
      <path d="M13.5 2.5v4.5" />
      <path d="M11.25 4.75h4.5" />
    </svg>
  );
}
