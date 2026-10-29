import { formatVnd } from '@/i18n/format';
import type { ApiErrorDetails } from './gateway-types';

/**
 * Turns a gateway error code into a customer-facing sentence.
 * Servers send codes, never text (api-endpoints-plan §0.3).
 */
export function describeError(code: string, details: ApiErrorDetails, locale: 'vi' | 'en'): string {
  const isVi = locale === 'vi';

  switch (code) {
    case 'OUT_OF_STOCK': {
      const stockByProduct = new Map<string, number>();
      for (const row of details.products ?? []) {
        const current = stockByProduct.get(row.productId);
        if (current === undefined || row.available < current) {
          stockByProduct.set(row.productId, row.available);
        }
      }

      const soldOut = [...stockByProduct.values()].filter((available) => available === 0).length;
      const short = [...stockByProduct.values()].filter((available) => available > 0);
      const lowestAvailable = short.length > 0 ? Math.min(...short) : 0;

      if (isVi) {
        if (soldOut > 0 && short.length > 0) {
          return `${soldOut} món đã hết hàng và ${short.length} món không đủ số lượng. Vui lòng giảm số lượng hoặc xóa món rồi thử lại.`;
        }
        if (soldOut > 0) {
          return `${soldOut} món trong giỏ đã hết hàng. Vui lòng xóa món đó và thử lại.`;
        }
        if (short.length > 0) {
          return `Một số món trong giỏ chỉ còn ${lowestAvailable} phần. Vui lòng giảm số lượng hoặc xóa món rồi thử lại.`;
        }
        return 'Một số món trong giỏ đã hết hàng. Vui lòng kiểm tra lại giỏ hàng.';
      }
      if (soldOut > 0 && short.length > 0) {
        return `${soldOut} item(s) are sold out and ${short.length} do not have enough stock. Lower the quantity or remove them and try again.`;
      }
      if (soldOut > 0) {
        return `${soldOut} item(s) in your cart are sold out. Remove them and try again.`;
      }
      if (short.length > 0) {
        return `Some items only have ${lowestAvailable} left. Lower the quantity or remove them and try again.`;
      }
      return 'Some items in your cart are sold out. Please review your cart.';
    }
    case 'PRODUCT_UNAVAILABLE':
      return isVi
        ? 'Một số món không còn được bán. Vui lòng xóa món đó khỏi giỏ hàng.'
        : 'Some items are no longer available. Please remove them from your cart.';
    case 'OPTION_INVALID':
      return isVi
        ? 'Size hoặc topping của một món không còn hợp lệ. Vui lòng chọn lại.'
        : 'A size or topping is no longer valid. Please choose again.';
    case 'PROMO_CODE_INVALID':
      return describePromoError(details.reason, details, locale);
    case 'ORDER_TOTAL_TOO_LOW':
      return isVi
        ? `Đơn tối thiểu ${formatVnd(details.minimumVnd ?? 0, locale)}.`
        : `The minimum order is ${formatVnd(details.minimumVnd ?? 0, locale)}.`;
    case 'ORDER_TOTAL_TOO_HIGH':
      return isVi
        ? `Đơn tối đa ${formatVnd(details.maximumVnd ?? 0, locale)}.`
        : `The maximum order is ${formatVnd(details.maximumVnd ?? 0, locale)}.`;
    case 'ORDER_NOT_PAYABLE':
      return isVi
        ? 'Đơn hàng không còn ở trạng thái có thể thanh toán.'
        : 'This order can no longer be paid.';
    case 'INVALID_STATE':
      return isVi
        ? 'Trạng thái đơn hàng đã thay đổi. Vui lòng tải lại trang.'
        : 'The order status changed. Please refresh the page.';
    case 'IMAGE_INVALID':
      return isVi
        ? 'Ảnh không hợp lệ. Chọn JPG, PNG hoặc WebP dung lượng dưới 2 MB.'
        : 'That image is not valid. Choose a JPG, PNG or WebP under 2 MB.';
    case 'STOCK_CONTENDED':
      return isVi
        ? 'Món vừa được người khác đặt. Vui lòng thử lại.'
        : 'Someone else just took that item. Please try again.';
    case 'IDEMPOTENCY_KEY_REUSED':
      return isVi
        ? 'Đơn hàng đã thay đổi trong lúc xử lý. Vui lòng kiểm tra lịch sử đơn.'
        : 'The order changed while it was being placed. Please check your order history.';
    case 'VALIDATION_FAILED':
      return isVi
        ? 'Thông tin gửi đi chưa hợp lệ. Vui lòng kiểm tra lại.'
        : 'Some information is not valid. Please review it and try again.';
    case 'INVALID_CREDENTIALS':
      return isVi ? 'Email hoặc mật khẩu không chính xác.' : 'Email or password is incorrect.';
    case 'EMAIL_TAKEN':
      return isVi
        ? 'Email này đã có tài khoản. Hãy đăng nhập hoặc dùng email khác.'
        : 'An account already uses this email. Sign in or use another email.';
    case 'ACCOUNT_LOCKED':
      return isVi
        ? 'Tài khoản đang bị tạm khóa. Vui lòng thử lại sau hoặc liên hệ quầy.'
        : 'This account is temporarily locked. Try again later or ask at the counter.';
    case 'ACCOUNT_DEACTIVATED':
      return isVi
        ? 'Tài khoản đã bị vô hiệu hóa. Vui lòng liên hệ quầy BrewLite.'
        : 'This account has been deactivated. Please contact the BrewLite counter.';
    case 'FIREBASE_TOKEN_INVALID':
      return isVi
        ? 'Không xác thực được tài khoản Google. Vui lòng thử lại.'
        : 'Google sign-in could not be verified. Please try again.';
    case 'FIREBASE_POPUP_CLOSED':
      return isVi
        ? 'Bạn đã đóng cửa sổ đăng nhập Google.'
        : 'You closed the Google sign-in window.';
    case 'CURRENT_PASSWORD_INCORRECT':
      return isVi ? 'Mật khẩu hiện tại không đúng.' : 'The current password is incorrect.';
    case 'SELF_ACTION_FORBIDDEN':
      return isVi
        ? 'Bạn không thể thực hiện thao tác này trên chính tài khoản mình.'
        : 'You cannot do that to your own account.';
    case 'LAST_ADMIN':
      return isVi ? 'Không thể bỏ quyền quản trị cuối cùng.' : 'The last admin cannot be demoted.';
    case 'PERMISSION_DENIED':
      return isVi
        ? 'Bạn không có quyền thực hiện thao tác này.'
        : 'You do not have permission to do that.';
    case 'UNAUTHENTICATED':
      return isVi
        ? 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.'
        : 'Your session expired. Please sign in again.';
    case 'RATE_LIMITED':
      return isVi
        ? 'Bạn thao tác quá nhanh. Vui lòng đợi một lát rồi thử lại.'
        : 'Too many attempts. Please wait a moment and try again.';
    case 'PAYMENT_PROVIDER_UNAVAILABLE':
      return isVi
        ? 'Cổng thanh toán đang bận. Vui lòng thử lại sau ít phút.'
        : 'The payment provider is unavailable. Please try again shortly.';
    case 'INTERNAL':
    case 'UPSTREAM_UNAVAILABLE':
    case 'UPSTREAM_TIMEOUT':
      return isVi
        ? 'Không thể kết nối đến hệ thống. Vui lòng thử lại.'
        : 'Could not reach the server. Please try again.';
    default:
      return isVi ? 'Đã xảy ra lỗi. Vui lòng thử lại.' : 'Something went wrong. Please try again.';
  }
}

