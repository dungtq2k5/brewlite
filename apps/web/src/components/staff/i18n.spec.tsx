import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { hydrateRoot } from 'react-dom/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  english,
  vietnamese,
  StaffLanguageProvider,
  STAFF_LANGUAGE_KEY,
  useStaffI18n,
} from './i18n';
function Probe() {
  const { t, locale, setLocale } = useStaffI18n();
  return (
    <div>
      <p>{t('Tồn kho')}</p>
      <button onClick={() => setLocale(locale === 'en' ? 'vi' : 'en')}>Switch</button>
    </div>
  );
}
beforeEach(() => {
  localStorage.clear();
});
describe('staff language preference', () => {
  it.each([null, 'xx'])('defaults to English with invalid or absent preference %j', (stored) => {
    if (stored) localStorage.setItem(STAFF_LANGUAGE_KEY, stored);
    render(
      <StaffLanguageProvider>
        <Probe />
      </StaffLanguageProvider>,
    );
    expect(screen.getByText('Inventory')).toBeTruthy();
  });
  it('switches immediately, persists and restores on remount', () => {
    const mounted = render(
      <StaffLanguageProvider>
        <Probe />
      </StaffLanguageProvider>,
    );
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByText('Tồn kho')).toBeTruthy();
    expect(localStorage.getItem(STAFF_LANGUAGE_KEY)).toBe('vi');
    mounted.unmount();
    render(
      <StaffLanguageProvider>
        <Probe />
      </StaffLanguageProvider>,
    );
    expect(screen.getByText('Tồn kho')).toBeTruthy();
  });
  it('continues working when storage reads and writes throw', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error();
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error();
    });
    render(
      <StaffLanguageProvider>
        <Probe />
      </StaffLanguageProvider>,
    );
    expect(screen.getByText('Inventory')).toBeTruthy();
    fireEvent.click(screen.getByRole('button'));
    expect(screen.getByText('Tồn kho')).toBeTruthy();
  });
  it('hydrates with English then restores saved Vietnamese without mismatch', async () => {
    const ui = (
      <StaffLanguageProvider>
        <Probe />
      </StaffLanguageProvider>
    );
    const container = document.createElement('div');
    container.innerHTML = renderToString(ui);
    expect(container.textContent).toContain('Inventory');
    document.body.appendChild(container);
    localStorage.setItem(STAFF_LANGUAGE_KEY, 'vi');
    const onRecoverableError = vi.fn();
    let root!: ReturnType<typeof hydrateRoot>;
    await act(async () => {
      root = hydrateRoot(container, ui, { onRecoverableError });
    });
    await waitFor(() => expect(container.textContent).toContain('Tồn kho'));
    expect(onRecoverableError).not.toHaveBeenCalled();
    await act(async () => root.unmount());
    container.remove();
  });
  it('has matching dictionary entries', () => {
    expect(Object.keys(english).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0))).toEqual(
      Object.keys(vietnamese).sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)),
    );
  });
});
