import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const gatewayUrl = process.env.GATEWAY_URL || 'http://127.0.0.1:23100';

    const res = await fetch(`${gatewayUrl}/api/v1/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data = await res.json();

    if (!res.ok) {
      return NextResponse.json(data, { status: res.status });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Proxy login error:', error);
    return NextResponse.json(
      { error: { message: 'Lỗi kết nối từ Web Server tới Gateway.' } },
      { status: 500 }
    );
  }
}