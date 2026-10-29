import type { ButtonHTMLAttributes } from 'react';
import Link from 'next/link';
import { cx } from '@/lib/cx';

export type ButtonVariant = 'primary' | 'ghost' | 'quiet' | 'danger' | 'danger-fill';

interface ButtonStyleProps {
  variant?: ButtonVariant;
  size?: 'sm';
  block?: boolean;
}

function buttonClass({ variant, size, block }: ButtonStyleProps, className?: string): string {
  return cx(
    'btn',
    variant && `btn--${variant}`,
    size === 'sm' && 'btn--sm',
    block && 'btn--block',
    className,
  );
}

export function Button({
  variant,
  size,
  block,
  className,
  type = 'button',
  ...props
}: ButtonStyleProps & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type={type} className={buttonClass({ variant, size, block }, className)} {...props} />
  );
}

interface ButtonLinkProps extends ButtonStyleProps {
  href: string;
  children: React.ReactNode;
  className?: string;
  prefetch?: boolean;
  target?: string;
  rel?: string;
  'aria-label'?: string;
}

export function ButtonLink({
  variant,
  size,
  block,
  className,
  href,
  children,
  ...props
}: ButtonLinkProps) {
  return (
    <Link href={href} className={buttonClass({ variant, size, block }, className)} {...props}>
      {children}
    </Link>
  );
}
