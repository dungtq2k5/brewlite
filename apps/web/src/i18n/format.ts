export function formatVnd(amount: number, locale: 'en' | 'vi'): string {
  if (locale === 'vi') {
    return new Intl.NumberFormat('vi-VN').format(amount) + ' ₫';
  }
  return '₫' + new Intl.NumberFormat('en-US').format(amount);
}

export function localized(
  text: { en: string; vi: string } | null | undefined,
  locale: 'en' | 'vi',
): string {
  if (!text) return '';
  return text[locale] || text.en || text.vi || '';
}

export function formatDateTime(isoString: string, locale: 'en' | 'vi'): string {
  return new Intl.DateTimeFormat(locale === 'vi' ? 'vi-VN' : 'en-US', {
    timeZone: 'Asia/Ho_Chi_Minh',
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(isoString));
}
