'use client';

import { useEffect, useId, useState, type FormEvent } from 'react';
import { formatVnd } from '@/i18n/format';
import type { Locale } from '@/i18n/locale';

type Outcome = 'SUCCEEDED' | 'FAILED';
type Phase = 'form' | 'processing' | 'success' | 'declined';

type FieldName = 'number' | 'expiry' | 'cvc' | 'name';
type FieldErrors = Partial<Record<FieldName, string>>;

interface Props {
  amountVnd: number;
  expiresAt: string | null;
  locale: Locale;
  cardholder: string;
  busy: boolean;
  /** Resolves true once the provider answered; false when the page must stay on the form. */
  onConfirm: (outcome: Outcome) => Promise<boolean>;
  onRefresh: () => void;
}

/**
 * Development/demo card form for the fake provider. It validates like a real
 * checkout and maps the two Stripe-style test cards onto the provider's
 * SUCCEEDED / FAILED outcomes, so the page never exposes "simulate" buttons.
 */
const SUCCESS_CARD = '4242424242424242';
const DECLINE_CARD = '4000000000000002';
const DEMO_EXPIRY = '12/34';
const DEMO_CVC = '123';

const BRAND_LABELS: Record<string, string> = {
  visa: 'VISA',
  mastercard: 'Mastercard',
  amex: 'AMEX',
  jcb: 'JCB',
  card: 'CARD',
};

function digitsOnly(value: string): string {
  return value.replace(/\D/g, '');
}

function groupCardNumber(value: string): string {
  return digitsOnly(value)
    .slice(0, 19)
    .replace(/(.{4})/g, '$1 ')
    .trim();
}

function formatExpiry(value: string): string {
  const digits = digitsOnly(value).slice(0, 4);
  return digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits;
}

function passesLuhn(digits: string): boolean {
  let sum = 0;
  let double = false;
  for (let index = digits.length - 1; index >= 0; index -= 1) {
    let digit = Number(digits[index]);
    if (double) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    double = !double;
  }
  return sum % 10 === 0;
}

function brandOf(digits: string): keyof typeof BRAND_LABELS {
  if (/^4/.test(digits)) return 'visa';
  if (/^(5[1-5]|2[2-7])/.test(digits)) return 'mastercard';
  if (/^3[47]/.test(digits)) return 'amex';
  if (/^35/.test(digits)) return 'jcb';
  return 'card';
}

function expiryProblem(value: string): string | null {
  const digits = digitsOnly(value);
  if (digits.length !== 4) return 'expiry';
  const month = Number(digits.slice(0, 2));
  const year = 2000 + Number(digits.slice(2));
  if (month < 1 || month > 12) return 'expiry';
  // Valid through the last day of the month printed on the card.
  const firstOfNextMonth = new Date(year, month, 1).getTime();
  return firstOfNextMonth <= Date.now() ? 'expiry' : null;
}

