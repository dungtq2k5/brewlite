'use client';

import { useRouter } from 'next/navigation';
import { StaffIcon } from './StaffIcon';
import styles from '../../app/(staff)/staff/staff.module.css';

export default function LogoutButton() {
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
      });
    } finally {
      router.replace('/login');
      router.refresh();
    }
  };

  return (
    <button type="button" className={styles.logout} onClick={handleLogout}>
      <StaffIcon name="logout" />
      <span>Đăng xuất</span>
    </button>
  );
}
