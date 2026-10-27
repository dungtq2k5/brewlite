'use client';

import { useState } from 'react';
import type { FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { BrandLogo } from '@/components/ui/brand-logo';
import { useLocale } from '@/i18n/locale-context';
import { loginAction } from './actions';

export function LoginClient() {
  const router = useRouter();
  const { locale, setLocale, tx } = useLocale();
  const [email, setEmail] = useState('admin@brewlite.local');
  const [password, setPassword] = useState('Admin@123456');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const res = await loginAction(email, password);
    setLoading(false);
    if (!res.ok) {
      setError(tx('Email hoặc mật khẩu không hợp lệ.', 'Invalid email or password.'));
      return;
    }
    router.push(res.data?.role === 'STAFF' ? '/staff/orders' : '/admin');
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F5EFE6] p-4">
      <div className="rounded-[28px] bg-[#FCF9F2] border-[1.5px] border-[#B59478] w-full max-w-md p-6 sm:p-8 space-y-5">
        <div className="flex items-center justify-between">
          <BrandLogo size="md" />
          <div className="inline-flex items-center rounded-full border border-[#9B7B60] bg-[#F3ECE1] p-0.5 text-xs font-bold">
            <button
              type="button"
              onClick={() => setLocale('vi')}
              className={`px-2.5 py-1 rounded-full ${locale === 'vi' ? 'bg-[#4E311E] text-white' : 'text-[#8C6A50]'}`}
            >
              VI
            </button>
            <button
              type="button"
              onClick={() => setLocale('en')}
              className={`px-2.5 py-1 rounded-full ${locale === 'en' ? 'bg-[#4E311E] text-white' : 'text-[#8C6A50]'}`}
            >
              EN
            </button>
          </div>
        </div>

        {error && (
          <div className="rounded-2xl bg-[#B83B2A] text-white p-3 text-xs font-bold">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <fieldset className="fieldset">
            <legend className="fieldset-legend text-[#4E311E] font-bold">Email</legend>
            <input
              type="email"
              className="input input-bordered w-full rounded-full bg-[#F3ECE1] border-[#9B7B60]"
              value={email}
              required
              onChange={(e) => setEmail(e.target.value)}
            />
          </fieldset>

          <fieldset className="fieldset">
            <legend className="fieldset-legend text-[#4E311E] font-bold">
              {tx('Mật khẩu', 'Password')}
            </legend>
            <input
              type="password"
              className="input input-bordered w-full rounded-full bg-[#F3ECE1] border-[#9B7B60]"
              value={password}
              required
              onChange={(e) => setPassword(e.target.value)}
            />
          </fieldset>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-full bg-[#4E311E] text-white font-bold text-sm hover:opacity-95"
          >
            {loading ? tx('Đang đăng nhập...', 'Signing in...') : tx('Đăng nhập →', 'Sign in →')}
          </button>
        </form>

        <div className="grid grid-cols-2 gap-2 pt-2">
          <button
            type="button"
            className="py-2 rounded-full border border-[#9B7B60] bg-[#F3ECE1] text-xs font-bold"
            onClick={() => {
              setEmail('admin@brewlite.local');
              setPassword('Admin@123456');
            }}
          >
            {tx('Tài khoản ADMIN', 'ADMIN Account')}
          </button>
          <button
            type="button"
            className="py-2 rounded-full border border-[#9B7B60] bg-[#F3ECE1] text-xs font-bold"
            onClick={() => {
              setEmail('staff01@brewlite.local');
              setPassword('Staff@123456');
            }}
          >
            {tx('Tài khoản STAFF', 'STAFF Account')}
          </button>
        </div>

        <div className="text-center">
          <Link href="/admin" prefetch={false} className="text-xs font-bold text-[#8C6A50] underline">
            ← {tx('Quay lại trang quản trị', 'Back to Admin')}
          </Link>
        </div>
      </div>
    </div>
  );
}