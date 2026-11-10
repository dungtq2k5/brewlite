'use client';

import { useState, useTransition } from 'react';
import { useTranslation } from 'react-i18next';
import { fakeConfirm } from '@/actions/payments';
import { useErrorMessage } from '../useErrorMessage';
import { Alert } from '../Alert';

/** The test provider's frame: a note and two buttons that play the provider's webhook. */
export function FakePayment({
  paymentId,
  onSucceeded,
}: Readonly<{ paymentId: string; onSucceeded: () => void }>) {
  const { t } = useTranslation('orders');
  const message = useErrorMessage();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const confirm = (outcome: 'SUCCEEDED' | 'FAILED') =>
    startTransition(async () => {
      setError(null);
      const result = await fakeConfirm(paymentId, outcome);
      if (!result.ok) return setError(message(result.code, result.details));
      if (outcome === 'SUCCEEDED') onSucceeded();
    });

  return (
    <div className="flex flex-col gap-3">
      <p className="text-base-content/70 text-sm">{t('order.pay.fakeNote')}</p>
      {error && <Alert type="error">{error}</Alert>}
      <button
        type="button"
        className="btn btn-primary"
        disabled={pending}
        onClick={() => confirm('SUCCEEDED')}
      >
        {t('order.pay.simulateSuccess')}
      </button>
      <button
        type="button"
        className="btn btn-outline"
        disabled={pending}
        onClick={() => confirm('FAILED')}
      >
        {t('order.pay.simulateFailure')}
      </button>
    </div>
  );
}
