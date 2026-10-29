'use client';

import { useTransition, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import { logoutAction } from '@/lib/auth-actions';

export default function LogoutButton({
  label = 'Đăng xuất',
  className = 'btn btn--sm',
  style,
}: {
  label?: string;
  className?: string;
  style?: CSSProperties;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      className={className}
      style={style}
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await logoutAction();
          if (result.ok) {
            router.replace(result.data.redirectTo);
            router.refresh();
          }
        })
      }
    >
      {pending ? 'Đang đăng xuất…' : label}
    </button>
  );
}
