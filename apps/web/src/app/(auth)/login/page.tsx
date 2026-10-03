'use client';

import React, { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { loginWithGooglePopup } from '@/lib/firebase';

interface LoginPageProps {
  searchParams?: Promise<{ next?: string }>;
}

interface TokenData {
  accessToken?: string;
  refreshToken?: string;
}

export default function LoginPage({ searchParams }: LoginPageProps) {
  const resolvedSearchParams = searchParams ? use(searchParams) : undefined;
  const nextUrl = resolvedSearchParams?.next || '/orders';

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [fullName, setFullName] = useState('Huỳnh Võ');
  const [email, setEmail] = useState('huynh.dev@brewlite.test');
  const [password, setPassword] = useState('Password123@');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [currentLang, setCurrentLang] = useState('vi');

  useEffect(() => {
    const savedLang = localStorage.getItem('brewlite_lang');
    if (savedLang === 'en' || savedLang === 'vi') {
      setCurrentLang(savedLang);
    } else {
      localStorage.setItem('brewlite_lang', 'vi');
      setCurrentLang('vi');
    }
  }, []);

  const switchLanguage = (lang: string) => {
    localStorage.setItem('brewlite_lang', lang);
    setCurrentLang(lang);
    window.location.reload();
  };

  const isVi = currentLang === 'vi';

  const formatErrorMessage = (codeOrMsg: string) => {
    switch (codeOrMsg) {
      case 'INTERNAL':
        return isVi
          ? 'Tài khoản chưa có mật khẩu hoặc lỗi hệ thống máy chủ Identity.'
          : 'Account has no password or Identity server error.';
      case 'RATE_LIMITED':
        return isVi
          ? 'Thao tác quá nhanh. Vui lòng đợi 30 giây!'
          : 'Too many requests. Please wait 30 seconds!';
      case 'INVALID_CREDENTIALS':
        return isVi ? 'Email hoặc mật khẩu không chính xác.' : 'Invalid email or password.';
      case 'VALIDATION_FAILED':
        return isVi ? 'Mật khẩu cần tối thiểu 8 ký tự.' : 'Password must be at least 8 characters.';
      case 'USER_ALREADY_EXISTS':
      case 'EMAIL_ALREADY_EXISTS':
        return isVi
          ? 'Email này đã tồn tại. Vui lòng chuyển sang tab Đăng nhập.'
          : 'Email already exists. Please sign in.';
      default:
        return (
          codeOrMsg ||
          (isVi
            ? 'Thao tác không thành công. Vui lòng thử lại sau.'
            : 'Operation failed. Please try again later.')
        );
    }
  };

  const saveTokenAndRedirect = async (tokenData: string | TokenData) => {
    const accessToken = typeof tokenData === 'string' ? tokenData : tokenData.accessToken;
    const refreshToken = typeof tokenData === 'object' ? tokenData.refreshToken : undefined;

    if (accessToken) {
      localStorage.setItem('brewlite_access_token', accessToken);
      localStorage.setItem('token', accessToken);

      document.cookie = 'bl_at=' + accessToken + '; path=/; max-age=604800; SameSite=Lax';
      if (refreshToken) {
        document.cookie = 'bl_rt=' + refreshToken + '; path=/; max-age=2592000; SameSite=Lax';
      }

      await fetch('/api/auth/set-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accessToken, refreshToken }),
      }).catch(() => null);
    }

    window.location.href = nextUrl;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    const endpoint = mode === 'login' ? '/api/v1/auth/login' : '/api/v1/auth/register';
    const payload =
      mode === 'login'
        ? { email, password }
        : {
            email,
            password,
            fullName: fullName.trim(),
            preferredLocale: currentLang,
          };

    try {
      let res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }).catch(() => null);

      if (!res) {
        const proxyUrl = mode === 'login' ? '/api/auth/login' : '/api/auth/register';
        res = await fetch(proxyUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }

      const json = await res.json();

      if (res.ok) {
        await saveTokenAndRedirect(json.data || json);
      } else {
        const rawCode = json.error?.code || json.error?.message || json.code || json.message;
        setErrorMsg(formatErrorMessage(rawCode));
      }
    } catch {
      setErrorMsg(
        isVi
          ? 'Không thể kết nối đến máy chủ xác thực.'
          : 'Could not connect to authentication server.',
      );
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    setErrorMsg('');

    try {
      const idToken = await loginWithGooglePopup();
      let res = await fetch('/api/v1/auth/firebase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      }).catch(() => null);

      if (!res) {
        res = await fetch('/api/auth/firebase', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idToken }),
        });
      }

      const json = await res.json();
      if (res.ok) {
        await saveTokenAndRedirect(json.data || json);
      } else {
        const msg = json.error?.code || json.error?.message || json.code || json.message;
        setErrorMsg(formatErrorMessage(msg));
      }
    } catch (err) {
      const e = err as { code?: string; message?: string };
      if (e.code === 'auth/popup-closed-by-user') {
        setErrorMsg(
          isVi ? 'Bạn đã đóng cửa sổ đăng nhập Google.' : 'Google sign-in popup was closed.',
        );
      } else {
        setErrorMsg(
          e.message ||
            (isVi ? 'Lỗi khi mở cửa sổ đăng nhập Google.' : 'Error opening Google sign-in window.'),
        );
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto py-6 px-4 space-y-5 pb-28 relative min-h-screen">
      {/* Nút chuyển đổi ngôn ngữ ở góc trên */}
      <div className="flex justify-end pt-2">
        <div className="bg-[#4E3427] text-white text-[11px] font-bold px-3 py-1 rounded-full flex items-center gap-1.5 shadow-xs select-none">
          <button
            type="button"
            onClick={() => switchLanguage('vi')}
            className={`transition ${currentLang === 'vi' ? 'opacity-100 font-black underline' : 'opacity-60 hover:opacity-100 cursor-pointer'}`}
          >
            VI
          </button>
          <span className="opacity-40">|</span>
          <button
            type="button"
            onClick={() => switchLanguage('en')}
            className={`transition ${currentLang === 'en' ? 'opacity-100 font-black underline' : 'opacity-60 hover:opacity-100 cursor-pointer'}`}
          >
            EN
          </button>
        </div>
      </div>

      {/* Logo bấm về trang chủ */}
      <div className="text-center space-y-2">
        <Link href="/" className="inline-flex flex-col items-center group cursor-pointer">
          <div className="w-12 h-12 rounded-full bg-[#4E3427] group-hover:bg-[#3D281E] flex items-center justify-center text-white mb-1 shadow-xs transition">
            <svg className="w-6 h-6 fill-current" viewBox="0 0 24 24">
              <path d="M20 3H4v10c0 2.21 1.79 4 4 4h6c2.21 0 4-1.79 4-4v-3h2c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 5h-2V5h2v3zM4 19h16v2H4z" />
            </svg>
          </div>
          <span className="text-xs font-black tracking-tight text-[#2B1E16] group-hover:underline">
            BrewLite
          </span>
        </Link>
        <h1 className="text-xl font-black text-[#2B1E16]">
          {mode === 'login'
            ? isVi
              ? 'Đăng nhập BrewLite'
              : 'Sign in to BrewLite'
            : isVi
              ? 'Đăng ký tài khoản'
              : 'Create Account'}
        </h1>
        <p className="text-xs text-[#8C7E74]">
          {isVi
            ? 'Đăng nhập để theo dõi đơn hàng và tích lũy điểm'
            : 'Sign in to track orders and earn loyalty points'}
        </p>
      </div>

      <div className="flex bg-[#EFE4D2] p-1 rounded-xl">
        <button
          type="button"
          onClick={() => {
            setMode('login');
            setErrorMsg('');
          }}
          className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition ${
            mode === 'login'
              ? 'bg-[#4E3427] text-white shadow-xs'
              : 'text-[#4E3427] hover:bg-white/40'
          }`}
        >
          {isVi ? 'Đăng nhập' : 'Sign In'}
        </button>
        <button
          type="button"
          onClick={() => {
            setMode('register');
            setErrorMsg('');
          }}
          className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition ${
            mode === 'register'
              ? 'bg-[#4E3427] text-white shadow-xs'
              : 'text-[#4E3427] hover:bg-white/40'
          }`}
        >
          {isVi ? 'Đăng ký mới' : 'Sign Up'}
        </button>
      </div>

      <form
        onSubmit={handleSubmit}
        className="bg-[#FDFBF9] border border-[#E8DEC8] rounded-3xl p-6 space-y-4 shadow-xs"
      >
        {errorMsg && (
          <div className="bg-[#FAF0F0] border border-[#F2C0C0] text-[#C8382B] text-xs font-semibold rounded-xl p-3 leading-relaxed">
            {errorMsg}
          </div>
        )}

        {mode === 'register' && (
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-[#2B1E16]">
              {isVi ? 'Họ và tên' : 'Full Name'}
            </label>
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Huỳnh Võ"
              className="w-full px-4 py-2.5 rounded-xl border border-[#D5C7B7] bg-white text-xs font-medium text-[#2B1E16] focus:outline-none focus:border-[#4E3427]"
            />
          </div>
        )}

        <div className="space-y-1.5">
          <label className="text-xs font-bold uppercase tracking-wider text-[#2B1E16]">Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="huynh.dev@brewlite.test"
            className="w-full px-4 py-2.5 rounded-xl border border-[#D5C7B7] bg-white text-xs font-medium text-[#2B1E16] focus:outline-none focus:border-[#4E3427]"
          />
        </div>

        <div className="space-y-1.5">
          <div className="flex justify-between items-center">
            <label className="text-xs font-bold uppercase tracking-wider text-[#2B1E16]">
              {isVi ? 'Mật khẩu' : 'Password'}
            </label>
            {mode === 'register' && (
              <span className="text-[10px] text-[#8C7E74]">
                {isVi ? 'Tối thiểu 8 ký tự' : 'At least 8 characters'}
              </span>
            )}
          </div>
          <input
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password123@"
            className="w-full px-4 py-2.5 rounded-xl border border-[#D5C7B7] bg-white text-xs font-medium text-[#2B1E16] focus:outline-none focus:border-[#4E3427]"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 bg-[#4E3427] hover:bg-[#3D281E] disabled:opacity-50 text-white font-bold rounded-xl text-xs sm:text-sm shadow-sm transition"
        >
          {loading
            ? isVi
              ? 'Đang xử lý...'
              : 'Processing...'
            : mode === 'login'
              ? isVi
                ? 'Đăng nhập'
                : 'Sign In'
              : isVi
                ? 'Tạo tài khoản'
                : 'Create Account'}
        </button>

        <div className="relative py-1">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-[#E8DEC8]"></div>
          </div>
          <div className="relative flex justify-center text-[10px] uppercase font-bold">
            <span className="bg-[#FDFBF9] px-2 text-[#8C7E74]">{isVi ? 'Hoặc' : 'Or'}</span>
          </div>
        </div>

        <button
          type="button"
          onClick={handleGoogleLogin}
          className="w-full py-2.5 bg-white border border-[#D5C7B7] hover:bg-gray-50 text-[#2B1E16] font-semibold rounded-xl text-xs flex items-center justify-center gap-2 shadow-xs transition"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
            />
          </svg>
          <span>{isVi ? 'Tiếp tục với Google' : 'Continue with Google'}</span>
        </button>
      </form>
    </div>
  );
}
