'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useRef, useState, useTransition } from 'react';
import { PRODUCT_IMAGE_MAX_BYTES } from '@brewlite/contracts';
import { useToast } from '@/components/feedback/ToastProvider';
import { useConsoleCopy } from '@/i18n/console-context';
import { removeProductImageAction, uploadProductImageAction } from '@/lib/admin-actions';
import { runAction } from '@/lib/action-result';
import { describeError } from '@/lib/error-messages';

const ACCEPTED = 'image/jpeg,image/png,image/webp';
const ACCEPTED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export default function ProductImageControl({
  productId,
  productName,
  imageUrl,
}: {
  productId: string;
  productName: string;
  imageUrl: string | null;
}) {
  const router = useRouter();
  const { t, locale } = useConsoleCopy();
  const { showToast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(imageUrl);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function chooseFile() {
    setError(null);
    inputRef.current?.click();
  }

  function upload(file: File) {
    setError(null);
    if (!ACCEPTED_TYPES.has(file.type) || file.size > PRODUCT_IMAGE_MAX_BYTES) {
      setError(describeError('IMAGE_INVALID', {}, locale));
      return;
    }

    const formData = new FormData();
    formData.set('productId', productId);
    formData.set('file', file);

    startTransition(async () => {
      const result = await runAction(uploadProductImageAction(formData));
      if (!result.ok) {
        setError(describeError(result.code, result.details, locale));
        return;
      }
      setPreview(result.data.imageUrl);
      showToast(t('Đã cập nhật ảnh sản phẩm.', 'Product image updated.'));
      router.refresh();
    });
  }

  function remove() {
    setError(null);
    startTransition(async () => {
      const result = await runAction(removeProductImageAction(productId));
      if (!result.ok) {
        setError(describeError(result.code, result.details, locale));
        return;
      }
      setPreview(null);
      showToast(t('Đã xóa ảnh sản phẩm.', 'Product image removed.'));
      router.refresh();
    });
  }

  return (
    <div className="image-control">
      <div className="image-control-preview">
        {preview ? (
          <Image
            src={preview}
            alt={t(`Ảnh ${productName}`, `${productName} image`)}
            width={56}
            height={56}
            sizes="56px"
            unoptimized={
              preview.startsWith('http://localhost:29199') ||
              preview.startsWith('http://127.0.0.1:29199')
            }
          />
        ) : (
          <span>{t('Chưa có', 'None')}</span>
        )}
      </div>
      <div className="image-control-actions">
        <button type="button" className="btn btn--sm" onClick={chooseFile} disabled={pending}>
          {pending
            ? t('Đang lưu…', 'Saving…')
            : preview
              ? t('Đổi ảnh', 'Change image')
              : t('Tải ảnh', 'Upload image')}
        </button>
        {preview && (
          <button
            type="button"
            className="btn btn--sm btn--quiet"
            onClick={remove}
            disabled={pending}
          >
            {t('Xóa', 'Remove')}
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED}
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (file) upload(file);
        }}
      />
      {error && (
        <p className="image-control-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
