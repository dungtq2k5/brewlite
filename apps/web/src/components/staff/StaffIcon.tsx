import type { ReactNode } from 'react';

type StaffIconName =
  | 'cup'
  | 'receipt'
  | 'box'
  | 'user'
  | 'logout'
  | 'refresh'
  | 'wifi'
  | 'credit-card'
  | 'coffee'
  | 'check-circle';

export function StaffIcon({ name }: { name: StaffIconName }) {
  const paths: Record<StaffIconName, ReactNode> = {
    cup: (
      <>
        <path d="M4 8h12v6a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V8Z" />
        <path d="M16 9h2a2 2 0 0 1 0 4h-2M7 3c0 1 1 1 1 2S7 6 7 7m4-4c0 1 1 1 1 2s-1 1-1 2" />
      </>
    ),

    receipt: (
      <>
        <path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Z" />
        <path d="M9 8h6M9 12h6M9 16h3" />
      </>
    ),

    box: (
      <>
        <path d="m12 2 9 5-9 5-9-5 9-5ZM3 7v10l9 5 9-5V7M12 12v10" />
      </>
    ),

    user: (
      <>
        <circle cx="12" cy="8" r="3.5" />
        <path d="M5 21v-2a7 7 0 0 1 14 0v2" />
      </>
    ),

    logout: (
      <>
        <path d="M9 4H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4M14 4h5a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-5M9 12h9m-3-3 3 3-3 3" />
      </>
    ),

    refresh: (
      <>
        <path d="M20 7v5h-5M4 17v-5h5" />
        <path d="M5.7 9A7 7 0 0 1 18 7l2 5M4 12l2 5a7 7 0 0 0 12.3-2" />
      </>
    ),

    wifi: (
      <>
        <path d="M3 9a15 15 0 0 1 18 0M6 12a10 10 0 0 1 12 0M9 15a5 5 0 0 1 6 0" />
        <circle cx="12" cy="19" r="1" fill="currentColor" stroke="none" />
      </>
    ),

    'credit-card': (
      <>
        <rect x="3" y="5" width="18" height="14" rx="2.5" />
        <path d="M3 10h18M7 15h4" />
      </>
    ),

    coffee: (
      <>
        <path d="M5 9h11v7a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4V9Z" />
        <path d="M16 11h2a2.5 2.5 0 0 1 0 5h-2M8 5c-1-1 1-2 0-3M12 5c-1-1 1-2 0-3" />
      </>
    ),

    'check-circle': (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="m8 12 2.5 2.5L16 9" />
      </>
    ),
  };

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width="1em"
      height="1em"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  );
}
