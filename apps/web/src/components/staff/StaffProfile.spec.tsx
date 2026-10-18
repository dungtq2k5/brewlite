import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { StaffProfile } from './StaffProfile';
import { StaffLanguageProvider, STAFF_LANGUAGE_KEY } from './i18n';
import { saveStaffProfile } from '@/lib/staff/actions';
import type { StaffUser } from '@/lib/staff/contracts';
vi.mock('@/lib/staff/actions', () => ({ saveStaffProfile: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
const user: StaffUser = {
  id: 'test',
  fullName: 'Current Staff',
  email: 'current@example.test',
  role: 'STAFF',
  permissions: [],
  hasPassword: false,
  preferredLocale: 'vi',
  createdAt: '2026-10-18T00:00:00Z',
};
beforeEach(() => {
  vi.resetAllMocks();
  localStorage.clear();
});
describe('current staff account', () => {
  it('renders server user, password flag and unchanged avatar with English default', () => {
    render(
      <StaffLanguageProvider>
        <StaffProfile user={user} />
      </StaffLanguageProvider>,
    );
    expect(screen.getByText(user.email)).toBeTruthy();
    expect(screen.getByText('MA')).toBeTruthy();
    expect(screen.getByText('Password not set')).toBeTruthy();
    expect((screen.getByLabelText('Full name *') as HTMLInputElement).value).toBe(user.fullName);
    expect((screen.getByRole('combobox') as HTMLSelectElement).value).toBe('en');
  });
  it('switches language immediately using the same persisted preference', () => {
    render(
      <StaffLanguageProvider>
        <StaffProfile user={user} />
      </StaffLanguageProvider>,
    );
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'vi' } });
    expect(screen.getByRole('heading', { name: 'Tài khoản' })).toBeTruthy();
    expect(localStorage.getItem(STAFF_LANGUAGE_KEY)).toBe('vi');
    expect(saveStaffProfile).not.toHaveBeenCalled();
  });
  it('prevents duplicate saves and reports success only after server confirmation', async () => {
    render(
      <StaffLanguageProvider>
        <StaffProfile user={user} />
      </StaffLanguageProvider>,
    );
    let resolve!: (value: Awaited<ReturnType<typeof saveStaffProfile>>) => void;
    vi.mocked(saveStaffProfile).mockReturnValue(
      new Promise((done) => {
        resolve = done;
      }),
    );
    fireEvent.change(screen.getByLabelText('Full name *'), { target: { value: 'Changed Staff' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(screen.queryByText('Profile updated')).toBeNull();
    expect((screen.getByRole('button', { name: 'Saving…' }) as HTMLButtonElement).disabled).toBe(
      true,
    );
    expect(saveStaffProfile).toHaveBeenCalledTimes(1);
    await act(async () => resolve({ ok: true, data: { ...user, fullName: 'Changed Staff' } }));
    expect(await screen.findByText('Profile updated')).toBeTruthy();
  });
  it('shows failure without a success notice and validates empty name', async () => {
    render(
      <StaffLanguageProvider>
        <StaffProfile user={user} />
      </StaffLanguageProvider>,
    );
    vi.mocked(saveStaffProfile).mockResolvedValue({ ok: false, error: 'unauthenticated' });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toContain('session has expired'),
    );
    expect(screen.queryByText('Profile updated')).toBeNull();
    fireEvent.change(screen.getByLabelText('Full name *'), { target: { value: '   ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(screen.getByRole('alert').textContent).toContain('1 to 100');
    expect(saveStaffProfile).toHaveBeenCalledTimes(1);
  });
});
