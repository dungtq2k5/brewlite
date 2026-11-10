'use client';

import { useTranslation } from 'react-i18next';
import { ConfirmSheet } from '../ConfirmSheet';

/** *Cancel this order?* — a bottom sheet on phones, a dialog on wide screens. Focus starts on *Keep*. */
export function CancelSheet({
  orderNo,
  pending,
  onConfirm,
  onClose,
}: Readonly<{ orderNo: string; pending: boolean; onConfirm: () => void; onClose: () => void }>) {
  const { t } = useTranslation('orders');
  return (
    <ConfirmSheet
      title={t('order.cancel.title')}
      body={t('order.cancel.body', { no: `#${orderNo}` })}
      confirmLabel={t('order.cancel.confirm')}
      keepLabel={t('order.cancel.keep')}
      pending={pending}
      onConfirm={onConfirm}
      onClose={onClose}
    />
  );
}
