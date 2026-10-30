'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ConfirmDialog } from '@/components/feedback/ConfirmDialog';
import { useToast } from '@/components/feedback/ToastProvider';
import { Button, ButtonLink } from '@/components/vellum/Button';
import { useConsoleCopy } from '@/i18n/console-context';
import { restoreProductAction } from '@/lib/admin-actions';
import { runAction } from '@/lib/action-result';
import { describeError } from '@/lib/error-messages';
import type { ApiErrorDetails } from '@/lib/gateway-types';
import { setProductAvailabilityAction } from '@/lib/staff-actions';

type ConfirmAction = 'pause' | 'resume' | 'restore';

/** Product actions that are not part of the edit form: availability and restore. */
export default function ProductDetailActions({
  productId,
  productName,
  isAvailable,
  deleted,
}: {
  productId: string;
  productName: string;
  isAvailable: boolean;
  deleted: boolean;
}) {
  const router = useRouter();
  const { t, locale } = useConsoleCopy();
  const { showToast } = useToast();
  const [confirm, setConfirm] = useState<ConfirmAction | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const close = () => {
    if (pending) return;
    setConfirm(null);
    setError(null);
  };

  const setAvailability = (next: boolean) => {
    setError(null);
    startTransition(async () => {
      const result = await runAction(
        setProductAvailabilityAction({
          productId,
          isAvailable: next,
        }),
      );
      if (!result.ok) {
        setError(describeError(result.code, result.details as ApiErrorDetails, locale));
        return;
      }
      setConfirm(null);
      showToast(
        next
          ? t('Đã mở bán lại sản phẩm.', 'Product is on sale again.')
          : t('Đã tạm ngừng sản phẩm.', 'Product paused.'),
      );
      router.refresh();
    });
  };

  const restore = () => {
    setError(null);
    startTransition(async () => {
      const result = await runAction(restoreProductAction(productId));
      if (!result.ok) {
        setError(describeError(result.code, result.details as ApiErrorDetails, locale));
        return;
      }
      setConfirm(null);
      showToast(t('Đã khôi phục sản phẩm.', 'Product restored.'));
      router.refresh();
    });
  };

  const copy = {
    pause: {
      title: t(`Tạm ngừng ${productName}?`, `Pause ${productName}?`),
      body: t(
        'Món sẽ biến mất khỏi menu khách ngay khi lưu. Bạn có thể mở bán lại bất cứ lúc nào.',
        'The item leaves the customer menu as soon as you save. You can put it back on sale later.',
      ),
      confirmLabel: t('Tạm ngừng', 'Pause'),
      tone: 'danger' as const,
    },
    resume: {
      title: t(`Mở bán lại ${productName}?`, `Put ${productName} back on sale?`),
      body: t(
        'Món sẽ hiện lại trên menu khách ngay khi lưu.',
        'The item appears on the customer menu as soon as you save.',
      ),
      confirmLabel: t('Mở bán lại', 'Resume'),
      tone: 'primary' as const,
    },
    restore: {
      title: t(`Khôi phục ${productName}?`, `Restore ${productName}?`),
      body: t(
        'Sản phẩm trở lại danh sách quản trị. Kiểm tra giá và tồn kho trước khi mở bán.',
        'The product returns to the admin list. Check price and stock before putting it on sale.',
      ),
      confirmLabel: t('Khôi phục', 'Restore'),
      tone: 'primary' as const,
    },
  };

  return (
    <>
      {deleted ? (
        <Button size="sm" variant="quiet" onClick={() => setConfirm('restore')}>
          {t('Khôi phục', 'Restore')}
        </Button>
      ) : (
        <>
          <ButtonLink href={`/admin/products?edit=${productId}`} size="sm" variant="quiet">
            {t('Sửa', 'Edit')}
          </ButtonLink>
          <Button
            size="sm"
            variant={isAvailable ? 'danger' : 'primary'}
            onClick={() => setConfirm(isAvailable ? 'pause' : 'resume')}
          >
            {isAvailable ? t('Tạm ngừng', 'Pause') : t('Mở bán lại', 'Resume')}
          </Button>
        </>
      )}

      {confirm && (
        <ConfirmDialog
          title={copy[confirm].title}
          confirmLabel={copy[confirm].confirmLabel}
          cancelLabel={t('Giữ nguyên', 'Keep as is')}
          tone={copy[confirm].tone}
          busy={pending}
          error={error}
          onCancel={close}
          onConfirm={() => {
            if (confirm === 'restore') restore();
            else setAvailability(confirm === 'resume');
          }}
        >
          {copy[confirm].body}
        </ConfirmDialog>
      )}
    </>
  );
}