function formatRemaining(milliseconds: number): string {
  const total = Math.max(0, Math.floor(milliseconds / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export default function FakeCardCheckout({
  amountVnd,
  expiresAt,
  locale,
  cardholder,
  busy,
  onConfirm,
  onRefresh,
}: Props) {
  const isVi = locale === 'vi';
  const fieldId = useId();
  const [number, setNumber] = useState(groupCardNumber(SUCCESS_CARD));
  const [expiry, setExpiry] = useState(DEMO_EXPIRY);
  const [cvc, setCvc] = useState(DEMO_CVC);
  const [name, setName] = useState(cardholder.toUpperCase());
  const [errors, setErrors] = useState<FieldErrors>({});
  const [phase, setPhase] = useState<Phase>('form');
  const [remaining, setRemaining] = useState<number | null>(null);

  useEffect(() => {
    if (!expiresAt) return;
    const deadline = new Date(expiresAt).getTime();
    const tick = () => setRemaining(Math.max(0, deadline - Date.now()));
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [expiresAt]);

  const expired = remaining !== null && remaining <= 0;
  const digits = digitsOnly(number);
  const brand = brandOf(digits);
  const blocked = busy || phase !== 'form' || expired;

  const validate = (): FieldErrors => {
    const next: FieldErrors = {};

    if (digits.length < 13 || digits.length > 19 || !passesLuhn(digits)) {
      next.number = isVi ? 'Số thẻ không hợp lệ.' : 'Enter a valid card number.';
    }
    if (expiryProblem(expiry)) {
      next.expiry = isVi ? 'Ngày hết hạn không hợp lệ.' : 'Enter a valid expiry date.';
    }
    if (!/^\d{3,4}$/.test(cvc)) {
      next.cvc = isVi
        ? 'Mã bảo mật phải có 3 hoặc 4 chữ số.'
        : 'The security code is 3 or 4 digits.';
    }
    if (name.trim().length < 2) {
      next.name = isVi ? 'Nhập tên in trên thẻ.' : 'Enter the name printed on the card.';
    }

    return next;
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (blocked) return;

    const nextErrors = validate();
    setErrors(nextErrors);
    const firstError = Object.keys(nextErrors)[0] as FieldName | undefined;
    if (firstError) {
      document.getElementById(`${fieldId}-${firstError}`)?.focus();
      return;
    }

    setPhase('processing');
    // A short authorisation beat reads as a real card network round-trip; the
    // provider call below is local and would otherwise flash by.
    await new Promise((resolve) => setTimeout(resolve, 900));

    const outcome: Outcome = digits === DECLINE_CARD ? 'FAILED' : 'SUCCEEDED';
    const confirmed = await onConfirm(outcome);
    if (!confirmed) {
      setPhase('form');
      return;
    }

    setPhase(outcome === 'SUCCEEDED' ? 'success' : 'declined');
    await new Promise((resolve) => setTimeout(resolve, outcome === 'SUCCEEDED' ? 1200 : 1000));
    onRefresh();
  };

  if (phase !== 'form') {
    const success = phase === 'success';
    return (
      <div
        className={[
          'card-result',
          phase === 'success' && 'card-result--success',
          phase === 'declined' && 'card-result--declined',
        ]
          .filter(Boolean)
          .join(' ')}
        role="status"
        aria-live="assertive"
      >
        {phase === 'processing' ? (
          <>
            <span className="card-spinner" aria-hidden="true" />
            <p className="card-result-title">
              {isVi ? 'Đang xác thực thẻ…' : 'Authorising your card…'}
            </p>
            <p className="fine">
              {isVi
                ? 'Vui lòng không đóng trang trong khi ngân hàng phản hồi.'
                : 'Please keep this page open while the bank responds.'}
            </p>
          </>
        ) : success ? (
          <>
            <span className="card-result-mark" aria-hidden="true">
              ✓
            </span>
            <p className="card-result-title">
              {isVi ? 'Thanh toán thành công' : 'Payment successful'}
            </p>
            <p className="fine">
              {isVi
                ? `${formatVnd(amountVnd, locale)} đã được thanh toán. Đơn của bạn đang chuyển tới quầy.`
                : `${formatVnd(amountVnd, locale)} paid. Your order is on its way to the counter.`}
            </p>
          </>
        ) : (
          <>
            <span className="card-result-mark" aria-hidden="true">
              ×
            </span>
            <p className="card-result-title">{isVi ? 'Thẻ bị từ chối' : 'Card declined'}</p>
            <p className="fine">
              {isVi
                ? 'Ngân hàng không chấp nhận giao dịch này. Bạn có thể thử lại bằng thẻ khác.'
                : 'The bank declined this payment. You can try again with another card.'}
            </p>
          </>
        )}
      </div>
    );
  }

  return (
    <form className="card-checkout" onSubmit={(event) => void submit(event)} noValidate>
      <div className="card-checkout-head">
        <div>
          <p className="page-meta">{isVi ? 'Thanh toán an toàn' : 'Secure payment'}</p>
          <p className="card-checkout-amount">{formatVnd(amountVnd, locale)}</p>
        </div>
        {remaining !== null && (
          <span className={expired ? 'tag tag--error' : 'tag tag--warning'} aria-live="polite">
            {expired
              ? isVi
                ? 'Phiên đã hết hạn'
                : 'Session expired'
              : isVi
                ? `Còn ${formatRemaining(remaining)}`
                : `${formatRemaining(remaining)} left`}
          </span>
        )}
      </div>

      <div className={`payment-card payment-card--${brand}`} aria-hidden="true">
        <span className="payment-card-chip" />
        <span className="payment-card-brand">{BRAND_LABELS[brand]}</span>
        <span className="payment-card-number">
          {groupCardNumber(digits) || '•••• •••• •••• ••••'}
        </span>
        <span className="payment-card-holder">
          {name.trim() || (isVi ? 'TÊN TRÊN THẺ' : 'CARDHOLDER')}
        </span>
        <span className="payment-card-expiry">{expiry || 'MM/YY'}</span>
      </div>

      <div className="card-brand-row" aria-label={isVi ? 'Thẻ được chấp nhận' : 'Accepted cards'}>
        <span>VISA</span>
        <span>Mastercard</span>
        <span>JCB</span>
        <span className="card-brand-note">
          {isVi ? 'Thẻ ghi nợ hoặc tín dụng' : 'Debit or credit'}
        </span>
      </div>

      <div className="field">
        <label htmlFor={`${fieldId}-number`}>{isVi ? 'Số thẻ' : 'Card number'}</label>
        <input
          id={`${fieldId}-number`}
          type="text"
          inputMode="numeric"
          autoComplete="cc-number"
          value={number}
          onChange={(event) => {
            setNumber(groupCardNumber(event.target.value));
            setErrors((previous) => ({ ...previous, number: undefined }));
          }}
          aria-invalid={Boolean(errors.number)}
          aria-describedby={errors.number ? `${fieldId}-number-error` : undefined}
          disabled={blocked}
          placeholder="1234 5678 9012 3456"
          className={errors.number ? 'input input--error' : 'input'}
        />
        {errors.number && (
          <p className="field-hint field-hint--error" id={`${fieldId}-number-error`} role="alert">
            {errors.number}
          </p>
        )}
      </div>

      <div className="field-row">
        <div className="field">
          <label htmlFor={`${fieldId}-expiry`}>{isVi ? 'Ngày hết hạn' : 'Expiry date'}</label>
          <input
            id={`${fieldId}-expiry`}
            type="text"
            inputMode="numeric"
            autoComplete="cc-exp"
            value={expiry}
            onChange={(event) => {
              setExpiry(formatExpiry(event.target.value));
              setErrors((previous) => ({ ...previous, expiry: undefined }));
            }}
            aria-invalid={Boolean(errors.expiry)}
            aria-describedby={errors.expiry ? `${fieldId}-expiry-error` : undefined}
            disabled={blocked}
            placeholder="MM/YY"
            className={errors.expiry ? 'input input--error' : 'input'}
          />
          {errors.expiry && (
            <p className="field-hint field-hint--error" id={`${fieldId}-expiry-error`} role="alert">
              {errors.expiry}
            </p>
          )}
        </div>

        <div className="field">
          <label htmlFor={`${fieldId}-cvc`}>{isVi ? 'Mã bảo mật' : 'Security code'}</label>
          <input
            id={`${fieldId}-cvc`}
            type="text"
            inputMode="numeric"
            autoComplete="cc-csc"
            value={cvc}
            onChange={(event) => {
              setCvc(digitsOnly(event.target.value).slice(0, 4));
              setErrors((previous) => ({ ...previous, cvc: undefined }));
            }}
            aria-invalid={Boolean(errors.cvc)}
            aria-describedby={errors.cvc ? `${fieldId}-cvc-error` : `${fieldId}-cvc-hint`}
            disabled={blocked}
            placeholder="CVC"
            className={errors.cvc ? 'input input--error' : 'input'}
          />
          {errors.cvc ? (
            <p className="field-hint field-hint--error" id={`${fieldId}-cvc-error`} role="alert">
              {errors.cvc}
            </p>
          ) : (
            <p className="field-hint" id={`${fieldId}-cvc-hint`}>
              {isVi ? '3 số ở mặt sau thẻ' : '3 digits on the back'}
            </p>
          )}
        </div>
      </div>

      <div className="field">
        <label htmlFor={`${fieldId}-name`}>{isVi ? 'Tên trên thẻ' : 'Name on card'}</label>
        <input
          id={`${fieldId}-name`}
          type="text"
          autoComplete="cc-name"
          value={name}
          onChange={(event) => {
            setName(event.target.value);
            setErrors((previous) => ({ ...previous, name: undefined }));
          }}
          aria-invalid={Boolean(errors.name)}
          aria-describedby={errors.name ? `${fieldId}-name-error` : undefined}
          disabled={blocked}
          placeholder={isVi ? 'NGUYEN VAN A' : 'JANE DOE'}
          className={errors.name ? 'input input--error' : 'input'}
        />
        {errors.name && (
          <p className="field-hint field-hint--error" id={`${fieldId}-name-error`} role="alert">
            {errors.name}
          </p>
        )}
      </div>

      <button
        className="btn btn--primary btn--block card-pay-button"
        type="submit"
        disabled={blocked}
      >
        {busy
          ? isVi
            ? 'Đang xử lý…'
            : 'Processing…'
          : isVi
            ? `Thanh toán ${formatVnd(amountVnd, locale)}`
            : `Pay ${formatVnd(amountVnd, locale)}`}
      </button>

      <p className="card-secure">
        <span className="card-lock" aria-hidden="true">
          ▣
        </span>
        {isVi
          ? 'Giao dịch được mã hoá. BrewLite không lưu số thẻ của bạn.'
          : 'Encrypted payment. BrewLite never stores your card number.'}
      </p>

      <details className="card-demo">
        <summary>{isVi ? 'Thẻ dùng cho bản demo' : 'Cards for this demo'}</summary>
        <dl>
          <div>
            <dt>4242 4242 4242 4242</dt>
            <dd>{isVi ? 'giao dịch thành công' : 'payment succeeds'}</dd>
          </div>
          <div>
            <dt>4000 0000 0000 0002</dt>
            <dd>{isVi ? 'ngân hàng từ chối' : 'bank declines'}</dd>
          </div>
        </dl>
      </details>
    </form>
  );
}
