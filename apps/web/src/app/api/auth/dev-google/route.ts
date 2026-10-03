import { NextResponse } from 'next/server';

// Route chỉ dành cho môi trường dev: tự đăng nhập bằng tài khoản mẫu.
export async function POST(request: Request) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: { message: 'Not found' } }, { status: 404 });
  }

  try {
    const { email = 'huynh@brewlite.test' } = await request.json().catch(() => ({}));
    const emulatorHost = process.env.FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:29099';
    const gatewayUrl = process.env.GATEWAY_URL || 'http://127.0.0.1:23100';

    // 1. Lấy idToken trực tiếp từ Firebase Emulator REST API
    let idToken = '';
    try {
      const emulatorRes = await fetch(
        `http://${emulatorHost}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=fake-api-key`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password: 'password123', returnSecureToken: true }),
        },
      );

      if (emulatorRes.ok) {
        const emulatorData = await emulatorRes.json();
        idToken = emulatorData.idToken;
      }
    } catch {
      // Bỏ qua nếu emulator chưa bật
    }

    // 2. Gửi idToken sang Gateway /api/v1/auth/firebase
    if (idToken) {
      const gatewayRes = await fetch(`${gatewayUrl}/api/v1/auth/firebase`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      });

      const gatewayData = await gatewayRes.json();
      if (gatewayRes.ok) {
        return NextResponse.json(gatewayData);
      }
    }

    // 3. Fallback Dev Mode: đăng nhập bằng tài khoản mẫu
    const fallbackRes = await fetch(`${gatewayUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'huynh@brewlite.test', password: 'Password123@' }),
    });

    const fallbackData = await fallbackRes.json();
    return NextResponse.json(fallbackData, { status: fallbackRes.status });
  } catch {
    return NextResponse.json({ error: { message: 'Lỗi xác thực Google Dev' } }, { status: 500 });
  }
}
