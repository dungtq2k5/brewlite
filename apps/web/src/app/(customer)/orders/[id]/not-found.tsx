import Link from 'next/link';
import { EmptyState } from '@/components/vellum/EmptyState';
import { PageHead } from '@/components/vellum/PageHead';
import { getLocale } from '@/i18n/locale.server';

export default async function OrderNotFound() {
  const locale = await getLocale();
  const isVi = locale === 'vi';

  return (
    <>
      <PageHead title={isVi ? 'Không tìm thấy đơn' : 'Order not found'} />
      <EmptyState
        title={isVi ? 'Không tìm thấy đơn hàng này' : 'This order was not found'}
        action={
          <Link className="btn btn--primary" href="/orders">
            {isVi ? 'Về lịch sử đơn' : 'Back to orders'}
          </Link>
        }
      >
        {isVi
          ? 'Đơn có thể đã bị xóa hoặc đường dẫn không còn đúng.'
          : 'The order may have been removed, or the link is out of date.'}
      </EmptyState>
    </>
  );
}
