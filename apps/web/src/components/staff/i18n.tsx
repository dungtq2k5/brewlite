'use client';
import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { formatDateTime, formatVnd, localized } from '@/i18n/format';
export type StaffLocale = 'en' | 'vi';
export const STAFF_LANGUAGE_KEY = 'brewlite_staff_lang';
export const english: Record<string, string> = {
  'Ghi chú khách hàng': 'Customer note',
  Size: 'Size',
  'Đăng nhập': 'Sign in',
  'Tài khoản nhân viên': 'Staff navigation',
  'Hết số lượng': 'Out of stock',
  'Còn hàng': 'In stock',
  'Đơn đang xử lý': 'Active orders',
  'Tồn kho': 'Inventory',
  'Tài khoản': 'Account',
  'Nhân viên': 'Staff',
  'Đăng xuất': 'Sign out',
  'Ngôn ngữ hiển thị': 'Display language',
  'Tiếng Việt': 'Vietnamese',
  English: 'English',
  'Dữ liệu từ máy chủ': 'Server data',
  'Làm mới': 'Refresh',
  'Đang tải…': 'Loading…',
  'Đang tải dữ liệu…': 'Loading data…',
  'Đang lưu…': 'Saving…',
  'Đang xử lý...': 'Processing…',
  Đóng: 'Close',
  'Đóng hộp thoại': 'Close dialog',
  'Đóng popup': 'Close dialog',
  'Lưu thay đổi': 'Save changes',
  'Tải lại': 'Reload',
  'Đã cập nhật hồ sơ': 'Profile updated',
  'Thay đổi của bạn đã được lưu.': 'Your changes have been saved.',
  'Quản lý thông tin cá nhân và ngôn ngữ hiển thị.': 'Manage your profile and display language.',
  Email: 'Email',
  'Ngày tạo tài khoản': 'Account created',
  'Bảo mật': 'Security',
  'Đã thiết lập mật khẩu': 'Password set',
  'Chưa thiết lập mật khẩu': 'Password not set',
  'Chỉnh hồ sơ': 'Edit profile',
  'Cập nhật tên hiển thị và ngôn ngữ.': 'Update your display name and language.',
  'Họ và tên *': 'Full name *',
  'Nhập họ và tên': 'Enter your full name',
  'Tên phải có từ 1 đến 100 ký tự.': 'Name must contain 1 to 100 characters.',
  'Loại tồn kho': 'Inventory type',
  'Sản phẩm': 'Products',
  Topping: 'Toppings',
  'Tìm theo tên hoặc mã sản phẩm': 'Search by product name or ID',
  'Tìm theo tên topping': 'Search by topping name',
  'Tìm tên hoặc mã sản phẩm…': 'Search product name or ID…',
  'Tìm tên topping…': 'Search toppings…',
  'Lọc trạng thái bán': 'Filter availability',
  'Tất cả': 'All',
  'Đang bật bán': 'On sale',
  'Đang tắt bán': 'Hidden',
  'Đang bán': 'On sale',
  'Tạm ẩn': 'Hidden',
  'Hết hàng': 'Out of stock',
  'Tên sản phẩm': 'Product name',
  'Thể loại': 'Category',
  'Số lượng': 'Quantity',
  'Trạng thái': 'Status',
  'Bật bán': 'Availability',
  'Thao tác': 'Actions',
  'Tên topping': 'Topping name',
  Giá: 'Price',
  'Tồn kho sản phẩm': 'Product inventory',
  'Danh sách topping': 'Toppings',
  'Chưa thể tải dữ liệu. Vui lòng làm mới để thử lại.':
    'Could not load data. Refresh to try again.',
  'Không tìm thấy kết quả phù hợp.': 'No matching results.',
  'Chưa có sản phẩm.': 'No products yet.',
  'Chưa có topping.': 'No toppings yet.',
  'Không theo dõi tồn kho': 'Stock is not tracked',
  'Chỉnh số lượng': 'Edit quantity',
  'Chỉnh số lượng {name}': 'Edit quantity for {name}',
  'Bật bán {name}': 'Enable sales for {name}',
  'Tắt bán {name}': 'Disable sales for {name}',
  'Hiện còn': 'Remaining',
  'Trạng thái bán sản phẩm': 'Product availability',
  'Sản phẩm đã hết hàng': 'Product is out of stock',
  'Số lượng bằng 0. Sản phẩm sẽ tự động tắt bán.': 'Quantity is zero. Sales will be disabled.',
  'Số lượng còn bán': 'Stock quantity',
  'Nhập số lượng': 'Enter quantity',
  'Nhập số lượng tồn kho mới. Đây là số lượng tuyệt đối, không phải số lượng cộng thêm.':
    'Enter the new absolute stock quantity, not an amount to add.',
  ' Để trống để giữ chế độ không theo dõi tồn kho.': ' Leave blank to keep stock untracked.',
  'Nhập số nguyên từ 0 đến 2.147.483.647.': 'Enter a whole number from 0 to 2,147,483,647.',
  'Lưu số lượng': 'Save quantity',
  'Đã cập nhật số lượng.': 'Quantity updated.',
  'Đã cập nhật trạng thái bán.': 'Availability updated.',
  'Đã tải lại dữ liệu hiện tại; vui lòng kiểm tra trước khi lưu lại.':
    'Current data reloaded. Review it before saving again.',
  'Chưa thể xác minh dữ liệu đã lưu. Đóng hộp thoại và nhấn Làm mới trước khi tiếp tục.':
    'Could not verify saved data. Close the dialog and refresh before continuing.',
  'Vui lòng chờ hoặc làm mới dữ liệu trước khi lưu.': 'Wait or refresh the data before saving.',
  'Đã thanh toán': 'Paid',
  'Đang pha': 'Preparing',
  'Chờ nhận': 'Ready for pickup',
  'Hoàn thành': 'Completed',
  'Đã hủy': 'Cancelled',
  'Chờ thanh toán': 'Awaiting payment',
  'Thanh toán thất bại': 'Payment failed',
  'Bắt đầu pha': 'Start preparing',
  'Đánh dấu sẵn sàng': 'Mark ready',
  'Đã giao khách': 'Complete pickup',
  'Tóm tắt đơn hàng': 'Order summary',
  'Lọc đơn hàng': 'Filter orders',
  'Tạo lúc': 'Created',
  'Thanh toán': 'Paid',
  'Ghi chú:': 'Note:',
  Tổng: 'Total',
  'Chi tiết': 'Details',
  'Hủy đơn': 'Cancel order',
  'Topping:': 'Toppings:',
  'Không có': 'None',
  'Không có đơn trong trạng thái này.': 'No orders in this status.',
  'Hiển thị {visible}/{total} đơn': 'Showing {visible}/{total} orders',
  'Còn {count} đơn': '{count} more orders',
  'Xem thêm {count} đơn': 'Show {count} more orders',
  'Thu gọn': 'Show less',
  '{count} đơn đang xử lý': '{count} active orders',
  'Đã cập nhật đơn hàng.': 'Order updated.',
  'Chi tiết đơn': 'Order details',
  'Thông tin đơn': 'Order information',
  'Mã đơn': 'Order number',
  'Thời gian tạo': 'Created at',
  'Ghi chú': 'Note',
  'Lý do hủy': 'Cancellation note',
  'Món và topping': 'Items and toppings',
  'Không topping': 'No toppings',
  'Đơn giá:': 'Unit price:',
  'Tổng tiền': 'Amounts',
  'Tạm tính': 'Subtotal',
  'Mã khuyến mãi': 'Promotion code',
  'Giảm theo mã': 'Promotion discount',
  'Giảm bằng điểm': 'Points discount',
  'Tổng thanh toán': 'Total paid',
  'Xác nhận thao tác': 'Confirm action',
  'Hủy đơn #{number}': 'Cancel order #{number}',
  'Đã hủy đơn #{number}': 'Order #{number} cancelled',
  'Đã cập nhật': 'Updated',
  'Trạng thái đơn': 'Order status',
  'Trạng thái hoàn tiền': 'Refund status',
  'Tổng đã thanh toán': 'Amount paid',
  'Trạng thái hiện tại': 'Current status',
  '⚠ Lưu ý': '⚠ Note',
  'Hủy đơn sẽ bắt đầu xử lý hoàn tiền.': 'Cancelling the order starts refund processing.',
  'Nhập lý do hủy đơn': 'Enter a cancellation note',
  'Xác nhận hủy': 'Confirm cancellation',
  'Không hoàn tiền': 'No refund',
  'Đang xử lý': 'Pending',
  'Đã hoàn tiền': 'Refunded',
  'Hoàn tiền thất bại': 'Refund failed',
  'Không xác định': 'Unknown',
  unauthenticated: 'Your session has expired. Please sign in again.',
  forbidden: 'You do not have permission to access this feature.',
  conflict: 'Stock changed. Close and reopen the dialog to use the latest version.',
  invalidState: 'The order status has changed. Refresh and try again.',
  notFound: 'This item no longer exists. Refresh to load current data.',
  invalidInput: 'Check the information you entered and try again.',
  requestFailed: 'Could not load or save data. Please try again.',
};
export const vietnamese: Record<string, string> = {
  ...Object.fromEntries(Object.keys(english).map((key) => [key, key])),
  unauthenticated: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
  forbidden: 'Bạn không có quyền truy cập chức năng này.',
  conflict: 'Số lượng vừa thay đổi. Đóng và mở lại hộp thoại để dùng phiên bản mới nhất.',
  invalidState: 'Trạng thái đơn đã thay đổi. Vui lòng làm mới và thử lại.',
  notFound: 'Mục này không còn tồn tại. Vui lòng làm mới dữ liệu.',
  invalidInput: 'Vui lòng kiểm tra thông tin đã nhập và thử lại.',
  requestFailed: 'Không thể tải hoặc lưu dữ liệu. Vui lòng thử lại.',
};
export function translate(
  locale: StaffLocale,
  key: string,
  params: Record<string, string | number> = {},
) {
  const template = (locale === 'en' ? english : vietnamese)[key] ?? key;
  return template.replace(/\{(\w+)\}/g, (match, name: string) => String(params[name] ?? match));
}
const LanguageContext = createContext<{
  locale: StaffLocale;
  setLocale: (value: StaffLocale) => void;
}>({ locale: 'en', setLocale: () => {} });
export function StaffLanguageProvider({ children }: { children: ReactNode }) {
  const [locale, updateLocale] = useState<StaffLocale>('en');
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STAFF_LANGUAGE_KEY);
      if (stored === 'en' || stored === 'vi') updateLocale(stored);
    } catch {
      updateLocale('en');
    }
  }, []);
  function setLocale(value: StaffLocale) {
    updateLocale(value);
    try {
      localStorage.setItem(STAFF_LANGUAGE_KEY, value);
    } catch {
      return;
    }
  }
  return (
    <LanguageContext.Provider value={{ locale, setLocale }}>
      <div lang={locale} className="contents">
        {children}
      </div>
    </LanguageContext.Provider>
  );
}
export function useStaffI18n() {
  const { locale, setLocale } = useContext(LanguageContext);
  const number = (value: number) =>
    new Intl.NumberFormat(locale === 'vi' ? 'vi-VN' : 'en-US').format(value);
  const dateTime = (value: string | undefined) =>
    value && Number.isFinite(Date.parse(value)) ? formatDateTime(value, locale) : '—';
  return {
    locale,
    setLocale,
    t: (key: string, params?: Record<string, string | number>) => translate(locale, key, params),
    number,
    dateTime,
    money: (value: number) => formatVnd(value, locale),
    name: (value: { en: string; vi: string }) => localized(value, locale),
  };
}