/** Describes anything that is not already a gateway code, including a dropped connection. */
export function describeUnknownError(
  error: unknown,
  locale: 'vi' | 'en',
): { code: string; message: string } {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = String((error as { code: unknown }).code);
    const details = (error as { details?: unknown }).details;
    return {
      code,
      message: describeError(
        code,
        typeof details === 'object' && details !== null ? (details as ApiErrorDetails) : {},
        locale,
      ),
    };
  }
  return {
    code: 'NETWORK',
    message:
      locale === 'vi'
        ? 'Không thể kết nối đến hệ thống. Vui lòng kiểm tra mạng và thử lại.'
        : 'Could not reach the server. Please check your connection and try again.',
  };
}

function describePromoError(
  reason: string | undefined,
  details: ApiErrorDetails,
  locale: 'vi' | 'en',
): string {
  const isVi = locale === 'vi';
  switch (reason) {
    case 'NOT_FOUND':
      return isVi ? 'Mã giảm giá không tồn tại.' : 'That promo code does not exist.';
    case 'INACTIVE':
      return isVi ? 'Mã giảm giá đã ngừng áp dụng.' : 'That promo code is inactive.';
    case 'NOT_STARTED':
      return isVi ? 'Mã giảm giá chưa có hiệu lực.' : 'That promo code is not active yet.';
    case 'EXPIRED':
      return isVi ? 'Mã giảm giá đã hết hạn.' : 'That promo code has expired.';
    case 'MIN_SUBTOTAL':
      return isVi
        ? `Đơn tối thiểu ${formatVnd(details.minSubtotalVnd ?? 0, locale)} để dùng mã này.`
        : `This code needs a subtotal of at least ${formatVnd(details.minSubtotalVnd ?? 0, locale)}.`;
    case 'EXHAUSTED':
      return isVi ? 'Mã giảm giá đã hết lượt sử dụng.' : 'That promo code has no uses left.';
    case 'PER_USER_LIMIT':
      return isVi ? 'Bạn đã dùng mã giảm giá này.' : 'You have already used this promo code.';
    default:
      return isVi ? 'Mã giảm giá không hợp lệ.' : 'That promo code is invalid.';
  }
}
